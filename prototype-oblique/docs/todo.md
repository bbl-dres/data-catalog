# Follow-up queue

## Editing mode unavailable — resolved

**Status:** completed and verified 13 September 2026. All eight pending migrations were applied through Supabase MCP after a narrow repair of pre-existing direct table write grants. The catalog now matches the canonical 19-table / 477-column schema.

Verified in a real signed-in browser: opened edit mode, saved a reversible comment change on Archivgut, saw its history, restored the exact original comment and reloaded with both audit entries visible. Revision 2 → 3 → 4 and the two retained history events are expected. The 3,918 original catalog rows survived activation unchanged; the verification added only two public history rows and private audit receipts. Public browsing, disabled signup, RLS and denied direct API-role table writes are verified.

The access-options DDL committed before an MCP migration-version collision; its missing ledger receipt was repaired after exact schema verification, without rerunning DDL. [Deployment record and evidence](review/2026-09-13-editing-activation.md#completed-hosted-activation).

## catalog-api Edge Function — pending

The earlier request returned 404. Deployment was deliberately not changed or rechecked during browser editing activation. This function is needed for the standard REST routes; browser editing uses the now-verified SQL RPCs directly. Follow the [API activation guide](api.md#activation).

## Auth password protection — separate review

The post-activation security advisor reports leaked-password protection disabled. No Auth settings were changed. Review the [Supabase setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) separately; it does not block the completed editing activation.
