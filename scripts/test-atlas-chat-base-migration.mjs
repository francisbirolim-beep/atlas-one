import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {randomBytes} from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import {createClient} from '@supabase/supabase-js'
import {backupSupabaseHomologacao} from './atlas-chat/captura-supabase.mjs'
import {recuperarEmPastaNova} from './atlas-chat/rotina-backup-local.mjs'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p)
const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-http-'))
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [empresa,outra,usuario,master,canal,conversa,mensagem]=[1,2,3,4,5,6,7].map(id)
const media=empresa+'/entrada/foto.bin',bytes=Buffer.from([1,2,255,7]),key=randomBytes(32)
const fakeRef='abcdefghijklmnopqrst',fakeUrl='https://'+fakeRef+'.supabase.co'
const tables=new Set(['atendimento_conversas','atendimento_mensagens','atlas_chat_ocultacoes','atendimento_eventos'])
let count=0,requests=0,ocultacao,backup
const check=async(n,f)=>{await f();count++;console.log('PASS:',n)}
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1')
  if(req.method!=='GET'){res.writeHead(405);res.end();return}
  requests++
  if(u.pathname==='/storage/v1/object/authenticated/whatsapp-midia/'+media||u.pathname==='/storage/v1/object/whatsapp-midia/'+media){res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end(bytes);return}
  const t=u.pathname.replace('/rest/v1/','')
  if(!tables.has(t)||u.searchParams.get('empresa_id')!=='eq.'+empresa||u.searchParams.get('order')!=='id.asc'){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Fora do escopo'}));return}
  const gt=u.searchParams.get('id'),limit=Number(u.searchParams.get('limit'))
  if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Limite inválido')
  const r=await q('select * from public.'+t+' where empresa_id=$1'+(gt?' and id>$3':'')+' order by id limit $2',gt?[empresa,limit,gt.slice(3)]:[empresa,limit])
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(r.rows))
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Erro de fixture'}))}
})
try{
 await db.exec(`create role anon;create role authenticated;create role service_role BYPASSRLS;
 create table empresas(id uuid primary key);
 create table usuarios(id uuid primary key,empresa_id uuid not null,nome text,role text);
 create table atendimento_whatsapp_canais(id uuid primary key,empresa_id uuid not null);
 create table atendimento_conversas(id uuid primary key,empresa_id uuid not null,cliente_id uuid,contato_nome text,telefone text,responsavel_id uuid,responsavel_nome text,whatsapp_chat_tipo text);
 create table atendimento_mensagens(id uuid primary key,empresa_id uuid not null,conversa_id uuid not null references atendimento_conversas(id) on delete cascade,texto text,media_url text);
 create table atendimento_eventos(id uuid primary key,empresa_id uuid not null,conversa_id uuid not null);
 grant select,insert,update,delete on usuarios,atendimento_conversas,atendimento_mensagens,atendimento_eventos to service_role;`)
 await q('insert into empresas values ($1),($2)',[empresa,outra])
 await q("insert into usuarios values ($1,$2,'Vendedor teste','vendedor'),($3,$2,'Master teste','master')",[usuario,empresa,master])
 await q('insert into atendimento_whatsapp_canais values ($1,$2)',[canal,empresa])
 await check('três esquemas de segurança coexistem no banco local',async()=>{
  await db.exec('alter default privileges in schema public grant all on tables to service_role, authenticated, anon; alter default privileges in schema public grant execute on functions to service_role, authenticated, anon')
  await db.exec(await readFile('docs/atlas-chat/migration-base-aditiva-revisada.sql','utf8'))
  for(const t of ['atlas_chat_acessos','atlas_chat_vinculos','atlas_chat_ocultacoes']){
   const r=(await q("select has_table_privilege('service_role',$1,'DELETE') as del,has_table_privilege('authenticated',$1,'SELECT') as leitura,has_table_privilege('anon',$1,'INSERT') as insercao",[t])).rows[0]
   assert.deepEqual(r,{del:false,leitura:false,insercao:false})
  }
  await db.exec(await readFile('docs/atlas-chat/esquema-protecao-historico.sql','utf8'))
 })
 await q("insert into atendimento_conversas values ($1,$2,null,'Cliente teste','5517999990000',$3,'Vendedor teste','contato')",[conversa,empresa,usuario])
 await q("insert into atendimento_mensagens values ($1,$2,$3,'Mensagem fictícia',$4)",[mensagem,empresa,conversa,media])
 await q('insert into atendimento_conversas(id,empresa_id) values ($1,$2)',[id(99),outra])
 await q('insert into atlas_chat_privado.conversas_protegidas values ($1,$2)',[empresa,conversa])
 await check('ocultar conversa mantém mensagem e identidade original',async()=>{
  await db.exec('set role service_role')
  ocultacao=(await q('insert into atlas_chat_ocultacoes(empresa_id,usuario_id,conversa_id) values ($1,$2,$3) returning id,cliente_nome,usuario_nome',[empresa,usuario,conversa])).rows[0]
  assert.equal(ocultacao.cliente_nome,'Cliente teste');assert.equal(ocultacao.usuario_nome,'Vendedor teste')
  assert.equal((await q('select texto from atendimento_mensagens where id=$1',[mensagem])).rows[0].texto,'Mensagem fictícia')
  await assert.rejects(q('delete from atendimento_conversas where id=$1',[conversa]),/exclusão física proibida/)
  await db.exec('reset role')
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 const local='http://127.0.0.1:'+server.address().port
 // SDK oficial; todo tráfego redirecionado exclusivamente ao servidor loopback.
 const criarCliente=async()=>createClient(fakeUrl,'fake-test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>{
  const u=new URL(typeof input==='string'?input:input.url||input.href)
  if(u.origin!==fakeUrl)throw Error('Rede externa bloqueada')
  return fetch(local+u.pathname+u.search,init)
 }}})
 await check('SDK oficial consulta banco e baixa mídia via HTTP local',async()=>{
  backup=await backupSupabaseHomologacao({url:fakeUrl,refPermitida:fakeRef,ativo:true,criarCliente,empresa,destino:dir,key,agora:3600000})
  assert.equal(backup.mensagens,1);assert.equal(backup.anexos,1);assert.ok(requests>=9)
 })
 await check('cópia recuperada inclui identidade e bytes, sem empresa alheia',async()=>{
  const dst=path.join(dir,'recuperacao')
  await recuperarEmPastaNova({arquivo:path.join(dir,empresa,backup.arquivo),key,empresa,destino:dst})
  const h=JSON.parse(await readFile(path.join(dst,'historico.json'),'utf8'))
  assert.equal(h.conversas.length,1);assert.equal(h.ocultacoes[0].cliente_nome,'Cliente teste');assert.equal(h.ocultacoes[0].usuario_nome,'Vendedor teste');assert.deepEqual(await readFile(path.join(dst,'midia',media)),bytes)
 })
 await check('Master restaura ocultação e mantém histórico original',async()=>{
  await db.exec('set role service_role')
  await q('update atlas_chat_ocultacoes set restaurado_em=now(),restaurado_por=$1 where id=$2',[master,ocultacao.id])
  assert.equal((await q('select restaurado_por from atlas_chat_ocultacoes where id=$1',[ocultacao.id])).rows[0].restaurado_por,master)
  assert.equal((await q('select count(*)::int n from atendimento_mensagens where id=$1',[mensagem])).rows[0].n,1)
 })
 console.log('TOTAL:',count,'testes de integração HTTP local aprovados.')
}finally{await new Promise(r=>server.close(r));await db.close();await rm(dir,{recursive:true,force:true})}
