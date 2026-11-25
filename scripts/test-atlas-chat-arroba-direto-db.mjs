import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import os from 'node:os'
import path from 'node:path'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,c,v,m,s,u,old,e2]=[1,2,3,4,5,6,7,8].map(id)
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table atendimento_mensagens(id uuid primary key,empresa_id uuid,conversa_id uuid,sessao_id uuid,direcao text,tipo text,texto text,created_at timestamptz default now());
 create table atendimento_conversas(id uuid primary key,empresa_id uuid,whatsapp_canal_id uuid,whatsapp_chat_tipo text,canal text,telefone text,whatsapp_chat_jid text,responsavel_id uuid,responsavel_nome text,status text,ocultar_da_caixa boolean,updated_at timestamptz);
 create table atendimento_whatsapp_canais(id uuid,empresa_id uuid,principal boolean,ativo boolean,usuario_id uuid);
 create table atlas_chat_arrobas(empresa_id uuid,apelido text,usuario_id uuid,publico boolean);
 create table usuarios(id uuid,empresa_id uuid,nome text,role text);
 create table atlas_chat_acessos(empresa_id uuid,usuario_id uuid,habilitado boolean);
 create table atendimento_whatsapp_permissoes(empresa_id uuid,canal_id uuid,usuario_id uuid,pode_atender boolean);
 create table atendimento_sessoes(id uuid,empresa_id uuid,conversa_id uuid,responsavel_id uuid,responsavel_nome text,status text,assigned_at timestamptz,closed_at timestamptz);
 create table atlas_chat_vinculos(empresa_id uuid,canal_id uuid,telefone text,responsavel_id uuid,atualizado_por uuid,updated_at timestamptz,primary key(empresa_id,canal_id,telefone));
 create table atendimento_eventos(empresa_id uuid,conversa_id uuid,sessao_id uuid,tipo text,dados jsonb);
 grant all on all tables in schema public to service_role;`)
 await db.exec(await readFile('docs/atlas-chat/esquema-arroba-direto.sql','utf8'))
 await q("insert into atendimento_conversas values($1,$2,$3,'contato','whatsapp','5517999990000','5517999990000@s.whatsapp.net',$4,'Anterior','aguardando',false,now())",[v,e,c,old])
 await q("insert into atendimento_mensagens values($1,$2,$3,$4,'entrada','texto','@daiane Oi',now())",[m,e,v,s])
 await q("insert into atendimento_whatsapp_canais values($1,$2,true,true,$3)",[c,e,old])
 await q("insert into usuarios values($1,$2,'Daiane','funcionario')",[u,e])
 await q("insert into atlas_chat_arrobas values($1,'daiane',$2,true)",[e,u])
 await q("insert into atlas_chat_acessos values($1,$2,false)",[e,u])
 await q("insert into atendimento_whatsapp_permissoes values($1,$2,$3,true)",[e,c,u])
 await q("insert into atendimento_sessoes values($1,$2,$3,$4,'Anterior','aguardando',null,null)",[s,e,v,old])
 const call=async (empresa=e,anterior=old)=>(await q('select atlas_chat_direcionar_arroba($1,$2,$3,$4) as r',[empresa,c,m,anterior])).rows[0].r
 assert.equal(await call(),null);console.log('PASS revogação impede rota')
 await q('update atlas_chat_acessos set habilitado=true')
 assert.equal(await call(e2),null);assert.equal(await call(e,u),null);console.log('PASS tenant e proprietário esperado')
 await q("update atendimento_mensagens set texto='Olá @daiane'");assert.equal(await call(),null);await q("update atendimento_mensagens set texto='@DAIANE Oi'")
 await q("update atendimento_conversas set whatsapp_chat_tipo='grupo'");assert.equal(await call(),null);await q("update atendimento_conversas set whatsapp_chat_tipo='contato'");console.log('PASS texto comum e grupo preservados')
 await q('update atendimento_whatsapp_permissoes set pode_atender=false');assert.equal(await call(),null);await q('update atendimento_whatsapp_permissoes set pode_atender=true')
 await db.exec('set role service_role');assert.deepEqual(await call(),{id:u,nome:'Daiane'})
 assert.equal((await q('select responsavel_id from atendimento_conversas')).rows[0].responsavel_id,u)
 assert.equal((await q('select responsavel_id from atendimento_sessoes')).rows[0].responsavel_id,u)
 assert.equal((await q('select responsavel_id from atlas_chat_vinculos')).rows[0].responsavel_id,u)
 assert.equal((await q('select count(*)::int as n from atendimento_mensagens')).rows[0].n,1)
 assert.equal(await call(e,u),null);assert.equal((await q('select count(*)::int as n from atendimento_eventos')).rows[0].n,1)
 console.log('PASS transferência, vínculo, histórico intacto e repetição idempotente')
 await db.exec('reset role;set role authenticated');await assert.rejects(call(),{code:'42501'});console.log('PASS execução negada ao usuário direto')
}finally{await db.close()}
