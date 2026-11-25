const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('lib/whatsappServer.ts','utf8')
const route = fs.readFileSync('app/api/integracoes/whatsapp/conversas/route.ts','utf8')
const globalButton = fs.readFileSync('components/BotaoChatGlobal.tsx','utf8')
const rows = [
  {id:'minha',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'contato',status:'aguardando',responsavel_id:'eu',nao_lidas:3},
  {id:'lida',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'contato',status:'aguardando',responsavel_id:'eu',nao_lidas:0},
  {id:'outro',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'contato',status:'aguardando',responsavel_id:'outro',nao_lidas:5},
  {id:'finalizada',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'contato',status:'finalizado',responsavel_id:'outro',nao_lidas:1},
  {id:'grupo',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'grupo',status:'aguardando',responsavel_id:'eu',nao_lidas:2},
  {id:'grupo-outro',empresa_id:'empresa',whatsapp_canal_id:'canal',whatsapp_chat_tipo:'grupo',status:'aguardando',responsavel_id:'outro',nao_lidas:2}
]
let consultas=[]
const supabaseAdmin={from(table){
  consultas.push(table)
  const data=table==='atendimento_conversas'?rows:table==='atendimento_mensagens'?[{conversa_id:'finalizada'}]:null
  assert.ok(data, 'Consulta desnecessária no contador: '+table)
  const q={then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject)}}
  for(const m of ['select','eq','in','order','range'])q[m]=()=>q
  return q
}}
const mod={exports:{}}
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mockRequire=(id)=>{
  if(id==='@/lib/supabaseAdmin')return {supabaseAdmin}
  if(id==='@/lib/whatsappEscalonamento')return {elegivelAoSecundario:()=>false,obterDistribuicaoWhatsApp:async()=>null}
  if(id==='@/lib/whatsappIdentidadeContato'||id==='@/lib/whatsappAlertasGrupo')return {}
  return require(id)
}
new Function('module','exports','require',js)(mod,mod.exports,mockRequire)
async function main(){
  const acessos=[{canal_id:'canal',visualizar:true,atender:true,transferir:true,supervisionar:true,dono:true,principal:true}]
  const usuario={id:'eu',empresa_id:'empresa',role:'master'}
  const result=await mod.exports.listarConversasAtendimento(usuario,{modo:'minhas',somentePendentes:true,acessos})
  assert.deepEqual(result.map(c=>c.id),['minha','finalizada','grupo'])
  assert.deepEqual(consultas,['atendimento_conversas','atendimento_mensagens'])
  assert.match(route,/somentePendentes: true, acessos/)
  assert.match(route,/pendentes: pendentes.length/)
  assert.match(globalButton,/conversas\?resumo=pendentes/)
  assert.match(globalButton,/if\(emCurso\)/)
  assert.match(globalButton,/controller\?\.abort\(\)/)
  assert.match(globalButton,/if\(oculto\) return/)
  console.log('PASS: contador reduzido, caixa pessoal do master, autorização, ausência de consultas de enriquecimento, controle de concorrência.')
}
main().catch(e=>{console.error(e);process.exitCode=1})

