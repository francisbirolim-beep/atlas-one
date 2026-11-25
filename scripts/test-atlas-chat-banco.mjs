import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
// Banco WASM em memória; não lê .env, não abre conexão com produção.
const mod=pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE || path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href
const {PGlite}=await import(mod)
const db=new PGlite()
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e1,e2,u1,u2,c1,c2,master]=[1,2,3,4,5,6,7].map(uid)
const phone='5517999990000'
let pass=0
async function check(name,fn){await fn();console.log('PASS:',name);pass++}
const q=(s,p=[])=>db.query(s,p)
try {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.empresas(id uuid PRIMARY KEY);
 CREATE TABLE public.usuarios(id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id));
 CREATE TABLE public.atendimento_whatsapp_canais(id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES public.empresas(id));
 `)
 await q('insert into empresas values ($1),($2)',[e1,e2])
 await q('insert into usuarios values ($1,$2),($3,$4),($5,$2)',[u1,e1,u2,e2,master])
 await q('insert into atendimento_whatsapp_canais values ($1,$2),($3,$4)',[c1,e1,c2,e2])
 await check('DDL PostgreSQL 17.5 aplicada em memória',async()=>db.exec(await readFile('docs/atlas-chat/esquema-permissoes-vinculos.sql','utf8')))
 await check('RLS ativa nas duas tabelas',async()=>assert.equal((await q("select count(*)::int as n from pg_class where relname in ('atlas_chat_acessos','atlas_chat_vinculos') and relrowsecurity")).rows[0].n,2))
 await check('service_role cadastra acesso e vínculo',async()=>{
  await db.exec('set role service_role')
  await q('insert into atlas_chat_acessos(empresa_id,usuario_id,habilitado,atualizado_por) values ($1,$2,true,$3)',[e1,u1,master])
  await q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone,responsavel_id,atualizado_por) values ($1,$2,$3,$4,$5)',[e1,c1,phone,u1,master])
 })
 await check('acesso de usuário de outra empresa recusado',async()=>assert.rejects(q('insert into atlas_chat_acessos(empresa_id,usuario_id) values ($1,$2)',[e1,u2]),{code:'23503'}))
 await check('canal de outra empresa recusado',async()=>assert.rejects(q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone) values ($1,$2,$3)',[e1,c2,phone]),{code:'23503'}))
 await check('responsável de outra empresa recusado',async()=>assert.rejects(q('update atlas_chat_vinculos set responsavel_id=$1 where empresa_id=$2',[u2,e1]),{code:'23503'}))
 await check('autor de outra empresa recusado',async()=>assert.rejects(q('update atlas_chat_vinculos set atualizado_por=$1 where empresa_id=$2',[u2,e1]),{code:'23503'}))
 await check('número inválido recusado',async()=>assert.rejects(q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone) values ($1,$2,$3)',[e1,c1,'123']),{code:'23514'}))
 await check('vínculo duplicado recusado',async()=>assert.rejects(q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone) values ($1,$2,$3)',[e1,c1,phone]),{code:'23505'}))
 await check('mesmo telefone pode existir em empresas diferentes',async()=>q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone,responsavel_id) values ($1,$2,$3,$4)',[e2,c2,phone,u2]))
 await check('revogação sem apagar vínculo',async()=>{
  await q('update atlas_chat_acessos set habilitado=false where empresa_id=$1 and usuario_id=$2',[e1,u1])
  assert.equal((await q('select habilitado from atlas_chat_acessos where empresa_id=$1',[e1])).rows[0].habilitado,false)
  assert.equal((await q('select responsavel_id from atlas_chat_vinculos where empresa_id=$1',[e1])).rows[0].responsavel_id,u1)
 })
 for(const role of ['anon','authenticated']){
  await db.exec('reset role; set role '+role)
  await check(role+' não lê nem altera dados',async()=>{
   await assert.rejects(q('select * from atlas_chat_vinculos'),{code:'42501'})
   await assert.rejects(q('update atlas_chat_acessos set habilitado=true'),{code:'42501'})
  })
 }
 await db.exec('reset role')
 await check('excluir responsável preserva vínculo e devolve à central',async()=>{
  await q('delete from usuarios where id=$1',[u1])
  const rows=(await q('select empresa_id,responsavel_id from atlas_chat_vinculos where empresa_id=$1',[e1])).rows
  assert.deepEqual(rows,[{empresa_id:e1,responsavel_id:null}])
  assert.equal((await q('select count(*)::int as n from atlas_chat_acessos where empresa_id=$1',[e1])).rows[0].n,0)
 })
 console.log('TOTAL:',pass,'testes aprovados; banco em memória descartado.')
}finally{await db.close()}
