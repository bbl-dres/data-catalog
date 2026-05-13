# Chat Worker

Cloudflare Worker that powers the **KI-Assistent** view in
`prototype-sqlite/`. Proxies Anthropic API calls and exposes the
catalog SQLite database to Claude via a `query_catalog(sql)` tool.

## Architecture

```
Browser ──POST /chat──▶ Worker ──┐
                                 ├──▶ Anthropic API (Claude Sonnet 4.6)
                                 └──▶ sql.js + catalog.db (bundled)
```

- **Anthropic SDK** sends/receives messages with prompt caching on the system prompt.
- **sql.js** loads `data/catalog.db` once per Worker isolate (warm-start cache).
- **Read-only** at two layers: `PRAGMA query_only = 1` on the engine, plus a regex check that rejects DML/DDL keywords before SQL touches the DB.

## Deploy via GitHub Actions (recommended)

The workflow at [`.github/workflows/deploy-chat-worker.yml`](../.github/workflows/deploy-chat-worker.yml) deploys on every push to `main` that touches `chat-worker/**` or `prototype-sqlite/data/catalog.db`. It also has a "Run workflow" button for manual re-deploys.

**One-time setup**:

1. Create a Cloudflare API token at <https://dash.cloudflare.com/profile/api-tokens> with the "Edit Cloudflare Workers" template. Note your **Account ID** from the dashboard sidebar.
2. In the GitHub repo → **Settings → Secrets and variables → Actions**:

   On the **Secrets** tab:

   | Name | Value |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | the token from step 1 |
   | `ANTHROPIC_API_KEY` | `sk-ant-…` from console.anthropic.com |

   On the **Variables** tab:

   | Name | Value |
   |---|---|
   | `CLOUDFLARE_ACCOUNT_ID` | your CF account ID (not sensitive, just an identifier) |

3. Run `npm install` locally once to generate `package-lock.json`, then commit it (the workflow uses `npm ci` and needs the lockfile).
4. Push to `main`. The Action deploys the worker and syncs the Anthropic key as a Cloudflare secret on every run.

Wrangler prints the public URL in the Action logs, e.g.:

```
Published bbl-datenkatalog-chat
  https://bbl-datenkatalog-chat.<your-account>.workers.dev
```

## Deploy from your machine (alternative)

```bash
cd chat-worker
npm install
npx wrangler login                       # OAuth into your CF account
npx wrangler secret put ANTHROPIC_API_KEY # paste sk-ant-...
npm run deploy
```

`predeploy` copies `../prototype-sqlite/data/catalog.db` into `data/catalog.db` so the bundled DB matches the frontend.

## Wire to the frontend

Open `prototype-sqlite/js/views/search.js` and set:

```js
const CHAT_WORKER_URL = 'https://bbl-datenkatalog-chat.<your-account>.workers.dev';
```

Refresh the catalog, navigate to **KI-Assistent**, ask a question.

## Local dev

```bash
npm run dev
```

Starts a local worker on `http://localhost:8787`. Point `CHAT_WORKER_URL` there to test before deploying.

## Updating the catalog

Whenever `prototype-sqlite/data/catalog.db` changes, re-run `npm run deploy`. The DB is bundled into the worker, so a redeploy is required to pick up new data.

## Configuration

`wrangler.toml`:

| Variable           | Default                 | Purpose                                    |
|--------------------|-------------------------|--------------------------------------------|
| `ALLOWED_ORIGIN`   | `*`                     | CORS origin. Tighten in production.        |
| `ANTHROPIC_MODEL`  | `claude-sonnet-4-6`     | Override to `claude-opus-4-7` or `claude-haiku-4-5-20251001`. |

Secrets (set via `wrangler secret put`):

| Name                | Required | Notes                          |
|---------------------|----------|--------------------------------|
| `ANTHROPIC_API_KEY` | yes      | From console.anthropic.com.    |

## Cost

- **Cloudflare Worker**: free tier (100k requests/day). The bundle is ~1.5 MB, comfortably under the 3 MiB free limit.
- **Anthropic API**: with prompt caching enabled on the system prompt, expect roughly $0.005–0.02 per conversation turn at Sonnet 4.6 rates.

## Limits & caveats

- The tool loop is capped at 8 turns to prevent runaway costs.
- Query results are truncated at 200 rows.
- The catalog DB ships with the worker — anyone hitting the endpoint can introspect the schema. Acceptable since the data is non-sensitive metadata; tighten `ALLOWED_ORIGIN` and add auth (JWT/eIAM) before production.
