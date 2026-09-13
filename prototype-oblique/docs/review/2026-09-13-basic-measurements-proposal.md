# Basic architectural measurements — implemented, 13 September 2026

The user approved the minimum profile and specified **Nettofläche** for Zone. Seven draft attribute definitions are now applied in Supabase and visible on localhost. This is catalog content: actual values and evidence remain in Bemessung/source systems; no automatic calculation was added.

| Geschäftsobjekt | Attribut | Einheit | Bemessungsart |
|---|---|---|---|
| Grundstück | Grundstücksfläche (GSF) | m² | `GSF` |
| Raum | Raumfläche (netto) | m² | `RAUMFLAECHE` |
| Raum | Lichte Raumhöhe | m | `RAUMHOEHE` |
| Raum | Raumvolumen (netto) | m³ | `RAUMVOLUMEN` |
| Nutzungseinheit | Nettogeschossfläche (NGF) | m² | `NGF` |
| Parkplatz | Parkierfläche | m² | `PARKIERFLAECHE` |
| Zone | Nettofläche | m² | `ZONENFLAECHE` |

Added NGF and PARKIERFLAECHE to BBL Bemessungsart (now 15 choices), and measuredFor definition links for Nutzungseinheit and Parkplatz (now seven candidate target-type links). Existing code identities and broader meanings remain intact: RAUMFLAECHE and ZONENFLAECHE select the documented net rule for these particular profiles. The legacy retired Grundstück.Fläche was preserved. Gebäude's five existing GF/GGF/VMF/EBF/GV attributes are unchanged; NF/HNF and apartment count remain excluded there. Geschoss's four earlier conceptual quantities are still not added as visible attributes.

Select one applicable measurement by object, type, rule/edition and date. Room height means clear height; irregular room volume is not universally area × one height. Parking means one space without access/manoeuvring area. NGF uses the assigned internal rooms once; overlapping zones must not be summed blindly. Unknown values stay unknown.

The [official SIA 416 contents](https://shop.sia.ch/50aee6ea-cbe6-4e1a-9324-2834bd24d9af/F/DownloadAnhang) distinguish area and volume categories. Only the public preview was inspected, not the full paywalled norm. The [Zürich 2025 Flächennachweis guide](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/planen-bauen/hochbau/planungsgrundlagen/cad/grundlagen/Richtlinie%20Fl%C3%A4chennachweis%20(2025).pdf), page 19, supports separating parking spaces and vehicle circulation; its local rules are not automatically BBL rules.

Applied 19 audited commands in one transaction after a full rollback preview. Exact before/after verification preserved all existing history and source inventories; independent postflight returned 254 attributes, 2,120 code values and 121 relationships before the subsequent FK batch. Evidence is in [measurements-spatial](2026-09-13-measurements-spatial/). RLS, public browsing and denied direct writes are unchanged. No schema migration or commit/push was performed for this batch.
