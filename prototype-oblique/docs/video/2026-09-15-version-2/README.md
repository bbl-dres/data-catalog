# BBL-Datenkatalog · Version 2

15. September 2026 · 82 Sekunden · 1920 × 1080 · 30 fps · Deutsch

[Video ansehen](../../../assets/bbl-datenkatalog-v2.mp4) · [Shotcut-Projekt](bbl-datenkatalog-v2.mlt) · [Storyboard](storyboard.jpg) · [Sprechertext](sprechertext.txt) · [Untertitel](bbl-datenkatalog-v2.de.srt)

## Was sich verbessert

- Eine konkrete Frage eröffnet den Film: Was bedeutet «Baujahr»?
- Bereits nach zwölf Sekunden wird erklärt, dass die Gebäudedatensätze in ihren Anwendungen bleiben und der Katalog Informationen darüber enthält.
- Das Gebäude bleibt während der Erklärung an derselben Stelle. Geschäftsobjekt, Attribute, technische Struktur und dokumentierte Beziehung werden schrittweise ergänzt.
- Wertelisten erklären zulässige Codes und Bedeutungen. Der Film behauptet keine automatische Vereinheitlichung aller Quellsysteme.
- Die echte Oberfläche zeigt die Suche nach «Gebäude», den Weg zum Attribut «Baujahr», dessen Definition und die dokumentierten Zuständigkeiten.
- Die Einladung zum Ausprobieren wird gesprochen. Der Schluss bleibt gut zwei Sekunden stehen, nachdem die Stimme endet.

**Version 1 bleibt vollständig erhalten.** Ihr Export, alle Produktionsdateien und die ursprünglichen MP4s wurden nicht verändert. Der archivierte Stand liegt in [2026-09-15-landscape](../2026-09-15-landscape/README.md), Git-Commit `aca2c32`. V2 hat eigene Mediennamen und ein eigenes Projektverzeichnis.

## Schnittübersicht

| Zeit | Inhalt |
|---|---|
| 0:00–0:12 | Baujahr: Fertigstellung oder Renovation? |
| 0:12–0:21 | Gebäudedatensätze und Metadaten unterscheiden |
| 0:21–0:33 | Geschäftsobjekt und Eigenschaften |
| 0:33–0:42 | Tabellen, Felder und dokumentierte Beziehungen |
| 0:42–0:46 | Wertelisten |
| 0:46–1:05 | Echte Suche und Baujahr-Definition |
| 1:05–1:12 | Fachstelle und Ansprechpersonen |
| 1:12–1:22 | Gesprochene Einladung und Schlussbild |

## Herkunft der Materialien

Die Stimme stammt aus den bereits vorhandenen ElevenLabs-Aufnahmen **Corinna Core – Grounding & Honest** der früheren Produktion vom 7. September. Es wurde keine neue Stimme erzeugt und kein Material an einen externen Dienst übertragen.

- `audio/corinna-short.flac`: verlustfreie Kopie von `C:/Users/david/Documents/Codex/2026-09-07/ca/outputs/bbl-short/assets/audio/corinna.wav`.
- `audio/corinna-explanation.flac`: verlustfreie Kopie von `C:/Users/david/Documents/Codex/2026-09-07/ca/outputs/bbl-film/assets/audio/02-06-narration.wav`. Diese frühere Produktionsdatei enthält bereits die damalige Tempoanpassung.
- Die beiden `source-*.srt` stammen aus diesen Produktionen. Ihre Zeitangaben beziehen sich auf die damaligen Filme. Der Audioanfang liegt dort bei 0,6 beziehungsweise 20 Sekunden.
- `timeline.json` dokumentiert jeden verwendeten Ausschnitt, seine Quelle und seine neue Position. Geschnitten wurde an vollständigen Aussagen; 10-ms-Fades an den Schnittkanten verhindern Klicks.
- `captures/` enthält unveränderte Screenshots des lokalen Prototyps vom 15. September. Im Film werden Ausschnitte vergrössert und zwei Ziele rot umrandet. Es handelt sich um eine montierte Bildschirmdemonstration aus echten Zuständen, keine durchgängige Bildschirmaufnahme. Definitionen und Namen in den Aufnahmen sind die damaligen Beispielinhalte des Prototyps.
- Diagramme und Titel sind lokal mit Pillow erzeugt. Schrift: vorhandene Noto-Sans-Dateien in `assets/fonts/pdf/`.

## Dateien und Bearbeitung

- `build_video.py`: Gestaltung, Satzschnitt, Untertitel, Audioanpassung und Export.
- `bbl-datenkatalog-v2.mlt`: Shotcut-Projekt mit getrennten Bildspuren und einer bearbeitbaren Sprachspur. PNGs enthalten die gestalteten Texte; deren Inhalt wird im Python-Skript geändert. Schnittpositionen und Einblendungen können in Shotcut geändert werden.
- `audio/narration-v2.flac`: verlustfreie fertig montierte Sprachspur.
- `audio/normalization.json`: Zweipass-Lautheitsmessung und angewandte Anpassung. Arbeitsziel ist −19 LUFS für das Monoprogramm bei maximal −2 dBTP vor AAC. Die vorhandenen Aufnahmen liegen bereits deutlich unter dieser Spitzengrenze; eine weitere harte Begrenzung war nicht nötig.
- `bbl-datenkatalog-v2.de.srt`: 28 zuschaltbare Untertitel; im Shotcut-Untertitelfenster importierbar. Die Website nutzt die entsprechende VTT-Datei in `assets/`.
- `qa.json`: technische Messung des fertigen AAC/MP4-Exports und Prüfung der unveränderten Version 1.
- `verify_export.py`: wiederholbare Kontrolle des Exports, der Shotcut-Ressourcen und des V1-Archivs; erzeugt auch `export-review.jpg` aus tatsächlichen MP4-Frames.
- `version-2.json`: SHA-256-Prüfsummen der gespeicherten Produktion und Ausgabedateien.

Zur Reproduktion mit Python, Pillow, numpy und der vorhandenen Shotcut-Installation:

```powershell
python docs/video/2026-09-15-version-2/build_video.py --audio --render
```

`--shotcut` kann einen anderen Shotcut-Ordner angeben. Der Renderer verwendet `QT_QPA_PLATFORM=offscreen` und `LC_NUMERIC=C`. Zwischendateien landen im temporären Verzeichnis, nicht im Archiv von Version 1. Exporte nach `assets/bbl-datenkatalog-v2*` ersetzen nur V2.

## Prüfung und Grenzen

Die Prüfung umfasst Bildkomposition, tatsächliche Exportframes, vollständige Dekodierung, Sprachinhalt per lokaler Transkriptionskontrolle, Untertitel, Lautheit und native Wiedergabe bei Laptop- und Telefonbreite. Eine subjektive Hörabnahme der Stimmwirkung bleibt Teil der gemeinsamen redaktionellen Abnahme. Die Stimme wurde aus zwei bestehenden Aufnahmen derselben Sprecherfigur montiert; Betonung und Sprechtempo können zwischen Passagen leicht variieren.

Der fertige Export misst −19,01 LUFS und −6,65 dBTP. Alle 39 Dateien des V1-Manifests sind bytegleich erhalten. Beide vorhandenen Handbuch-Browsertests bestanden, einschliesslich nativer Wiedergabe und 28 Untertiteln bei 1280 und 390 Pixeln Fensterbreite. Ausgeführt wurde gezielt der Handbuchteil der Funktionsprüfungen.

Der Film zeigt einen datierten Prototypstand. Bei späteren Änderungen an Definition, Navigation oder Zuständigkeiten müssen die betreffenden Bildschirmbilder aktualisiert werden.
