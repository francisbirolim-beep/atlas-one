import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,e2,u,u2,u3,c,c2]=[1,2,3,4,5,6,7].map(id),telefone='5517999990000'
let total=0
async function check(n,f){await f();total++;console.log('PASS:',n)}
try{
 await db.exec('create role anon;create role authenticated;create role service_role BYPASSRLS;create table usuarios(id uuid primary key,empresa_id uuid not null,unique(empresa_id,id));create table atendimento_whatsapp_canais(id uuid primary key,empresa_id uuid not null,unique(empresa_id,id));alter default privileges in schema public grant all on tables to service_role,authenticated,anon;')
 await q('insert into usuarios values($1,$2),($3,$4),($5,$2)',[u,e,u2,e2,u3])
 await q('insert into atendimento_whatsapp_canais values($1,$2),($3,$4)',[c,e,c2,e2])
 await check('schema novo aplicado',async()=>db.exec(await readFile('docs/atlas-chat/esquema-nomes-pessoais.sql','utf8')))
 await db.exec('set role service_role')
 await check('mesmo contato pode ter nomes pessoais distintos',async()=>{
  await q("insert into atlas_chat_nomes_pessoais(empresa_id,usuario_id,canal_id,telefone,nome) values($1,$2,$3,$4,'Contato A'),($1,$5,$3,$4,'Contato B')",[e,u,c,telefone,u3])
  await q("update atlas_chat_nomes_pessoais set nome='Nome novo' where empresa_id=$1 and usuario_id=$2 and canal_id=$3 and telefone=$4",[e,u,c,telefone])
  assert.deepEqual((await q('select nome from atlas_chat_nomes_pessoais order by usuario_id')).rows,[{nome:'Nome novo'},{nome:'Contato B'}])
 })
 await check('usuário ou canal de outra empresa recusado',async()=>{for(const [usuario,canal] of [[u2,c],[u,c2]])await assert.rejects(q("insert into atlas_chat_nomes_pessoais(empresa_id,usuario_id,canal_id,telefone,nome) values($1,$2,$3,$4,'X')",[e,usuario,canal,telefone]),{code:'23503'})})
 await check('serviço não possui DELETE',async()=>assert.rejects(q('delete from atlas_chat_nomes_pessoais'),{code:'42501'}))
 await db.exec('reset role;set role authenticated')
 await check('usuário não consulta a tabela diretamente',async()=>assert.rejects(q('select * from atlas_chat_nomes_pessoais'),{code:'42501'}))
 console.log('TOTAL:',total,'testes de nomes pessoais aprovados.')
}finally{await db.close()}
