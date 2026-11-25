import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {criarBackupLocal,verificarBackupLocal} from './atlas-chat/backup-local.mjs'
const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-chat-backup-test-'))
const empresa='00000000-0000-4000-8000-000000000001',outra='00000000-0000-4000-8000-000000000002'
const media=empresa+'/entrada/2026-11/foto.bin',file=path.join(dir,media),dest=path.join(dir,'backup.enc')
const bytes=Buffer.from([0,1,2,3,255,7]),key=randomBytes(32)
const snapshot={empresa,conversas:[{id:'c1',empresa_id:empresa,contato_nome:'Cliente fictício'}],mensagens:[{id:'m1',empresa_id:empresa,conversa_id:'c1',texto:'Mensagem fictícia',media_url:media}],ocultacoes:[{id:'o1',empresa_id:empresa,conversa_id:'c1',usuario_nome:'Vendedor fictício'}],eventos:[]}
let count=0
async function check(n,f){await f();console.log('PASS:',n);count++}
try{
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes)
 await check('backup criptografado contém mensagem, auditoria e mídia',async()=>assert.deepEqual(await criarBackupLocal(snapshot,dir,dest,key),{mensagens:1,anexos:1}))
 await check('arquivo não contém conteúdo em texto aberto',async()=>assert.ok(!(await readFile(dest,'utf8')).includes('Mensagem fictícia')))
 await check('recuperação íntegra mesmo após remover o arquivo de origem',async()=>{await rm(file);const r=await verificarBackupLocal(dest,key,empresa);assert.deepEqual(r.snapshot,snapshot);assert.deepEqual(r.anexos.get(media),bytes)})
 await check('backup de outra empresa recusado',async()=>assert.rejects(verificarBackupLocal(dest,key,outra)))
 await check('chave incorreta recusada',async()=>assert.rejects(verificarBackupLocal(dest,randomBytes(32),empresa)))
 await check('arquivo adulterado recusado',async()=>{const e=JSON.parse(await readFile(dest,'utf8'));const d=Buffer.from(e.data,'base64');d[0]^=1;e.data=d.toString('base64');const f=path.join(dir,'tampered.enc');await writeFile(f,JSON.stringify(e));await assert.rejects(verificarBackupLocal(f,key,empresa))})
 await check('mídia ausente impede declarar backup concluído',async()=>assert.rejects(criarBackupLocal(snapshot,dir,path.join(dir,'missing.enc'),key)))
 await check('registro de outra empresa bloqueado',async()=>assert.rejects(criarBackupLocal({...snapshot,mensagens:[{...snapshot.mensagens[0],empresa_id:outra}]},dir,path.join(dir,'cross.enc'),key)))
 await check('caminho externo ou traversal bloqueado',async()=>{for(const p of ['https://example.invalid/a',empresa+'/entrada/../../secret'])await assert.rejects(criarBackupLocal({...snapshot,mensagens:[{...snapshot.mensagens[0],media_url:p}]},dir,path.join(dir,'bad.enc'),key))})
 await check('backup existente não é sobrescrito',async()=>{await writeFile(file,bytes);await assert.rejects(criarBackupLocal(snapshot,dir,dest,key));assert.deepEqual((await verificarBackupLocal(dest,key,empresa)).snapshot,snapshot)})
 console.log('TOTAL:',count,'testes de backup aprovados.')
}finally{await rm(dir,{recursive:true,force:true})}
