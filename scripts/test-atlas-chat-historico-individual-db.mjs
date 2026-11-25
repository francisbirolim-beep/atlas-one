import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import os from 'node:os'
import path from 'node:path'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [e,c,v,da,gabi,other,group]=[1,2,3,4,5,6,7].map(id)
let n=0
async function check(name,fn){await fn();console.log('PASS',name);n++}
try{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table atendimento_mensagens(id uuid primary key,empresa_id uuid,conversa_id uuid,direcao text,tipo text,texto text,usuario_id uuid,created_at timestamptz not null default now());
create table atendimento_conversas(id uuid primary key,empresa_id uuid,whatsapp_canal_id uuid,whatsapp_chat_tipo text,canal text,telefone text,contato_nome text,responsavel_id uuid,status text,ocultar_da_caixa boolean,created_at timestamptz default now());
create table atendimento_whatsapp_canais(id uuid,empresa_id uuid,principal boolean);
create table atendimento_eventos(empresa_id uuid,conversa_id uuid,tipo text,dados jsonb);
create table usuarios(id uuid,empresa_id uuid);
create table atlas_chat_acessos(empresa_id uuid,usuario_id uuid,central_habilitado boolean);
create table atendimento_sessoes(empresa_id uuid,conversa_id uuid);
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
alter table atendimento_conversas enable row level security;
alter table atendimento_mensagens enable row level security;
alter table atendimento_eventos enable row level security;
alter table atendimento_sessoes enable row level security;
create policy conversa_legacy on atendimento_conversas for select to authenticated using(true);
create policy mensagem_legacy on atendimento_mensagens for select to authenticated using(true);
create policy evento_legacy on atendimento_eventos for select to authenticated using(true);
create policy sessao_legacy on atendimento_sessoes for select to authenticated using(true);
grant select on atendimento_conversas,atendimento_mensagens,atendimento_eventos,atendimento_sessoes to authenticated;
grant select on all tables in schema public to service_role;`)
await q('insert into usuarios values($1,$2),($3,$2),($4,$5)',[da,e,gabi,other,id(99)])
await q('insert into atlas_chat_acessos values($1,$2,false),($1,$3,true)',[e,da,gabi])
await q('insert into atendimento_whatsapp_canais values($1,$2,true)',[c,e])
await q("insert into atendimento_conversas(id,empresa_id,whatsapp_canal_id,whatsapp_chat_tipo,canal,telefone,contato_nome,responsavel_id,status,ocultar_da_caixa) values($1,$2,$3,'contato','whatsapp','5517999990000','Cliente',$4,'aguardando',false),($5,$2,$3,'grupo','whatsapp','0','Grupo',$4,'aguardando',false)",[v,e,c,gabi,group])
const msg=(num,text,dir='entrada',u=null,conv=v)=>q("insert into atendimento_mensagens(id,empresa_id,conversa_id,direcao,tipo,texto,usuario_id) values($1,$2,$3,$4,'texto',$5,$6)",[id(num),e,conv,dir,text,u])
await msg(10,'histórico antigo não atribuído')
await msg(18,'Saída antiga comprovada','saida',gabi)
await check('migração aditiva',async()=>db.exec(await readFile('supabase/migrations/20261125211200_atlas_chat_mensagem_responsavel.sql','utf8')))
const read=async(u,empresa=e,conv=v)=>(await q('select texto from atlas_chat_mensagens_individuais($1,$2,$3)',[empresa,u,conv])).rows.map(x=>x.texto)
const caixa=async(u)=>(await q('select * from atlas_chat_caixa_individual($1,$2,$3)',[e,u,c])).rows
await msg(11,'Gabi antes')
await msg(12,'Gabi responde','saida',gabi)
await msg(13,'@daiane Olá')
await check('comando não vaza para responsável anterior',async()=>assert.deepEqual(await read(gabi),['Gabi responde','Gabi antes']))
await q('update atendimento_conversas set responsavel_id=$1 where id=$2',[da,v])
await q("insert into atendimento_eventos values($1,$2,'atlas_chat_arroba_direto',jsonb_build_object('mensagem_id',$3::text,'destino',$4::text))",[e,v,id(13),da])
await msg(14,'Daiane responde','saida',da)
await msg(15,'Cliente para Daiane')
await msg(16,'Grupo','entrada',null,group)
await msg(17,'Eco desconhecido','saida',null)
await check('Daiane vê somente mensagens dela',async()=>assert.deepEqual(await read(da),['Cliente para Daiane','Daiane responde','@daiane Olá']))
await check('Gabi conserva apenas histórico próprio',async()=>{assert.deepEqual(await read(gabi),['Gabi responde','Gabi antes']);const rows=await caixa(gabi);assert.equal(rows.length,1);assert.equal(rows[0].status,'historico');assert.equal(rows[0].ultimo_preview,'Gabi responde')})
await check('preview da Daiane não usa histórico global',async()=>{const rows=await caixa(da);assert.equal(rows.length,1);assert.equal(rows[0].ultimo_preview,'Cliente para Daiane')})
await check('contador individual e marcador não afetam outro atendente',async()=>{
 assert.equal((await caixa(da))[0].nao_lidas,2)
 assert.equal((await caixa(gabi))[0].nao_lidas,1)
 const marca=(u,m)=>q('select atlas_chat_marcar_lida($1,$2,$3,$4) ok',[e,u,v,id(m)])
 assert.equal((await marca(da,12)).rows[0].ok,false)
 assert.equal((await marca(da,15)).rows[0].ok,true)
 assert.equal((await caixa(da))[0].nao_lidas,0)
 assert.equal((await caixa(gabi))[0].nao_lidas,1)
 await marca(da,13)
 assert.equal((await caixa(da))[0].nao_lidas,0)
})
await check('grupo e outro tenant isolados',async()=>{assert.deepEqual(await read(gabi,e,group),[]);assert.deepEqual(await read(da,id(99)),[])})
await check('histórico geral intacto',async()=>assert.equal((await q('select count(*)::int n from atendimento_mensagens')).rows[0].n,9))
await db.exec('set role authenticated')
await check('RPC não pode ser chamado diretamente pelo usuário',async()=>assert.rejects(read(da),{code:'42501'}))
await check('consulta direta de chat-only não acessa contato nem preview da central',async()=>{
 await q("select set_config('request.jwt.claim.sub',$1,false)",[da])
 assert.equal((await q('select count(*)::int n from atendimento_mensagens where conversa_id=$1',[v])).rows[0].n,0)
 assert.equal((await q('select count(*)::int n from atendimento_conversas where id=$1',[v])).rows[0].n,0)
 assert.equal((await q('select count(*)::int n from atendimento_eventos where conversa_id=$1',[v])).rows[0].n,0)
 assert.equal((await q('select count(*)::int n from atendimento_mensagens where conversa_id=$1',[group])).rows[0].n,1)
})
await check('central autorizada mantém acesso anterior',async()=>{
 await q("select set_config('request.jwt.claim.sub',$1,false)",[gabi])
 assert.equal((await q('select count(*)::int n from atendimento_mensagens where conversa_id=$1',[v])).rows[0].n,8)
})
await db.exec('reset role;set role service_role')
await check('backend autorizado consulta histórico individual',async()=>assert.equal((await read(da)).length,3))
await check('importa somente autoria antiga comprovada',async()=>{
 const res=await q('select atlas_chat_importar_mensagens_atribuidas($1,$2::uuid[]) n',[e,[id(10),id(18)]])
 assert.equal(res.rows[0].n,1)
 assert.deepEqual(await read(gabi),['Gabi responde','Gabi antes','Saída antiga comprovada'])
 assert.equal((await q('select atlas_chat_importar_mensagens_atribuidas($1,$2::uuid[]) n',[e,[id(18)]])).rows[0].n,0)
})
console.log('TOTAL:',n,'testes aprovados')
}finally{await db.close()}
