import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE || path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite()
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e1,e2,u1,u2,master,otherMaster,c1,m1]=Array.from({length:8},(_,i)=>uid(i+1))
let pass=0
const q=(s,p=[])=>db.query(s,p)
async function check(n,fn){await fn();console.log('PASS:',n);pass++}
try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE empresas(id uuid primary key);
 CREATE TABLE usuarios(id uuid primary key,empresa_id uuid not null,nome text,role text);
 CREATE TABLE atendimento_conversas(id uuid primary key,empresa_id uuid,cliente_id uuid,contato_nome text,telefone text,responsavel_id uuid,responsavel_nome text,whatsapp_chat_tipo text);
 CREATE TABLE atendimento_mensagens(id uuid primary key,empresa_id uuid,conversa_id uuid,texto text,media_url text);
 grant select on usuarios,atendimento_conversas,atendimento_mensagens to service_role;`)
 await q('insert into empresas values ($1),($2)',[e1,e2])
 await q("insert into usuarios values ($1,$2,'Vendedor A','vendedor'),($3,$4,'Vendedor B','vendedor'),($5,$2,'Master A','master'),($6,$4,'Master B','master')",[u1,e1,u2,e2,master,otherMaster])
 await q("insert into atendimento_conversas values ($1,$2,null,'Cliente Fictício','5517999990000',$3,'Vendedor A','contato')",[c1,e1,u1])
 await q("insert into atendimento_mensagens values ($1,$2,$3,'Orçamento enviado','arquivo-ficticio.pdf')",[m1,e1,c1])
 await check('esquema de histórico aplicado em memória',async()=>db.exec(await readFile('docs/atlas-chat/esquema-historico.sql','utf8')))
 await db.exec('set role service_role')
 let id
 await check('ocultação registra nome original, cliente, telefone e responsável',async()=>{
  const r=await q("insert into atlas_chat_ocultacoes(empresa_id,usuario_id,conversa_id,usuario_nome,telefone) values ($1,$2,$3,'falso','falso') returning *",[e1,u1,c1])
  const x=r.rows[0];id=x.id;assert.equal(x.usuario_nome,'Vendedor A');assert.equal(x.cliente_nome,'Cliente Fictício');assert.equal(x.telefone,'5517999990000');assert.equal(x.responsavel_id,u1)
 })
 await check('mensagem original e referência do arquivo permanecem',async()=>assert.deepEqual((await q('select texto,media_url from atendimento_mensagens where id=$1',[m1])).rows,[{texto:'Orçamento enviado',media_url:'arquivo-ficticio.pdf'}]))
 await check('outra empresa não pode ocultar conversa',async()=>assert.rejects(q('insert into atlas_chat_ocultacoes(empresa_id,usuario_id,conversa_id) values ($1,$2,$3)',[e2,u2,c1])))
 await check('mensagem inexistente recusada',async()=>assert.rejects(q('insert into atlas_chat_ocultacoes(empresa_id,usuario_id,conversa_id,mensagem_id) values ($1,$2,$3,$4)',[e1,u1,c1,uid(99)])))
 await check('usuário comum e Master externo não restauram',async()=>{for(const u of [u1,otherMaster])await assert.rejects(q('update atlas_chat_ocultacoes set restaurado_em=now(),restaurado_por=$1 where id=$2',[u,id]))})
 await check('Master da empresa restaura sem editar original',async()=>{await q('update atlas_chat_ocultacoes set restaurado_em=now(),restaurado_por=$1 where id=$2',[master,id]);assert.equal((await q('select restaurado_por from atlas_chat_ocultacoes where id=$1',[id])).rows[0].restaurado_por,master)})
 await check('auditoria não pode ser excluída nem renomeada pelo serviço',async()=>{await assert.rejects(q('delete from atlas_chat_ocultacoes where id=$1',[id]),{code:'42501'});await assert.rejects(q("update atlas_chat_ocultacoes set cliente_nome='alterado' where id=$1",[id]),{code:'42501'})})
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role)
  await check(role+' não acessa auditoria',async()=>assert.rejects(q('select * from atlas_chat_ocultacoes'),{code:'42501'}))
 }
 await db.exec('reset role')
 await check('renomear cliente e usuário não altera identidade histórica',async()=>{
  await q("update usuarios set nome='Outro nome' where id=$1",[u1]);await q("update atendimento_conversas set contato_nome='Novo nome' where id=$1",[c1])
  const r=(await q('select usuario_nome,cliente_nome from atlas_chat_ocultacoes where id=$1',[id])).rows[0]
  assert.deepEqual(r,{usuario_nome:'Vendedor A',cliente_nome:'Cliente Fictício'})
 })
 console.log('TOTAL:',pass,'testes de histórico aprovados.')
}finally{await db.close()}
