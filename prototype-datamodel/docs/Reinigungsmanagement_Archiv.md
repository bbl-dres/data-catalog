# Reinigungsmanagement (Archiv)

# 1. Ziel dieses Dokumentes

Dieses Fachkonzept legt die Grundlagen für ein einheitliches Verständnis und die Modellierung von Daten für das **Reinigungsmanagement** als Teil des Objektmanagements im Bundesamt für Bauten und Logistik (BBL) fest. Es basiert ausschliesslich auf verifizierbaren Standards und öffentlich zugänglichen Dokumentationen.

Die Kernziele dieses Dokuments sind:

- **Definition zentraler Geschäftsobjekte:** Extraktion und Konsolidierung aus verifizierten Standards (GEFMA 220:2023, DIN 77400:2015, ProLeMo 2021)
- **Standardkonformität:** Sicherstellung der Kompatibilität mit nationalen und internationalen Best-Practice-Standards
- **Interoperabilität:** Schaffung einer Basis für die Integration mit bestehenden BBL-Systemen (SAP PM, SAP RE-FX, Korasoft)
- **Datenqualität:** Definition klarer Identifikatoren und Attribute basierend auf etablierten Normen
- **Praxisrelevanz:** Ableitung aus realen Implementierungen (ETH Zürich, BUW Prozessmodell, CAFM Connect)

# 2. Reinigungsmanagement - Aufgaben und Bedeutung

### 2.1 Rolle im Immobilienmanagement

Das Reinigungsmanagement bildet gemäss ProLeMo 2021 einen der Kernprozesse des infrastrukturellen Gebäudemanagements. Nach GEFMA 200 entfallen 15-25% der gesamten Bewirtschaftungskosten auf Reinigungsdienstleistungen, womit es zu den kostenintensivsten FM-Leistungen gehört. Als operative Schnittstelle zwischen Gebäudetechnik und Nutzern beeinflusst es direkt die Wahrnehmung der BBL-Dienstleistungsqualität.

### 2.2 Inhaltliche Dimensionen

Basierend auf GEFMA 220:2023 und DIN 77400:2015 umfasst das Reinigungsmanagement vier zentrale Dimensionen:

- **Technische Reinigung:** Wartungsreinigung technischer Anlagen, Lüftungskanäle, Serverräume (DIN 77400 Raumgruppe 5)
- **Hygienische Reinigung:** Sanitärbereiche, Küchen, Gesundheitseinrichtungen nach DIN 13063:2021
- **Repräsentative Reinigung:** Eingangsbereiche, Sitzungszimmer, Kundenzonen (APPA Level 1-2)
- **Funktionale Reinigung:** Büros, Verkehrsflächen, Lager (GEFMA 220 Objektgruppe Verwaltung)

### 2.3 Kernaufgaben

Mögliche Kernaufgaben:

- **Leistungsdefinition:** Spezifikation nach 400+ Positionen GEFMA 220, Qualitätsstufen nach NS-INSTA 800 (5-stufig)
- **Flächenmanagement:** Ermittlung nach DIN 277-1, Revierbildung nach GEFMA 220 Kap. 4
- **Ressourcenplanung:** Zeitrichtwerte nach DIN 77400 (m²/h), Personalberechnung nach APPA (2.800-5.000 m²/FTE)
- **Qualitätskontrolle:** Stichprobenverfahren nach NS-INSTA 800, RAL-GZ 992/2 Auditkriterien
- **Vertragsmanagement:** Leistungsverzeichnisse nach GEFMA 220, SLAs nach BBL-Weisungen
- **Nachhaltigkeitsmanagement:** RUMBA-Konformität, EU Ecolabel-Kriterien gemäss BIG HBP

### 2.4 Strategische Bedeutung

- **Werterhaltung:** Verlängerung der Lebensdauer durch fachgerechte Pflege (SIA 469)
- **Gesundheitsschutz:** Erfüllung ArGV 3, COVID-Massnahmen, Hygienevorschriften
- **Energieeffizienz:** Reduzierung Reinigungsfrequenzen durch IoT-Sensoren (Planon-Referenz)
- **Digitalisierung:** BIM2FM-Integration via CAFM Connect, digitale Qualitätskontrolle

# 3. Empfehlung Geschäftsobjekte (Konsolidiert)

Bedeutung der Prioritätsstufen:

- **Muss:** Zwingend erforderlich gemäss gesetzlichen Vorgaben oder BBL-Standards
- **Soll:** Wichtig für vollständige fachliche Abbildung gemäss Best Practice
- **Kann:** Erweiterte Funktionalität für Optimierung

|  | Gruppe/Geschäftsobjekt | Priorität | Beschreibung | Primäre Identifikatoren | Relevante Standards | Kommentar |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **STRUKTUROBJEKTE** |  |  |  |  |  |
| 2 | Reinigungsobjekt | Muss | Kleinste zu reinigende Einheit (Raum, Fläche, Sanitärobjekt, Bauteil, Ausstattung) | Objekt-ID, Raumnummer (SAP) | DIN 77400, GEFMA 220 Kap. 3 | Verknüpfung mit Technischem Platz (SAP PM) |
| 3 | Reinigungsrevier | Muss | Logische Gruppierung von Reinigungsobjekten | Revier-ID, Gebäude-ID | GEFMA 220 Kap. 4.3, BUW Prozessmodell | Basis für Leistungsverzeichnis |
| 4 | Reinigungszone | Soll | Übergeordnete Gruppierung nach Hygieneanforderungen | Zonen-ID, Hygienetyp | DIN 13063, NS-INSTA 800 | Kritisch für Gesundheitswesen |
| 5 | **PLANUNGSOBJEKTE** |  |  |  |  |  |
| 6 | Reinigungskonzept | Muss | Gesamtstrategie mit Definition der Reinigungsleistungen und Qualitätsstufen | Konzept-ID, Version | ProLeMo 2021, BS UCM | Erstellt in Phase 21, Basis für Ausschreibung |
| 7 | Mengenauszug Reinigung | Muss | Strukturierte Aufstellung aller zu reinigenden Elemente mit Flächen aus BIM | Auszug-ID, Stand | BS UCM, CAFM Connect | Direkte Grundlage für LV-Erstellung |
| 8 | Leistungsverzeichnis | Muss | Strukturierte Leistungsbeschreibung für Ausschreibung | LV-ID, Version | GEFMA 220, NPK 641 | Basis für Vergabe |
| 9 | **LEISTUNGSOBJEKTE** |  |  |  |  |  |
| 10 | Reinigungsleistung | Muss | Definierte Tätigkeit mit Spezifikation | LV-Position (GEFMA 220) | GEFMA 220 (400+ Positionen) | Standardkatalog verfügbar |
| 11 | Reinigungsplan | Muss | Zeitliche Planung mit Zyklen | Plan-ID, Gültigkeitszeitraum | DIN 77400 Tab. 2, ProLeMo | Integration mit SAP PM Wartungsplänen |
| 12 | Reinigungsauftrag | Muss | Operative Arbeitsanweisung | Auftrags-ID, Status | BBL-Weisungen, SAP PM | Schnittstelle zu Störungsmeldungen |
| 13 | Sonderreinigung | Soll | Ereignisbasierte Reinigung | Ereignis-ID, Auslöser | GEFMA 220 Kap. 5.4 | Nach Veranstaltungen, Störfällen |
| 14 | **QUALITÄTSOBJEKTE** |  |  |  |  |  |
| 15 | Qualitätsprofil | Soll | Anforderungen je Raumtyp | Profil-ID, Raumkategorie | NS-INSTA 800 Level 1-5 | SLA-relevant |
| 16 | Qualitätskontrolle | Soll | Dokumentierte Prüfung mit Bewertung | Kontroll-ID, Zeitstempel | NS-INSTA 800, DIN SPEC 77224 | Statistische Stichproben |
| 17 | **DOKUMENTATIONSOBJEKTE** |  |  |  |  |  |
| 18 | Aufzeichnungen Reinigung | Muss | Protokolle durchgeführter Reinigungen als Leistungsnachweis | Protokoll-ID, Datum | BUW Prozessmodell, ArGV 3 | Compliance-Nachweis |
| 19 | Pflegeanleitung | Soll | Herstellerspezifische Reinigungsanleitungen für Materialien | Anleitung-ID, Material | GEFMA 220, BS UCM | Fachgerechte Reinigung |
| 20 | **VERWALTUNGSOBJEKTE** |  |  |  |  |  |
| 21 | Reinigungsvertrag | Muss | Vertragliche Vereinbarung | Vertrags-ID, Laufzeit | OR, SIA 118/380 | Integration SAP VM |
| 22 | Service Level Agreement | Soll | Qualitäts- und Leistungsvereinbarung | SLA-ID, KPIs | BBL-Weisungen Anhang I | Messbare Kriterien |
| 23 | **RESSOURCENOBJEKTE** |  |  |  |  |  |
| 24 | Reinigungspersonal | Muss | Mitarbeitende und Dienstleister | Personal-ID, Qualifikation | GEFMA 220 Kap. 7 | Schulungsnachweise |
| 25 | Reinigungsmittel | Soll | Chemikalien und Verbrauchsmaterial | Artikel-ID, CAS-Nummer | CLP-Verordnung, EU Ecolabel | Sicherheitsdatenblätter |

Tabelle: Empfehlung Geschäftsobjekte (Konsolidiert)

![](Reinigungsmanagement_Archiv/229017395.png)

Bild: Tabelle: Empfehlung Geschäftsobjekte (Konsolidiert). [Quelle](https://www.mermaidchart.com/app/projects/5ddada0a-47f7-43e6-87eb-a297e604e809/diagrams/e0e2f3a1-ffca-4467-94d0-20080d716914/version/v0.1/edit)

# 4. Übersicht der relevanten Standards und Beispiele

### 4.1 Standards als Tabelle

|  | Kategorie/Name | Zweck (Kurz) | Relevanz für BBL | Anwendung BBL | Schnittstellen | Status | Anmerkungen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **FUNDAMENT: Rechtliche Grundlagen** |  |  |  |  |  |  |
| 2 | ArGV 3 SR 822.113 | Gesundheitsschutz am Arbeitsplatz | Hoch | Hygiene, Raumklima, Sanitäranlagen | SUVA, SECO | Aktiv | Bundesverordnung |
| 3 | Lebensmittelgesetz SR 817.0 | Lebensmittelsicherheit und HACCP | Hoch | Kantinen, Teeküchen, Selbstkontrolle | BAG | Aktiv | Für Verpflegungsbereiche |
| 4 | **NORMATIVE STANDARDS** |  |  |  |  |  |  |
| 5 | DIN 77400:2015 | Reinigung Schulgebäude | Hoch | Leistungsprogramm, Zeitwerte | DIN 13063 | Aktiv | Mindestanforderungen |
| 6 | GEFMA 220:2010 | Lebenszykluskosten-rechnung im FM | Mittel | Kostenplanung über Lebenszyklus | SAP FI/CO | Aktiv | NICHT für operative Reinigung |
| 7 | NS-INSTA 800-1:2018 | Qualitätsmessung Reinigung | Hoch | Statistische Kontrolle, Level 0-5 | Mieterportal | Aktiv | Aktualisiert 2018 |
| 8 | RAL-GZ 992/1 und 992/2 | Textilservice für Gesundheitswesen | Niedrig | Wäschepflege-Standards | Externe Dienstleister | Aktiv seit 1986 | Für Wäschereien, nicht Reinigung |
| 9 | DIN 13063:2021 | Krankenhausreinigung | Mittel | Spezielle Hygienebereiche | RKI-Richtlinien | Aktiv | Für Gesundheitsbereiche |
| 10 | **BBL-GOVERNANCE** |  |  |  |  |  |  |
| 11 | Weisungen Betrieb (06/2023) | BBL-Betriebsstandards | Sehr hoch | Verbindliche Vorgaben | SAP RE-FX/PM | Aktiv | Stand 19. Juni 2023 |
| 12 | Standards Büroarbeitsplätze | Ausstattung/Reinigung | Sehr hoch | Anhang I der Weisungen | Mieterportal | Aktiv | Stand 11. August 2023 |
| 13 | Weisung Gebäudeautomation | GA-Integration | Hoch | Sensorik für Bedarfsreinigung | Domotik, IoT | Aktiv | Update 01.04.2025 |
| 14 | **FACHANWENDUNGEN BBL** |  |  |  |  |  |  |
| 15 | SAP PM | Instandhaltung/Wartung | Mittel | Auftragsverwaltung (anpassbar für Reinigung) | SAP RE-FX | Produktiv | Technischer Platz |
| 16 | SAP RE-FX | Immobilienverwaltung | Hoch | Mietflächendaten | Korasoft | Produktiv | Mietobjekte |
| 17 | Korasoft | CAD/Flächenmanagement | Hoch | Grafische Flächenplanung | SAP, GIS | Produktiv | Revierverwaltung möglich |
| 18 | **SCHWEIZER STANDARDS** |  |  |  |  |  |  |
| 19 | ProLeMo 2021 | Prozess-/Leistungsmodell FM | Hoch | FM-Prozessstruktur | SIA 113 | Aktiv | IFMA/CRB, Update 2022 |
| 20 | SIA 113:2010 | FM-gerechte Bauplanung | Hoch | Frühe FM-Integration | SIA 112 | Aktiv | SN 508 113 |
| 21 | **INTEGRATION** |  |  |  |  |  |  |
| 22 | CAFM-Connect 3.0 | Datenaustausch | Hoch | Systemintegration | IFC4, SAP | Aktiv | Mit Bindestrich |
| 23 | BIM2FM | Methodik/Konzept | Mittel | Digitaler Zwilling | IFC, COBie | Entwicklung | Kein spezifischer Standard |
| 24 | **REFERENZEN UND SONSTIGES** |  |  |  |  |  |  |
| 25 | BUW-Prozessmodell für die Bau- und Immobilienwirtschaft | Bau- und Immobilienwirtschaft | Hoch | BPMN-Prozessmodelle | BPMN 2.0 | Aktiv seit 2015 | Uni Wuppertal, Reinigungsmanagement (IGM) |
| 26 | BuildingSmart UCM: Routinemässige Reinigung |  | Sehr Hoch |  | ProLeMo |  |  |

### 4.2 Bewertungskriterien für "Relevanz für BBL"

- **Sehr hoch:** Gesetzlich vorgeschrieben, BBL-Kernsystem oder verbindliche Weisung
- **Hoch:** Best Practice Schweiz, wichtig für Qualität oder Integration
- **Mittel:** Ergänzend, für Spezialfälle oder internationale Referenz

### 4.3 Strategische Einordnung

1. **FUNDAMENT:** Rechtlich bindende Vorgaben (ArGV 3, VKF)
2. **BBL-GOVERNANCE:** Interne verbindliche Standards
3. **FACHANWENDUNGEN:** Operative IT-Systeme (SAP)
4. **STANDARDS:** Normative Vorgaben (DIN, GEFMA, SIA)
5. **INTEGRATION:** Schnittstellen und Datenaustausch
6. **REFERENZEN UND SONTIGES:** Verifizierte Praxisbeispiele und Sonstiges

# 5. Wichtigste Standards und Beispiele im Detail (Schrittweise Ergänzung)

Zur einheitlichen Klassifizierung der Standards werden folgende Kategorien verwendet:

- **Fachanwendung**: IT-Systeme, Register oder Plattformen (z.B. GWR, Grundbuch, ÖREB-Kataster)
- **Geschäftsprozess:** Strukturierte Abfolge von Aktivitäten zur Erreichung eines definierten Geschäftsziels (z.B. Reinigungsausschreibung, Qualitätskontrolle durchführen, Reinigungsplan erstellen)
- **Geschäftsobjekt**: Eigenständige fachliche Entitäten mit eindeutiger Identität (z.B. Grundstück, Gebäude, Wohnung, Person)
- **Geschäftsobjekttyp**: Spezialisierungen oder Ausprägungen von Geschäftsobjekten (z.B. Stockwerkeigentum, Wohngebäude, Bauprojekt)
- **Dokument:** Informationsträger zur Dokumentation, Kommunikation oder Nachweisführung im Geschäftsprozess (z.B. Leistungsverzeichnis, Reinigungsplan, Qualitätsprotokoll, Pflegeanleitung)
- **Attribut**: Eigenschaften oder Merkmale von Geschäftsobjekten (z.B. EGID, Baujahr, Fläche, Koordinaten)
- **Fachbegriff**: Konzepte, Definitionen oder Klassifikationen ohne eigenständige Objektnatur (z.B. Grundeigentum, Vollregister, Nachführungspflicht)
- **Relation**: Beziehungen und Verknüpfungen zwischen Geschäftsobjekten, die deren Abhängigkeiten und Zusammenhänge definieren (z.B. Gebäude-zu-Grundstück, Equipment-zu-Technischer-Platz, Mietobjekt-zu-Vertrag)

## 5.1 Verordnung 3 zum Arbeitsgesetz (ArGV 3) SR 822.113

- **Relevanz für BBL:** Hoch
- **Beschreibung:** Die ArGV 3 definiert die gesetzlichen Mindestanforderungen an den Gesundheitsschutz am Arbeitsplatz und hat direkte Auswirkungen auf die Reinigungsstandards in Bundesgebäuden. Sie legt verbindliche Vorgaben für Hygiene, Sauberkeit und Unterhalt von Arbeitsräumen fest.
- **Dokumentation:**
  - Bundesgesetz: <https://www.fedlex.admin.ch/eli/cc/1993/2553_2553_2553/de>
  - SECO-Wegleitung zur ArGV 3

|  | Begriff | Kategorie | Beschreibung | Relevanz BBL | Kommentar |
| --- | --- | --- | --- | --- | --- |
| 1 | Allgemeine Anforderungen (Art. 12) | Fachbegriff | Gebäude und Räume müssen sauber gehalten werden. Verschmutzungen und Ablagerungen, die zu gesundheitlichen Beeinträchtigungen führen können, sind zu beseitigen | Sehr Hoch | Grundlegende Reinigungspflicht für alle BBL-Gebäude |
| 2 | Sanitäre Einrichtungen (Art. 31-33) | Fachbegriff | Toiletten, Waschräume und Garderoben müssen regelmässig gereinigt und desinfiziert werden. Mindestens einmal täglich bei normaler Nutzung | Sehr Hoch | Definiert Mindestfrequenz für Sanitärreinigung |
| 3 | Aufenthalts- und Pausenräume (Art. 33) | Fachbegriff | Sozialräume müssen hygienisch einwandfrei und regelmässig gereinigt werden | Hoch | Betrifft Kantinen, Pausenräume, Teeküchen |
| 4 | Bodenbeläge (Art. 14) | Attribut | Böden müssen rutschfest, leicht zu reinigen und hygienisch sein. In Nassräumen wasserdicht und mit Gefälle | Hoch | Beeinflusst Materialwahl und Reinigungsmethoden |
| 5 | Wände und Decken (Art. 13) | Attribut | Oberflächen müssen den hygienischen Anforderungen entsprechen und leicht zu reinigen sein | Hoch | Relevant für Materialwahl in sensiblen Bereichen |
| 6 | Reinigungsfrequenz | Attribut | Je nach Verschmutzungsgrad und Nutzung, mindestens jedoch: Arbeitsräume wöchentlich, Sanitäranlagen täglich, Sozialräume täglich | Sehr Hoch | Gesetzliche Mindestanforderungen für Reinigungszyklen |
| 7 | Abfallentsorgung (Art. 30) | Geschäftsprozess | Abfälle sind regelmässig zu entsorgen. Behälter müssen dicht schliessen und leicht zu reinigen sein | Hoch | Teil des täglichen Reinigungsprozesses |
| 8 | Lüftung und Raumklima (Art. 16-17) | Relation | Reinigung von Lüftungsanlagen zur Vermeidung von Keimbildung und Staubablagerungen | Hoch | Schnittstelle zwischen Reinigung und Gebäudetechnik |
| 9 | Erste Hilfe Räume (Art. 36) | Fachbegriff | Besondere Hygieneanforderungen für Sanitätsräume, erhöhte Reinigungsfrequenz und Desinfektion | Mittel | Spezialreinigung für Gesundheitsbereiche |
| 10 | Dokumentationspflicht | Dokument | Nachweis der Einhaltung der gesetzlichen Vorgaben durch Reinigungsprotokolle und Kontrollberichte | Hoch | Basis für Compliance-Nachweis gegenüber SUVA/SECO |

## 5.2 Bundesgesetz über Lebensmittel und Gebrauchsgegenstände (LMG) SR 817.0

- **Relevanz für BBL:** Hoch
- **Beschreibung:** Das Lebensmittelgesetz (LMG) und seine Verordnungen definieren verbindliche Hygieneanforderungen für alle Bereiche, in denen mit Lebensmitteln umgegangen wird. Für BBL-Gebäude betrifft dies insbesondere Kantinen, Cafeterias, Teeküchen und Verpflegungsbereiche. Die Einhaltung der Vorschriften ist gesetzlich verpflichtend und wird durch kantonale Lebensmittelinspektorate kontrolliert.
- **Dokumentation:**
  - Bundesgesetz: <https://www.fedlex.admin.ch/eli/cc/2017/62/de>
  - Lebensmittel- und Gebrauchsgegenständeverordnung (LGV): SR 817.02
  - Hygieneverordnung (HyV): SR 817.024.1

| Nr. | Begriff | Kategorie | Beschreibung | Relevanz BBL | Kommentar |
| --- | --- | --- | --- | --- | --- |
| 1 | Selbstkontrolle (Art. 26 LMG) | Geschäftsprozess | Betriebe müssen ein HACCP-basiertes Selbstkontrollkonzept implementieren, das auch die Reinigung und Desinfektion umfasst | Sehr Hoch | Dokumentierte Reinigungsprozesse für alle Verpflegungsbereiche erforderlich |
| 2 | Gute Hygienepraxis (GHP) | Fachbegriff | Grundlegende Hygienemassnahmen gemäss HyV Art. 47, umfasst Reinigung, Desinfektion, Schädlingsbekämpfung und Personalhygiene | Sehr Hoch | Basis für alle Reinigungskonzepte in Lebensmittelbereichen |
| 3 | Reinigungsplan Lebensmittelbereich | Dokument | Detaillierter Plan mit Was, Wann, Womit, Wie und Wer für alle Oberflächen und Geräte im Lebensmittelbereich | Sehr Hoch | Gesetzlich vorgeschrieben, Teil der Selbstkontrolle |
| 4 | Oberflächenanforderungen | Attribut | Oberflächen in Lebensmittelbereichen müssen glatt, abwaschbar, korrosionsbeständig und ungiftig sein (HyV Art. 48) | Sehr Hoch | Beeinflusst Materialwahl für Böden, Wände, Arbeitsflächen |
| 5 | Reinigung und Desinfektion | Geschäftsprozess | Zweistufiger Prozess: Erst Reinigung zur Entfernung von Schmutz, dann Desinfektion zur Abtötung von Mikroorganismen | Sehr Hoch | Unterschiedliche Mittel und Methoden erforderlich |
| 6 | Kontaktflächen Lebensmittel | Geschäftsobjekt | Alle Flächen, die direkt mit Lebensmitteln in Kontakt kommen (Arbeitsflächen, Schneidebretter, Geräte) | Sehr Hoch | Tägliche Reinigung und Desinfektion nach jedem Gebrauch |
| 7 | Reinigungsmittel Lebensmittelbereich | Attribut | Nur für Lebensmittelbereiche zugelassene Reinigungs- und Desinfektionsmittel gemäss EDI-Verordnung | Hoch | Spezielle Produktanforderungen, Sicherheitsdatenblätter erforderlich |
| 8 | Reinigungsfrequenz Küche | Attribut | Arbeitsflächen: nach jedem Gebrauch; Böden: täglich; Kühlräume: wöchentlich; Lüftung: monatlich bis quartalsweise | Sehr Hoch | Höhere Frequenzen als normale Büroreinigung |
| 9 | Schädlingsmonitoring | Geschäftsprozess | Regelmässige Kontrolle und Dokumentation von Schädlingsbefall, präventive Massnahmen | Hoch | Teil der Reinigung und Hygienemassnahmen |
| 10 | Personalhygiene | Fachbegriff | Reinigungspersonal in Lebensmittelbereichen muss spezielle Hygieneschulung haben, Arbeitskleidung tragen | Hoch | Zusätzliche Schulungsanforderungen |
| 11 | Kontrollprotokolle | Dokument | Nachweisdokumente über durchgeführte Reinigungen mit Datum, Zeit, ausführende Person und verwendete Mittel | Sehr Hoch | Prüfungsrelevant bei Lebensmittelkontrollen |
| 12 | Kritische Kontrollpunkte (CCP) | Geschäftsobjekt | Identifizierte Risikobereiche wie Kühlketten, Kreuzkontamination, die besondere Reinigungsaufmerksamkeit erfordern | Hoch | HACCP-relevante Reinigungspunkte |
| 13 | Abfallmanagement Küche | Geschäftsprozess | Getrennte Sammlung organischer Abfälle, tägliche Entsorgung, regelmässige Reinigung der Abfallbehälter | Hoch | Verhindert Schädlingsbefall und Geruchsbildung |

## 5.3 BS UCM - Routinemässige Reinigung (ProLeMo)

- **Relevanz für BBL:** Sehr Hoch
- **Beschreibung:** Der BuildingSMART Use Case definiert den standardisierten Informationsfluss für die routinemäßige Reinigung von der BIM-Planung bis zum Betrieb.
- **Dokumentation:**
  - BS Use Case Management: <https://ucm.buildingsmart.org/en/use-cases/1700/de>
  - Original Dokumente im Anhang

|  | Begriff | Kategorie | Beschreibung | Relevanz BBL | Kommentar |
| --- | --- | --- | --- | --- | --- |
| 1 | Reinigungsobjekt | Geschäftsobjekt | Räume und Bauteile mit reinigungsrelevanten Attributen (Fläche, Material, Nutzungsart) aus dem BIM-Modell | Sehr Hoch | Basis für Mengenauszug und Leistungsverzeichnis. Entspricht BBL-Geschäftsobjekt "Reinigungsobjekt" |
| 2 | Reinigungskonzept | Geschäftsobjekt | Dokumentiertes Konzept mit Definition der Reinigungsleistungen, Zyklen und Qualitätsstufen basierend auf BIM-Daten | Sehr Hoch | Erstellt in Phase 21, Grundlage für Ausschreibung |
| 3 | LIM (Liegenschafts-Informationsmodell) | Geschäftsobjekt | As-built Modell mit vollständigen, geprüften Reinigungsdaten für die Übergabe in den Betrieb | Sehr Hoch | Basis für CAFM-Integration und Betriebsphase |
| 4 | Mengenauszug Reinigung | Geschäftsobjekt | Strukturierte Aufstellung aller zu reinigenden Elemente mit Flächen, Materialien und Eigenschaften aus dem BIM | Sehr Hoch | Direkte Verwendung für Reinigungsausschreibung |
| 5 | Flaeche RF | Attribut | Reinigungsfläche des Raumes in m² gemäß SIA 416 | Sehr Hoch | Kernattribut für Mengenberechnung (Code R0609) |
| 6 | Nutzungsart | Attribut | Raumnutzungstyp zur Definition der Reinigungsanforderungen | Sehr Hoch | Bestimmt Reinigungsfrequenz und -qualität (Code R0305) |
| 7 | Bodenbelagstyp | Attribut | Art des Bodenbelags (z.B. Parkett, Linoleum, Teppich, Naturstein) | Sehr Hoch | Definiert Reinigungsmethode und -mittel (Code B0803) |
| 8 | Glasflaeche | Attribut | Fläche der Glaselemente in m² (Fenster, Türen, Trennwände) | Hoch | Für Glasreinigung relevant (Codes B1009, B1008, etc.) |
| 9 | Wandbekleidungstyp | Attribut | Material der Wandoberfläche (z.B. Anstrich, Tapete, Fliesen) | Hoch | Bestimmt Reinigungsmethode (Code B1604) |
| 10 | Material | Attribut | Spezifische Materialangabe für alle Bauteile | Sehr Hoch | Kritisch für Reinigungsmittelauswahl (Code B0206) |
| 11 | Deckenbekleidungstyp | Attribut | Art der Deckenoberfläche (z.B. Akustikdecke, Gipskarton) | Mittel | Für periodische Reinigung (Code B1403) |
| 12 | Max. Personenbelegung | Attribut | Maximale Anzahl Personen im Raum | Hoch | Beeinflusst Reinigungsfrequenz (Code R0614) |
| 13 | Mieteinheit | Attribut | Zuordnung zu Mietbereich für Abrechnung | Hoch | Für Kostenverteilung relevant (Code R0605) |
| 14 | Hersteller/Artikelnummer | Attribut | Produktspezifikation für Pflegeanleitung | Mittel | Für spezielle Reinigungsanforderungen (Codes B0104/B0105) |
| 15 | CAFM-Integration | Relation | Überführung der BIM-Daten in das Computer Aided Facility Management System für den Betrieb | Sehr Hoch | Schnittstelle zwischen Planung und operativem Betrieb |
| 16 | PIA (Projekt-Informations-anforderungen) | Dokument | Kombination aus OIA (Organisations-Informationsanforderungen) und LIA (Liegenschafts-Informationsanforderungen), definiert die benötigten Daten und Attribute für die Übergabe | Sehr Hoch | Grundlage für alle Datenanforderungen, muss in Phase 11 erstellt werden |
| 17 | BAP (BIM-Abwicklungsplan) | Dokument | Antwort des Auftragnehmers auf die PIA, enthält Pflichtenheft und Nachvertrag für die BIM-Abwicklung | Sehr Hoch | Verbindliche Vereinbarung zur Datenlieferung |
| 18 | Reinigungskonzept | Dokument | Ausgearbeitetes Konzept mit Definition der Reinigungsleistungen, erstellt in Phase 21 | Sehr Hoch | Basis für Ausschreibung und Leistungsverzeichnis |
| 19 | Mengenauszug Reinigung | Dokument | Strukturierte Aufstellung aller zu reinigenden Elemente mit Flächen aus dem BIM-Modell | Sehr Hoch | Direkte Grundlage für Reinigungsausschreibung |
| 20 | Objektstammblatt | Dokument | Zusammenfassung aller relevanten Objektdaten für die Reinigung | Hoch | Übersichtsdokument für Betrieb (Code B02201) |
| 21 | Pflegeanleitung | Dokument | Herstellerspezifische Reinigungsanleitungen für Materialien und Oberflächen | Hoch | Kritisch für fachgerechte Reinigung (Code B18005) |
| 22 | Gebäude- und Geschossverzeichnis | Dokument | Strukturierte Auflistung aller Gebäude und Geschosse mit reinigungsrelevanten Informationen | Hoch | Basis für Revierbildung (Code B02202) |
| 23 | Layoutplan | Dokument | Grafische Darstellung der Reinigungsflächen und -reviere | Mittel | Für Tourenplanung relevant (Code V08007) |

## 5.4 BUW-Prozessmodell – Reinigungsmanagement (IGM)

- **Relevanz für BBL:** Hoch
- **Beschreibung:** Das BUW-Prozessmodell ist ein detailliertes Referenzmodell für BIM-basierte Betriebsprozesse. Für das Reinigungsmanagement, das dem Infrastrukturellen Gebäudemanagement (IGM) zugeordnet ist, definiert es einen durchgängigen Informationsfluss von der Ausschreibung über die Personalunterweisung bis hin zur Durchführung und Überwachung der Leistungen. Das Modell legt dabei einen Fokus auf die benötigten Inputs und die erzeugten Outputs (Dokumente, Protokolle, Nachweise) der einzelnen Prozessschritte.
- **Dokumentation:**
  - Webseite: <https://dpbb.uni-wuppertal.de/de/forschung/buw-prozessmodell-fuer-die-bau-und-immobilienwirtschaft/>
  - Original Dokument im Anhang: Prozesse\_Betrieb\_-\_Druckbericht.pdf

|  | Begriff | Kategorie | Beschreibung | Relevanz BBL | Kommentar |
| --- | --- | --- | --- | --- | --- |
| 1 | Leistungsausschreibung Reinigungsmanagement | Geschäftsobjekt | Der Gesamtprozess für die Ausschreibung von Reinigungsleistungen. Er umfasst die Erstellung von Flächenverzeichnissen, Leistungsverzeichnissen (LV), Vertrags- und Bewertungsbedingungen als Outputs. | Sehr Hoch | Dies ist ein Kernelement für die Beschaffung und das Vertragsmanagement (analog zu SAP VM). Es bildet die Grundlage für das BBL-Geschäftsobjekt |
| 2 | Flächenverzeichnis für Reinigung | Geschäftsobjekt | Ein Dokument, das alle zu reinigenden Flächen auflistet und auf Basis von Plänen (Lageplan) und Rauminformationen (Raumbuch) erstellt wird. Es ist die Grundlage für das Reinigungs-LV. | Sehr Hoch |  |
| 3 | Reinigungs-LV | Geschäftsobjekt | Das Leistungsverzeichnis (LV), das die spezifischen Reinigungsaufgaben definiert. Es wird auf Basis des Flächenverzeichnisses und des Betreiberkonzepts erstellt. | Sehr Hoch | Direktes Äquivalent zum BBL-Geschäftsobjekt |
| 4 | Reinigungsunterweisung | Geschäftsobjekt | Der dokumentierte Prozess zur Einweisung des Personals. Inputs dafür sind u. a. das Betreiberkonzept und Sicherheitskonzepte. Der Output ist der Unterweisungsnachweis. | Hoch |  |
| 5 | Aufzeichnungen durchgeführter Reinigungen | Geschäftsobjekt | Protokolle und Nachweise über die erfolgte Unterhaltsreinigung. Diese werden geprüft und freigegeben, um die Leistungserbringung zu überwachen. | Hoch | Erfüllt die Funktion des BBL-Geschäftsobjekts |
| 6 | Anordnung zur Sonderreinigung | Geschäftsobjekt | Ein expliziter Auftrag für eine außerplanmäßige, ereignisbasierte Reinigung. Auslöser kann eine Mängel- oder Schadenmeldung sein. | Hoch | Entspricht exakt dem BBL-Geschäftsobjekt |
| 7 | Reinigungsmanagement (IGM) | Fachbegriff | Im BUW-Modell ist dies der übergeordnete Fachprozess innerhalb des Infrastrukturellen Gebäudemanagements (IGM), der alle Aspekte der Reinigung bündelt. | Sehr Hoch | Definiert den fachlichen Rahmen und Prozesskontext, analog zur Einordnung gemäss ProLeMo 2021 in Ihrem Fachkonzept. |
| 8 | Leistungsausschreibung Reinigungsmanagement (IGM) | Fachprozess | Definiert den Gesamtprozess für die Ausschreibung von Reinigungsleistungen, von der Erstellung der Grundlagen bis zu den finalen Vergabeunterlagen. | Sehr Hoch | Output sind die Ausschreibungsunterlagen Reinigung , welche das Flächenverzeichnis und das Flächenverzeichnis und das Reinigungs-LV enthalten. Als Input dienen u.a. das Betreiberkonzept und Pläne. |
| 9 | Reinigung durchführen | Fachprozess | Beschreibt die operative Durchführung der Unterhalts- und Sonderreinigung gemäss den vertraglichen Vorgaben. | Sehr Hoch | Der Prozess wird durch den Reinigungsplan oder eine explizite Anordnung zur Sonderreinigung ausgelöst. Das zentrale Lieferobjekt (Output) sind die Aufzeichnungen durchgeführter Reinigungen als Leistungsnachweis. |
| 10 | Reinigung überwachen | Fachprozess | Umfasst die Kontrolle der erbrachten Reinigungsleistung und die Reaktion auf festgestellte Mängel. | Sehr Hoch | Input sind die Aufzeichnungen (Leistungsnachweise) der Reinigungsfirma. Wichtiger Output bei Abweichungen ist die Anordnung zur Sonderreinigung. |
| 11 | An Reinigungsunterweisung teilnehmen | Fachprozess | Der Prozess der Teilnahme an sicherheits- und objektrelevanten Einweisungen aus Sicht des Dienstleisters und die Bestätigung des Verständnisses. | Hoch | Basiert auf Inputs wie dem Nachweis über Reinigungsflächen und diversen Sicherheitskonzepten. Der Output ist der geprüfte Unterweisungsnachweis. |
| 12 | Qualitätssicherung durchführen | Fachprozess | Definiert den übergeordneten Rahmen zur Überprüfung der Dienstleistungsqualität, indem die erbrachte Leistung (Ist) mit den Vorgaben (Soll) verglichen wird. | Sehr Hoch | Der wesentliche Input ist das definierte Leistungs-Soll (z.B. aus dem SLA). Das Ergebnis (Output) ist ein Prüfergebnis, z.B. in Form eines Kontrollberichts. |
