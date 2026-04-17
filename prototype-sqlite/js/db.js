// ============================================================
// DB: thin query helpers around sql.js.
//
// The catalog Database instance (created by initApp in app.js)
// lives on the global `db` variable. These helpers wrap prepare/
// bind/step/free and swallow errors with a console warning so
// render functions can treat the DB as a synchronous read API.
// ============================================================

let db = null;

function query(sql, params) {
  try {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('SQL Error:', e.message, '\nQuery:', sql);
    return [];
  }
}

function queryOne(sql, params) {
  const r = query(sql, params);
  return r.length > 0 ? r[0] : null;
}
