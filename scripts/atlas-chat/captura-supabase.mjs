import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {executarBackupSeDevido} from './rotina-backup-local.mjs'
const principal='urtqbvjpwnrfaayolymt'
const ref=/^[a-z0-9]{20}$/
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const tabelas={conversas:'atendimento_conversas',mensagens:'atendimento_mensagens',ocultacoes:'atlas_chat_ocultacoes',eventos:'atendimento_eventos'}
export function validarOrigemHomologacao({url,refPermitida,ativo}){
 if(ativo!==true||!ref.test(refPermitida||'')||refPermitida===principal)throw Error('Captura real desabilitada ou projeto principal bloqueado')
 const u=new URL(url)
 if(u.origin!=='https://'+refPermitida+'.supabase.co'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('Origem fora da homologação autorizada')
}
const limite=100*1024*1024
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
export async function capturarAtlasChat({client,empresa,root}){
 if(!uuid.test(empresa))throw Error('Empresa inválida')
 let total=0
 async function capturar(){
  const s={empresa}
  for(const [nome,tabela] of Object.entries(tabelas)){
   s[nome]=[]
   let ultimo=null
   while(true){
    let q=client.from(tabela).select('*').eq('empresa_id',empresa).order('id',{ascending:true}).limit(500)
    if(ultimo)q=q.gt('id',ultimo)
    const {data,error}=await q
    if(error||!Array.isArray(data))throw Error('Falha na captura: '+tabela)
    if(data.some(r=>r.empresa_id!==empresa||!uuid.test(r.id)))throw Error('Registro fora do escopo')
    for(const row of data){
     if(ultimo&&row.id<=ultimo)throw Error('Paginação inválida')
     ultimo=row.id
    }
    s[nome].push(...data)
    if(Buffer.byteLength(JSON.stringify(s))>limite)throw Error('Limite da homologação excedido')
    if(data.length<500)break
   }
  }
  return s
 }
 const s=await capturar(),ids=new Set(s.conversas.map(c=>c.id))
 for(const t of ['mensagens','ocultacoes','eventos'])if(s[t].some(r=>!ids.has(r.conversa_id)))throw Error('Histórico inconsistente')
 total=Buffer.byteLength(JSON.stringify(s))
 const arquivos=new Set(s.mensagens.map(m=>m.media_url).filter(Boolean))
 for(const p of arquivos){
  if(typeof p!=='string')throw Error('Mídia inválida')
  const partes=p.split('/')
  if(partes[0]!==empresa||!['entrada','saida'].includes(partes[1])||partes.length<3||partes.some(x=>!x||x==='.'||x==='..'||x.includes('\\')||x.includes('\0')))throw Error('Mídia fora do escopo')
  const {data,error}=await client.storage.from('whatsapp-midia').download(p)
  if(error||!data||!Number.isSafeInteger(data.size)||total+data.size>limite)throw Error('Anexo ausente ou limite excedido')
  const bytes=Buffer.from(await data.arrayBuffer());total+=bytes.length
  if(total>limite)throw Error('Limite excedido')
  const local=path.join(root,p);await mkdir(path.dirname(local),{recursive:true,mode:0o700});await writeFile(local,bytes,{flag:'wx',mode:0o600})
 }
 // Releitura detecta divergências entre páginas; não substitui snapshot transacional.
 if(hash(s)!==hash(await capturar()))throw Error('Histórico mudou durante a captura; repetir posteriormente')
 return s
}
export async function backupSupabaseHomologacao({url,refPermitida,ativo,criarCliente,empresa,destino,key,agora,intervaloMs}){
 validarOrigemHomologacao({url,refPermitida,ativo})
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-captura-'))
 try{
  const client=await criarCliente(url)
  return await executarBackupSeDevido({empresa,root,destino,key,agora,intervaloMs,capturar:()=>capturarAtlasChat({client,empresa,root})})
 }finally{await rm(root,{recursive:true,force:true})}
}
