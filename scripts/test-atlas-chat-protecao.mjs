import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import os from 'node:os'
import path from 'node:path'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e1,e2,c1,c2,m1,m2]=[1,2,3,4,5,6].map(id)
let count=0
async function check(n,f){await f();console.log('PASS:',n);count++}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role BYPASSRLS;
 create table atendimento_conversas(id uuid primary key,empresa_id uuid not null);
 create table atendimento_mensagens(id uuid primary key,empresa_id uuid not null,conversa_id uuid not null references atendimento_conversas(id) on delete cascade,texto text);
 grant select,update,delete,truncate on atendimento_conversas,atendimento_mensagens to service_role,authenticated;`)
 await q('insert into atendimento_conversas values ($1,$2),($3,$4)',[c1,e1,c2,e2])
 await q("insert into atendimento_mensagens values ($1,$2,$3,'preservar'),($4,$5,$6,'legado')",[m1,e1,c1,m2,e2,c2])
 await check('DDL de proteção aplicada em banco descartável',async()=>db.exec(await readFile('docs/atlas-chat/esquema-protecao-historico.sql','utf8')))
 await q('insert into atlas_chat_privado.conversas_protegidas values ($1,$2)',[e1,c1])
 for(const role of ['service_role','authenticated']){
  await db.exec('reset role;set role '+role)
  await check(role+' não apaga mensagem protegida',async()=>assert.rejects(q('delete from atendimento_mensagens where id=$1',[m1]),/exclusão física proibida/))
  await check(role+' não apaga conversa protegida em cascata',async()=>assert.rejects(q('delete from atendimento_conversas where id=$1',[c1]),/exclusão física proibida/))
  await check(role+' não trunca histórico',async()=>assert.rejects(db.exec('truncate atendimento_mensagens'),/truncamento proibido/))
 }
 await db.exec('reset role;set role service_role')
 await check('rotina legada fora do piloto permanece intacta',async()=>{await q('delete from atendimento_conversas where id=$1',[c2]);assert.equal((await q('select count(*)::int n from atendimento_mensagens where id=$1',[m2])).rows[0].n,0)})
 await check('registro privado não pode ser desativado pelo serviço',async()=>assert.rejects(q('delete from atlas_chat_privado.conversas_protegidas'),{code:'42501'}))
 await check('conteúdo protegido permanece no banco',async()=>assert.equal((await q('select texto from atendimento_mensagens where id=$1',[m1])).rows[0].texto,'preservar'))
 console.log('TOTAL:',count,'testes de proteção física aprovados.')
}finally{await db.close()}
