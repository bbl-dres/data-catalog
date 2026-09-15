# Review der erhaltenen Version 1

15. September 2026 · Empfehlungen für eine separate Weiterentwicklung

Grundlage: Bildfolge, Schnittplan, Sprechertext, Untertitel und technische Audiomessung des 76-Sekunden-Exports. Die Beurteilung der Tonspur umfasst Pegel und Text; eine subjektive Bewertung der Stimmwirkung wurde nicht vorgenommen. Zielgruppe für diese Beurteilung: BBL-Mitarbeitende, die den Katalog erstmals kennenlernen.

## Einschätzung

Die Fassung hat eine konsistente Gestaltung, einen verständlichen Beispielbegriff und eine überschaubare Länge. Das grösste Verbesserungspotenzial liegt in einem früher sichtbaren Alltagsnutzen, präziserem Sprechertext und einer kontinuierlich aufgebauten Bildgeschichte. Gegenwärtig wechseln zehn Kapitelbilder; der konkrete Suchvorgang erscheint erst bei etwa 65 Sekunden.

## Prioritäten

### 1. Mit einer konkreten Frage beginnen

0:00–0:14 erklärt zuerst das System und sein Umfeld. «Ohne eigene Daten» kann den Eindruck eines leeren Katalogs erzeugen. Ein alltagsnaher Einstieg schafft eine klarere Erwartung:

> Was bedeutet «Baujahr» genau – und wo finde ich die passende Quelle? Der BBL-Datenkatalog hilft Ihnen, solche Fragen zu klären.

Die Unterscheidung zwischen Metadaten und Gebäudedatensätzen früh auflösen: Der Katalog beschreibt Bedeutung, Struktur und Herkunft; die einzelnen Gebäudedatensätze bleiben in ihren Anwendungen.

### 2. Zu weitgehende Aussagen korrigieren

| Aktueller Wortlaut | Vorschlag |
|---|---|
| «organisiert das Immobilienmanagement» | «macht Informationen über Daten im Immobilienmanagement auffindbar» |
| «mit all seinen fachlichen Eigenschaften» | «mit seinen dokumentierten fachlichen Eigenschaften» |
| «exakte Speicherorte» | «dokumentierte Tabellen und Felder in den Quellsystemen» |
| «überall exakt denselben standardisierten Code» | «Wertelisten zeigen zulässige Codes und ihre Bedeutung.» |
| «bleiben immer geschützt» | «Die eigentlichen Datensätze bleiben in den Quellsystemen.» |
| «Sucht eine Fachperson nun ein Gebäude» | «Sucht eine Fachperson nach dem Begriff ‹Gebäude›» |

Diese Formulierungen passen besser zur dokumentierten Funktion des Prototyps. Ein Katalogeintrag bewirkt selbst weder eine systemweite Harmonisierung noch Schutz oder Zugriff auf Quelldaten. Die Korrekturen benötigen eine neue oder passend neu aufgenommene Sprecherfassung; nur die Untertitel zu ändern würde Ton und Text widersprüchlich machen.

### 3. Eine zusammenhängende Grafik aufbauen

Von 0:14 bis 0:48 wird das Gebäude mehrfach neu eingeführt und anders positioniert. Dasselbe Gebäude-/Begriffselement länger stehen lassen; Eigenschaften, Systeme und Verbindungen nacheinander ergänzen. Bewegung zeigt dann einen Zusammenhang. Die Pfeile bei 0:40–0:48 brauchen eine eindeutige Bedeutung wie «beschreibt» oder «verweist auf», damit sie nicht wie ein Transport von Datensätzen wirken.

### 4. Text reduzieren und die echte Nutzung zeigen

Die linke Überschrift, der erklärende Absatz und die Diagrammbeschriftungen konkurrieren mit dem Sprechertext. Pro Moment eine Hauptaussage und wenige notwendige Labels zeigen; die wiederkehrende Fusszeile reduzieren. Beschriftungen mit 27–32 Pixeln im Full-HD-Bild werden in einem rund 830 Pixel breiten Player auf etwa 12–14 Pixel verkleinert, auf dem Telefon noch stärker.

Bei 0:65–0:71 zeigt die schematische Trefferkarte nur die Labels «Definition» und «Führendes System». Eine kurze Aufnahme aus dem aktuellen Katalog sollte die tatsächliche Suche, das Öffnen des Begriffs und eine konkrete dokumentierte Antwort zeigen. Die Darstellung auf den relevanten Bereich zuschneiden und langsam genug halten, damit die Antwort gelesen werden kann.

### 5. Abschluss und Ton fertigstellen

Die Schlusskarte läuft von 0:71 bis 0:76, aber die Handlungsaufforderung wird nicht gesprochen. Vorschlag:

> Probieren Sie es aus: Suchen Sie nach einem Begriff aus Ihrem Arbeitsalltag.

Im Film einen klaren Schlusssatz zeigen; einen echten Link «Katalog öffnen» kann die Webseite unter dem Player anbieten. Eine im Film gezeichnete Schaltfläche ist nicht bedienbar.

Der Sprechertext hat 168 Wörter, ungefähr 142 Wörter pro Minute: Für eine Überarbeitung muss er nicht pauschal schneller gesprochen werden. Kurze Pausen nach Definition, Verknüpfung und Metadaten wären sinnvoll. Die abschliessende Tonmischung sollte auf Sprachverständlichkeit ausgerichtet sein.

FFmpeg misst −19,0 LUFS integrierte Lautheit bei Mono und +0,4 dB True Peak; die höchste gemessene Spitze liegt ungefähr bei 0:54. Das ist ein Anlass für eine kontrollierte Begrenzung der Pegelspitzen. Für die nächste Webfassung ist eine True-Peak-Grenze von etwa −1,5 dBTP ein praktischer Arbeitswert; der fertige AAC-Export muss erneut gemessen werden. Kein pauschales Anheben der Gesamtlautstärke ohne Berücksichtigung von Mono-/Stereo-Wiedergabe.

## Vorgeschlagene Struktur, rund 75 Sekunden

| Zeit | Aufgabe |
|---|---|
| 0–7 s | Eine Frage aus dem Arbeitsalltag und der direkte Nutzen. |
| 7–20 s | Den Begriff erklären; Metadaten und einzelne Datensätze unterscheiden. |
| 20–38 s | Dieselbe Grafik um Systeme, Tabellen und dokumentierte Beziehungen ergänzen. |
| 38–48 s | Ein kurzes Beispiel für Codes und gemeinsame Bedeutung. |
| 48–68 s | Echte Suche und eine konkrete Antwort im Katalog zeigen. |
| 68–75 s | Gesprochene Einladung und ruhige Schlusskarte. |

Empfehlung: Erst den präziseren Sprechertext festlegen, dann den Schnitt und die Animation daran ausrichten. Die erhaltene Version 1 bleibt als vollständiger Vergleich erhalten.

## Technische Referenzen

- [W3C: Audio- und Videoinhalte zugänglich gestalten](https://www.w3.org/WAI/media/av/av-content/): verständliche Sprache, Pausen zwischen Themen, lesbare Beschriftungen und integrierte Beschreibung wichtiger Bildinformationen.
- [FFmpeg: loudnorm](https://ffmpeg.org/ffmpeg-filters.html#loudnorm): Messung und Bearbeitung von integrierter Lautheit, Lautheitsbereich und True Peak; Beachtung von Mono bei Stereo-Wiedergabe.
