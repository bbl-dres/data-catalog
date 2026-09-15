"""Build V2 independently of the preserved V1. Requires Pillow, numpy and Shotcut.

All narration is sentence-level editing of the user's existing Corinna recordings.
UI images are actual captures from the local prototype, with editorial crops/highlights.
"""
from pathlib import Path
from functools import lru_cache
import argparse
import json
import math
import os
import re
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ASSETS = PROJECT / "assets"
GRAPHICS = HERE / "graphics"
W, H, FPS, SR = 1920, 1080, 30, 48000
INK, BLUE, RED = "#1c2834", "#24588c", "#cf2932"
MUTED, PALE, LINE, WHITE = "#536576", "#edf3f7", "#d5e0e9", "#ffffff"
# Source times below refer to the old source FILMS, matching their checked SRTs.
# Audio FLAC files begin 0.6 s / 20 s later than the source films.
EDITS = [
    dict(id="hook", source="short", a=.6, b=12.30, cues=[1,2,3,4,5], gap=.30),
    dict(id="metadata", source="short", a=46.80, b=55.30, cues=[18,19,20], gap=.35),
    dict(id="meaning", source="explanation", a=20, b=31.15, cues=[7,8,9,10], gap=.35),
    dict(id="structure", source="short", a=37.64, b=46.64, cues=[15,16,17], gap=.30),
    dict(id="values", source="explanation", a=59.45, b=63.30, cues=[20], gap=.45),
    dict(id="demo", source="short", a=12.36, b=30.98, cues=[6,7,8,9,10,11,12], gap=.35),
    dict(id="contacts", source="short", a=31.16, b=37.60, cues=[13,14], gap=.35),
    dict(id="close", source="short", a=55.32, b=62.72, cues=[21,22,23], gap=2.15),
]
cursor = .45
for clip in EDITS:
    clip["start"] = round(cursor, 3)
    clip["end"] = round(cursor + clip["b"] - clip["a"], 3)
    cursor = clip["end"] + clip["gap"]
DURATION = math.ceil(cursor)
N = DURATION * FPS
SEG = {c["id"]: c for c in EDITS}
tracks = {"Hintergrund und Titel": [], "Durchgehendes Beispiel": [], "Elemente": [], "Akzente": []}


@lru_cache(None)
def font(size, bold=False):
    return ImageFont.truetype(str(ASSETS / "fonts/pdf" / ("NotoSans-Bold.ttf" if bold else "NotoSans-Regular.ttf")), size)


class Canvas:
    def __init__(self):
        self.im = Image.new("RGBA", (W,H), (0,0,0,0))
        self.d = ImageDraw.Draw(self.im)

    def text(self,x,y,value,size=40,fill=INK,bold=False,anchor="la"):
        self.d.text((x,y),value,font=font(size,bold),fill=fill,anchor=anchor,spacing=14)

    def box(self,x,y,w,h,fill=WHITE,outline=None,radius=20,width=2):
        self.d.rounded_rectangle((x,y,x+w,y+h),radius,fill,outline,width)

    def line(self,points,fill=BLUE,width=4):
        self.d.line(points,fill,width,joint="curve")

    def building(self,x,y,s=1):
        def b(a,b,c,d,fill,outline=None): self.box(x+a*s,y+b*s,c*s,d*s,fill,outline,3)
        b(8,210,290,16,"#d8e2ec"); b(154,58,118,152,"#d6e3ee",BLUE)
        b(30,4,142,206,WHITE,BLUE); b(20,0,162,15,BLUE)
        for row in range(3):
            for col in range(3): b(49+col*37,34+row*46,19,25,"#8ba9c5")
        for row in range(3):
            for col in range(2): b(190+col*39,79+row*42,18,23,"#9bb4c9")
        b(83,176,35,35,BLUE)

    def base(self,label,title):
        self.box(0,0,W,H,WHITE,radius=0)
        self.box(100,63,8,38,RED,radius=1)
        self.text(131,60,"BBL · DATENKATALOG",29,INK,True)
        self.text(1820,62,label,26,MUTED,anchor="ra")
        self.text(100,153,title,64,INK,True)

    def capture(self,name,crop,box):
        im=Image.open(HERE/"captures"/name).convert("RGBA").crop(crop)
        x,y,w,h=box
        scale=min(w/im.width,h/im.height)
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        self.im.alpha_composite(im,(round(x+(w-im.width)/2),round(y+(h-im.height)/2)))
        return (x+(w-im.width)/2,y+(h-im.height)/2,scale)


def add(track,name,c,start,end,fade=False):
    track={"Fond et titres":"Hintergrund und Titel","Exemple continu":"Durchgehendes Beispiel","Éléments":"Elemente","Accents":"Akzente"}.get(track,track)
    GRAPHICS.mkdir(exist_ok=True)
    c.im.save(GRAPHICS/(name+".png"),optimize=True)
    tracks[track].append(dict(id=name,start=round(start*FPS),end=round(end*FPS),fade=fade))


def graphics():
    meta=SEG["metadata"]["start"]-.12
    meaning=SEG["meaning"]["start"]-.12
    tech=SEG["structure"]["start"]-.12
    values=SEG["values"]["start"]-.12
    demo=SEG["demo"]["start"]-.15
    contacts=SEG["contacts"]["start"]-.15
    close=SEG["close"]["start"]-.15
    for name,start,end,label,title in [
        ("hook-bg",0,meta,"01 · EINE FRAGE","Was bedeutet «Baujahr»?"),
        ("metadata-bg",meta,meaning,"02 · DIE IDEE","Der Katalog beschreibt Daten."),
        ("diagram-bg",meaning,demo,"03 · DIE ZUSAMMENHÄNGE","Ein Begriff. Seine Zusammenhänge."),
    ]:
        c=Canvas();c.base(label,title)
        c.box(100,292,645,620,PALE,radius=28)
        add("Fond et titres",name,c,start,end)
    # The building stays in exactly the same position throughout the explanation.
    c=Canvas();c.building(250,408,1.12);c.text(422,695,"Gebäude",58,INK,True,"ma")
    add("Exemple continu","building-anchor",c,0,demo,True)
    c=Canvas();c.text(930,315,"Fertigstellung?",57,INK,True)
    c.box(890,292,930,187,None,LINE,24,3)
    add("Éléments","question-completion",c,3.0,meta,True)
    c=Canvas();c.text(930,548,"Letzte Renovation?",57,INK,True)
    c.box(890,525,930,187,None,LINE,24,3)
    add("Accents","question-renovation",c,4.75,meta,True)
    c=Canvas();c.text(920,804,"Begriffe gemeinsam klären.",42,BLUE,True)
    add("Éléments","hook-benefit",c,7.2,meta,True)
    c=Canvas();c.box(890,300,930,243,PALE)
    c.text(937,331,"Quellsysteme",47,INK,True)
    c.text(937,415,"Einzelne Gebäudedatensätze",36,MUTED)
    c.line([(940,488),(1740,488)],LINE,4)
    add("Éléments","source-data",c,meta,meaning,True)
    c=Canvas();c.box(890,583,930,286,INK)
    c.text(937,617,"Datenkatalog",47,WHITE,True)
    c.text(937,703,"Bedeutung · Struktur · Herkunft",35,"#e5edf4")
    c.text(937,782,"Informationen über Daten",39,WHITE,True)
    add("Accents","metadata-card",c,meta+4.85,meaning,True)
    c=Canvas();c.text(422,341,"Geschäftsobjekt",41,BLUE,True,"ma")
    c.text(422,795,"Unabhängig vom Quellsystem",31,MUTED,anchor="ma")
    add("Éléments","object-label",c,meaning,demo,True)
    c=Canvas();c.box(1060,292,760,205,PALE)
    c.text(1098,318,"Attribute",42,BLUE,True)
    c.text(1098,395,"Baujahr · Gebäude-ID · Fläche",36,INK)
    c.line([(755,433),(810,433),(810,391),(1040,391)],BLUE,4)
    c.text(810,327,"Eigenschaften",29,MUTED)
    add("Accents","attributes",c,meaning+5.72,demo,True)
    c=Canvas();c.box(1060,537,760,178,PALE)
    c.text(1098,561,"Tabellen und Felder",41,BLUE,True)
    c.text(1098,635,"Technische Struktur im Quellsystem",31,INK)
    add("Éléments","tables",c,tech,demo,True)
    c=Canvas();c.line([(755,610),(1040,610)],BLUE,4)
    c.text(892,642,"Dokumentierte\nBeziehung",28,MUTED,anchor="ma")
    add("Accents","documented-link",c,tech+4.8,demo,True)
    c=Canvas();c.box(1060,755,760,157,"#f9f0df")
    c.text(1098,777,"Wertelisten",38,INK,True)
    c.text(1098,840,"Zulässige Codes und Bedeutung",34,INK)
    add("Éléments","value-lists",c,values,demo,True)

    # Real interface, cut to the area needed for each action.
    search_end=demo+3.1
    list_start=demo+4.2
    answer_start=demo+6.3
    def shot(name,a,b,title,image,crop,box=(100,280,1720,650),highlight=None):
        c=Canvas();c.base("04 · IM KATALOG",title)
        c.box(98,277,1724,655,WHITE,LINE,12,2)
        xx,yy,scale=c.capture(image,crop,box)
        if highlight:
            hx,hy,hw,hh=highlight
            c.box(xx+(hx-crop[0])*scale,yy+(hy-crop[1])*scale,hw*scale,hh*scale,None,RED,6,4)
        c.text(100,955,"Aufnahmen aus dem Prototyp · 15. September 2026",25,MUTED)
        add("Fond et titres",name,c,a,b)
    shot("demo-search",demo,search_end,"1   Nach «Gebäude» suchen","02-search.png",(375,177,1227,445),highlight=(399,345,153,35))
    shot("demo-open",search_end,list_start,"2   Das Geschäftsobjekt öffnen","03-building.png",(375,140,1227,382))
    shot("demo-attributes",list_start,answer_start,"3   Attribute / Baujahr","04-attribute-list.png",(375,325,1227,615),highlight=(586,529,119,32))
    shot("demo-definition",answer_start,contacts,"4   Die Definition klärt die Frage","05-baujahr.png",(378,177,1050,297),(130,303,1660,320))
    c=Canvas();c.box(140,701,1640,163,PALE,radius=16)
    c.text(960,731,"Baujahr = Jahr der Fertigstellung",61,BLUE,True,"ma")
    add("Éléments","answer-summary",c,answer_start+1.2,contacts,True)
    shot("demo-contacts",contacts,close,"5   Die zuständige Fachstelle finden","05-baujahr.png",(378,365,1219,552),(130,306,1660,432))
    c=Canvas();c.text(100,805,"Für Rückfragen: «Verantwortlich»",50,BLUE,True)
    add("Éléments","contacts-summary",c,contacts+.25,close,True)
    c=Canvas();c.base("05 · SELBST AUSPROBIEREN","Vom Begriff zur Klarheit.")
    c.text(100,357,"Suchen Sie einen Begriff",76,INK,True)
    c.text(100,459,"aus Ihrem Arbeitsalltag.",76,INK,True)
    c.box(100,622,101,6,RED,radius=0)
    c.text(100,683,"Zum Beispiel: Gebäude, Baujahr oder Fläche.",38,MUTED)
    c.text(100,876,"Prototyp · Ihre Fragen helfen bei der Weiterentwicklung.",29,MUTED)
    c.building(1500,410,1.0)
    add("Fond et titres","endcard",c,close,DURATION)


def tc(seconds,comma=False):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f"{h:02}:{m:02}:{s:02}{',' if comma else '.'}{ms:03}"


def captions():
    def parse_t(value):
        h,m,s=value.replace(",",".").split(":");return int(h)*3600+int(m)*60+float(s)
    sources={}
    for source in ("short","explanation"):
        groups=re.split(r"\n\s*\n",(HERE/f"audio/source-{source}.srt").read_text(encoding="utf-8-sig").strip())
        sources[source]={}
        for group in groups:
            lines=group.splitlines();a,b=lines[1].split(" --> ")
            sources[source][int(lines[0])]=(parse_t(a),parse_t(b),"\n".join(lines[2:]))
    cues=[]
    for clip in EDITS:
        for i in clip["cues"]:
            a,b,t=sources[clip["source"]][i]
            cues.append((max(a,clip["a"])-clip["a"]+clip["start"],min(b,clip["b"])-clip["a"]+clip["start"],t))
    for i,(a,b,t) in enumerate(cues):
        assert 0<=a<b<=DURATION
        if i:assert cues[i-1][1]<=a+.001
    (ASSETS/"bbl-datenkatalog-v2.de.vtt").write_text("WEBVTT\n\n"+"\n\n".join(f"{tc(a)} --> {tc(b)}\n{t}" for a,b,t in cues)+"\n",encoding="utf-8",newline="\n")
    (HERE/"bbl-datenkatalog-v2.de.srt").write_text("\n\n".join(f"{i+1}\n{tc(a,True)} --> {tc(b,True)}\n{t}" for i,(a,b,t) in enumerate(cues))+"\n",encoding="utf-8",newline="\n")
    (HERE/"sprechertext.txt").write_text("\n\n".join(t.replace("\n"," ") for a,b,t in cues)+"\n",encoding="utf-8",newline="\n")
    return cues


def run(args,**kwargs):
    return subprocess.run([str(v) for v in args],check=True,**kwargs)


def build_audio(ffmpeg,scratch):
    audio={}
    for s in ("short","explanation"):
        p=run([ffmpeg,"-v","error","-i",HERE/f"audio/corinna-{s}.flac","-f","f32le","-ar",SR,"-ac",1,"-"],capture_output=True)
        audio[s]=np.frombuffer(p.stdout,dtype="<f4")
    out=np.zeros(DURATION*SR,dtype="<f4")
    for clip in EDITS:
        offset=.6 if clip["source"]=="short" else 20
        a=round((clip["a"]-offset)*SR);b=round((clip["b"]-offset)*SR)
        piece=audio[clip["source"]][a:b].copy()
        # Ten-millisecond edge fades suppress edit clicks without touching words.
        fade=round(.01*SR)
        piece[:fade]*=np.linspace(0,1,fade);piece[-fade:]*=np.linspace(1,0,fade)
        start=round(clip["start"]*SR);out[start:start+len(piece)]=piece
    raw=scratch/"v2-assembly.f32";raw.write_bytes(out.tobytes())
    common=[ffmpeg,"-hide_banner","-y","-f","f32le","-ar",SR,"-ac",1,"-i",raw]
    measured=run(common+["-af","loudnorm=I=-19:TP=-2:LRA=7:print_format=json","-f","null","-"],capture_output=True,text=True)
    stats=json.JSONDecoder().raw_decode(measured.stderr[measured.stderr.rfind("{"):])[0]
    filt=("loudnorm=I=-19:TP=-2:LRA=7:linear=true:"+":".join(f"{k}={stats[v]}" for k,v in [("measured_I","input_i"),("measured_TP","input_tp"),("measured_LRA","input_lra"),("measured_thresh","input_thresh"),("offset","target_offset")])+":print_format=json")
    processed=run(common+["-af",filt,"-ar",SR,"-c:a","flac",HERE/"audio/narration-v2.flac"],capture_output=True,text=True)
    (HERE/"audio/normalization.json").write_text(json.dumps(dict(first_pass=stats,second_pass=json.JSONDecoder().raw_decode(processed.stderr[processed.stderr.rfind("{"):])[0],target_note="Mono programme, -19 LUFS, -2 dBTP before AAC. Final AAC is measured separately."),indent=2)+"\n",encoding="utf-8",newline="\n")


def prop(parent,k,v): ET.SubElement(parent,"property",name=k).text=str(v)


def mlt():
    root=ET.Element("mlt",producer="tractor",version="7.38.0",LC_NUMERIC="C")
    ET.SubElement(root,"profile",description="HD 1080p30",width=str(W),height=str(H),frame_rate_num=str(FPS),frame_rate_den="1",progressive="1",sample_aspect_num="1",sample_aspect_den="1",display_aspect_num="16",display_aspect_den="9",colorspace="709")
    p=ET.SubElement(root,"producer",id="white");prop(p,"resource",WHITE);prop(p,"mlt_service","color")
    bg=ET.SubElement(root,"playlist",id="background");ET.SubElement(bg,"entry",producer="white",**{"in":"0","out":str(N-1)})
    for items in tracks.values():
        for it in items:
            dur=it["end"]-it["start"]
            p=ET.SubElement(root,"producer",id=it["id"],**{"in":"0","out":str(dur-1)})
            for k,v in [("resource",f"graphics/{it['id']}.png"),("mlt_service","qimage"),("length",dur),("eof","pause"),("aspect_ratio",1),("seekable",1),("shotcut:caption",it["id"])]:prop(p,k,v)
            if it["fade"]:
                f=ET.SubElement(p,"filter",**{"in":"0","out":"8"})
                for k,v in [("mlt_service","brightness"),("shotcut:filter","fadeInBrightness"),("alpha","0=0;8=1"),("level",1),("shotcut:animIn",9)]:prop(f,k,v)
    p=ET.SubElement(root,"chain",id="voice")
    for k,v in [("resource","audio/narration-v2.flac"),("mlt_service","avformat"),("video_index",-1),("audio_index",0),("shotcut:caption","Corinna · V2 Schnitt")]:prop(p,k,v)
    pl=ET.SubElement(root,"playlist",id="main_bin");prop(pl,"xml_retain",1)
    pl=ET.SubElement(root,"playlist",id="audio");prop(pl,"shotcut:name","A1 · Corinna");prop(pl,"shotcut:audio",1)
    ET.SubElement(pl,"entry",producer="voice",**{"in":"0","out":str(N-1)})
    # Overlapping graphical elements each receive an editable video track.
    # Pack compatible layers; preserve insertion order for compositing.
    packed=[]
    for group,items in tracks.items():
        lanes=[]
        for it in items:
            lane=next((lane for lane in lanes if all(it["start"]>=x["end"] or it["end"]<=x["start"] for x in lane)),None)
            if lane is None:lane=[];lanes.append(lane)
            lane.append(it)
        for lane in lanes:packed.append((group,lane))
    for i,(name,lane) in enumerate(packed):
        pl=ET.SubElement(root,"playlist",id=f"v{i}");prop(pl,"shotcut:name",f"V{i+1} · {name}");prop(pl,"shotcut:video",1)
        end=0
        for it in sorted(lane,key=lambda x:x["start"]):
            if it["start"]>end:ET.SubElement(pl,"blank",length=str(it["start"]-end))
            ET.SubElement(pl,"entry",producer=it["id"],**{"in":"0","out":str(it["end"]-it["start"]-1)})
            end=it["end"]
        if end<N:ET.SubElement(pl,"blank",length=str(N-end))
    tr=ET.SubElement(root,"tractor",id="tractor",shotcut="1",**{"in":"0","out":str(N-1)})
    prop(tr,"shotcut",1);prop(tr,"shotcut:name","BBL-Datenkatalog · Version 2")
    prop(tr,"shotcut:projectAudioChannels",1)
    prop(tr,"shotcut:projectNotes","Separate V2. Real prototype captures; edited existing Corinna narration. Do not overwrite V1. Regenerate artwork/audio with build_video.py; timing and fades editable here. Import bbl-datenkatalog-v2.de.srt for subtitles.")
    ET.SubElement(tr,"track",producer="background");ET.SubElement(tr,"track",producer="audio",hide="video")
    for i in range(len(packed)):ET.SubElement(tr,"track",producer=f"v{i}",hide="audio")
    for i in range(1,len(packed)+2):
        t=ET.SubElement(tr,"transition",**{"in":"0","out":str(N-1)})
        props=[("mlt_service","mix" if i==1 else "qtblend"),("a_track",0),("b_track",i),("always_active",1)]
        props += [("sum",1)] if i==1 else [("compositing",0)]
        for k,v in props:prop(t,k,v)
    ET.indent(root,space="  ");ET.ElementTree(root).write(HERE/"bbl-datenkatalog-v2.mlt",encoding="utf-8",xml_declaration=True)


def review_images():
    moments=[2,6,10,17,25,31,39,44,48,51,54,59,68,77,81]
    sheet=Image.new("RGB",(1440,5*300),WHITE);d=ImageDraw.Draw(sheet)
    for i,sec in enumerate(moments):
        frame=Image.new("RGBA",(W,H),WHITE)
        for items in tracks.values():
            for it in items:
                if it["start"]<=sec*FPS<it["end"]:frame.alpha_composite(Image.open(GRAPHICS/f"{it['id']}.png"))
        if sec==6:frame.convert("RGB").save(ASSETS/"bbl-datenkatalog-v2-poster.jpg",quality=92)
        sheet.paste(frame.convert("RGB").resize((480,270),Image.Resampling.LANCZOS),((i%3)*480,(i//3)*300))
        d.text(((i%3)*480+12,(i//3)*300+272),tc(sec),font=font(18),fill=INK)
    sheet.save(HERE/"storyboard.jpg",quality=92)


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--render",action="store_true");parser.add_argument("--audio",action="store_true")
    parser.add_argument("--shotcut",type=Path,default=Path(os.environ["LOCALAPPDATA"])/"Programs/Shotcut")
    parser.add_argument("--scratch",type=Path,default=Path(os.environ["TEMP"])/"bbl-video-review")
    args=parser.parse_args();args.scratch.mkdir(exist_ok=True,parents=True)
    graphics();cues=captions();mlt();review_images()
    (HERE/"timeline.json").write_text(json.dumps(dict(duration=DURATION,fps=FPS,edits=EDITS,captions=len(cues),tracks=tracks),ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    if args.audio or not (HERE/"audio/narration-v2.flac").exists():build_audio(args.shotcut/"ffmpeg.exe",args.scratch)
    print(f"Built V2: {DURATION} seconds, {len(cues)} subtitle cues",flush=True)
    if args.render:
        silent=args.scratch/"v2-picture.mp4"
        with open(args.scratch/"v2-render.log","w",encoding="utf-8") as log:
            run([args.shotcut/"melt.exe","bbl-datenkatalog-v2.mlt","-consumer",f"avformat:{silent}","vcodec=libx264","crf=19","preset=fast","pix_fmt=yuv420p","an=1","movflags=+faststart","real_time=-4","threads=4"],cwd=HERE,env={**os.environ,"QT_QPA_PLATFORM":"offscreen","LC_NUMERIC":"C"},stdout=log,stderr=log)
        run([args.shotcut/"ffmpeg.exe","-v","warning","-y","-i",silent,"-i",HERE/"audio/narration-v2.flac","-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","160k","-ar",SR,"-ac",1,"-movflags","+faststart","-metadata","title=Wie der BBL-Datenkatalog funktioniert - Version 2","-metadata:s:a:0","language=deu",ASSETS/"bbl-datenkatalog-v2.mp4"])
        print("Rendered assets/bbl-datenkatalog-v2.mp4",flush=True)


if __name__=="__main__":main()
