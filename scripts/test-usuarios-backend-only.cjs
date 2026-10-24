// PostgreSQL WASM isolado, somente fixtures; nao usa credenciais nem conecta a rede.
// npm install --prefix /tmp/atlas-security-pg-20261024 @electric-sql/pglite@0.5.10
// ATLAS_PGLITE_MODULE=/tmp/atlas-security-pg-20261024/node_modules/@electric-sql/pglite node scripts/test-usuarios-backend-only.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {PGlite} = require(process.env.ATLAS_PGLITE_MODULE || '@electric-sql/pglite')
const candidate = path.join(__dirname, '../docs/security-review/USUARIOS_BACKEND_ONLY_CANDIDATO_NAO_APLICAR_20261024.sql')
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002'
const employee='20000000-0000-0000-0000-000000000001', master='20000000-0000-0000-0000-000000000002', other='20000000-0000-0000-0000-000000000003'
;(async()=>{
 const db = new PGlite()
 try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema public,auth,private to authenticated,anon,service_role;
 create table public.usuarios(id uuid primary key,empresa_id uuid not null,role text not null,nome text not null);
 insert into public.usuarios values('${employee}','${A}','funcionario','Funcionario'),('${master}','${A}','master','Master'),('${other}','${B}','funcionario','Outra empresa');
 create function private.current_empresa_id() returns uuid language sql stable security definer set search_path='' as $$select u.empresa_id from public.usuarios u where u.id=(select auth.uid()) limit 1$$;
 revoke all on function private.current_empresa_id() from public;
 grant execute on function private.current_empresa_id() to authenticated;
 alter table public.usuarios enable row level security;
 create policy usuarios_select_empresa on public.usuarios for select to authenticated using(empresa_id=(select private.current_empresa_id()));
 create policy usuarios_insert_empresa on public.usuarios for insert to authenticated with check(empresa_id=(select private.current_empresa_id()));
 create policy usuarios_update_empresa on public.usuarios for update to authenticated using(empresa_id=(select private.current_empresa_id())) with check(empresa_id=(select private.current_empresa_id()));
 create policy usuarios_delete_empresa on public.usuarios for delete to authenticated using(empresa_id=(select private.current_empresa_id()));
 grant all on public.usuarios to authenticated,service_role;
 grant update(role),insert(nome) on public.usuarios to public,anon,authenticated;
 set role authenticated; set test.uid='${employee}';
 `)
 // Prova que a fixture reproduz a falha antes da correcao, sem tocar producao.
 await db.exec(`update public.usuarios set role='master' where id='${employee}'`)
 assert.equal((await db.query(`select role from public.usuarios where id='${employee}'`)).rows[0].role,'master')
 await db.exec(`reset role;update public.usuarios set role='funcionario' where id='${employee}'`)
 await db.exec(fs.readFileSync(candidate,'utf8'))
 // Aplicacao repetida segura e grants de coluna removidos.
 await db.exec(fs.readFileSync(candidate,'utf8'))
 await db.exec(`set role authenticated;set test.uid='${employee}'`)
 assert.equal((await db.query('select * from public.usuarios')).rows.length,2,'Funcionario mantem leitura da empresa')
 const denied = async sql => assert.rejects(db.exec(sql),e=>e.code==='42501',sql)
 for(const sql of [
 `update public.usuarios set role='master' where id='${employee}'`,
 `update public.usuarios set role='master' where id='${master}'`,
 `update public.usuarios set empresa_id='${B}' where id='${employee}'`,
 `update public.usuarios set id='20000000-0000-0000-0000-000000000099' where id='${employee}'`,
 `update public.usuarios set nome='alterado' where id='${employee}'`,
 `delete from public.usuarios where id='${master}'`,
 `insert into public.usuarios values('20000000-0000-0000-0000-000000000098','${A}','master','Intruso')`,
 'truncate public.usuarios'
 ]) await denied(sql)
 await db.exec(`set test.uid='${master}'`)
 assert.equal((await db.query('select * from public.usuarios')).rows.length,2,'Master mantem leitura')
 await denied(`update public.usuarios set role='master' where id='${employee}'`)
 await db.exec(`set test.uid='${other}'`)
 assert.equal((await db.query('select * from public.usuarios')).rows.length,1,'Outra empresa isolada')
 await db.exec('reset role;set role anon')
 await denied('select * from public.usuarios')
 await denied(`update public.usuarios set role='master'`)
 await db.exec('reset role;set role service_role')
 await db.exec(`insert into public.usuarios values('20000000-0000-0000-0000-000000000097','${A}','funcionario','Criado pelo backend');update public.usuarios set nome='Editado pelo backend' where id='${employee}'`)
 assert.equal((await db.query(`select nome from public.usuarios where id='${employee}'`)).rows[0].nome,'Editado pelo backend','Backend preservado')
 assert.equal((await db.query(`select role from public.usuarios where id='${employee}'`)).rows[0].role,'funcionario','Sem autoelevacao')
 console.log('PASS: falha reproduzida antes; autoelevacao/escritas/anonimo/TRUNCATE negados depois; grants de coluna tratados; leitura tenant e backend preservados; SQL idempotente. Teste em PostgreSQL WASM com fixtures, nao clone completo.')
 } finally { await db.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
