// Integração isolada: npm install --prefix /tmp/atlas-pg @electric-sql/pglite@0.5.10
// ATLAS_PGLITE_MODULE=/tmp/atlas-pg/node_modules/@electric-sql/pglite node scripts/test-acessos-etapas-rls.cjs
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {PGlite}=require(process.env.ATLAS_PGLITE_MODULE||'@electric-sql/pglite')
;(async()=>{
 const db=new PGlite()
 await db.exec(`
 create role authenticated;create role anon;create role service_role bypassrls;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.current_empresa_id() returns uuid language sql stable as $$select nullif(current_setting('test.empresa',true),'')::uuid$$;
 create function private.is_master_atlas() returns boolean language sql stable as $$select current_setting('test.master',true)='true'$$;
 grant usage on schema public,auth,private to authenticated,anon,service_role;
 create table public.empresas(id uuid primary key);
 create table public.usuarios(id uuid primary key,empresa_id uuid references public.empresas(id));
 create table public.configuracoes_gerais(chave text primary key,valor text);
 alter table public.configuracoes_gerais enable row level security;
 create policy baseline on public.configuracoes_gerais for all to authenticated using(true) with check(true);
 grant all on public.configuracoes_gerais to authenticated;
 insert into public.empresas values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
 insert into public.usuarios values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
 insert into public.configuracoes_gerais values('acesso_usuario:20000000-0000-0000-0000-000000000001','{"crmEscopo":"proprios","acoes":{"financeiro.geral.consultar":"oculto"}}');
 `)
 await db.exec(fs.readFileSync('supabase/migrations/20261016001422_permissoes_etapas_usuario_v1.sql','utf8'))
 assert.equal((await db.query('select count(*)::int n from public.usuario_acessos_etapas')).rows[0].n,1,'Migra configuração legada')
 await db.exec(`set role authenticated;set test.uid='20000000-0000-0000-0000-000000000001';set test.empresa='10000000-0000-0000-0000-000000000001';set test.master='false';`)
 assert.equal((await db.query('select * from public.usuario_acessos_etapas')).rows.length,1,'Usuário lê o próprio acesso')
 await assert.rejects(db.exec(`update public.usuario_acessos_etapas set config='{}'::jsonb`),'Usuário não altera o próprio acesso')
 await assert.rejects(db.exec(`update public.configuracoes_gerais set valor='{}' where chave='acesso_usuario:20000000-0000-0000-0000-000000000001'`),'Legado não permite autoelevação')
 await db.exec(`set test.uid='20000000-0000-0000-0000-000000000002';set test.empresa='10000000-0000-0000-0000-000000000002';`)
 assert.equal((await db.query('select * from public.usuario_acessos_etapas')).rows.length,0,'Outra empresa não lê o acesso')
 assert.equal((await db.query(`select * from public.configuracoes_gerais where chave like 'acesso_usuario:%'`)).rows.length,0,'Legado também isolado')
 await db.exec(`reset role;set role anon;`)
 await assert.rejects(db.query('select * from public.usuario_acessos_etapas'),'Anônimo sem acesso')
 await db.exec('reset role;set role service_role;')
 await db.exec(`update public.usuario_acessos_etapas set config='{"crmEscopo":"proprios","acoes":{},"cliente360":{"financeiro":"oculto"}}'::jsonb`)
 assert.equal((await db.query('select config from public.usuario_acessos_etapas')).rows[0].config.cliente360.financeiro,'oculto','Backend autorizado grava configuração')
 await db.close()
 console.log('PASS: migration PostgreSQL, preservação do legado, isolamento de empresa, leitura própria, bloqueio de autoelevação e anônimo, gravação pelo backend.')
})().catch(e=>{console.error(e);process.exitCode=1})
