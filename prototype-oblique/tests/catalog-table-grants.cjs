'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {database}=require(path.join(root,'supabase/local-database.cjs'));
const {migrationFiles}=require(path.join(root,'supabase/local-database.cjs'));
const files=migrationFiles().slice(4); // Original schema/public import is already loaded.
(async()=>{
 const db=await database({bundle:true});
 try{
  await db.exec('GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA catalog TO anon,authenticated,service_role');
  const before=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
  const sql=fs.readFileSync(path.join(root,'supabase/repairs/2026-09-13-catalog-table-grants.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s,before);
  for(const file of files)await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
  const check=(await db.query("SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema='catalog') AS columns, (SELECT bool_and(NOT has_table_privilege(r,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AND has_table_privilege(r,c.oid,'SELECT')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r WHERE n.nspname='catalog' AND c.relkind='r') AS read_only")).rows[0];
  assert.equal(check.columns,483);assert.equal(check.read_only,true);
  console.log('PASS: reproduced hosted write-grant drift; repair is repeatable, preserves all rows and SELECT, and all current incremental migrations apply with 483 columns and no direct API-role writes.');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
