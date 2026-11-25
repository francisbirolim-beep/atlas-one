import assert from 'node:assert/strict'
import {mkdtemp,rm,readdir} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {randomBytes} from 'node:crypto'
import {backupSupabaseHomologacao,validarOrigemHomologacao} from './atlas-chat/captura-supabase.mjs'
import {verificarBackupLocal} from './atlas-chat/backup-local.mjs'
const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-captura-test-'))
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const empresa=uid(1),outra=uid(2),c=uid(3),media=empresa+'/entrada/foto.bin',refPermitida='abcdefghijklmnopqrst',url='https://'+refPermitida+'.supabase.co',key=randomBytes(32)
const tables={atendimento_conversas:[{id:c,empresa_id:empresa}],atendimento_mensagens:Array.from({length:501},(_,i)=>({id:uid(i+10),empresa_id:empresa,conversa_id:c,texto:'teste',media_url:i===0?media:null})),atlas_chat_ocultacoes:[],atendimento_eventos:[]}
let total=0,downloads=0,clients=0
function fake({cross=false,missing=false,change=false}={}){
 let reads=0
 return {from(t){let filter,after,limit;const q={select(){return q},eq(k,v){assert.equal(k,'empresa_id');filter=v;return q},order(k){assert.equal(k,'id');return q},limit(n){limit=n;return q},gt(k,v){assert.equal(k,'id');after=v;return q},then(resolve){assert.equal(filter,empresa);let data=tables[t].filter(x=>!after||x.id>after).slice(0,limit).map(x=>({...x}));if(t==='atendimento_conversas'){reads++;if(cross)data[0].empresa_id=outra;if(change&&reads>1)data[0].contato_nome='mudou'}resolve({data,error:null})}};return q},storage:{from(b){assert.equal(b,'whatsapp-midia');return {async download(p){downloads++;assert.equal(p,media);return missing?{error:true}:{data:new Blob([new Uint8Array([1,2,255])])}}}}}}
}
const base={url,refPermitida,ativo:true,empresa,destino:dir,key,agora:3600000,intervaloMs:60000,criarCliente:async()=>{clients++;return fake()}}
const check=async(n,f)=>{await f();console.log('PASS:',n);total++}
try{
 await check('flag desligada não cria cliente',async()=>{await assert.rejects(backupSupabaseHomologacao({...base,ativo:false}));assert.equal(clients,0)})
 await check('projeto principal explicitamente bloqueado',async()=>assert.throws(()=>validarOrigemHomologacao({ativo:true,url:'https://urtqbvjpwnrfaayolymt.supabase.co',refPermitida:'urtqbvjpwnrfaayolymt'})))
 await check('origem diferente ou URL com credencial recusada',async()=>{for(const u of ['https://example.org','https://abc@'+refPermitida+'.supabase.co'])assert.throws(()=>validarOrigemHomologacao({...base,url:u}))})
 let r
 await check('captura paginada de 501 mensagens e anexo integra backup',async()=>{r=await backupSupabaseHomologacao(base);assert.equal(r.mensagens,501);assert.equal(r.anexos,1);assert.equal(downloads,1)})
 await check('recuperação verifica dados e bytes da captura',async()=>{const v=await verificarBackupLocal(path.join(dir,empresa,r.arquivo),key,empresa);assert.equal(v.snapshot.mensagens.length,501);assert.deepEqual(v.anexos.get(media),Buffer.from([1,2,255]))})
 await check('registro de outro tenant falha fechado',async()=>assert.rejects(backupSupabaseHomologacao({...base,agora:3660000,criarCliente:async()=>fake({cross:true})}),/fora do escopo/))
 await check('arquivo ausente não publica backup',async()=>assert.rejects(backupSupabaseHomologacao({...base,agora:3660000,criarCliente:async()=>fake({missing:true})}),/Anexo ausente/))
 await check('mudança durante captura impede publicação',async()=>assert.rejects(backupSupabaseHomologacao({...base,agora:3660000,criarCliente:async()=>fake({change:true})}),/Histórico mudou/))
 await check('falhas preservam a única cópia válida',async()=>assert.equal((await readdir(path.join(dir,empresa))).filter(f=>f.endsWith('.enc')).length,1))
 console.log('TOTAL:',total,'testes da integração simulada aprovados.')
}finally{await rm(dir,{recursive:true,force:true})}
