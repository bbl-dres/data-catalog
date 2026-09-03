# Workspace Management

# 1. Ziel dieses Dokuments

Dieses Fachkonzept legt die Grundlagen für ein einheitliches Verständnis und die Modellierung von Daten im Bundesamt für Bauten und Logistik (BBL) fest. Es dient als verbindliches Referenzwerk, um sicherzustellen, dass alle Fachbereiche und IT-Systeme mit denselben Konzepten und Definitionen arbeiten können.

Die Kernziele dieses Dokuments sind:

1. **Definition zentraler Geschäftsobjekte:** Klare und konsistente Definition der domänenspezifischen Geschäftsobjekte und deren Attribute, unabhängig von spezifischen IT-Systemen.
2. **Standardkonformität:** Sicherstellung, dass die Datenmodellierung den anerkannten nationalen und internationalen Gesetzesvorgaben und Best-Practice-Standards folgt.
3. **Interoperabilität:** Schaffung einer Basis für den nahtlosen Austausch und die Integration von Daten über verschiedene Systeme und Prozesse hinweg.
4. **Langfristige Datenqualität:** Beitrag zur Sicherung der Qualität und Konsistenz der Daten, um die Abhängigkeit von einzelnen IT-Systemen zu reduzieren und eine langfristige Nutzbarkeit zu gewährleisten.
5. **Brücke zwischen Fach und IT:** Bereitstellung eines Referenzwerks, das als gemeinsame Sprache zwischen fachlichen Anforderungen und deren technischer Umsetzung dient.
6. **Fundament für strategische Entscheidungen:** Schaffung einer faktenbasierten Grundlage für strategische Entscheidungen, operative Steuerung und Compliance-Management.

# 2. Workspace Management – Aufgaben und Bedeutung

### 2.1. Rolle im Immobilienmanagement

Das Workspace Management bildet die zentrale Schnittstelle zwischen Immobilienmanagement, Personalwesen und Arbeitsorganisation im BBL. Es orchestriert die effiziente Nutzung der verfügbaren Arbeitsplatzressourcen, optimiert die Flächenauslastung und schafft moderne, flexible Arbeitsumgebungen für die Bundesverwaltung. Als strategischer Enabler für New Work und digitale Transformation gewährleistet es die bedarfsgerechte Bereitstellung von Arbeitsplätzen bei gleichzeitiger Kostenoptimierung und Nachhaltigkeitssteigerung.

### 2.2. Inhaltliche Dimensionen

Das Workspace Management umfasst fünf zentrale Dimensionen:

1. **Arbeitsplatzstruktur und -typologie**: Definition und Kategorisierung verschiedener Arbeitsplatztypen (Einzelbüros, Open Space, Shared Desks, Kollaborationszonen, Ruhezonen, Phone Booths) mit standardisierten Ausstattungsmerkmalen und Flächenkennzahlen gemäss GEFMA und DIN EN 15221.
2. **Buchungs- und Reservierungssysteme**: Digitale Verwaltung von Arbeitsplatzbuchungen, Raumbelegungen und Ressourcenreservierungen über integrierte Workplace-Apps mit Real-Time-Verfügbarkeit und Mobile-First-Ansatz.
3. **Auslastungs- und Nutzungsanalyse**: Kontinuierliche Erfassung und Analyse von Belegungsdaten durch IoT-Sensoren, Zugangssysteme und Buchungsdaten zur evidenzbasierten Optimierung von Desk-Sharing-Ratios (typisch 0.7-0.8:1) und Activity Based Working Konzepten.
4. **Gesundheit und Wohlbefinden**: Implementation von WELL Building Standard Kriterien, Ergonomie-Standards (EN ISO 9241), Raumklima-Monitoring (CO₂ < 1000 ppm, Temperatur 20-23°C) und akustischer Qualität (Leesman Index 70+) zur Steigerung von Mitarbeiterzufriedenheit und Produktivität.
5. **Digitale Integration und Automatisierung**: Vernetzung mit HR-Systemen für automatische Arbeitsplatzzuweisungen, BIM-Integration (IFC 4.3), SAP RE-FX Anbindung und Azure-basierte IoT-Plattformen für Smart Building Features.

### 2.3. Kernaufgaben

- **Strategische Arbeitsplatzplanung**: Entwicklung zukunftsfähiger Workplace-Strategien mit optimierten Flächenkonzepten, flexiblen Nutzungsmodellen und nachhaltiger Ressourcenallokation.
- **Operative Arbeitsplatzverwaltung**: Tägliche Administration von Arbeitsplatzbuchungen, Umzügen, Neueinrichtungen und technischen Ausstattungen mit standardisierten Service-Level-Agreements.
- **Datenbasierte Optimierung**: Kontinuierliche Analyse von Nutzungsdaten zur Identifikation von Optimierungspotenzialen (typisch 15-25% Flächenreduktion) und Anpassung der Arbeitsplatzkonzepte.
- **Compliance Management**: Sicherstellung der Einhaltung von Arbeitsschutzvorschriften (EKAS 6508), Barrierefreiheit (BehiG), Datenschutz und Nachhaltigkeitsstandards.
- **Change Management**: Begleitung der Transformation zu modernen Arbeitsformen durch Kommunikation, Schulung und partizipative Gestaltungsprozesse.

### 2.4. Strategische Bedeutung

Das Workspace Management ist ein kritischer Erfolgsfaktor für die Modernisierung der Bundesverwaltung und die Umsetzung der Digitalstrategie des Bundes. Es ermöglicht eine Flächenoptimierung von 20-40% bei gleichzeitiger Steigerung der Mitarbeiterzufriedenheit und schafft die infrastrukturellen Voraussetzungen für hybride Arbeitsmodelle und kollaborative Arbeitsformen.

Als Hebel für Nachhaltigkeit und Klimaschutz reduziert effizientes Workspace Management den CO₂-Fussabdruck durch optimierte Flächennutzung und energieeffiziente Gebäudesteuerung. Die systematische Datenerfassung und -analyse bildet die Grundlage für evidenzbasierte Entscheidungen und kontinuierliche Verbesserung der Arbeitsumgebungen.

Durch die Integration modernster Technologien wie KI-gestützter Raumplanung, predictive Analytics für Auslastungsprognosen und automatisierter Workplace Services positioniert sich das BBL als Vorreiter für innovative Arbeitsplatzkonzepte in der öffentlichen Verwaltung.

# 3. Empfehlung Geschäftsobjekte (Konsolidiert)

### Bedeutung der Prioritätsstufen:

- **Muss**: Geschäftsobjekte, die für die fachliche Vollständigkeit des Workspace Managements zwingend erforderlich sind. Diese Objekte bilden das Kerngerüst des Datenmodells und sind für die grundlegenden Geschäftsprozesse im Arbeitsplatzmanagement unabdingbar.
- **Sollte**: Geschäftsobjekte, die das fachliche Datenmodell um wichtige Aspekte erweitern und die praktische Anwendbarkeit erheblich steigern. Sie sind nicht kritisch für die Grundfunktionalität, aber wichtig für eine vollständige fachliche Abbildung des Workspace Managements.
- **Könnte**: Geschäftsobjekte, die zusätzlichen fachlichen Mehrwert bieten und erweiterte Anwendungsfälle ermöglichen. Sie erweitern das Datenmodell um spezialisierte Bereiche, sind aber nicht für die Kerngeschäftsprozesse erforderlich.
- **Wird nicht**: Geschäftsobjekte, die bewusst nicht im Workspace Management modelliert werden, entweder weil sie durch andere Objekte fachlich abgedeckt sind oder weil sie fachlich in anderen Domänen zugeordnet sind.

|  | Gruppe/Geschäftsobjekt | Priorität | Beschreibung | Primäre Identifikatoren | Relevante Standards | Kommentar |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |

Tabelle: Empfehlung Geschäftsobjekte (Konsolidiert)

# 4. Übersicht der relevanten Standards

### 4.1 Bewertungskriterien für «Relevanz für BBL»

- **Sehr hoch**: Rechtlich oder regulatorisch verpflichtend; grundlegende Voraussetzung für Kernprozesse und -systeme; verbindliche interne Vorgabe; oder unmittelbar umsetzbarer, priorisierter Use Case mit hohem Nutzen.
- **Hoch**: Branchenweit anerkannte Praxis in der Schweiz; wesentlich für Rechtssicherheit, Compliance oder Interoperabilität; wichtig für robuste Integration in bestehende Prozess- und Datenflüsse.
- **Mittel**: Ergänzend oder domänenspezifisch; nützlich für Spezialfälle, Pilotierungen oder als Referenz; optional ohne unmittelbaren Umsetzungsdruck.
- **Niedrig**: Informativ; geringe direkte Anwendbarkeit im Betrieb; Beobachten/Monitoring ausreichend.

### 4.2 Strategische Einordnung (Kategorie Standards)

Die Standards und Use Cases lassen sich in folgende strategische Kategorien einordnen:

- **Rechtliche Grundlagen**: Rechtlich bindende Vorgaben auf Bundes- oder Verordnungsebene; definieren Mindestanforderungen und Rahmenbedingungen.
- **BBL Weisungen und Prozesse**: Interne, verbindliche Standards und Prozessmodelle; legen organisatorische Zuständigkeiten, Abläufe und Qualitätsvorgaben fest.
- **BBL Fachanwendungen**: Operative IT-Systeme und Register für fachliche Leistungen und Verwaltungsaufgaben; stellen Funktionen und Schnittstellen für die Datenintegration bereit.
- **Technische Standards**: Normen und Integrationsstandards (z. B. Datenmodelle, Schnittstellen, Qualitäts- und Leistungskataloge), die Austauschformate und Qualitätsstufen definieren.
- **Externe Beispiele**: Verifizierte Praxisbeispiele und Best-Practice-Implementierungen als Referenz für erfolgreiche Umsetzungen und innovative Ansätze.

### 4.3. Übersicht als Tabelle

|  | Kategorie / Name des Standards | Beschreibung (Kurz) | Relevanz für BBL | Kommentar |
| --- | --- | --- | --- | --- |
| 1 | **Rechtliche Grundlagen** |  |  |  |
| 2 | Arbeitsgesetz (ArG) | Regelt Arbeitszeiten, Gesundheitsschutz und Arbeitsbedingungen in der Schweiz | Sehr hoch – Definiert Mindestanforderungen für Arbeitsplätze | Zentral für Compliance |
| 3 | Arbeitsverordnung 3 (ArGV 3) | Konkretisiert Gesundheitsschutz am Arbeitsplatz mit technischen Anforderungen | Sehr hoch – Spezifiziert Raumklima, Beleuchtung, Ergonomie | Operative Grundlage |
| 4 | EKAS Richtlinie 6508 | Arbeitssicherheit für Betriebe mit besonderen Gefährdungen (50+ Mitarbeiter) | Hoch – Verbindlich für BBL-Arbeitsplätze | Sicherheitssystem-Pflicht |
| 5 | Behindertengleichstellungsgesetz (BehiG) | Barrierefreier Zugang zu Bauten und Dienstleistungen | Sehr hoch – Alle Arbeitsplätze müssen barrierefrei zugänglich sein | Inklusive Arbeitsplätze |
| 6 | Datenschutzgesetz (DSG) | Schutz personenbezogener Daten bei Workspace-Analytics | Sehr hoch – Regelt Mitarbeiterdaten-Erfassung | Compliance-kritisch |
| 7 | Umweltschutzgesetz (USG) Art. 35j | Kreislaufwirtschaft für Bundesbauten | Sehr hoch – Rechtlich mandatiert | NEU: Vorbildfunktion Bund |
| 8 | **BBL Weisungen und Prozesse** |  |  |  |
| 9 | KBOB-Empfehlungen | Koordinationskonferenz der Bau- und Liegenschaftsorgane | Sehr hoch – Faktisch verbindlich für Bundesbauten | Lifecycle-Kosten |
| 10 | BBL Weisungen Büroarbeitsplätze | Interne Standards für Arbeitsplatzgestaltung (Anhang I) | Sehr hoch – Verbindliche interne Vorgaben | Primärer BBL-Standard |
| 11 | VILB (SR 172.010.21) | Verordnung Immobilienmanagement und Logistik des Bundes | Sehr hoch – Rechtlicher Rahmen BBL | NEU: Strategische Grundlage |
| 12 | **BBL Fachanwendungen** |  |  |  |
| 13 | SAP RE-FX + WSM | Real Estate Management System, mit Workspace Management | Sehr hoch – Kernimmobiliensystem BBL | Flächenverwaltung |
| 14 | AIM / CAFM-System | Computer Aided Facility Management | Sehr hoch – Operative FM-Plattform | [Platzhalter - zu ergänzen] |
| 15 | Workplace Booking System | Arbeitsplatz-Buchungsplattform | Sehr hoch – Desk Booking und Raumreservierung | [Platzhalter - zu ergänzen] |
| 16 | IoT-Plattform | Sensor- und Gebäudeautomation | Hoch – Belegungsdaten und Raumklima | Azure-basiert |
| 17 | **Technische Standards - Facility Management** |  |  |  |
| 18 | ISO 41001:2018 | Internationaler Standard für Facility Management-Systeme | Hoch – Rahmenwerk für systematisches FM | Zertifizierungsbasis |
| 19 | DIN EN 15221 Serie | Europäische FM-Normen (Begriffe, Vereinbarungen, Qualität, Flächen) | Hoch – Standardisierte Flächenmessung und Benchmarking | Teil 1-7 relevant |
| 20 | GEFMA 444 | Computer Aided Facility Management (CAFM) Zertifizierung | Hoch – Anforderungen für CAFM-Systeme | Software-Anforderungen |
| 21 | **Technische Standards - Arbeitsplatz & Ergonomie** |  |  |  |
| 22 | WELL Building Standard v2 | Gesundheit und Wohlbefinden in Gebäuden | Mittel – Mitarbeiterzufriedenheit und Produktivität | 10 Konzepte inkl. Luft, Licht |
| 23 | ISO 45001:2018 | Arbeitsschutzmanagementsysteme | Hoch – Systematischer Gesundheitsschutz | Ersetzt OHSAS 18001 |
| 24 | EN ISO 9241 Serie | Ergonomie der Mensch-System-Interaktion | Sehr hoch – Bildschirmarbeitsplätze und Software-Ergonomie | Arbeitsplatzgestaltung |
| 25 | ISO 21542:2021 | Barrierefreiheit und Nutzbarkeit von Bauten | Sehr hoch – Accessibility-Compliance | NEU: Korrigiert von ISO 23045 |
| 26 | Leesman Index | Globaler Benchmark für Arbeitsplatzeffektivität | Mittel – Ziel: Score 70+ für exzellente Arbeitsplätze | Mitarbeiterbefragung |
| 27 | **Technische Standards - Digitalisierung & BIM** |  |  |  |
| 28 | IFC 4.3 / ISO 16739-1:2024 | Building Information Modeling Datenaustausch | Hoch – BIM-Integration für digitale Zwillinge | Interoperabilität |
| 29 | IBPDI | International Building Performance & Data Initiative | Mittel – Standardisierung von Gebäudedaten | NEU: Common Data Model |
| 30 | MQTT/CoAP | IoT-Kommunikationsprotokolle | Mittel – Sensoranbindung für Belegungsdaten | Leichtgewichtig |
| 31 | **Technische Standards - Nachhaltigkeit & Energie** |  |  |  |
| 32 | SIA 2040:2017 | Effizienzpfad Energie | Niedrig – 2000-Watt-Gesellschaft Ziele | Schweizer Energiestrategie, eher Datendomäne Energie und Ressourcen |
| 33 | SNBS 2.1 Hochbau | Standard Nachhaltiges Bauen Schweiz | Sehr hoch – Nachhaltigkeitszertifizierung Bundesbauten | Gesellschaft, Wirtschaft, Umwelt |
| 34 | Minergie / Minergie-ECO | Schweizer Energieeffizienz-Label | Hoch – Fachlicher Standard Schweiz | NEU: Gesundheit + Energie, eher Datendomäne Energie und Ressourcen |
| 35 | ISO 14001:2015 | Umweltmanagementsysteme | Mittel – Systematisches Umweltmanagement | Integration mit ISO 50001 |
| 36 | ISO 50001:2018 | Energiemanagementsysteme | Sehr hoch – Energiestrategie 2050 | NEU: Portfolio-Management |
| 37 | SN EN 15232-1:2017 | Energieeffizienz durch Gebäudeautomation | Hoch – Smart Building Integration | BAC-Klassen A-D |
| 38 | **Technische Standards - Gebäudeautomation** |  |  |  |
| 39 | BACnet (ISO 16484-5) | Building Automation and Control Networks | Hoch – Offener Standard Gebäudeautomation | NEU: Schweiz-Standard |
| 40 | KNX (ISO/IEC 14543-3) | Europäischer Standard für Haus- und Gebäudesystemtechnik | Mittel – Weit verbreitet in Europa | NEU: 500+ Hersteller |
| 41 | IWMS Standards | Integrated Workplace Management Systems | Mittel – Technologieplattform für Workspace Management | Gartner Magic Quadrant |
| 42 | ITIL v4 | IT Service Management | Mittel – Service Desk für Workplace Services | Incident/Change Management |
| 43 | **Technische Standards - Messung & Flächen** |  |  |  |
| 44 | SIA 416:2003 | Flächen und Volumen von Gebäuden | Sehr hoch – Schweizer Standard Flächenberechnung | De-facto Standard |
| 45 | SIA 416/1:2007 | Kennzahlen im Facility Management | Hoch – Schweizer FM-Kennzahlen | Benchmarking-Basis |
| 46 | DIN 277:2021 | Grundflächen und Rauminhalte von Bauwerken | Mittel – Alternative Flächenberechnung | Für D/A/CH-Vergleiche |
| 47 | IPMS | International Property Measurement Standards | Niedrig – Internationale Vergleichbarkeit | Globale Harmonisierung |
| 48 | **Technische Standards - Bauplanung** |  |  |  |
| 49 | SIA 113:2010 | FM-gerechte Bauplanung und Realisierung | Sehr hoch – Übergabe an Betrieb | Dokumentationsanforderungen |
| 50 | SIA 500:2009 | Hindernisfreie Bauten | Sehr hoch – Barrierefreiheit rechtlich gefordert | NEU: BehiG-Umsetzung |
| 51 | SIA 380/1:2016 | Thermische Energie im Hochbau | Hoch – Heizenergiebedarf | Minergie-Grundlage |
| 52 | SIA 382/1:2014 | Lüftungs- und Klimaanlagen | Hoch – Raumluftqualität | HVAC-Anforderungen |
| 53 | **Technische Standards - Qualität & Prozesse** |  |  |  |
| 54 | ISO 9001:2015 | Qualitätsmanagementsysteme | Mittel – Prozessqualität im FM | Kontinuierliche Verbesserung |
| 55 | ISO 16000-40:2019 | Indoor Air Quality Management System | Hoch – Systematisches IAQ-Management | NEU: Post-COVID Fokus |
| 56 | **Externe Beispiele - Arbeitskonzepte** |  |  |  |
| 57 | Activity Based Working (ABW) | Flexibles Arbeitsplatzkonzept | Hoch – Moderne Arbeitsformen | Keine feste Platzzuweisung |
| 58 | Desk Sharing / Hot-Desking | Geteilte Arbeitsplatznutzung | Hoch – Flächenoptimierung | Policy-Entwicklung nötig |
| 59 | Hybride Arbeitsmodelle | Kombination Büro und Remote-Arbeit | Sehr hoch – Post-Pandemie Standard | Interne Richtlinien nötig |
| 60 | **Externe Beispiele - Zertifizierungen** |  |  |  |
| 61 | LEED v4.1 | Leadership in Energy and Environmental Design | Niedrig – Primär Nordamerika | Alternative: SNBS |
| 62 | DGNB | Deutsche Gesellschaft für Nachhaltiges Bauen | Niedrig – Deutschland-Fokus | SGNI Schweiz-Adaption |
| 63 | BREEAM | Building Research Establishment Environmental Assessment | Niedrig – UK-Standard | Internationale Alternative |

Tabelle: Übersicht der relevanten Standards

# 5. Wichtigste Standards im Detail (schrittweise Ergänzung)

Zur einheitlichen Klassifizierung der Begriffe und Standards werden folgende Kategorien verwendet:

- **Fachanwendung**: Operatives IT-System, Register oder Plattform mit definiertem Zweck, Datenhoheit und Schnittstellen.
- **Geschäftsprozess**: Strukturierte Abfolge von Aktivitäten zur Erreichung eines klar definierten fachlichen Ziels, inkl. Rollen und Ergebnissen.
- **Geschäftsobjekt**: Fachlich abgegrenzte Entität mit eindeutiger Identität über ihren Lebenszyklus (z. B. Identifikator, Zustände).
- **Geschäftsobjekttyp**: Spezialisierung oder Ausprägung eines Geschäftsobjekts mit zusätzlichen Merkmalen oder Regeln.
- **Dokument**: Informationsträger zur Dokumentation, Kommunikation oder Nachweisführung, analog oder digital, mit Metadaten.
- **Attribut**: Eigenschaft oder Merkmal eines Geschäftsobjekts, fachlich definiert und typisiert.
- **Fachbegriff**: Begriff, Definition oder Klassifikation mit fachlicher Bedeutung ohne eigene Objektidentität.
- **Relation**: Fachlich begründete Beziehung zwischen Geschäftsobjekten (z. B. Zugehörigkeit, Referenz, Abhängigkeit), inklusive Kardinalitäten und Regeln.

### 5.X IBPDI

- **Priorität**:
- **Beschreibung**:
- **Relevanz für BBL**:
- **Dokumentation:**

|  | Begriff | Kategorie | Beschreibung | Relevanz BBL |
| --- | --- | --- | --- | --- |
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
