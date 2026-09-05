# Side-tree domain navigation

Investigated and fixed on 2026-09-05.

## Reproduction and cause

From `#/products`, clicking **Energie** under **Datenprodukte** used the link `#/domains/energie`. This opened the general domain profile, including **Geschäftsobjekte (3)**, and selected the Energie branch under Geschäftsobjekte. The clicked branch had shown **1** data product.

`views.tree()` used the same domain-entity URL for each occurrence of a domain, regardless of its parent section. `sectionOf()` correctly placed that general domain profile in the business-object section. The issue was the grouping link losing its collection context, rather than an incorrect domain identifier or an HTTP redirect. Referenzdaten and API-Verzeichnis shared the same link-building pattern. Their repeated domains could also receive duplicate active markers when another occurrence of the domain profile was selected.

## Behaviour after the fix

- **Datenprodukte → Energie** opens `#/products?domain=energie&group=domain`, containing the one energy product. Referenzdaten and API-Verzeichnis use equivalent routes within their own sections.
- Domain membership is checked by identifier, separately from free-text search. Changing the tile/table view or grouping, clearing the search, exporting CSV, reloading or going Back retains the exact domain restriction.
- The title and breadcrumbs identify both the collection and domain. The parent collection link returns to the complete list. Product/reference/API detail breadcrumbs return to that same domain within their collection.
- Only the matching section's domain branch is active. It opens on entry, works in the shared desktop tree, rail flyout and phone drawer, and keeps an explicit navigation-model override in its links.
- The primary domain profiles under Geschäftsobjekte/Domänen and system profiles under Datentabellen/Systeme remain canonical entity links. Their profile tabs and relationship diagrams remain available.
- An unknown domain identifier produces the existing not-found view rather than silently displaying all entries.

## Verification

The browser regression reproduces the original click for products, reference data and APIs. It checks the destination, exact member counts, active tree branch, detail breadcrumbs, tile/table changes, search clearing, CSV contents, reload/Back behaviour, the container navigation model and the mobile drawer. It also checks that the original business-object domain link still opens its domain profile and that an unknown domain cannot broaden the results.

The fix uses the existing collection renderer and export context; it introduces no duplicate data or separate page implementation. See [architecture.md](architecture.md) and [tests/README.md](../tests/README.md).
