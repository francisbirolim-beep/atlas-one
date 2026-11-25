import {randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,rm,link,stat} from 'node:fs/promises'
import path from 'node:path'
import {criarBackupLocal,verificarBackupLocal} from './backup-local.mjs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Runner local; caller supplies synthetic snapshot and isolated folders.
// No timers, credentials, network, or production database access.
export async function executarBackupSeDevido({empresa,root,destino,key,capturar,agora=Date.now(),intervaloMs=3600000}){
 if(!uuid.test(empresa)||!Number.isSafeInteger(agora)||agora<0||!Number.isSafeInteger(intervaloMs)||intervaloMs<60000)throw Error('Parâmetros inválidos')
 const dir=path.join(destino,empresa)
 await mkdir(dir,{recursive:true,mode:0o700})
 const lock=path.join(dir,'.execucao')
 try{await mkdir(lock,{mode:0o700})}catch(e){if(e.code==='EEXIST')return {status:'ocupado'};throw e}
 const estado=path.join(dir,'ultimo-sucesso.json'),temp=path.join(dir,'.tmp-'+randomUUID())
 try{
  let anterior=null
  try{anterior=JSON.parse(await readFile(estado,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
  if(anterior){
   if(!Number.isSafeInteger(anterior.em)||anterior.em>agora||!/^backup-[0-9]+-[0-9a-f-]+\.enc$/.test(anterior.arquivo))throw Error('Estado inválido')
   if(agora-anterior.em<intervaloMs){
    await verificarBackupLocal(path.join(dir,anterior.arquivo),key,empresa)
    return {status:'aguardando',proximo:anterior.em+intervaloMs}
   }
  }
  await mkdir(temp,{mode:0o700})
  const snapshot=await capturar()
  if(snapshot.empresa!==empresa)throw Error('Captura de outra empresa')
  const pendente=path.join(temp,'backup.enc')
  const resumo=await criarBackupLocal(snapshot,root,pendente,key)
  await verificarBackupLocal(pendente,key,empresa)
  const arquivo='backup-'+agora+'-'+randomUUID()+'.enc'
  // Publicar somente cópia verificada; link exclusivo nunca sobrescreve.
  await link(pendente,path.join(dir,arquivo))
  const novo={em:agora,arquivo,...resumo}
  await writeFile(path.join(temp,'estado.json'),JSON.stringify(novo),{mode:0o600,flag:'wx'})
  await rename(path.join(temp,'estado.json'),estado)
  return {status:'concluido',...novo}
 }finally{await rm(temp,{recursive:true,force:true});await rm(lock,{recursive:true,force:true})}
}
export async function recuperarEmPastaNova({arquivo,key,empresa,destino}){
 const {snapshot,anexos}=await verificarBackupLocal(arquivo,key,empresa)
 // Diretório novo obrigatório; não tocar em arquivos ou banco existentes.
 await mkdir(destino,{mode:0o700})
 try{
  await writeFile(path.join(destino,'historico.json'),JSON.stringify(snapshot),{flag:'wx',mode:0o600})
  for(const [p,bytes] of anexos){
   const file=path.join(destino,'midia',p)
   await mkdir(path.dirname(file),{recursive:true,mode:0o700})
   await writeFile(file,bytes,{flag:'wx',mode:0o600})
  }
  await writeFile(path.join(destino,'recuperacao.json'),JSON.stringify({empresa,mensagens:snapshot.mensagens.length,anexos:anexos.size,verificado:true}),{flag:'wx',mode:0o600})
  return {mensagens:snapshot.mensagens.length,anexos:anexos.size}
 }catch(e){await rm(destino,{recursive:true,force:true});throw e}
}
