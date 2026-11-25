import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,outra,central,vendedor,canal,c,m]=[1,2,3,4,5,6,7].map(id),tel='5517999990000',ts='2026-11-24T22:00:00Z'
let total=0
const check=async(n,f)=>{await f();total++;console.log('PASS:',n)}
const atribuir=async(p=[e,canal,c,tel,central,ts,vendedor])=>(await q('select atlas_chat_atribuir_encerrada($1,$2,$3,$4,$5,$6,$7) resultado',p)).rows[0].resultado
try{
 await db.exec(`create role anon;create role authenticated;create role service_role BYPASSRLS;
 create table empresas(id uuid primary key);
 create table usuarios(id uuid primary key,empresa_id uuid not null,nome text,role text);
 create table atendimento_whatsapp_canais(id uuid primary key,empresa_id uuid not null,principal boolean,ativo boolean,usuario_id uuid);
 create table atendimento_whatsapp_permissoes(empresa_id uuid,canal_id uuid,usuario_id uuid,pode_atender boolean,primary key(empresa_id,canal_id,usuario_id));
 create table atendimento_conversas(id uuid primary key,empresa_id uuid,whatsapp_canal_id uuid,telefone text,whatsapp_chat_tipo text,whatsapp_chat_jid text,responsavel_id uuid,responsavel_nome text,status text,updated_at timestamptz);
 create table atendimento_mensagens(id uuid primary key,empresa_id uuid,conversa_id uuid,texto text);
 create table atendimento_eventos(id uuid primary key default gen_random_uuid(),empresa_id uuid,conversa_id uuid,tipo text,dados jsonb);
 grant select,update on usuarios,atendimento_whatsapp_canais,atendimento_whatsapp_permissoes,atendimento_conversas to service_role;
 grant select on atendimento_mensagens to service_role;
 grant select,insert on atendimento_eventos to service_role;`)
 await q('insert into empresas values($1),($2)',[e,outra])
 await q("insert into usuarios values($1,$2,'Central','vendedor'),($3,$2,'Vendedor','vendedor')",[central,e,vendedor])
 await q('insert into atendimento_whatsapp_canais values($1,$2,true,true,$3)',[canal,e,central])
 await q('insert into atendimento_whatsapp_permissoes values($1,$2,$3,true)',[e,canal,vendedor])
 await q("insert into atendimento_conversas values($1,$2,$3,$4,'contato',$5,$6,'Central','finalizado',$7)",[c,e,canal,tel,tel+'@s.whatsapp.net',central,ts])
 await q("insert into atendimento_mensagens values($1,$2,$3,'histórico original')",[m,e,c])
 await db.exec(await readFile('docs/atlas-chat/esquema-permissoes-vinculos.sql','utf8'))
 await q('insert into atlas_chat_acessos(empresa_id,usuario_id,habilitado) values($1,$2,true)',[e,vendedor])
 await q('insert into atlas_chat_vinculos(empresa_id,canal_id,telefone,responsavel_id) values($1,$2,$3,$4)',[e,canal,tel,vendedor])
 await check('função instalada no PostgreSQL isolado',async()=>db.exec(await readFile('docs/atlas-chat/esquema-atribuicao.sql','utf8')))
 await db.exec('set role authenticated')
 await check('usuário comum não chama executor',async()=>assert.rejects(atribuir(),{code:'42501'}))
 await db.exec('reset role;set role service_role')
 await check('empresa diferente não altera conversa',async()=>assert.equal(await atribuir([outra,canal,c,tel,central,ts,vendedor]),'conflito'))
 await check('versão desatualizada bloqueia atribuição',async()=>assert.equal(await atribuir([e,canal,c,tel,central,'2026-11-24T21:00:00Z',vendedor]),'conflito'))
 await db.exec('reset role')
 await check('atendimento aberto não muda responsável',async()=>{await q("update atendimento_conversas set status='em_atendimento' where id=$1",[c]);assert.equal(await atribuir(),'conflito');await q("update atendimento_conversas set status='finalizado' where id=$1",[c])})
 await check('acesso revogado bloqueia gravação',async()=>{await q('update atlas_chat_acessos set habilitado=false');assert.equal(await atribuir(),'acesso');await q('update atlas_chat_acessos set habilitado=true')})
 await check('permissão de canal revogada bloqueia gravação',async()=>{await q('update atendimento_whatsapp_permissoes set pode_atender=false');assert.equal(await atribuir(),'acesso');await q('update atendimento_whatsapp_permissoes set pode_atender=true')})
 await check('vínculo alterado bloqueia gravação',async()=>{await q('update atlas_chat_vinculos set responsavel_id=null');assert.equal(await atribuir(),'vinculo');await q('update atlas_chat_vinculos set responsavel_id=$1',[vendedor])})
 await check('telefone duplicado bloqueia atribuição',async()=>{await q("insert into atendimento_conversas select $1,empresa_id,whatsapp_canal_id,telefone,whatsapp_chat_tipo,whatsapp_chat_jid,responsavel_id,responsavel_nome,status,updated_at from atendimento_conversas where id=$2",[id(99),c]);assert.equal(await atribuir(),'ambiguo');await q('delete from atendimento_conversas where id=$1',[id(99)])})
 await db.exec('set role service_role')
 await check('atribuição efetiva reabre conversa e grava evento',async()=>{assert.equal(await atribuir(),'atribuido');const r=(await q('select responsavel_id,responsavel_nome,status from atendimento_conversas where id=$1',[c])).rows[0];assert.deepEqual(r,{responsavel_id:vendedor,responsavel_nome:'Vendedor',status:'aguardando'});assert.equal((await q('select count(*)::int n from atendimento_eventos')).rows[0].n,1)})
 await check('repetição da mesma decisão não transfere nem duplica evento',async()=>{assert.equal(await atribuir(),'conflito');assert.equal((await q('select count(*)::int n from atendimento_eventos')).rows[0].n,1)})
 await check('mensagem original continua vinculada à conversa',async()=>assert.equal((await q('select texto from atendimento_mensagens where id=$1',[m])).rows[0].texto,'histórico original'))
 console.log('TOTAL:',total,'testes de atribuição aprovados.')
}finally{await db.close()}
