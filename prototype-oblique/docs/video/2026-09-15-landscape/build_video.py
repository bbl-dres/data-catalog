"""Build the landscape adaptation of the user-supplied NotebookLM explainer.

Python + Pillow. Shotcut's melt/ffmpeg render the editable timeline. No TTS,
remote media processing, AI imagery, or cropping of the portrait original.
"""
from pathlib import Path
from functools import lru_cache
import argparse
import json
import os
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ASSETS = PROJECT / "assets"
GRAPHICS = HERE / "graphics"
FPS, W, H, DURATION = 30, 1920, 1080, 76
N = FPS * DURATION
INK, MUTED, BLUE, RED = "#1c2834", "#596978", "#24588c", "#d8232a"
PALE, LINE, WHITE = "#f0f4f7", "#d9e2e9", "#ffffff"
tracks = {"Hintergrund und Kapitel": [], "Diagramme": [], "Ergänzungen": [], "Akzente": []}


@lru_cache(None)
def font(size, bold=False):
    return ImageFont.truetype(str(ASSETS / "fonts/pdf" / ("NotoSans-Bold.ttf" if bold else "NotoSans-Regular.ttf")), size)


class Canvas:
    def __init__(self):
        self.im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def text(self, x, y, value, size=36, fill=INK, bold=False, anchor="la"):
        self.d.text((x, y), value, font=font(size, bold), fill=fill, anchor=anchor, spacing=15)

    def box(self, x, y, w, h, fill=WHITE, outline=None, radius=20, width=2):
        self.d.rounded_rectangle((x, y, x+w, y+h), radius, fill, outline, width)

    def line(self, points, fill=BLUE, width=4):
        self.d.line(points, fill, width, joint="curve")

    def panel(self, x, y, w, h, fill=WHITE, outline=LINE):
        self.box(x+2, y+8, w, h, "#e4ebf0")
        self.box(x, y, w, h, fill, outline)

    def chip(self, x, y, label, fill="#e6edf6", color=BLUE, size=25):
        w = self.d.textlength(label, font(size, True)) + 40
        self.box(x, y, w, 52, fill, radius=26)
        self.text(x+20, y+9, label, size, color, True)

    def arrow(self, x1, y1, x2, y2, fill=BLUE):
        import math
        angle = math.atan2(y2-y1, x2-x1)
        self.line([(x1,y1),(x2,y2)],fill,5)
        for a in (-.55,.55):
            self.line([(x2-17*math.cos(angle+a),y2-17*math.sin(angle+a)),(x2,y2)],fill,5)

    def building(self, x, y, s=1):
        def b(a,b,c,d,fill,outline=None): self.box(x+a*s,y+b*s,c*s,d*s,fill,outline,radius=3)
        b(8,210,290,16,"#d8e2ec")
        b(154,58,118,152,"#d6e3ee",BLUE)
        b(30,4,142,206,"#ffffff",BLUE)
        b(20,0,162,15,BLUE)
        for row in range(3):
            for col in range(3): b(49+col*37,34+row*46,19,25,"#8ba9c5")
        for row in range(3):
            for col in range(2): b(190+col*39,79+row*42,18,23,"#9bb4c9")
        b(83,176,35,35,BLUE)

    def system(self, x, y, title, subtitle, w=390, table=False):
        self.panel(x,y,w,160)
        self.box(x+24,y+30,58,55,"#e6edf6",BLUE,6)
        self.line([(x+35,y+48),(x+70,y+48)],BLUE,3)
        self.line([(x+35,y+61),(x+70,y+61)],BLUE,3)
        self.text(x+107,y+26,title,36,INK,True)
        self.text(x+107,y+82,subtitle,27,MUTED)
        if table:
            self.panel(x,y+178,w,112)
            self.text(x+25,y+194,"Datentabelle",28,BLUE,True)
            for i in range(3): self.line([(x+25+i*110,y+251),(x+111+i*110,y+251)],LINE,5)

    def catalog(self,x,y,w=500,h=152):
        self.panel(x,y,w,h,INK,INK)
        self.box(x+30,y+34,7,66,RED,radius=2)
        self.text(x+61,y+25,"Datenkatalog",43,WHITE,True)
        self.text(x+61,y+89,"beschreibt und verknüpft",27,"#d5e3ee")


def add(track, name, canvas, start, end, fade=False, move=False):
    GRAPHICS.mkdir(parents=True,exist_ok=True)
    canvas.im.save(GRAPHICS/(name+".png"), optimize=True)
    tracks[track].append(dict(id=name,start=round(start*FPS),end=round(end*FPS),fade=fade,move=move))


CHAPTERS = [
    (0,7.3,"01 · DIE IDEE",["Daten verstehen.","Zusammenhänge", "sehen."], ["Wie funktioniert ein Katalog", "ohne eigene Gebäudedaten?"]),
    (7.3,13.8,"01 · DIE AUSGANGSLAGE",["Viele Systeme.","Eine Frage."],["Wo finde ich die Information,", "die ich brauche?"]),
    (13.8,17.9,"02 · DER BEGRIFF",["Ein Beispiel:","das Gebäude."],["Ein gemeinsamer Begriff ist", "der Ausgangspunkt."]),
    (17.9,23.9,"02 · ZWEI PERSPEKTIVEN",["Was bedeutet es?", "Wo liegt es?"],["Fachliche Bedeutung und", "technische Speicherung", "werden getrennt beschrieben."]),
    (23.9,31.1,"02 · DAS GESCHÄFTSOBJEKT",["Ein Begriff.","Seine", "Eigenschaften."],["Die fachliche Definition gilt", "unabhängig vom Quellsystem."]),
    (31.1,39.5,"03 · DIE SYSTEME",["Ein Gebäude.","Mehrere", "Perspektiven."],["Finanzieller Wert in SAP.", "Geografische Fläche im GIS."]),
    (39.5,47.9,"03 · DIE VERBINDUNGEN",["Der Katalog", "verbindet."],["Vom Geschäftsobjekt zu den", "dokumentierten Tabellen", "in den Quellsystemen."]),
    (47.9,58.4,"04 · DIE WERTELISTEN",["Dieselbe", "Bedeutung.", "Derselbe Code."],["Wertelisten beschreiben", "zulässige Codes und", "ihre gemeinsame Bedeutung."]),
    (58.4,64.9,"05 · DIE METADATEN",["Wissen über", "Daten."],["Die eigentlichen Datensätze", "bleiben in den Quellsystemen."]),
    (64.9,71,"05 · DER NUTZEN",["Suchen.","Verstehen.","Quelle finden."],["Definition und führendes System", "im Katalog nachschlagen."]),
]


def build_graphics():
    for i,(start,end,label,title,body) in enumerate(CHAPTERS):
        c=Canvas(); c.box(0,0,W,H,WHITE,radius=0)
        c.box(790,168,1030,699,PALE,radius=32)
        c.box(110,85,8,39,RED,radius=1)
        c.text(138,81,"BBL · DATENKATALOG",30,INK,True)
        c.text(1815,86,"KURZ ERKLÄRT",24,MUTED,anchor="ra")
        c.text(110,212,label,27,BLUE,True)
        for n,line in enumerate(title): c.text(106,279+87*n,line,66,INK,True)
        yy=320+87*len(title)
        c.box(110,yy,74,5,RED,radius=1)
        for n,line in enumerate(body): c.text(110,yy+41+47*n,line,32,MUTED)
        c.text(110,893,"Begriffe verstehen · Informationen finden",25,MUTED)
        c.text(1815,893,"Schematisches Beispiel",23,MUTED,anchor="ra")
        add("Hintergrund und Kapitel",f"chapter-{i:02}",c,start,end)

    # Opening: a catalog describes a building and relates it to sources.
    c=Canvas(); c.building(1150,267,1.1); c.text(1310,536,"Gebäude",48,INK,True,"ma")
    c.catalog(1050,635,525); add("Diagramme","opening",c,0,7.3,True)
    c=Canvas(); c.arrow(1310,599,1310,627); c.chip(895,433,"Bedeutung"); c.chip(1540,433,"Quellen")
    add("Ergänzungen","opening-links",c,3.8,7.3,True)

    c=Canvas(); c.system(868,253,"SAP","Finanzen",410); c.system(1332,417,"GIS","Geografie",410)
    c.system(898,609,"Weitere Systeme","Weitere Perspektiven",580)
    add("Diagramme","silos",c,7.3,13.8,True,True)
    c=Canvas(); c.text(1590,680,"?",98,RED,True); add("Ergänzungen","question",c,11.5,13.8,True)

    c=Canvas(); c.building(1091,282,1.65); c.text(1330,691,"Gebäude",56,INK,True,"ma")
    add("Diagramme","building",c,13.8,17.9,True,True)

    c=Canvas(); c.panel(844,280,438,475); c.building(924,329,.9)
    c.text(1063,573,"Bedeutung",38,INK,True,"ma"); c.text(1063,638,"Was ist ein Gebäude?",28,MUTED,anchor="ma")
    add("Diagramme","meaning",c,17.9,23.9,True)
    c=Canvas(); c.panel(1312,280,450,475); c.system(1340,340,"System","Tabellen und Felder",394)
    c.text(1537,573,"Speicherung",38,INK,True,"ma"); c.text(1537,638,"Wo sind die Daten?",28,MUTED,anchor="ma")
    add("Ergänzungen","storage",c,21.3,23.9,True,True)

    c=Canvas(); c.panel(886,249,847,551); c.building(940,320,1.04)
    c.text(1325,300,"Gebäude",46,INK,True)
    for n,txt in enumerate(["Baujahr","Fläche","Adresse"]):
        c.box(1325,383+n*83,343,63,PALE,radius=8); c.text(1350,394+n*83,txt,31)
    c.text(987,605,"Fachliche Eigenschaften",29,MUTED)
    add("Diagramme","properties",c,23.9,31.1,True)
    c=Canvas(); c.chip(1085,698,"Geschäftsobjekt",fill="#fbe7e8",color=RED,size=35)
    add("Ergänzungen","business-object",c,27.5,31.1,True,True)

    c=Canvas(); c.panel(1067,224,486,150); c.building(1090,244,.45); c.text(1255,250,"Gebäude",39,INK,True)
    c.text(1255,308,"Geschäftsobjekt",26,MUTED)
    c.system(846,490,"SAP","Finanzieller Wert",445); c.system(1320,490,"GIS","Geografische Fläche",445)
    add("Diagramme","perspectives",c,31.1,39.5,True)
    c=Canvas(); c.arrow(1250,393,1070,466); c.arrow(1370,393,1540,466)
    c.text(1309,740,"Zwei Sichten auf denselben Begriff",33,BLUE,True,"ma")
    add("Ergänzungen","perspective-lines",c,34.6,39.5,True)

    c=Canvas(); c.panel(1100,219,420,111); c.text(1310,240,"Gebäude",43,INK,True,"ma")
    c.catalog(1065,404,490,140); c.system(844,602,"SAP","Finanzen",445); c.system(1320,602,"GIS","Geografie",445)
    c.text(1068,790,"Datentabelle",28,BLUE,True,"ma"); c.text(1543,790,"Datentabelle",28,BLUE,True,"ma")
    add("Diagramme","bridge",c,39.5,47.9,True)
    c=Canvas(); c.arrow(1310,344,1310,390); c.arrow(1210,558,1067,588); c.arrow(1410,558,1543,588)
    add("Ergänzungen","bridge-lines",c,41.5,47.9,True)

    c=Canvas(); c.panel(1020,240,580,258)
    c.text(1310,267,"Werteliste",43,INK,True,"ma")
    c.line([(1054,341),(1566,341)],LINE,2)
    c.text(1055,363,"Code",30,BLUE,True); c.text(1260,363,"Bedeutung",30,BLUE,True)
    c.text(1055,423,"…",36,MUTED); c.text(1260,423,"Gebäudekategorie",30)
    c.system(846,617,"SAP","Gebäudekategorie",445); c.system(1320,617,"GIS","Gebäudekategorie",445)
    add("Diagramme","values",c,47.9,58.4,True)
    c=Canvas(); c.arrow(1200,515,1067,595); c.arrow(1420,515,1543,595)
    c.chip(904,545,"gleicher Code",size=28); c.chip(1410,545,"gleicher Code",size=28)
    add("Ergänzungen","same-code",c,53.8,58.4,True,True)

    c=Canvas(); c.catalog(1040,250,545)
    c.text(1310,434,"Definitionen · Strukturen · Quellen",30,BLUE,True,"ma")
    c.system(846,591,"SAP","Eigentliche Datensätze",445); c.system(1320,591,"GIS","Eigentliche Datensätze",445)
    add("Diagramme","metadata",c,58.4,64.9,True)
    c=Canvas(); c.line([(859,529),(1751,529)],LINE,3)
    c.chip(1030,785,"Die Daten bleiben im Quellsystem",size=26)
    add("Ergänzungen","data-stays",c,61,64.9,True)

    c=Canvas(); c.panel(884,235,850,96)
    c.d.ellipse((922,259,956,293),outline=BLUE,width=4); c.line([(951,290),(966,305)],BLUE,4)
    c.text(993,256,"Gebäude",38,INK)
    c.panel(884,367,850,431); c.text(932,394,"Gebäude",49,INK,True)
    c.text(933,478,"Geschäftsobjekt",29,MUTED)
    c.line([(931,548),(1687,548)],LINE,2)
    c.text(933,577,"Definition",32,BLUE,True); c.text(933,637,"Führendes System",32,BLUE,True)
    c.text(933,715,"Beziehungen und Quellen nachschlagen",29,MUTED)
    add("Diagramme","search",c,64.9,71,True,True)

    c=Canvas(); c.box(0,0,W,H,WHITE,radius=0); c.box(210,227,9,58,RED,radius=2)
    c.text(252,226,"BBL · DATENKATALOG",40,INK,True)
    c.text(210,363,"Jetzt selbst entdecken.",84,INK,True)
    c.text(216,519,"Mit einem Begriff aus Ihrem Arbeitsalltag beginnen.",39,MUTED)
    c.box(216,634,1030,107,PALE,LINE,12); c.text(253,662,"Im Datenkatalog suchen",39,BLUE,True)
    c.building(1400,338,1.05)
    c.text(216,864,"Prototyp · nur zur Demonstration",28,MUTED)
    c.text(216,926,"Erklärung und Originalton: NotebookLM · Gestaltung: BBL-Datenkatalog-Prototyp",24,MUTED)
    add("Hintergrund und Kapitel","endcard",c,71,76)


CAPTIONS = [
    (.23,4.36,"Der Datenkatalog des BBL organisiert\ndas Immobilienmanagement."),
    (4.5,7.3,"Aber wie funktioniert das\nganz ohne eigene Daten?"),
    (7.49,11.55,"Verwaltungsdaten liegen verstreut\nin zahllosen isolierten IT-Systemen."),
    (11.8,13.65,"Die Suche danach ist extrem mühsam."),
    (13.83,17.75,"Nehmen wir als Beispiel einen völlig\nalltäglichen Begriff: das Gebäude."),
    (18.09,21.3,"Der Katalog trennt als Erstes\ndie inhaltliche Bedeutung streng"),
    (21.34,23.78,"von der technischen Speicherung\nin der Software."),
    (23.93,27.05,"Er beschreibt das Gebäude\nmit all seinen fachlichen Eigenschaften."),
    (27.5,30.93,"Diese rein inhaltliche Definition\nnennt man ein Geschäftsobjekt."),
    (31.13,35.33,"In der Realität existiert so ein Gebäude\naber in vielen Systemen gleichzeitig:"),
    (35.55,39.35,"als finanzieller Wert in SAP\nund als geografische Fläche im GIS."),
    (39.68,41.48,"Der Katalog fungiert hier als Brücke."),
    (41.6,44.15,"Er verbindet das abstrakte Geschäftsobjekt"),
    (44.27,47.75,"direkt mit den exakten Speicherorten,\nden sogenannten Datentabellen."),
    (48.2,50.4,"Damit alle Systeme dieselbe Sprache sprechen,"),
    (50.5,53.65,"festigt der Katalog diese Brücke\nmit verbindlichen Wertelisten."),
    (53.83,56.02,"So nutzt die Gebäudekategorie überall"),
    (56.05,58.35,"exakt denselben standardisierten Code."),
    (58.59,60.85,"All diese Verbindungen sind reine Metadaten."),
    (61,64.75,"Die sensiblen echten Daten bleiben immer\ngeschützt in den Quellsystemen."),
    (65.15,67,"Sucht eine Fachperson nun ein Gebäude,"),
    (67.07,70.75,"sieht sie sofort die exakte Definition\nund das führende Quellsystem."),
]


def timecode(seconds,comma=False):
    ms=round(seconds*1000); h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f"{h:02}:{m:02}:{s:02}{',' if comma else '.'}{ms:03}"


def build_captions():
    ASSETS.joinpath("bbl-datenkatalog-landscape.de.vtt").write_text("WEBVTT\n\n"+"\n\n".join(f"{timecode(a)} --> {timecode(b)}\n{t}" for a,b,t in CAPTIONS)+"\n",encoding="utf-8")
    HERE.joinpath("bbl-datenkatalog.de.srt").write_text("\n\n".join(f"{i+1}\n{timecode(a,True)} --> {timecode(b,True)}\n{t}" for i,(a,b,t) in enumerate(CAPTIONS))+"\n",encoding="utf-8")
    HERE.joinpath("sprechertext.txt").write_text("\n\n".join(t.replace("\n"," ") for _,_,t in CAPTIONS)+"\n",encoding="utf-8")


def prop(parent,k,v): ET.SubElement(parent,"property",name=k).text=str(v)


def build_mlt():
    root=ET.Element("mlt",producer="tractor",version="7.38.0",LC_NUMERIC="C")
    ET.SubElement(root,"profile",description="HD 1080p30",width=str(W),height=str(H),frame_rate_num=str(FPS),frame_rate_den="1",progressive="1",sample_aspect_num="1",sample_aspect_den="1",display_aspect_num="16",display_aspect_den="9",colorspace="709")
    black=ET.SubElement(root,"producer",id="black",**{"in":"0","out":str(N-1)})
    prop(black,"resource","#ffffff");prop(black,"mlt_service","color");prop(black,"eof","pause")
    bg=ET.SubElement(root,"playlist",id="background");ET.SubElement(bg,"entry",producer="black",**{"in":"0","out":str(N-1)})
    for items in tracks.values():
        for item in items:
            dur=item["end"]-item["start"]
            p=ET.SubElement(root,"producer",id=item["id"],**{"in":"0","out":str(dur-1)})
            for k,v in [("resource","graphics/"+item["id"]+".png"),("mlt_service","qimage"),("length",dur),("eof","pause"),("aspect_ratio",1),("seekable",1),("shotcut:caption",item["id"])]:prop(p,k,v)
            if item["move"]:
                f=ET.SubElement(p,"filter",**{"in":"0","out":str(dur-1)})
                for k,v in [("mlt_service","affine"),("shotcut:filter","affineSizePosition"),("transition.rect",f"0=0 16 1920 1080 1;12~=0 0 1920 1080 1;{dur-1}=0 0 1920 1080 1"),("transition.distort",1),("transition.fill",1)]:prop(f,k,v)
            if item["fade"]:
                f=ET.SubElement(p,"filter",**{"in":"0","out":"9"})
                for k,v in [("mlt_service","brightness"),("shotcut:filter","fadeInBrightness"),("alpha","0=0;9=1"),("level",1),("shotcut:animIn",10)]:prop(f,k,v)
    a=ET.SubElement(root,"chain",id="narration",**{"in":"0","out":str(N-1)})
    for k,v in [("resource","../../../assets/Wie_der_BBL-Datenkatalog_funktioniert.mp4"),("mlt_service","avformat"),("video_index",-1),("audio_index",1),("seekable",1),("shotcut:caption","NotebookLM · Originalton")]:prop(a,k,v)
    bin=ET.SubElement(root,"playlist",id="main_bin");prop(bin,"xml_retain",1)
    pl=ET.SubElement(root,"playlist",id="audio");prop(pl,"shotcut:name","A1 · NotebookLM Originalton");prop(pl,"shotcut:audio",1)
    ET.SubElement(pl,"entry",producer="narration",**{"in":"0","out":str(N-1)})
    for i,(name,items) in enumerate(tracks.items()):
        pl=ET.SubElement(root,"playlist",id=f"v{i}");prop(pl,"shotcut:name",f"V{i+1} · {name}");prop(pl,"shotcut:video",1)
        end=0
        for it in sorted(items,key=lambda z:z["start"]):
            assert it["start"]>=end,(name,it)
            if it["start"]>end:ET.SubElement(pl,"blank",length=str(it["start"]-end))
            ET.SubElement(pl,"entry",producer=it["id"],**{"in":"0","out":str(it["end"]-it["start"]-1)})
            end=it["end"]
        if end<N:ET.SubElement(pl,"blank",length=str(N-end))
    tr=ET.SubElement(root,"tractor",id="tractor",shotcut="1",**{"in":"0","out":str(N-1)})
    prop(tr,"shotcut",1);prop(tr,"shotcut:name","Wie der BBL-Datenkatalog funktioniert · 16:9")
    prop(tr,"shotcut:projectAudioChannels",2)
    prop(tr,"shotcut:projectNotes","76 s · 1920×1080 · 30 fps. Original NotebookLM audio. Rebuilt diagrams. Import bbl-datenkatalog.de.srt in Shotcut's Subtitles panel if required. Text and diagram shapes are edited in build_video.py; clip timing and fades are editable here.")
    ET.SubElement(tr,"track",producer="background");ET.SubElement(tr,"track",producer="audio",hide="video")
    for i in range(len(tracks)):ET.SubElement(tr,"track",producer=f"v{i}",hide="audio")
    t=ET.SubElement(tr,"transition",**{"in":"0","out":str(N-1)})
    for k,v in [("mlt_service","mix"),("a_track",0),("b_track",1),("always_active",1),("sum",1)]:prop(t,k,v)
    for i in range(2,2+len(tracks)):
        t=ET.SubElement(tr,"transition",**{"in":"0","out":str(N-1)})
        for k,v in [("mlt_service","qtblend"),("a_track",0),("b_track",i),("always_active",1),("compositing",0)]:prop(t,k,v)
    ET.indent(root,space="  ");ET.ElementTree(root).write(HERE/"bbl-datenkatalog-landscape.mlt",encoding="utf-8",xml_declaration=True)
    HERE.joinpath("timeline.json").write_text(json.dumps(dict(duration=DURATION,fps=FPS,chapters=[dict(start=a,end=b,title=c) for a,b,c,_,_ in CHAPTERS],tracks=tracks),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def run(args,**kwargs):
    print("Running:",args[0],flush=True)
    subprocess.run([str(a) for a in args],check=True,**kwargs)


def main():
    p=argparse.ArgumentParser();p.add_argument("--render",action="store_true");p.add_argument("--shotcut",type=Path,default=Path(os.environ.get("LOCALAPPDATA",""))/"Programs/Shotcut");p.add_argument("--scratch",type=Path,default=Path(os.environ.get("TEMP","/tmp"))/"bbl-video-review")
    args=p.parse_args()
    build_graphics();build_captions();build_mlt()
    print("Built graphics, Shotcut project, captions and timeline.",flush=True)
    # Poster and review contact sheet are built from the actual timeline layers.
    review=[]
    for sec in [3,10,16,22,29,37,45,56,63,69,73]:
        frame=Image.new("RGBA",(W,H),WHITE)
        for items in tracks.values():
            for item in items:
                if item["start"]<=sec*FPS<item["end"]:frame.alpha_composite(Image.open(GRAPHICS/(item["id"]+".png")))
        if sec==3:frame.convert("RGB").save(ASSETS/"bbl-datenkatalog-landscape-poster.jpg",quality=90)
        thumb=frame.convert("RGB");thumb.thumbnail((480,270));review.append(thumb)
    contact=Image.new("RGB",(1440,1080),WHITE)
    for i,img in enumerate(review):contact.paste(img,((i%3)*480,(i//3)*270))
    contact.save(HERE/"storyboard.jpg",quality=90)
    if args.render:
        args.scratch.mkdir(parents=True,exist_ok=True)
        silent=args.scratch/"landscape-picture.mp4"
        env={**os.environ,"QT_QPA_PLATFORM":"offscreen","LC_NUMERIC":"C"}
        with open(args.scratch/"render.log","w",encoding="utf-8") as log:
            run([args.shotcut/"melt.exe","bbl-datenkatalog-landscape.mlt","-consumer",f"avformat:{silent}","vcodec=libx264","crf=19","preset=fast","pix_fmt=yuv420p","an=1","movflags=+faststart","real_time=-4","threads=4"],cwd=HERE,env=env,stdout=log,stderr=log)
        # Keep the supplied compressed audio bit-for-bit, without a new encode.
        run([args.shotcut/"ffmpeg.exe","-hide_banner","-loglevel","warning","-y","-i",silent,"-i",ASSETS/"Wie_der_BBL-Datenkatalog_funktioniert.mp4","-map","0:v:0","-map","1:a:0","-c","copy","-movflags","+faststart","-metadata","title=Wie der BBL-Datenkatalog funktioniert","-metadata:s:a:0","language=deu",ASSETS/"bbl-datenkatalog-landscape.mp4"])
        print("Rendered assets/bbl-datenkatalog-landscape.mp4",flush=True)


if __name__=="__main__":main()
