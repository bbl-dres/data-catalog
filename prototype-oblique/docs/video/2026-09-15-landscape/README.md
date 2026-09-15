# Wie der BBL-Datenkatalog funktioniert

16:9-Fassung für das Handbuch · 15. September 2026

## Erhaltene Version 1

**Diese Fassung auf ausdrücklichen Nutzerwunsch dauerhaft erhalten.** Der Film ist zusätzlich als [version-1.mp4](version-1.mp4) mit [Untertiteln](version-1.de.vtt) und [Vorschaubild](version-1-poster.jpg) in diesem Produktionsordner archiviert. [version-1.json](version-1.json) dokumentiert die Prüfsummen von Film, Tonquelle und Produktionsdateien.

Künftige Überarbeitungen in einem neuen Versionsordner anlegen. Die archivierten Dateien und die vorhandenen Shotcut-/Grafikquellen hier weder überschreiben noch löschen. `build_video.py` für eine Weiterentwicklung zuerst in den neuen Produktionsordner kopieren; im Archiv nicht erneut ausführen. Die eingebundene Handbuchfassung bleibt vorerst unverändert.

Die [redaktionelle und filmische Beurteilung](REVIEW.md) enthält Vorschläge für eine spätere Version; diese Vorschläge sind in Version 1 nicht umgesetzt.

- **Film:** [bbl-datenkatalog-landscape.mp4](../../../assets/bbl-datenkatalog-landscape.mp4), 1920 × 1080, 30 fps, 76 Sekunden, H.264/AAC mit Fast Start.
- **Shotcut:** [bbl-datenkatalog-landscape.mlt](bbl-datenkatalog-landscape.mlt).
- **Untertitel:** [WebVTT für den Player](../../../assets/bbl-datenkatalog-landscape.de.vtt) und [SRT für Shotcut](bbl-datenkatalog.de.srt), 22 deutsche Einblendungen.
- **Vorschau:** [Storyboard](storyboard.jpg).
- **Quellen:** [Gestaltung und Schnitt erzeugen](build_video.py), [Timeline](timeline.json), [Sprechertext](sprechertext.txt).

## Was übernommen wurde

Die bereitgestellte Datei `assets/Wie_der_BBL-Datenkatalog_funktioniert.mp4` ist ein 720 × 1280 grosses Hochformatvideo mit rund 75,77 Sekunden Laufzeit. Die neue Fassung übernimmt seine Erklärung und den vollständigen Originalton. Beim MP4-Export wird der AAC-Audiostream unverändert kopiert. Es wurde keine neue Stimme erzeugt und das Sprechtempo bleibt gleich. Die Schlusskarte verlängert das Bild auf 76 Sekunden.

Die Bilder wurden als breite, gut lesbare Diagramme neu aufgebaut. Die ursprünglichen Hochformatbilder wurden weder gedehnt noch beschnitten. Es gibt keine seitlichen Füllbalken. Noto Sans und die Farben orientieren sich am vorhandenen Katalog. Die frühere 70-Sekunden-Fassung bleibt als `assets/bbl-datenkatalog-70s-clean.mp4` erhalten.

Die Darstellung erläutert Begriffe und Zusammenhänge. SAP/GIS sind schematische Beispiele; es werden keine konkreten Tabellenzuordnungen, Gebäude-Datensätze oder gültigen Gebäudekategorie-Codes erfunden. Der Ton ist die vom Nutzer gelieferte NotebookLM-Erklärung. Seine vereinfachenden Aussagen zu verbindlichen Wertelisten und geschützten Quelldaten beschreiben das Prinzip und sind keine Prüfung der tatsächlichen Harmonisierung oder Zugriffskontrolle einzelner Systeme.

## In Shotcut bearbeiten

Das Projekt innerhalb dieses Repositorys öffnen, damit die relativen Pfade zu `graphics/` und `../../../assets/` erhalten bleiben. Es enthält getrennte Spuren für Originalton, Kapitel, Diagramme und ergänzende Einblendungen. Schnittpunkte, Einblendungen und Bewegungen lassen sich direkt in Shotcut bearbeiten.

Texte und Zeichnungen liegen in PNG-Grafiken. Ihre Inhalte und Gestaltung lassen sich in `build_video.py` ändern und mit Python und Pillow neu erzeugen; es sind keine nativen Shotcut-Textfelder. Die SRT-Datei kann für eine Fassung mit eingebrannten Untertiteln in Shotcuts Untertitelbereich importiert werden. Die Handbuchfassung nutzt stattdessen zuschaltbare WebVTT-Untertitel.

## Neu erzeugen

```powershell
python docs/video/2026-09-15-landscape/build_video.py
python docs/video/2026-09-15-landscape/build_video.py --render
```

Benötigt Python mit Pillow sowie Shotcut mit `melt.exe` und `ffmpeg.exe`. Ein anderer Shotcut-Ordner kann mit `--shotcut 'C:\Pfad\zu\Shotcut'` übergeben werden. Zwischendateien und Renderprotokoll gehen nach `%TEMP%/bbl-video-review`; `--scratch` überschreibt diesen Pfad. Die Dateien für das Handbuch werden in `assets/` erzeugt. Ein erneuter Build ersetzt die generierte MLT-Datei; manuelle Änderungen in Shotcut unter einem neuen Projektnamen speichern.

Die Untertitel wurden mit Shotcuts lokalem `whisper-cli` zeitlich vorbereitet und Schreibweisen wie BBL, GIS, Datentabellen, Wertelisten und Quellsystem korrigiert. Modellbezug über die [offizielle whisper.cpp-Modelldokumentation](https://github.com/ggml-org/whisper.cpp/tree/master/models). Die Videodatei wurde dafür nicht an einen externen Dienst übertragen. Das lokale Modell und die temporäre Transkription sind keine Laufzeitabhängigkeiten.

## Frühere Stimme wiederfinden

Die vorhandenen Produktionsunterlagen unter `C:/Users/david/Documents/Codex/2026-09-07/ca/outputs/bbl-film/README.md` nennen **ElevenLabs · Corinna Core – Grounding & Honest** für die damaligen Sprecheraufnahmen. Diese ältere Stimme wird in der vorliegenden NotebookLM-Adaption nicht verwendet.

## Prüfung

- Export vollständig mit FFmpeg dekodiert; keine Dekodierfehler. 1920 × 1080, 30 fps, 76 Sekunden, 2 673 357 Bytes.
- AAC-Stream von Quelle und Export hat denselben SHA-256: `e7e3d5dd71dd5a98ad4183816547012a9f8a7db2c2b13c88eb9e129c4ef9bac5`.
- Gerenderte Szenen visuell geprüft; keine abgeschnittenen Beschriftungen. Native Wiedergabe, 16:9-Proportionen, Poster und alle 22 Untertitel im Browser bei 1280 und 390 Pixeln geprüft.
- Der vollständige `functional.cjs`-Lauf besteht die Handbuch- und Videoprüfungen. Ein unabhängiger Test zur anfänglichen Aufklappstellung der Steckbrief-Systemdaten schlägt fehl (`true` statt erwartetem `false`); derselbe Fehler ist mit dem ursprünglichen Test aus Git HEAD separat reproduzierbar. Die Steckbriefimplementierung wurde bei dieser Videoarbeit nicht geändert.
