# Print detail and navigation review — 7 September 2026

## Findings and changes

| Finding | Implemented change |
| --- | --- |
| Collection printing disabled child rows, so List exported an inventory instead of the requested attribute/field lists. | Removed the entry-point-dependent `listRows` setting. List always includes the complete children of selected entries. Existing web filters select parent entries; child filtering/pagination does not truncate exports. |
| Repeating long parent descriptions in each child row made the document noisy. | One introductory table contains selected entries and their domain/system descriptions, captured with the frozen snapshot. Description visibility remains synchronized. Parent identity and other selected metadata remain regular detail columns. |
| Responsibility grouping was missing for tables, reference data, products and APIs. | Added the shared `resp` option. Web and print use `responsibleOrg`, alphabetic organisation order and unspecified values last. |
| Header-only width allocation split short values while other columns had spare space. | Measure actual words and compact values with the embedded font. Reserve short-value widths, cap unnecessary growth and give remaining width to descriptions. Summary and detail tables share this allocator. |
| Automatic contents disappeared when fewer than three groups were present. | Every multi-page document has a TOC by default, including ungrouped List. Two levels expose section/group headings and individual entities with correct page ranges. |
| Page references were plain text. | Preview anchors jump and focus the destination without changing the app route. Matching PDF GoTo annotations use the same destinations and rectangles after pagination. |
| Section structure and available layouts were unclear. | Plain section headings identify Entries and context, then Attributes/Fields/Values/Endpoints. Group labels are subordinate. The selector offers Tiles and List; detail entry points default to List. |

## Measured widths

The reported Architectural view case was reproduced with nine business objects and 41 attributes, using A3 portrait and the actual Noto Sans Export font at 9 pt. Widths below include cell padding.

| Column | Before (pt) | After (pt) | Result |
| --- | ---: | ---: | --- |
| Business object | 134.51 | 86.48 | All names still fit on one line. |
| Description | 162.97 | 235.66 | Maximum wrapping fell from three lines to two. |
| Responsibility | 112.03 | 117.45 | Immobilienmanagement now fits on one line. |
| Status | 43.42 | 45.26 | Entwurf now fits on one line. |
| Attribute count | 55.06 | 49.06 | Numeric values and header still fit. |

A3 landscape also keeps short values intact. Reports are written to `oblique-diagram-export/print-widths-{before,after}.json` in the OS temporary directory. Paper dimensions and text sizes remain unchanged. Extremely wide selections can still require fewer columns or a larger paper size.

## Validation

- Responsibility grouping checked in seven web collections and all five printable kinds.
- Selected child IDs compared against every rendered detail row, including domain, system and filtered field entry points.
- Long summaries tested across page breaks in DE/FR/IT/EN and both orientations.
- Layout regression covers paper sizes, languages, grouping, complete rows and overlapping geometry. Tile and shared-visibility suites cover 320–1600 px controls.
- TOC checks cover two levels, long names, multiple contents pages, mouse and keyboard navigation, translated labels and retained catalog routes.
- Downloaded PDFs inspected with PyMuPDF for source text, page bounds, embedded fonts, vector output, manifest hashes and actual internal-link destinations.
- Routing regression remains 16/16 scenario groups; core checks are 44/44.

Checks use local fixtures and headless Edge. No hosted catalog data was changed. Preview navigation and PDF link annotations were verified; physical-device and every PDF-reader behavior are outside this validation.

## References

- [Current behavior](../behavior.md#data-model-pdf-export)
- [Architecture](../architecture.md)
- [Routing review](2026-09-06-routing-code-review.md)
- [Print content](../../js/diagram-content.js), [layout and links](../../js/diagram-layout.js), [PDF writer](../../js/pdf.js)
- [Detail/grouping tests](../../tests/print-details.cjs), [contents tests](../../tests/print-contents.cjs), [width measurements](../../tests/print-widths.cjs), [PDF verification](../../tests/diagram-pdf.py)
