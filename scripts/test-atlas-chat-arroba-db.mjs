import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,e2,u,u2,u3]=[1,2,3,4,5].map(id)
let total=0
async function check(n,f){await f();total++;console.log('PASS:',n)}
try{
 await db.exec('create role anon;create role authenticated;create role service_role BYPASSRLS;create table usuarios(id uuid primary key,empresa_id uuid not null,unique(empresa_id,id));alter default privileges in schema public grant all on tables to service_role,authenticated,anon;')
 await q('insert into usuarios values($1,$2),($3,$4),($5,$2)',[u,e,u2,e2,u3])
 await check('schema aditivo aplicado',async()=>db.exec(await readFile('docs/atlas-chat/esquema-arrobas.sql','utf8')))
 await db.exec('set role service_role')
 const insert=(empresa,usuario,apelido,autor=null)=>q("insert into atlas_chat_arrobas(empresa_id,usuario_id,apelido,nome_publico,atualizado_por) values($1,$2,$3,'Teste',$4)",[empresa,usuario,apelido,autor])
 await check('cadastro é privado por padrão',async()=>{await insert(e,u,'gabriel');assert.equal((await q('select publico from atlas_chat_arrobas')).rows[0].publico,false)})
 await check('identificador duplicado na empresa recusado',async()=>assert.rejects(insert(e,u3,'gabriel'),{code:'23505'}))
 await check('mesmo identificador em outra empresa permitido',async()=>insert(e2,u2,'gabriel'))
 await check('usuário de outra empresa recusado',async()=>assert.rejects(insert(e2,u3,'outro'),{code:'23503'}))
 await check('autor de outra empresa recusado',async()=>assert.rejects(insert(e,u3,'outro',u2),{code:'23503'}))
 await check('central e caracteres inválidos reservados',async()=>{for(const a of ['central','@outro','UPPER'])await assert.rejects(insert(e,u3,a),{code:'23514'})})
 await check('serviço não apaga configuração',async()=>assert.rejects(q('delete from atlas_chat_arrobas'),{code:'42501'}))
 await db.exec('reset role;set role authenticated')
 await check('usuário comum não consulta nem modifica configuração',async()=>{await assert.rejects(q('select * from atlas_chat_arrobas'),{code:'42501'});await assert.rejects(q('update atlas_chat_arrobas set publico=true'),{code:'42501'})})
 console.log('TOTAL:',total,'testes de banco aprovados.')
}finally{await db.close()}
