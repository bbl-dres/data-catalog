# Follow-up queue

## Gebäudezustand and Schutz-/Denkmalstatus — completed

Added the two approved attributes as draft text definitions, with correct responsibilities, spaced ranks and candidate RE-FX source links. Official value lists remain to be confirmed; retain source wording in the interim. NF/HNF and Anzahl Wohnungen are explicitly excluded. Four audited commands passed rollback and independent postflight checks. [Details and evidence](review/2026-09-13-building-condition-heritage.md).

## Gebäude classification value lists — completed

Gebäudeart 1 and Gebäudeart 2 now use their separate existing BBL lists (21/100 values). The former combined definition is archived with history. Bauperiode is bound to GWR GBAUP and Gebäudeklasse (GWR) to the existing GKLAS list. Five audited commands were rollback-tested, committed and independently verified; source values and versions are unchanged. GKLAS retains its documented 4.2 source caveat. [Details and evidence](review/2026-09-13-building-classifications.md).

## Catalog refinement and relationship view — completed

Applied 297 audited commands across four rollback-tested batches: Gebäude has the five GF/GGF/VMF/EBF/GV definitions and one Anzahl Geschosse; BBL Genauigkeit has Geschätzt/Gemessen/Aggregiert/Unbekannt; EBF expands the standard list to seven options; comments are shorter; BBL responsibilities follow the agreed scope with documents and external organisations preserved. Three candidate Baujahr mappings now connect GIS IMMO, RE-FX and GWR tables/fields in both directions. Details use one column with Verantwortlich first; Bereitstellungsformen has the shared full-width collapse control. Independently verified in Supabase and localhost. [Changes, sources, limits and evidence](review/2026-09-13-catalog-refinement.md).

### Remaining stewardship decisions

- Confirm the three Baujahr source mappings and add further field-to-attribute mappings with source evidence.
- Confirm RE-FX measurement codes/value fields and the BBL storey-counting rule before operational value mapping.
- Assign BBL Projektentwicklung when dedicated early-stage entries are defined; do not reassign all generic project phases.
- Review legacy external publisher labels on r-sia-flaeche and r-kanton separately.
- Confirm the official value lists for the added Gebäudezustand and Schutz-/Denkmalstatus attributes. NF/HNF and Anzahl Wohnungen remain explicitly out of scope at this point.

## Bemessung Standard value list — completed

Created **BBL Bemessungsstandard** with SIA 416, DIN 277, IPMS, BBL-Regel and Andere dokumentierte Regel, and bound the existing Standard attribute as a code. Preserved identifier, sortOrder 1220, references and prior history. Seven audited commands were rollback-tested, committed atomically and independently verified; the attribute link and five options were checked in the localhost app. The later EBF refinement added SIA 380 and SIA 416/1, for seven current choices. Edition and measurement-rule details remain in Quelle. [Applied content and evidence](review/2026-09-13-bemessung-standard.md).

## Consistent business-attribute order — completed

All 217 attributes across 26 populated business objects now have spaced numbers in topic bands, with primary identifiers first and addresses in country-to-street order. Retired/archived definitions sort last without changing their lifecycle. Applied through 217 audited, rollback-tested commands and independently read back. Attribute and field tables default to sortOrder ascending, including when the rank column is hidden; explicit user sorts remain available. SQL/Excel and browser row-order checks passed. [Order and evidence](review/2026-09-13-attribute-order.md).

## Bemessung and consistent attribute names — completed

Applied and verified 13 September 2026: **11 active Bemessung attributes**, no separate Bemessungsumfang, five existing typed measured-object relationships, FID, accuracy and method value lists. Genauigkeit now follows the later user-confirmed categories Geschätzt / Gemessen / Aggregiert / Unbekannt; the exact tolerance stays in the source. Standard now uses the completed value-list follow-up above; edition and detailed rule evidence stay in Quelle.

Geometry values are named **Geometrie**; lifecycle attributes use **Status**, with the requested Gebäude exception **Status (GWR)** linked to **GWR Gebäudestatus (GSTAT)**. Geometriebezug and Bewirtschaftungsstatus remain distinct. The 52 audited commands were rollback-tested, committed atomically and checked against the original snapshot. Existing data, references and history were preserved. Verified Bemessung and GSTAT in the localhost app. [Applied content and evidence](review/2026-09-13-bemessung-simplification.md).

### Optional domain extension

Aussenfläche is not yet a catalog object. Agree its definition and relationship target before extending measuredFor. This does not block the completed cleanup of the five existing target types.

## Attribute and field status columns — completed

Both row tables show their existing database status as a pill by default, always last. Ansicht can hide it and Reset restores it. Existing v1 saved row views gain the previously unavailable choice once; subsequent choices and explicit URL selections remain respected. Verified actual pills, optional-column order, hide/reload/reset, preference migration and 320/390/1440 px layouts; field navigation regression checks pass. No schema migration needed.

## Database migration and security review — completed

Confirmed complete by the user on 13 September 2026. [Review and evidence](review/2026-09-13-security-review.md). Session/account authorization is applied as hosted migration 20260913143436; RLS and public browsing remain intact. The exact original comment was restored after a real localhost save/history/restore (Archivgut revision 4 → 5 → 6). Public GET locks are corrected, frame protection added and obsolete activation tooling/generated SQL removed. No commit or push was performed.

## System section — completed

Expanded by default and placed last, after access options. The section remains manually collapsible. Verified on the localhost Bodenabdeckung profile and in field-profile checks at 320, 390 and 1440 px. This is a presentation change only.


## Editing mode unavailable — resolved

**Status:** completed and verified 13 September 2026. All eight pending migrations were applied through Supabase MCP after a narrow repair of pre-existing direct table write grants. The catalog now matches the canonical 19-table / 477-column schema.

Verified in a real signed-in browser: opened edit mode, saved a reversible comment change on Archivgut, saw its history, restored the exact original comment and reloaded with both audit entries visible. Revision 2 → 3 → 4 and the two retained history events are expected. The 3,918 original catalog rows survived activation unchanged; the verification added only two public history rows and private audit receipts. Public browsing, disabled signup, RLS and denied direct API-role table writes are verified.

The access-options DDL committed before an MCP migration-version collision; its missing ledger receipt was repaired after exact schema verification, without rerunning DDL. [Deployment record and evidence](review/2026-09-13-editing-activation.md#completed-hosted-activation).

## catalog-api Edge Function — pending

The security review rechecked this on 13 September 2026: GET still returned 404. The Edge handler is tested locally, but deployment remains a separate operational task. This function is needed for the standard REST routes; browser editing uses the now-verified SQL RPCs directly. Follow the [API activation guide](api.md#activation). A process-only MCP discovery with the functions feature group returned notLoggedIn; the existing database-scoped connection remains working. Edge deployment needs a separately authorized functions connection. Saved MCP settings and credentials were not changed.

## Auth password protection — operational follow-up

The post-activation security advisor reports leaked-password protection disabled. The connected MCP does not expose Auth configuration updates; no Auth setting or plan was changed. Supabase documents this feature for Pro plans and above. Review the [Supabase setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) separately; it does not block the completed editing activation.

## Hosting response headers — operational follow-up

GitHub Pages currently supplies HSTS but lacks HTTP CSP/framing, nosniff and Referrer-Policy headers. The repository now has a tested runtime frame guard, meta CSP and no-referrer policy. Consider hosting/proxy support for response headers; no hosting migration or publication was performed.
