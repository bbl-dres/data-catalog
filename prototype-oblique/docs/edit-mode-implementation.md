# Edit mode implementation

Design reference: [2 September study](wireframes/2026-09-02-edit-mode.html). Agreed scope, 12 September 2026: all permanent signed-in users may edit; public browsing stays available; registration remains administrator-managed. Relationship and TERMDAT editing are excluded.

## Plan and mapping

1. Use a profile-sized edit workspace in the existing page, with editable name/description, overview, owned rows, read-only relations/history, changed-field markers, an unsaved count, Save and Discard. Add creation from the seven collection pages and child creation in their owners. Existing attribute/field profiles use the same forms.
2. Store drafts in memory, independent of published data. Support inline row edits, adding, reordering, archiving and restoring rows. Preserve exact multilingual values; explicitly choose the language being edited rather than saving display fallback as a translation. Validate required names, owner references, formats, codes, URLs and duplicate codes/semantic names. Confirm discard/navigation and protect reloads. Keep edits after server/network errors.
3. Add a narrowly scoped Supabase command API. Verify a permanent authenticated identity server-side, allow only explicitly listed catalog properties, compare revisions, serialize against other catalog writers, and atomically save the profile plus child changes and append history. Use command IDs for safe retries. Keep direct table writes and relation writes denied. Reload the canonical snapshot after save.
4. Verify with real local PostgreSQL and browser tests: authorization, forged/system-property rejection, concurrency, rollback, idempotency, history, owned-row scope, translations, row ordering, keyboard/mobile behavior, and unchanged public browsing. Document the hosted migration step.

## Schema adaptations

- The study predates the normalized schema. Optional/inherited responsibility and unknown protection values remain optional; missing historical metadata must not be invented merely to edit another field.
- Select responsibility from existing catalog actors. There is no connected Admindir search API.
- Definition version is curated separately from the automatic edit revision. No invented year-based version increment.
- Preserve identities: removing a saved row archives it, and the editor can restore it. Ordering and archival need explicit columns.
- Code-list binding and Required on an attribute remain editable owned properties, as the study specifies. No relationship/lineage assertion or terminology link can be edited.
- System-of-record information inferred from relations remains read-only where the schema has no direct field. System/domain fields that exist in the model remain selectable.
- Password recovery displays administrator instructions; normal password changes remain available after login.

Hosted writes require applying the new SQL migration. The browser uses only the existing public project key plus the current user's session; no admin credential belongs in this app.

## Implemented scope

| Profile | Editable owned rows |
|---|---|
| Domain / System | Profile properties; related entries remain read-only |
| Business object | Business attributes, format, key role, required flag, code-list binding |
| Data table | Data fields, source type, nullability, key roles, code-list binding |
| Code list | Exact textual codes, names, descriptions and short names |
| Data product | Product attributes and value specifications |
| API | Endpoint URL/path/operation, method, protocol, environment and documented access mechanisms |

Existing attribute/field detail pages also support editing. Parent identity stays fixed. Actor creation, relationship/lineage assertions, terminology and service verification assessments are outside this implementation. Reordering uses buttons or drag handles; filtering and 25-row pages bound large forms. Content language is explicit and independent of the interface language.

`edit-schema.js` defines the forms and transformations; `editor.js` owns one in-memory draft. Opening refreshes the canonical snapshot. Failed validation focuses the first invalid field, including hidden row details. Navigation/reload warn about unsaved work. Session loss preserves the draft and disables saving until the same account signs back in. Ctrl/Cmd+S saves. Drafts do not survive an accepted reload or tab closure.

`catalog.save_entry()` accepts a command UUID, root table/UUID/expected revision, a property patch and changed child patches. It verifies identity and scope, locks records, checks revisions, applies the whole operation and writes history in one transaction. Failed child validation rolls back the root too. Parent revisions also advance for child edits, including edits through standalone attribute/field profiles. No-ops do not advance revisions. Reusing the same command with the same payload returns its original result after a lost response; reusing it with a different payload or account is rejected.

Successful saves reload the catalog. If that reload fails, the editor explicitly reports that the save succeeded and offers a reload without resubmitting. Conflicts retain the draft and require comparison/reopening; the app never silently overwrites a newer revision. Public history includes child edits on the owning profile, with the record name and full before/after snapshots in SQL. Private audit records retain the actual Auth user and command IDs; public history uses a generic editor label.

## Activation and validation

Follow [Enable editing](../supabase/README.md#enable-editing): disable public signup, apply the earlier security migration if needed, then apply the editing migration once. The implementation does not change hosted accounts/settings or apply hosted SQL. Public reads and login remain available before activation.

Local checks use PGlite with the actual migrations and the real vendored Supabase SDK in Edge, intercepting only network transport. They cover authorization, immutable/relation properties, atomic rollback, all collection types, owned rows and endpoint defaults, no-ops, revisions, stale owner/child drafts, private attribution, retries, multilingual edits, validation, navigation/discard, archive/restore, pending saves, session loss, reload failure and mobile layouts in all four languages. Auth, public browsing/Excel, core, migration, security and public API contract regressions are also run. No test writes hosted data or sends email. See [test commands](../tests/README.md).
