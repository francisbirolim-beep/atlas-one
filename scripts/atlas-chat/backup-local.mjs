import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import {readFile,writeFile,realpath,stat} from 'node:fs/promises'
import path from 'node:path'
const MAX=100*1024*1024
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash=b=>createHash('sha256').update(b).digest('hex')
const tipos=['conversas','mensagens','ocultacoes','eventos']
function checar(snapshot){
 if(!uuid.test(snapshot?.empresa||''))throw Error('Empresa inválida')
 for(const t of tipos){
  if(!Array.isArray(snapshot[t]))throw Error('Tabela ausente: '+t)
  if(snapshot[t].some(r=>r.empresa_id!==snapshot.empresa))throw Error('Registro de outra empresa')
 }
 const ids=new Set(snapshot.conversas.map(c=>c.id))
 for(const t of ['mensagens','ocultacoes','eventos'])if(snapshot[t].some(r=>!ids.has(r.conversa_id)))throw Error('Conversa ausente')
 const files=new Set()
 for(const m of snapshot.mensagens){
  if(!m.media_url)continue
  const p=m.media_url.split('/')
  if(p[0]!==snapshot.empresa||!['entrada','saida'].includes(p[1])||p.length<3||p.some(x=>!x||x==='.'||x==='..'||x.includes('\\')||x.includes('\0')))throw Error('Mídia externa ou caminho inválido')
  files.add(m.media_url)
 }
 return files
}
function chave(k){if(!Buffer.isBuffer(k)||k.length!==32)throw Error('Chave AES-256 inválida')}
export async function criarBackupLocal(snapshot,root,destino,key){
 chave(key)
 const files=checar(snapshot),base=await realpath(root)
 let total=Buffer.byteLength(JSON.stringify(snapshot))
 const anexos=[]
 for(const p of files){
  const local=await realpath(path.join(base,p))
  if(!local.startsWith(base+path.sep))throw Error('Arquivo fora da origem')
  const info=await stat(local)
  if(!info.isFile()||total+info.size>MAX)throw Error('Arquivo inválido ou limite local excedido')
  const bytes=await readFile(local)
  total+=bytes.length
  if(total>MAX)throw Error('Limite local excedido')
  anexos.push({path:p,bytes:bytes.toString('base64'),sha256:hash(bytes)})
 }
 const payload=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),snapshot,anexos}))
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv)
 cipher.setAAD(Buffer.from('atlas-chat-backup-v1'))
 const encrypted=Buffer.concat([cipher.update(payload),cipher.final()])
 const envelope=JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')})
 await writeFile(destino,envelope,{flag:'wx',mode:0o600})
 return {mensagens:snapshot.mensagens.length,anexos:anexos.length}
}
export async function verificarBackupLocal(arquivo,key,empresa){
 chave(key)
 if((await stat(arquivo)).size>MAX*3)throw Error('Backup acima do limite local')
 const e=JSON.parse(await readFile(arquivo,'utf8'))
 if(e.version!==1)throw Error('Versão inválida')
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'))
 decipher.setAAD(Buffer.from('atlas-chat-backup-v1'))
 decipher.setAuthTag(Buffer.from(e.tag,'base64'))
 const p=JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.data,'base64')),decipher.final()]).toString('utf8'))
 if(p.snapshot.empresa!==empresa)throw Error('Backup de outra empresa')
 const files=checar(p.snapshot)
 if(!Array.isArray(p.anexos)||p.anexos.length!==files.size)throw Error('Manifesto incompleto')
 const anexos=new Map()
 for(const a of p.anexos){
  if(!files.has(a.path)||anexos.has(a.path))throw Error('Anexo inválido')
  const bytes=Buffer.from(a.bytes,'base64')
  if(hash(bytes)!==a.sha256)throw Error('Anexo corrompido')
  anexos.set(a.path,bytes)
 }
 return {snapshot:p.snapshot,anexos}
}
