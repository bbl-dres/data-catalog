"""Check the delivered file and preserved V1; save measured QA and export frames."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[2]
BIN=Path(os.environ["LOCALAPPDATA"])/"Programs/Shotcut"
VIDEO=PROJECT/"assets/bbl-datenkatalog-v2.mp4"
SCRATCH=Path(os.environ["TEMP"])/"bbl-video-review"


def run(args):
    return subprocess.run([str(a) for a in args],capture_output=True,text=True,check=True)


def main():
    probe=json.loads(run([BIN/"ffprobe.exe","-v","error","-show_entries","format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels,nb_frames","-of","json",VIDEO]).stdout)
    v,a=probe["streams"]
    assert [v["codec_name"],v["width"],v["height"],v["r_frame_rate"],int(v["nb_frames"])]==["h264",1920,1080,"30/1",2460]
    assert a["codec_name"]=="aac" and a["channels"]==1 and a["sample_rate"]=="48000"
    assert float(probe["format"]["duration"])==82
    decoded=run([BIN/"ffmpeg.exe","-v","error","-i",VIDEO,"-f","null","-"])
    assert not decoded.stderr.strip(),decoded.stderr
    measure=run([BIN/"ffmpeg.exe","-hide_banner","-i",VIDEO,"-vn","-af","loudnorm=I=-19:TP=-2:LRA=7:print_format=json","-f","null","-"])
    stats=json.JSONDecoder().raw_decode(measure.stderr[measure.stderr.rfind("{"):])[0]
    assert float(stats["input_tp"])<=-1.5
    assert -19.5<=float(stats["input_i"])<=-18.5
    manifest=json.loads((PROJECT/"docs/video/2026-09-15-landscape/version-1.json").read_text(encoding="utf-8"))
    for name,info in manifest["files"].items():
        b=(PROJECT/name).read_bytes()
        assert len(b)==info["bytes"] and hashlib.sha256(b).hexdigest()==info["sha256"],f"V1 changed: {name}"
    xml=ET.parse(HERE/"bbl-datenkatalog-v2.mlt")
    resources=[p.text for p in xml.findall(".//property[@name='resource']") if not p.text.startswith("#")]
    assert all((HERE/p).is_file() for p in resources)
    vtt=(PROJECT/"assets/bbl-datenkatalog-v2.de.vtt").read_text(encoding="utf-8")
    assert vtt.startswith("WEBVTT") and vtt.count(" --> ")==28
    frames=[2,6,10,18.5,25,31,39,44,48,50,51.5,55,62,68,77]
    sheet=Image.new("RGB",(1440,1500),"white");d=ImageDraw.Draw(sheet)
    font=ImageFont.truetype(str(PROJECT/"assets/fonts/pdf/NotoSans-Regular.ttf"),18)
    for i,t in enumerate(frames):
        still=SCRATCH/f"v2-export-{t}.png"
        run([BIN/"ffmpeg.exe","-v","error","-y","-ss",t,"-i",VIDEO,"-frames:v",1,still])
        im=Image.open(still).convert("RGB").resize((480,270),Image.Resampling.LANCZOS)
        sheet.paste(im,((i%3)*480,(i//3)*300))
        d.text(((i%3)*480+12,(i//3)*300+272),f"{t:g} s · exported MP4",font=font,fill="#1c2834")
    sheet.save(HERE/"export-review.jpg",quality=92)
    report=dict(video=probe,full_decode="passed",audio=dict(integrated_lufs=float(stats["input_i"]),true_peak_dbtp=float(stats["input_tp"]),loudness_range_lu=float(stats["input_lra"])),v1_preservation=dict(files_checked=len(manifest["files"]),all_sha256_unchanged=True),shotcut_resources=len(resources),subtitle_cues=28,export_frames_seconds=frames)
    (HERE/"qa.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(json.dumps(report,indent=2))


if __name__=="__main__":main()
