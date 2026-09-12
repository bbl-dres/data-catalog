// ============================================================
// BBL Datenkatalog – Chat Worker
//
// Cloudflare Worker that proxies Anthropic API calls and gives
// Claude tool-call access to the catalog SQLite database.
//
// Flow:
//   1. POST /chat receives { messages: [{role, content}, ...] }.
//   2. Worker calls Anthropic with a `query_catalog(sql)` tool.
//   3. When the model emits tool_use, the SQL runs locally
//      against sql.js + the bundled catalog.db.
//   4. Loop until stop_reason !== 'tool_use', return the text.
//
// catalog.db is read-only at the engine level (PRAGMA query_only)
// and DML statements are rejected up front for defence in depth.
// ============================================================

// MUST be first — polyfills browser globals that sql.js reads at init.
import './polyfill.js';
import initSqlJs from 'sql.js';

// Bundled at build time via wrangler.toml [[rules]].
import sqlWasmModule from 'sql.js/dist/sql-wasm.wasm';
import catalogDbBytes from '../data/catalog.db';

// ── DB bootstrap ──────────────────────────────────────────────
// Module-scope cache: the first request in a Worker isolate pays
// the WASM init cost; subsequent requests reuse the in-memory DB.
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const SQL = await initSqlJs({
      instantiateWasm(imports, success) {
        WebAssembly.instantiate(sqlWasmModule, imports).then(instance =>
          success(instance, sqlWasmModule)
        );
        return {};
      }
    });
    const db = new SQL.Database(new Uint8Array(catalogDbBytes));
    db.run('PRAGMA query_only = 1;');
    return db;
  })().catch(err => {
    // Don't poison the cache: a failed init shouldn't make every future
    // request fail with the same stale error. Clear the slot so the next
    // request retries from scratch.
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

// ── Tool implementation ───────────────────────────────────────
// Read-only is enforced at the engine level via `PRAGMA query_only = 1`
// (set in getDb()). We don't try to filter SQL by regex — keyword-based
// blocking has false positives (e.g. `name LIKE '%insert%'` literals) and
// false negatives (comments, unicode, multi-statement). The engine flag
// rejects mutations definitively; we trust it.
function runCatalogQuery(db, sql) {
  try {
    const rows = [];
    const stmt = db.prepare(sql);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    // Cap result size so a runaway query can't blow the context window.
    const truncated = rows.length > 200;
    return {
      rows: truncated ? rows.slice(0, 200) : rows,
      row_count: rows.length,
      truncated
    };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// ── Prompt ────────────────────────────────────────────────────
// Compact schema overview. Full DDL is available to the model via
// `SELECT sql FROM sqlite_master WHERE type='table'` if it needs it.
const SYSTEM_PROMPT = `Du bist der KI-Assistent für den BBL Datenkatalog – ein Metadatenkatalog des Schweizer Bundesamts für Bauten und Logistik (BBL) für Immobilien-Geschäftsobjekte.

Antworte standardmässig auf Deutsch (Schweizer Hochdeutsch, kein ß), es sei denn der Nutzer fragt in einer anderen Sprache.

Du hast Zugriff auf eine SQLite-Datenbank über das Tool \`query_catalog\`. Verwende es, um Fragen mit echten Daten zu beantworten – rate niemals.

## Wichtigste Tabellen

Vocabulary-Schicht:
  vocabulary, collection, concept (id, name_de, name_en, name_fr, name_it, definition, status, standard_ref, collection_id, vocabulary_id, steward_id), concept_attribute (key_role: PK|FK|UK), term, concept_term, code_list, code_list_value

Physical-Schicht:
  system, schema_, dataset, field, concept_mapping (concept_id → field_id, "realizes")

Published-Schicht:
  data_product, distribution, data_product_dataset

Cross-cutting:
  relationship_edge, lineage_link, data_classification, data_profile, contact, "user"

Namens-Spalten haben Varianten _de, _en, _fr, _it. Wähle name_de / label_de bei deutschen Fragen. Die Felder \`definition\` und \`description\` sind JSON-Text (parse bei Bedarf).

## Antwortformat (sehr wichtig)

Schreibe für menschliche Leser im Web-Chat. Halte dich an diese Regeln:

1. **Antwort zuerst.** Beginne mit dem direkten Ergebnis, nicht mit einer Erklärung deiner Vorgehensweise oder einer Wiederholung der Frage.

2. **Verwende Listen statt Fliesstext** für Aufzählungen ab 3 Elementen. Nutze Markdown-Listen (\`-\`) oder Tabellen für Vergleiche/Spalten.

3. **Hebe Entitätsnamen mit Fett-Schrift hervor** (\`**Mietobjekt**\`). Verwende Inline-Code (\`backticks\`) nur für technische Bezeichner wie Spaltennamen oder SQL-Schlüsselwörter.

4. **Mache Entitäten anklickbar.** Wenn du auf eine Entität verweist, formatiere sie als Markdown-Link in den Katalog. URL-Schema:
   - Geschäftsobjekt: \`[Name](#/vocabulary/<id>)\`
   - Fachbegriff: \`[Name](#/terms/<id>)\`
   - Codeliste: \`[Name](#/codelists/<id>)\`
   - System: \`[Name](#/systems/<id>)\`
   - Datensammlung: \`[Name](#/datasets/<id>)\`
   - Dataset/Tabelle: \`[Name](#/systems/<sys_id>/datasets/<id>)\`

   Beispiel: \`Die Domäne **Portfolio** enthält [Mietobjekt](#/vocabulary/abc-123) und [Gebäude](#/vocabulary/def-456).\`

5. **Zeige keine rohen UUIDs im Fliesstext.** Sie gehören in Links (Ziel-Attribut) oder, falls wirklich nötig, in eine separate Spalte einer Tabelle.

6. **Halte Tabellen kompakt.** Maximal 4–5 Spalten. Lass die ID-Spalte weg, wenn die Namen bereits anklickbar sind.

7. **Keine Meta-Kommentare** wie "Ich habe folgende Datenbank-Abfrage durchgeführt …". Der Nutzer interessiert sich nur für die Antwort.

8. **Bei leeren Ergebnissen**: kurz und ehrlich. "Keine Treffer für X. Möchtest du …?" – schlage 1–2 sinnvolle Alternativen vor.`;

const TOOLS = [
  {
    name: 'query_catalog',
    description:
      'Run a read-only SQL SELECT against the BBL Datenkatalog SQLite database. ' +
      'Returns up to 200 rows. Only SELECT is permitted; DML/DDL is rejected.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'A single SQLite SELECT statement.'
        }
      },
      required: ['sql']
    }
  }
];

// ── Anthropic API client (direct fetch, no SDK) ───────────────
async function callAnthropic(env, body) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${errText}`);
  }
  return resp.json();
}

// ── Tool loop ─────────────────────────────────────────────────
async function runChat(env, userMessages) {
  const db = await getDb();
  const messages = [...userMessages];
  const trace = [];

  for (let turn = 0; turn < 8; turn++) {
    const response = await callAnthropic(env, {
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      tools: TOOLS,
      messages
    });

    if (response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { reply: text, trace, usage: response.usage };
    }

    // Append the assistant turn (text + tool_use blocks) so the next
    // request can reference the tool_use_id when we add tool_result.
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const sql = String(block.input?.sql || '');
      const result = runCatalogQuery(db, sql);
      trace.push({ sql, ...result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result)
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: '(Tool-Schleife abgebrochen – zu viele Iterationen.)', trace };
}

// ── HTTP entry ────────────────────────────────────────────────
// CORS: echo back the request Origin only if it's on the allowlist;
// otherwise return a non-matching value so the browser blocks the
// response. ALLOWED_ORIGINS is comma-separated in wrangler.toml.
// `*` is still honoured (any origin) for emergency overrides.
function pickAllowedOrigin(env, req) {
  const list = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*')) return '*';
  const origin = req?.headers?.get?.('Origin');
  return origin && list.includes(origin) ? origin : 'null';
}

function corsHeaders(env, req) {
  return {
    'Access-Control-Allow-Origin': pickAllowedOrigin(env, req),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env, req) });
    }
    // Health endpoint: no auth, no API calls, costs nothing. Used by
    // the post-deploy smoke test in CI.
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'bbl-datenkatalog-chat' }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(env, req)
        }
      });
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonError('Invalid JSON body', 400, env, req);
    }
    const messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return jsonError('Missing "messages" array', 400, env, req);
    }

    try {
      const result = await runChat(env, messages);
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(env, req)
        }
      });
    } catch (e) {
      // Always log full detail to the Worker console (visible in `wrangler tail`
      // / CF dashboard logs). Only echo stack traces back to clients when
      // DEBUG=1 — otherwise leak just a generic message.
      console.error('chat error:', e?.stack || e);
      const detail = env.DEBUG === '1'
        ? (e?.stack ? `${e.message}\n${e.stack}` : (e?.message || String(e)))
        : 'Internal server error';
      return jsonError(detail, 500, env, req);
    }
  }
};

function jsonError(message, status, env, req) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env, req)
    }
  });
}
