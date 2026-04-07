"""
Script to generate consolidated business concepts from domain markdown files.
Removes duplicates and assigns primary domain to each concept.
"""

import pandas as pd
from pathlib import Path

# Define all concepts extracted from the markdown files
# Format: (Domain, Group, Concept, Priority, Description, Relevant Standards, Comment)

concepts_data = []

# ==================== Architektonische Sicht ====================
domain = "Architektonische Sicht"
concepts_data.extend([
    # Räumliche Objekte
    (domain, "Räumliche Objekte", "Standort", "Kann", "Geografische Gruppierung mehrerer Grundstücke und Gebäude für Verwaltungszwecke", "IFC (IfcSite), IBPDI (Site)", "Bildet Areale oder ein Campus"),
    (domain, "Räumliche Objekte", "Grundstück", "Muss", "Räumlich abgrenzbare Bodeneinheit mit eigenständigen Eigentumsrechten", "ZGB, GBV, eCH-0129, eGRISDM", "Rechtliche Grundlage, global"),
    (domain, "Räumliche Objekte", "Bodenabdeckung", "Soll", "Versiegelte und unversiegelte Flächen gemäss amtlicher Vermessung", "DM.01-AV-CH, eGRISDM", "Für Umgebungsflächenmanagement"),
    (domain, "Räumliche Objekte", "Gebäude", "Muss", "Mit dem Boden fest verbundenes Bauwerk mit eindeutiger Identifikation", "VGWR, eCH-0129, IFC, IBPDI", "Zentrale Verwaltungseinheit, global"),
    (domain, "Räumliche Objekte", "Geschoss", "Muss", "Horizontale Gliederungsebene innerhalb eines Gebäudes", "VGWR, IFC, SIA 416", "Für Flächenmanagement, bildet ein CAFM Basisplan"),
    (domain, "Räumliche Objekte", "Raum", "Soll", "Funktional definierter Bereich innerhalb eines Geschosses", "IFC, IBPDI, SIA 416", "Detaillierteste Verwaltungseinheit"),
    (domain, "Räumliche Objekte", "Fläche / Bemessung", "Muss", "2D Darstellung von Räumlichen Objekten", "", ""),
    (domain, "Räumliche Objekte", "Gebäudeeingang", "Soll", "Physischer Zugang zu einem Gebäude", "VGWR, eCH-0129", "Für Adressierung und Zugang"),
    (domain, "Räumliche Objekte", "Zone", "Soll", "Funktionale oder technische Bereiche (Brandabschnitte, Klimazonen)", "Bauen Digital CH, IFC", "Für spezialisierte Anwendungen"),
    (domain, "Räumliche Objekte", "Nutzungseinheit", "Soll", "Bauliche Einheit mit eigenem Zugang (Wohnung, Gewerbe, sonstige Nutzung)", "VGWR, eCH-0129", "Erweitert Wohnung um alle Nutzungsarten"),
    (domain, "Räumliche Objekte", "Parkplatz", "Soll", "Stellfläche für Fahrzeuge, Velos, oder Sonstiges, mit eindeutiger ID", "-", "Werden in Reservierungssystemen genutzt"),
    # Rechtliche Objekte
    (domain, "Rechtliche Objekte", "Eigentumsrecht", "Soll", "Rechtliche Zuordnung von Eigentum an Grundstücken/Gebäuden", "ZGB, eGRISDM", "Rechtliche Grundlage"),
    (domain, "Rechtliche Objekte", "Baurecht", "Kann", "Selbständiges und dauerndes Recht auf fremdem Grundstück", "ZGB, eGRISDM", "Für komplexe Rechtsverhältnisse"),
    (domain, "Rechtliche Objekte", "Dienstbarkeit", "Kann", "Beschränkung des Eigentums zugunsten eines berechtigten Grundstücks", "ZGB, eGRISDM", "Für Zugangs- und Leitungsrechte"),
    # Technische Objekte
    (domain, "Technische Objekte", "System", "Kann", "Funktionale Gruppierung technischer Anlagen (HLK, Elektro, Sanitär)", "IFC, IBPDI", "Nicht nur für TGA-Management, Systeme können auch Fassaden, Tragwerke sein"),
    (domain, "Technische Objekte", "Technische Anlage", "Muss", "HLK Gebäudetechnische Anlage (Heizung, Klima, Lüftung)", "SIA, GEFMA", "Ist ein Typ von System (Ausprägung)"),
    (domain, "Technische Objekte", "Heizungsanlage", "Soll", "Wärmeerzeugung, -verteilung und -abgabe", "IFC, IBPDI, REC, Brick Schema, eBKP-H (D05)", "Spezialisierung von System. Zentral für Wärmeversorgung"),
    (domain, "Technische Objekte", "Lüftungsanlage", "Soll", "Luftaufbereitung, -verteilung und Luftwechsel", "IFC, IBPDI, REC, Brick Schema, ASHRAE, eBKP-H (D07)", "Spezialisierung von System. Wichtig für Luftqualität"),
    (domain, "Technische Objekte", "Kälteanlage", "Soll", "Kälteerzeugung, -verteilung und Klimatisierung", "IFC, IBPDI, REC, Brick Schema, ASHRAE, eBKP-H (D06)", "Spezialisierung von System. Kühlung und Klimatisierung"),
    (domain, "Technische Objekte", "Elektroanlage", "Soll", "Elektrische Versorgungssysteme inkl. Stark- und Schwachstrom", "IFC, IBPDI, REC, Brick Schema, eBKP-H (D01)", "Spezialisierung von System. Kritisch für Gebäudebetrieb"),
    (domain, "Technische Objekte", "Beleuchtungsanlage", "Soll", "Beleuchtungssysteme inkl. Steuerung und Notbeleuchtung", "IFC, IBPDI, REC, Brick Schema, DALI", "Spezialisierung von System. Energieeffizienz und Komfort"),
    (domain, "Technische Objekte", "Sanitäranlage", "Soll", "Wasser- und Abwassersysteme inkl. aller sanitären Installationen", "IFC, IBPDI, REC, eBKP-H (D08/D09)", "Spezialisierung von System. Grundversorgung"),
    (domain, "Technische Objekte", "Aufzugsanlage", "Soll", "Vertikale Beförderungsanlagen (Aufzüge, Fahrtreppen)", "IFC, IBPDI, REC, eBKP-H (D12)", "Spezialisierung von System. Wichtig für Barrierefreiheit"),
    (domain, "Technische Objekte", "Brandschutzanlage", "Soll", "Technische Brandschutzeinrichtungen (Sprinkler, Brandmelder, RWA)", "IFC, IBPDI, REC, eBKP-H (D04), VKF", "Spezialisierung von System. Sicherheitskritisch"),
    (domain, "Technische Objekte", "Sicherheitsanlage", "Soll", "Einbruch-, Zutritts- und Überwachungssysteme", "IFC, IBPDI, REC, eBKP-H (D03)", "Spezialisierung von System. Schutz von Personen und Sachwerten"),
    (domain, "Technische Objekte", "Kommunikationsanlage", "Soll", "IT-Netzwerke, Telefonie, Datenübertragung", "IFC, IBPDI, REC, Brick Schema", "Spezialisierung von System. Digitale Infrastruktur"),
    (domain, "Technische Objekte", "Gebäudeautomation", "Soll", "Mess-, Steuer- und Regelungssysteme für Gebäudetechnik", "IFC, IBPDI, REC, Brick Schema, BACnet, eBKP-H (D02)", "Spezialisierung von System. Basis für Smart Building"),
    (domain, "Technische Objekte", "Energieerzeugungsanlage", "Soll", "Photovoltaik, BHKW, Wärmepumpen zur Eigenproduktion", "IFC, IBPDI, REC, Brick Schema", "Spezialisierung von System. Nachhaltigkeit und Autarkie"),
    (domain, "Technische Objekte", "Komponente", "Muss", "Einzelne technische Bauteile und Geräte", "IFC, IBPDI, Bauen Digital CH", "Für Wartung und Betrieb"),
    (domain, "Technische Objekte", "Sensor", "Soll", "IoT-Geräte zur Performance-Überwachung", "IBPDI", "Für IoT und Smart Building"),
    # Konstruktive Objekte
    (domain, "Konstruktive Objekte", "Bauteil", "Soll", "Physische Bauteile der Gebäudestruktur", "IFC, Bauen Digital CH", "Übergeordnete Klasse für alle konstruktiven Elemente"),
    (domain, "Konstruktive Objekte", "Bauteiltyp", "Soll", "Standardisierte Typendefinition für Bauteile", "IFC (IfcBuildingElementType), Bauen Digital CH", "Ermöglicht Wiederverwendung von Standards"),
    (domain, "Konstruktive Objekte", "Wand", "Soll", "Vertikale raumabschliessende oder tragende Konstruktion", "IFC (IfcWall), eBKP-H (C2/E/G1), SIA 416", "Spezialisierung von Bauteil. Tragend/Nichttragend, Aussen/Innen"),
    (domain, "Konstruktive Objekte", "Decke/Bodenplatte", "Soll", "Horizontale tragende Konstruktion", "IFC (IfcSlab), eBKP-H (C3), SIA 260", "Spezialisierung von Bauteil. Inkl. Bodenplatten"),
    (domain, "Konstruktive Objekte", "Dach", "Soll", "Oberer Gebäudeabschluss mit Witterungsschutz", "IFC (IfcRoof), eBKP-H (F), SIA 232", "Spezialisierung von Bauteil. Flach-/Steildach"),
    (domain, "Konstruktive Objekte", "Stütze", "Soll", "Vertikales Tragelement", "IFC (IfcColumn), eBKP-H (C2.2)", "Spezialisierung von Bauteil"),
    (domain, "Konstruktive Objekte", "Träger/Balken", "Soll", "Horizontales Tragelement", "IFC (IfcBeam), eBKP-H (C2.3)", "Spezialisierung von Bauteil"),
    (domain, "Konstruktive Objekte", "Fundament", "Soll", "Gründungskonstruktion des Gebäudes", "IFC (IfcFooting), eBKP-H (C1), SIA 267", "Spezialisierung von Bauteil. Basis des Tragwerks"),
    (domain, "Konstruktive Objekte", "Treppe", "Soll", "Vertikale Erschliessung zwischen Geschossen", "IFC (IfcStair), eBKP-H (G4), SIA 500", "Spezialisierung von Bauteil. Sicherheitsrelevant"),
    (domain, "Konstruktive Objekte", "Tür", "Soll", "Bewegliches Element für Raumzugang", "IFC (IfcDoor), eBKP-H (G2.1), SIA 343", "Spezialisierung von Bauteil. Inkl. Brandschutztüren"),
    (domain, "Konstruktive Objekte", "Fenster", "Soll", "Öffnung in Aussenwand für Belichtung/Lüftung", "IFC (IfcWindow), eBKP-H (E3), SIA 331", "Spezialisierung von Bauteil. Energierelevant"),
    (domain, "Konstruktive Objekte", "Fassade", "Soll", "Aussenhaut des Gebäudes", "IFC (IfcCurtainWall), eBKP-H (E), SIA 243", "Spezialisierung von Bauteil. Vorhangfassade oder massive Fassade"),
    # Bauprodukte und Materialien
    (domain, "Bauprodukte und Materialien", "Bauprodukt", "Muss", "Vorgefertigtes oder katalogisiertes Produkt für den Einbau", "IFC (IfcProduct), NPK, CRB", "Basis für Produktkataloge und Beschaffung"),
    (domain, "Bauprodukte und Materialien", "Material", "Soll", "Werkstoff mit physikalischen und ökologischen Eigenschaften", "IFC (IfcMaterial), KBOB, Minergie-ECO", "Zentral für Nachhaltigkeit und Bauphysik"),
    (domain, "Bauprodukte und Materialien", "Materialschicht", "Kann", "Einzelne Schicht in einem Schichtaufbau", "IFC (IfcMaterialLayer), SIA 180", "Für bauphysikalische Berechnungen"),
    (domain, "Bauprodukte und Materialien", "Schichtaufbau", "Kann", "Mehrschichtiger Materialverbund eines Bauteils", "IFC (IfcMaterialLayerSet), SIA 279", "U-Wert, Schallschutz, Brandschutz"),
    # Übergreifend
    (domain, "Übergreifend", "Adresse", "Muss", "Strukturierte Adressinformationen für Grundstücke, Gebäude und Eingänge", "eCH-0010, VGWR, DM.01-AV-CH", "In Domäne 'Organisatorische Daten' verschoben"),
    (domain, "Übergreifend", "Koordinaten", "Soll", "Geografische Koordinaten für räumliche Objekte", "DM.01-AV-CH, LV95, IBPDI", "In Domäne 'Organisatorische Daten' verschoben"),
    (domain, "Übergreifend", "Zertifikat", "Soll", "Zertifikate für Gebäude, Anlagen, Bauprodukte", "IBPDI, Bauen Digital CH", "Für alle Objekte relevant (MINERGIE, CE, etc.)"),
    # Messungen/Performance
    (domain, "Messungen/Performance", "Bemessung", "Muss", "Flächen, Volumen, Längen, Stückzahlen nach SIA 416", "SIA 416, IBPDI", "Flexibel für alle Messgrössen"),
    (domain, "Messungen/Performance", "Sensormessung", "Soll", "Zeitreihen-Messwerte von IoT-Sensoren", "IBPDI", "Für Performance-Monitoring"),
])

# ==================== Dokumentenmanagement ====================
domain = "Dokumentenmanagement"
concepts_data.extend([
    (domain, "Dokumentstruktur", "Dokument", "Muss", "Einzelne aufgezeichnete Information unabhängig vom Informationsträger (Pläne, Verträge, Berichte, E-Mails)", "eCH-0039, KBOB BWD, ISO 15489", "Zentrale Verwaltungseinheit für alle BBL-Informationen"),
    (domain, "Dokumentstruktur", "Dossier", "Muss", "Zusammengehörige Dokumente zu einem Geschäft oder Vorgang als strukturierte Einheit", "eCH-0039, ArchG, GEVER", "Organisationseinheit für Geschäftsfälle und Projekte"),
    (domain, "Dokumentstruktur", "Version", "Muss", "Versionierte Instanz eines Dokuments mit Änderungshistorie", "eCH-0039, ISO 15489", "Für Nachvollziehbarkeit und Änderungsmanagement"),
    (domain, "Dokumentstruktur", "Dokumenttyp", "Soll", "Katalogentität für die Klassifikation ähnlicher Dokumente mit spezifischem Informationsgehalt", "KBOB BWD", "Strukturiert Dokumentablage nach Leistungsbereichen"),
    (domain, "Metadaten", "Metadatensatz", "Soll", "Eigenständige Entität für strukturierte Beschreibungsinformationen zu Dokumenten", "Dublin Core, ISO 23081, eCH-0039", "Flexibles Metadatenmanagement"),
    (domain, "Prozesse", "Workflow", "Soll", "Definierter Ablauf für Dokumentenbearbeitung mit Status und Übergängen", "eCH-0039, ISO 15489", "Steuert Dokumentenlebenszyklen"),
    (domain, "Prozesse", "Anweisung", "Kann", "Strukturierte Handlungsanweisung für Dokumentenbearbeitung", "eCH-0039", "Directive gemäss eCH-0039"),
    (domain, "Archivierung", "Archivgut", "Muss", "Dokumente mit bleibendem Wert, die dauerhaft aufbewahrt werden", "ArchG, ISAD(G)", "Endstatus wertvoller Dokumente"),
    (domain, "Archivierung", "Vorarchiv", "Kann", "Zwischenlager für Dokumente vor der definitiven Archivierung", "ArchG", "Übergangsbereich vor Archivierung"),
    (domain, "Organisation", "Registraturplan", "Soll", "Systematisches Ordnungssystem für die strukturierte Ablage", "ArchG, eCH-0002", "Basis für Ablagestruktur"),
    (domain, "Kommunikation", "Nachricht", "Kann", "Standardisierte Struktur für Dokumentenaustausch zwischen Systemen", "eCH-0039", "Transportcontainer für Austausch"),
])

# ==================== Energie und Ressourcen ====================
domain = "Energie und Ressourcen"
concepts_data.extend([
    # Energie-Infrastruktur
    (domain, "Energie-Infrastruktur", "Energieträger", "Muss", "Art der eingesetzten Energie (Öl, Gas, Fernwärme, Strom, erneuerbare)", "PACTA, EnG, CO2-Gesetz", "Basis für Emissionsberechnung"),
    (domain, "Energie-Infrastruktur", "Zähler/Messpunkt", "Muss", "Erfassungspunkt für Energie- und Ressourcenverbrauch", "InterWatt EDM, IBPDI, SAP PM", "Zentral für Verbrauchserfassung"),
    (domain, "Energie-Infrastruktur", "Zählwert/Messwert", "Muss", "Gemessene Verbrauchsdaten zu definiertem Zeitpunkt", "InterWatt EDM, IBPDI", "Basis für alle Berechnungen"),
    # Emissionen & Klimadaten
    (domain, "Emissionen & Klimadaten", "THG-Emission Scope 1", "Muss", "Direkte Emissionen aus eigenen Quellen", "GHG Protocol, PACTA, KlG", "Kernindikator Klimaziele"),
    (domain, "Emissionen & Klimadaten", "THG-Emission Scope 2", "Muss", "Indirekte Emissionen aus eingekaufter Energie", "GHG Protocol, PACTA, KlG", "Emissionen Strombezug"),
    (domain, "Emissionen & Klimadaten", "THG-Emission Scope 3", "Soll", "Vor-/nachgelagerte Emissionen (graue Energie)", "GHG Protocol, PACTA, KlG", "Vollständige Klimabilanz"),
    (domain, "Emissionen & Klimadaten", "Emissionsfaktor", "Muss", "Umrechnungsfaktor Energie zu CO2-Äquivalenten", "BAFU, GHG Protocol", "Grundlage Emissionsberechnung"),
    (domain, "Emissionen & Klimadaten", "Dekarbonisierungspfad", "Muss", "Zeitlicher Verlauf der Ziel-CO2-Intensität", "CRREM, SIA 2040, KlG", "Benchmark für Zielerreichung"),
    # Kennzahlen & Benchmarks
    (domain, "Kennzahlen & Benchmarks", "Energiebezugsfläche", "Muss", "Beheizte Fläche innerhalb thermischer Hülle", "SIA 380/1, PACTA", "Bezugsgröße für alle KPIs"),
    (domain, "Kennzahlen & Benchmarks", "Energieintensität", "Muss", "Energieverbrauch pro m² und Jahr", "CRREM, SIA 2040", "Effizienz-Benchmark"),
    (domain, "Kennzahlen & Benchmarks", "CO2-Intensität", "Muss", "THG-Emissionen pro m² und Jahr", "CRREM, PACTA", "Klimaverträglichkeits-KPI"),
    (domain, "Kennzahlen & Benchmarks", "Absenkpfad", "Muss", "Gebäudespezifischer Reduktionspfad bis 2040/2050", "PACTA, KlG", "Individueller Zielpfad"),
    (domain, "Kennzahlen & Benchmarks", "Wasserverbrauch", "Soll", "Verbrauch von Trink- und Brauchwasser", "IBPDI, RUMBA", "Ressourcenmanagement"),
    (domain, "Kennzahlen & Benchmarks", "Abfallaufkommen", "Kann", "Art und Menge anfallender Abfälle", "RUMBA, USG", "Kreislaufwirtschaft"),
    # Zertifizierungen
    (domain, "Zertifizierungen", "Energieausweis", "Soll", "Offizielle Energieeffizienz-Bewertung", "GEAK, Minergie", "Nachweis Energiestandard"),
    (domain, "Zertifizierungen", "Nachhaltigkeitszertifikat", "Kann", "Umfassende Nachhaltigkeitsbewertung", "SNBS, LEED, BREEAM", "Erweiterte ESG-Bewertung"),
])

# ==================== Mietermanagement (Nutzungssicht) ====================
domain = "Mietermanagement (Nutzungssicht)"
concepts_data.extend([
    # Vertragswesen
    (domain, "Vertragswesen", "Mietvertrag", "Muss", "Rechtliche Vereinbarung zwischen Vermieter und Mieter über die Gebrauchsüberlassung einer Mietsache", "OR Art. 253-274, SAP RE-FX, IBPDI, RICS", "Zentrales Geschäftsobjekt, Basis für alle Mietprozesse"),
    (domain, "Vertragswesen", "Pachtvertrag", "Soll", "Vertrag über die Überlassung einer ertragsfähigen Sache", "OR, SAP RE-FX", "Ergänzung für spezielle Nutzungen"),
    (domain, "Vertragswesen", "Untermietvertrag", "Soll", "Vereinbarung über die teilweise oder vollständige Weitergabe der Mietsache", "OR Art. 262", "Für Untermietverhältnisse"),
    (domain, "Vertragswesen", "Vertragszusatz", "Kann", "Ergänzungen und Nachträge zum Hauptvertrag", "SAP RE-FX", "Für Vertragsanpassungen"),
    # Mietobjekte
    (domain, "Mietobjekte", "Mietobjekt", "Muss", "Vermietbare Einheit (übergeordnet)", "SAP RE-FX, VGWR", "Abstrakte Oberklasse für alle vermietbaren Einheiten"),
    (domain, "Mietobjekte", "Mietfläche", "Muss", "Konkrete vermietbare Fläche innerhalb eines Gebäudes", "SAP RE-FX, SIA 416", "Spezifische Flächeneinheit"),
    (domain, "Mietobjekte", "Mieteinheit", "Kann", "Abgeschlossene bauliche Einheit mit eigenem Zugang", "VGWR, SAP RE-FX, IBPDI", "Wohnung, Büro, Gewerbeeinheit"),
    (domain, "Mietobjekte", "Flächenpool", "Kann", "Flexible Sammlung vermietbarer Flächen", "SAP RE-FX", "Für variable Flächenzuteilung"),
    (domain, "Mietobjekte", "Stellplatz", "Kann", "Parkplatz oder Abstellfläche", "SAP RE-FX", "Ergänzende Mietobjekte"),
    # Vertragsparteien
    (domain, "Vertragsparteien", "Mieter", "Muss", "Vertragspartei, die die Mietsache nutzt", "OR, SAP RE-FX, IBPDI", "Natürliche oder juristische Person"),
    (domain, "Vertragsparteien", "Vermieter", "Muss", "Vertragspartei, die die Mietsache überlässt", "OR, SAP RE-FX", "BBL als Vermieter"),
    (domain, "Vertragsparteien", "Hauptmieter", "Soll", "Primärer Vertragspartner bei Untermietverhältnissen", "OR", "Für komplexe Mietverhältnisse"),
    (domain, "Vertragsparteien", "Bürge", "Kann", "Person, die für Mietverbindlichkeiten haftet", "OR", "Sicherheitsleistung"),
    # Finanzielle Objekte
    (domain, "Finanzielle Objekte", "Mietzins", "Muss", "Vereinbarte Gegenleistung für die Gebrauchsüberlassung", "OR, SAP RE-FX, RICS", "Attribut des Mietvertrags"),
    (domain, "Finanzielle Objekte", "Nebenkosten", "Muss", "Betriebskosten und Zusatzleistungen", "OR, SVIT, SAP RE-FX", "Heizung, Wasser, Hauswartung etc."),
    (domain, "Finanzielle Objekte", "Kaution", "Soll", "Sicherheitsleistung des Mieters", "OR Art. 257e", "Max. 3 Monatszinse"),
    (domain, "Finanzielle Objekte", "Mietzinsanpassung", "Soll", "Dokumentierte Änderung des Mietzinses", "OR, SAP RE-FX", "Indexierung, Referenzzins"),
    (domain, "Finanzielle Objekte", "Nebenkostenabrechnung", "Muss", "Periodische Abrechnung der Nebenkosten", "SVIT, HEV, SAP RE-FX", "Jährliche Abrechnung"),
    # Prozessobjekte
    (domain, "Prozessobjekte", "Kündigung", "Muss", "Beendigung des Mietverhältnisses", "OR Art. 266a-266o", "Ordentliche/ausserordentliche Kündigung"),
    (domain, "Prozessobjekte", "Mahnung", "Soll", "Zahlungserinnerung bei ausstehenden Forderungen", "OR, IBPDI", "Mahnprozess"),
    (domain, "Prozessobjekte", "Übergabeprotokoll", "Soll", "Dokumentation des Zustands bei Ein-/Auszug", "OR", "Mängeldokumentation"),
    (domain, "Prozessobjekte", "Schlichtungsverfahren", "Kann", "Verfahren bei Streitigkeiten", "OR", "Mietschlichtungsbehörde"),
    # Kommunikation
    (domain, "Kommunikation", "Mieterkorrespondenz", "Soll", "Schriftverkehr mit Mietern", "IBPDI", "Anfragen, Mitteilungen"),
    # Technische Objekte
    (domain, "Technische Objekte", "Zähler (Mieter)", "Soll", "Verbrauchszähler für Energie und Wasser", "SAP PM", "Für verbrauchsabhängige Abrechnung"),
    (domain, "Technische Objekte", "Schlüssel", "Soll", "Zugangsberechtigung und -verwaltung", "-", "Schlüsselmanagement"),
    # Bemessungen
    (domain, "Bemessungen", "Flächenmessung (Bemessung)", "Muss", "Verschiedene Flächenkennzahlen nach SIA 416", "SIA 416, IBPDI", "VMF, HNF, NNF, NGF, etc."),
    (domain, "Bemessungen", "Arbeitsplatz", "Soll", "Anzahl und Typ der Arbeitsplätze", "KBOB", "Für Bundesnutzung"),
])

# ==================== Organisatorische Daten (MDM) ====================
domain = "Organisatorische Daten (MDM)"
concepts_data.extend([
    (domain, "Akteur", "Organisation", "Muss", "Juristische Personen und Organisationseinheiten (Mieter, Dienstleister, Behörden, Bundesstellen)", "UIDG/V, eCH-0108, eCH-0098, IBPDI CDM", "Gesetzlich verpflichtend gemäss UIDG"),
    (domain, "Akteur", "Person", "Muss", "Natürliche Personen als Ansprechpartner, Einzelunternehmer oder Verantwortliche", "eCH-0044, eCH-0011, revDSG", "Datenschutzkonform gemäss revDSG"),
    (domain, "Akteur", "Kontakt", "Soll", "Kommunikationskanäle (Telefon, E-Mail, elektronische Services)", "eCH-0046, IBPDI CDM", "Best Practice für strukturierte Kommunikation"),
    (domain, "Akteur", "Rolle", "Muss", "Definition von Verantwortlichkeiten (Eigentümer, Mieter, FM-Verantwortlicher, Projektleiter)", "IBPDI CDM, OR Art. 253ff", "Rechtlich erforderlich für Verträge"),
    (domain, "Verortung", "Adresse (MDM)", "Muss", "Lokalisierungs- und Korrespondenzadressen", "eCH-0010, GWR, VGWR", "GWR-Pflicht für Bundesgebäude"),
    (domain, "Verortung", "Geokoordinate", "Soll", "Geografische Koordinaten für räumliche Verortung", "GeoIG, GeoIV, swisstopo", "Best Practice für GIS-Integration"),
])

# ==================== Projektmanagement ====================
domain = "Projektmanagement"
concepts_data.extend([
    # Portfolioverwaltung
    (domain, "Portfolioverwaltung", "Portfolio", "Muss", "Oberste Organisationsstruktur für strategische Projekt- und Programmverwaltung", "SAP EPPM", "Kernobjekt EPPM, Parent für Initiativen"),
    (domain, "Portfolioverwaltung", "Initiative (Programm)", "Muss", "Programm-Ebene zur Bündelung mehrerer zusammenhängender Projekte", "SAP EPPM", "Kernobjekt EPPM, Container für Elemente"),
    (domain, "Portfolioverwaltung", "Element", "Muss", "Einzelnes Portfolio-Item, das ein konkretes Projekt oder Vorhaben repräsentiert", "SAP EPPM", "Kernobjekt EPPM, zentrale Entität"),
    # Projektstruktur
    (domain, "Projektstruktur", "Projektdefinition", "Muss", "Hauptprojektebene mit Stammdaten, Terminen und Verantwortlichkeiten", "SAP EPPM, SAP PS", "Kernobjekt für beide Systeme"),
    (domain, "Projektstruktur", "Phase", "Muss", "Projektphasen gemäss SIA 112 (Strategische Planung bis Bewirtschaftung)", "SAP EPPM, SIA 112", "Kernobjekt EPPM, SIA-konform"),
    (domain, "Projektstruktur", "Aufgabe", "Muss", "Detaillierte Arbeitspakete mit Aufwand, Dauer und Terminen", "SAP EPPM", "Kernobjekt EPPM, hierarchisch strukturiert"),
    (domain, "Projektstruktur", "PSP-Element", "Soll", "Strukturelemente zur hierarchischen Gliederung des Projekts", "SAP PS", "Integration mit SAP PS erforderlich"),
    # Klassifizierung
    (domain, "Klassifizierung", "Klassifizierungshierarchie", "Muss", "Strukturierte Kategorisierungsebene für Portfolioelemente", "SAP EPPM", "Kernobjekt EPPM für Strukturierung"),
    (domain, "Klassifizierung", "Bereich", "Muss", "Thematische oder organisatorische Gruppierung", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Klassifizierung", "Entscheidungspunkt", "Muss", "Definierte Gates/Meilensteine für Projektfreigaben", "SAP EPPM", "Kernobjekt EPPM, steuert Lebenszyklus"),
    # Beteiligte
    (domain, "Beteiligte", "Rolle (Projekt)", "Soll", "Abstrakte Funktionsbeschreibung für Projektbeteiligte", "SAP EPPM", "Kernobjekt EPPM, Teil der Domäne MDM"),
    (domain, "Beteiligte", "Geschäftspartner", "Soll", "Konkrete Personen oder Organisationen als Projektressourcen", "SAP EPPM", "Kernobjekt EPPM, Teil der Domäne MDM"),
    (domain, "Beteiligte", "Bauherr", "Soll", "Oberster Entscheidungsträger eines Bauvorhabens (BBL)", "SIA 112, BöB", "BBL als Bauherr, Teil der Domäne MDM"),
    (domain, "Beteiligte", "Planer", "Soll", "Architekt/Ingenieur für Planung", "SIA 112", "Vertragspartner, Teil der Domäne MDM"),
    (domain, "Beteiligte", "Anbieter", "Soll", "Unternehmen in Vergabeverfahren", "BöB, VöB, SIMAP", "Vergaberelevant, Teil der Domäne MDM"),
    # Finanzierung
    (domain, "Finanzierung", "Finanzgruppe", "Muss", "Übergeordnete Gruppierung für Finanzplanungskategorien", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Finanzierung", "Finanzkategorie", "Muss", "Kategorien für Budgetierung und Kostenplanung", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Finanzierung", "Finanzsicht", "Muss", "Aggregierte Plan- und Ist-Werte aus finanzieller Perspektive", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Finanzierung", "Finanz-/Kapazitätsplanung", "Muss", "Periodische Plan- und Kapazitätswerte mit Zeitbezug", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Finanzierung", "Projektbudget", "Soll", "Kostenplanung auf PSP-Element-Ebene", "SAP PS", "PS-Integration"),
    # Qualität und Risiko
    (domain, "Qualität und Risiko", "Checkliste", "Muss", "Container für Qualitätssicherungs- und Compliance-Prüfungen", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Qualität und Risiko", "Checklistenpunkt", "Muss", "Einzelne Prüfpunkte innerhalb einer Checkliste", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Qualität und Risiko", "Risiko", "Muss", "Identifizierte Projektrisiken mit Bewertung", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Qualität und Risiko", "Massnahme", "Muss", "Definierte Aktionen zur Risikomitigation", "SAP EPPM", "Kernobjekt EPPM"),
    # Termine und Meilensteine
    (domain, "Termine und Meilensteine", "Meilenstein", "Muss", "Wichtige Projektereignisse ohne Dauer", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Termine und Meilensteine", "Ergebnis", "Muss", "Definierte Projektergebnisse/Deliverables", "SAP EPPM", "Kernobjekt EPPM"),
    (domain, "Termine und Meilensteine", "Netzplan", "Kann", "Container für Vorgänge mit Anordnungsbeziehungen", "SAP PS", "Bei PS-Nutzung relevant"),
    (domain, "Termine und Meilensteine", "Vorgang", "Kann", "Ausführbare Arbeitseinheit in Netzplan", "SAP PS", "Bei PS-Nutzung relevant"),
    # Vergabe
    (domain, "Vergabe", "Öffentlicher Auftrag", "Soll", "Vertrag zwischen BBL und Anbieterin", "BöB, VöB", "Rechtlich relevant"),
    (domain, "Vergabe", "Ausschreibung", "Soll", "Öffentliche Bekanntmachung eines Vergabeverfahrens", "SIMAP, BöB", "Vergabepflicht"),
    (domain, "Vergabe", "Los", "Kann", "Teillos einer Ausschreibung", "SIMAP", "Bei grossen Vergaben"),
    # Dokumentation
    (domain, "Dokumentation", "Projektdokument", "Soll", "Alle projektbezogenen Dokumente und Unterlagen", "ActaNova, SIMAP", "Dokumentationspflicht"),
    (domain, "Dokumentation", "Projektpflichtenheft", "Soll", "Dokument mit Funktionen und Eigenschaften des Bauwerks", "SIA 112", "SIA-Standard"),
    # Systemtechnisch
    (domain, "Systemtechnisch", "Objektverknüpfung", "Muss", "Generische Verknüpfungstabelle für flexible Objekt-Beziehungen", "SAP EPPM", "Kernobjekt EPPM, ermöglicht Integration"),
])

# Convert to DataFrame
df = pd.DataFrame(concepts_data, columns=[
    "Domäne", "Gruppe", "Konzept", "Priorität", "Beschreibung", "Relevante Standards", "Kommentar"
])

# Remove duplicates - keep the first occurrence (primary domain)
# Define primary domain priority for deduplication
domain_priority = {
    "Architektonische Sicht": 1,
    "Organisatorische Daten (MDM)": 2,
    "Dokumentenmanagement": 3,
    "Projektmanagement": 4,
    "Mietermanagement (Nutzungssicht)": 5,
    "Energie und Ressourcen": 6,
    "Portfoliomanagement": 7,
    "Finanzen": 8,
    "Metadaten": 9,
    "Workspace Management": 10,
}

# Add priority column for sorting
df["_priority"] = df["Domäne"].map(domain_priority)

# Sort by concept and priority to ensure primary domain comes first
df_sorted = df.sort_values(["Konzept", "_priority"])

# Mark duplicates
df_sorted["_is_duplicate"] = df_sorted.duplicated(subset=["Konzept"], keep="first")

# Create final dataframe without duplicates
df_final = df_sorted[~df_sorted["_is_duplicate"]].copy()

# Remove helper columns
df_final = df_final.drop(columns=["_priority", "_is_duplicate"])

# Sort by Domain and Group for final output
df_final = df_final.sort_values(["Domäne", "Gruppe", "Konzept"])

# Reset index
df_final = df_final.reset_index(drop=True)

# Save to Excel
output_path = Path(__file__).parent.parent / "Konsolidierte_Geschaeftsobjekte.xlsx"
df_final.to_excel(output_path, index=False, sheet_name="Geschäftsobjekte")

print(f"Excel file created: {output_path}")
print(f"Total unique concepts: {len(df_final)}")
print(f"\nConcepts per domain:")
print(df_final.groupby("Domäne").size())
