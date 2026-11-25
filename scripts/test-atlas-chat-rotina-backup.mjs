import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import {executarBackupSeDevido,recuperarEmPastaNova} from './atlas-chat/rotina-backup-local.mjs'
const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-rotina-'))
const empresa='00000000-0000-4000-8000-000000000001'
const root=path.join(dir,'origem'),destino=path.join(dir,'backups'),media=empresa+'/entrada/foto.bin',key=randomBytes(32)
const file=path.join(root,media),bytes=Buffer.from([1,2,3,4,255])
const snapshot={empresa,conversas:[{id:'c',empresa_id:empresa,contato_nome:'Cliente teste'}],mensagens:[{id:'m',empresa_id:empresa,conversa_id:'c',texto:'mensagem de teste',media_url:media}],ocultacoes:[],eventos:[]}
let calls=0,total=0,primeiro,segundo
const base={empresa,root,destino,key,capturar:async()=>{calls++;return snapshot},agora:3600000,intervaloMs:60000}
const check=async(n,f)=>{await f();total++;console.log('PASS:',n)}
try{
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes)
 await check('primeira execução cria cópia verificada',async()=>{primeiro=await executarBackupSeDevido(base);assert.equal(primeiro.status,'concluido');assert.equal(primeiro.anexos,1)})
 await check('intervalo impede duplicação antes do prazo',async()=>{assert.equal((await executarBackupSeDevido({...base,agora:base.agora+59999})).status,'aguardando');assert.equal(calls,1)})
 await check('execução no prazo cria versão independente',async()=>{segundo=await executarBackupSeDevido({...base,agora:base.agora+60000});assert.equal(segundo.status,'concluido');assert.notEqual(primeiro.arquivo,segundo.arquivo)})
 await check('execução concorrente é bloqueada',async()=>{const lock=path.join(destino,empresa,'.execucao');await mkdir(lock);try{assert.equal((await executarBackupSeDevido({...base,agora:base.agora+120000})).status,'ocupado')}finally{await rm(lock,{recursive:true})}})
 await check('falha de captura não substitui último sucesso',async()=>{await rm(file);await assert.rejects(executarBackupSeDevido({...base,agora:base.agora+120000}));const s=JSON.parse(await readFile(path.join(destino,empresa,'ultimo-sucesso.json'),'utf8'));assert.equal(s.arquivo,segundo.arquivo)})
 await check('recuperação materializa histórico e bytes sem fonte',async()=>{const d=path.join(dir,'recuperado');const r=await recuperarEmPastaNova({arquivo:path.join(destino,empresa,primeiro.arquivo),key,empresa,destino:d});assert.deepEqual(r,{mensagens:1,anexos:1});assert.deepEqual(JSON.parse(await readFile(path.join(d,'historico.json'),'utf8')),snapshot);assert.deepEqual(await readFile(path.join(d,'midia',media)),bytes)})
 await check('recuperação nunca sobrescreve diretório existente',async()=>assert.rejects(recuperarEmPastaNova({arquivo:path.join(destino,empresa,primeiro.arquivo),key,empresa,destino:path.join(dir,'recuperado')}),{code:'EEXIST'}))
 await check('backup adulterado não é considerado válido no intervalo',async()=>{const f=path.join(destino,empresa,segundo.arquivo);const s=await readFile(f,'utf8');await writeFile(f,s.slice(0,-1));await assert.rejects(executarBackupSeDevido({...base,agora:base.agora+60001}))})
 await check('versões anteriores continuam presentes',async()=>assert.equal((await readdir(path.join(destino,empresa))).filter(x=>x.endsWith('.enc')).length,2))
 console.log('TOTAL:',total,'testes de rotina aprovados.')
}finally{await rm(dir,{recursive:true,force:true})}
