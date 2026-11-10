const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const body=fs.readFileSync('app/api/vendas/excluir-incorreta/route.ts','utf8')
const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const EMP='87897d68-1334-491c-b29b-4065cd83760c'
const VEN='f21b0ce8-ea2a-424e-9a2f-04743eb47894'
const CLI='18094b86-108e-4e9f-ad69-098ab9acc5b4'
const USU='8e8153b2-044b-4002-8c27-63bc6a03690f'
let role='master',excluida=false,rpcCalls=0,rpcErro=null
const rpcArgs=[]
const banco={
 from(nome){
  assert.equal(nome,'vendas_obras')
  const f={}
  const q={
   select(){return q},eq(k,v){f[k]=v;return q},
   async maybeSingle(){
    assert.equal(f.empresa_id,EMP)
    return {data:f.id===VEN&&f.cliente_id!==('ERRADO')?
     {id:VEN,numero:72,cliente_id:CLI,orcamento_id:'22a5edf1-13cc-41ff-8f5c-bd5fee5725b1',
      status:excluida?'cancelada':'ativa',excluida_em:excluida?'2026-11-10T12:00:00Z':null}:null,error:null}
   }
  };return q
 },
 async rpc(fn,args){
  assert.equal(fn,'excluir_venda_incorreta_v1')
  assert.equal(args.p_empresa,EMP)
  assert.equal(args.p_usuario,USU)
  assert.equal(args.p_venda,VEN)
  assert.ok(args.p_motivo.length>=8)
  rpcArgs.push(args);rpcCalls++
  if(rpcErro)return {data:null,error:{message:rpcErro}}
  excluida=true;return {data:{ok:true,vendaId:VEN,contasCanceladas:1},error:null}
 }
}
const NextResponse={json(data,options={}){return{body:data,status:options.status||200}}}
const imports={
 'next/server':{NextResponse},
 '@/lib/tenantServer':{autenticarTenant:async()=>role===null?null:{id:USU,nome:'Usuário',role,empresa_id:EMP}},
 '@/lib/supabaseAdmin':{supabaseAdmin:banco},
}
const mod={exports:{}}
new Function('require','module','exports',js)(name=>{assert.ok(Object.hasOwn(imports,name),'Import inesperado '+name);return imports[name]},mod,mod.exports)
const excluir=mod.exports.POST
const requisicao=(confirmacao='EXCLUIR 72',motivo='Venda cadastrada por engano')=>({
 json:async()=>({vendaId:VEN,clienteId:CLI,confirmacao,motivo})
})
async function testar(){
 role=null
 assert.equal((await excluir(requisicao())).status,401)
 role='funcionario'
 assert.equal((await excluir(requisicao())).status,403)
 role='master'
 assert.equal((await excluir(requisicao('EXCLUIR 73'))).status,400)
 assert.equal((await excluir(requisicao('EXCLUIR 72','curto'))).status,400)
 assert.equal(rpcCalls,0)
 rpcErro='Há recebimento ou movimentação financeira. Corrija no Financeiro antes de excluir'
 let bloqueio=await excluir(requisicao())
 assert.equal(bloqueio.status,409);assert.match(bloqueio.body.error,/recebimento/)
 assert.equal(excluida,false)
 rpcErro=null
 let ok=await excluir(requisicao())
 assert.equal(ok.status,200);assert.equal(ok.body.ok,true);assert.equal(ok.body.contasCanceladas,1)
 assert.equal(excluida,true);assert.equal(rpcCalls,2)
 let repetida=await excluir(requisicao())
 assert.equal(repetida.status,409)
 const ui=fs.readFileSync('components/clientes/VendasCliente360.tsx','utf8')
 for(const text of ["Excluir venda","role==='master'","EXCLUIR ","/api/vendas/excluir-incorreta","/integracoes/wvetro/sincronizar-numero",".is('excluida_em',null)"])
  assert.ok(ui.includes(text),'UI sem requisito: '+text)
 assert.ok(!body.includes(".delete(")&&!body.includes("DELETE FROM"),'Exclusão física proibida')
 for(const path of [
 'app/api/visao-geral-projetos/route.ts','app/api/clientes/[id]/kanban-obras/route.ts',
 'app/api/kanban-central/route.ts','components/clientes/VendaObraCentral.tsx'
 ]){
  const s=fs.readFileSync(path,'utf8')
  assert.ok(s.includes(".is('excluida_em',null)"),'Venda excluída continua aparecendo em '+path)
 }
 console.log('PASS: acesso Master, confirmação exata, bloqueio financeiro, RPC auditada, sem DELETE físico, filtros dos Kanbans e sincronização W.Vetro')
}
testar().catch(e=>{console.error(e);process.exitCode=1})
