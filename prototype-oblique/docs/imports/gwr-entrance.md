# Geschäftsobjekt Gebäudeeingang

Content addition on 15 September 2026, based on the user-supplied `Merkmalskatalog.mhtml`, GWR **5.0.0 (revised)**. The saved page was captured on 5 September 2026. The source edition is provenance, not a local catalog version or a confirmed publication date.

The new **Gebäudeeingang** business object belongs to **Architektonische Sicht** (`bau`), at `#/objects/gebaeudeeingang`. Its definition is copied from the source. The business object and its attributes are **Entwurf**, consistent with the other local business profiles. The official GWR table remains **Gültig**.

## Attributes and interpretation

| Code | Name from GWR | Group | Required in this GWR profile |
|---|---|---|---|
| EGID | Eidgenössischer Gebäudeidentifikator | Identifikation | Yes |
| EDID | Eidgenössischer Eingangsidentifikator | Identifikation | Yes |
| EGAID | Eidgenössischer Gebäudeadressidentifikator | Identifikation | Yes |
| DEINR | Eingangsnummer Gebäude | Adresse | No |
| DKODE | E-Eingangskoordinate | Lage | No; paired with DKODN |
| DKODN | N-Eingangskoordinate | Lage | No; paired with DKODE |
| DOFFADR | Offizielle Adresse | Adresse | Yes |
| DPLZ4 | Postleitzahl | Adresse | Yes |
| DPLZZ | Postleitzahl-Zusatzziffer | Adresse | Yes |
| DPLZNAME | Ortschaftsname | Adresse | Yes |

The nine entrance-section features retain source order, with **EGID** added first as the building reference. EGID comes from the building section; it is not an invented tenth column in the imported entrance table. **EGID + EDID** form the entrance identifier. Both are flagged as identifier components, with their scope stated in comments; the existing UI labels these flags “PK”. EGAID identifies the address and is kept separate.

Identifiers and postal codes use semantic identifier/code values; their documented numeric coding remains in `value_specification.format` and the source notes. DPLZZ explicitly preserves two-character display, including `00`. DKODE/DKODN retain LV95, documented ranges, optional paired presence, and the source's location rules. No WGS84 conversion is implied.

One draft completeness rule is assigned to the seven obligatory attributes. Detailed source requirements, including composite uniqueness and the coordinate pair, remain documented requirements in the attribute comments. They do not introduce instance-data validation or new physical key constraints.

The source defines an addressed entrance from outside; additional cellar, garage and emergency entrances are outside this GWR entity. The object comment preserves that scope and the persistence of the entrance identifier after address changes.

## Connections and provenance

- Nine confirmed `represents` links join the existing GWR fields to the new attributes, with exact source anchors and review notes.
- One confirmed `realizes` link connects the GWR entrance table to the business object. Coverage is **partial** because the added EGID reference is outside the table's nine imported fields.
- DOFFADR reuses `r-gwr-doffadr` with its existing `0 = Nein`, `1 = Ja` values.
- GWR is documented as a metadata source; no system-of-record designation or new BBL/BFS ownership assertion is inferred.
- The original table, fields, code lists, other objects and all prior history remain unchanged. Frozen JSON migration inputs are not rewritten.

Evidence: [extracted source](../sources/gwr/2026-09-15-entrance-source.json), [official entity definition](https://www.housing-stat.ch/catalog/de/5.0/revised#beschreibung-der-entitaet-gebaeudeeingang), [entrance feature section](https://www.housing-stat.ch/catalog/de/5.0/revised#section22).

Source SHA-256: `a731e2c6756c4eb7b255598add4339c96f0600b0a338625d3b018aa9f4111bc4`.

## Reproduction and checks

`scripts/extract-gwr-entrance.py` uses Python/lxml to extract the saved MHTML and verifies all nine feature metadata records against the original GWR import. `scripts/gwr-entrance-import.cjs` produces an atomic administrator content transaction, defaulting to rollback. It requires a freshly reviewed `md5(catalog.read_snapshot(true)::text)` baseline and resolves existing database references by public identifier. New records receive database-generated UUIDs.

```powershell
python scripts/extract-gwr-entrance.py "C:\Users\david\Downloads\Merkmalskatalog.mhtml"
node scripts/gwr-entrance-import.cjs BASELINE_HASH preview PREVIEW.sql
node scripts/gwr-entrance-import.cjs BASELINE_HASH commit IMPORT.sql
node tests/gwr-entrance-import.cjs
node tests/gwr-entrance-browser.cjs
```

The SQL suite uses the existing `PGLITE_MODULE` setup; the browser suite uses `PLAYWRIGHT_MODULE`. Browser tests default to the isolated SQL snapshot and intercept hosted requests. `GWR_ENTRANCE_LIVE_READ=1` enables public read-only checks against the configured catalog.

Checks cover 10 attributes, seven required assignments, nine field mappings, one table mapping, 22 new per-record history events, exact preservation of existing content, complete rollback including the catalog revision, stale-source/baseline and repeat refusal, lazy profile/index loading, Excel projection, source/code-list links and desktop/320px layouts. The import's history actor is explicitly **Codex (MCP-Import)**; it does not impersonate a signed-in editor.

## Applied and verified

Applied to the configured Supabase catalog on **15 September 2026**, after the isolated SQL/browser suites and a successful hosted rollback preview. Import ID: `gwr-entrance-20260915-v1`. The hosted preview preserved baseline hash `d3caef8d3a5775b223f5345d840602c9` and catalog revision `4`. The committed result hash was `a8e065ef6749664c792b7426026c5127`; catalog revision advanced to `55`.

A subsequent database read and the public live browser suite confirmed the domain, draft status, 10 attributes, nine field mappings, one table mapping and 22 history events. Source links, EDID qualification, unchanged nine-field source inventory and the existing two-value DOFFADR list passed at 1440px and 320px. The import refuses a repeat run; these hashes document this operation rather than a permanent current-state claim.
