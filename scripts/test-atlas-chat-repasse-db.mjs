import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,other,central,vendedor,canal,c,s,m]=[1,2,3,4,5,6,7,8].map(id)
let count=0
const check=async(n,f)=>{await f();count++;console.log('PASS:',n)}
const repassar=async(empresa=e)=>(await q('select atlas_chat_repassar_pendencia($1,$2,$3) resultado',[empresa,c,vendedor])).rows[0].resultado
try{
 await db.exec(`create role anon;create role authenticated;create role service_role BYPASSRLS;
 create table empresas(id uuid primary key);
 create table usuarios(id uuid primary key,empresa_id uuid not null,nome text,role text);
 create table atendimento_whatsapp_canais(id uuid primary key,empresa_id uuid not null,principal boolean,ativo boolean,usuario_id uuid);
 create table atendimento_whatsapp_permissoes(empresa_id uuid,canal_id uuid,usuario_id uuid,pode_atender boolean);
 create table atendimento_whatsapp_distribuicao(empresa_id uuid primary key,ativo boolean,usuario_principal_id uuid,secundarios_ids uuid[]);
 create table atendimento_conversas(id uuid primary key,empresa_id uuid,whatsapp_canal_id uuid,whatsapp_chat_tipo text,responsavel_id uuid,responsavel_nome text,status text,ocultar_da_caixa boolean,ultima_entrada_em timestamptz,ultima_saida_em timestamptz,updated_at timestamptz);
 create table atendimento_sessoes(id uuid primary key,empresa_id uuid,conversa_id uuid,responsavel_id uuid,responsavel_nome text,status text,closed_at timestamptz,assigned_at timestamptz,first_response_at timestamptz);
 create table atendimento_mensagens(id uuid primary key,empresa_id uuid,conversa_id uuid,texto text);
 create table atendimento_eventos(id uuid primary key default gen_random_uuid(),empresa_id uuid,conversa_id uuid,sessao_id uuid,tipo text,dados jsonb);
 create table notificacoes(id uuid primary key default gen_random_uuid(),empresa_id uuid,usuario_id uuid,categoria text,tipo text,titulo text,mensagem text,href text,origem_tipo text,origem_id text,push_status text);
 grant select,update on usuarios,atendimento_whatsapp_canais,atendimento_whatsapp_permissoes,atendimento_whatsapp_distribuicao,atendimento_conversas,atendimento_sessoes to service_role;
 grant select on atendimento_mensagens to service_role;
 grant select,insert on atendimento_eventos,notificacoes to service_role;`)
 await q('insert into empresas values($1),($2)',[e,other])
 await q("insert into usuarios values($1,$2,'Central','vendedor'),($3,$2,'Vendedor','vendedor')",[central,e,vendedor])
 await q('insert into atendimento_whatsapp_canais values($1,$2,true,true,$3)',[canal,e,central])
 await q('insert into atendimento_whatsapp_permissoes values($1,$2,$3,true)',[e,canal,vendedor])
 await q('insert into atendimento_whatsapp_distribuicao values($1,true,$2,array[$3::uuid])',[e,central,vendedor])
 await q("insert into atendimento_conversas values($1,$2,$3,'contato',$4,'Central','aguardando',false,now()-interval '10 minutes',null,now())",[c,e,canal,central])
 await q("insert into atendimento_sessoes values($1,$2,$3,$4,'Central','aguardando',null,null,null)",[s,e,c,central])
 await q("insert into atendimento_mensagens values($1,$2,$3,'Histórico original')",[m,e,c])
 await db.exec(await readFile('docs/atlas-chat/esquema-permissoes-vinculos.sql','utf8'))
 await q('insert into atlas_chat_acessos(empresa_id,usuario_id,habilitado) values($1,$2,true)',[e,vendedor])
 await check('executor e configuração separados instalados',async()=>db.exec(await readFile('docs/atlas-chat/esquema-repasse.sql','utf8')))
 await q('insert into atlas_chat_repasse_config values($1,false,$2,5)',[e,vendedor])
 await check('desligado preserva regra antiga',async()=>assert.equal(await repassar(),'desligado'))
 await q('update atlas_chat_repasse_config set ativo=true')
 await check('destino esperado divergente cancela execução',async()=>assert.equal((await q('select atlas_chat_repassar_pendencia($1,$2,$3) resultado',[e,c,central])).rows[0].resultado,'config_alterada'))
 await check('outro tenant não repassa',async()=>assert.equal(await repassar(other),'inelegivel'))
 await check('prazo ainda não vencido impede repasse',async()=>{await q("update atendimento_conversas set ultima_entrada_em=now()");assert.equal(await repassar(),'prazo');await q("update atendimento_conversas set ultima_entrada_em=now()-interval '10 minutes'")})
 await check('resposta cancela repasse',async()=>{await q('update atendimento_conversas set ultima_saida_em=now()');assert.equal(await repassar(),'prazo');await q('update atendimento_conversas set ultima_saida_em=null')})
 await check('atendimento assumido não transfere',async()=>{await q("update atendimento_conversas set status='em_atendimento'");assert.equal(await repassar(),'inelegivel');await q("update atendimento_conversas set status='aguardando'")})
 await check('acesso revogado impede repasse',async()=>{await q('update atlas_chat_acessos set habilitado=false');assert.equal(await repassar(),'acesso');await q('update atlas_chat_acessos set habilitado=true')})
 await check('sessão inconsistente não é alterada',async()=>{await q("update atendimento_sessoes set status='em_atendimento'");assert.equal(await repassar(),'sessao');await q("update atendimento_sessoes set status='aguardando'")})
 await db.exec('set role authenticated')
 await check('usuário comum não executa repasse',async()=>assert.rejects(repassar(),{code:'42501'}))
 await db.exec('reset role;set role service_role')
 await check('repasse real local atualiza conversa, sessão, auditoria e aviso',async()=>{assert.equal(await repassar(),'repassado');assert.equal((await q('select responsavel_id from atendimento_conversas')).rows[0].responsavel_id,vendedor);assert.equal((await q('select responsavel_id from atendimento_sessoes')).rows[0].responsavel_id,vendedor);assert.equal((await q('select tipo from atendimento_eventos')).rows[0].tipo,'atlas_chat_repasse_automatico');assert.equal((await q('select usuario_id from notificacoes')).rows[0].usuario_id,vendedor)})
 await check('repetição não duplica notificações',async()=>{assert.equal(await repassar(),'inelegivel');assert.equal((await q('select count(*)::int n from notificacoes')).rows[0].n,1)})
 await check('histórico original permanece',async()=>assert.equal((await q('select texto from atendimento_mensagens')).rows[0].texto,'Histórico original'))
 console.log('TOTAL:',count,'testes de repasse no banco aprovados.')
}finally{await db.close()}
