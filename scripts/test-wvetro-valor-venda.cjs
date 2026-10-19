const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const load=(path,imports={})=>{
 const m={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText,{module:m,exports:m.exports,require:n=>{
   if(n in imports)return imports[n]
   throw Error('Dependência inesperada: '+n)
 },console,Date})
 return m.exports
}
const core=load('lib/wvetroValorVendaValidacao.ts')
assert.equal(core.moedaWVetro('R$ 9.461,43'),9461.43)
assert.equal(core.moedaWVetro('10.217,92'),10217.92)
assert.equal(core.moedaWVetro('R$ não informado'),null)
assert.equal(core.valorOrigemVendaWVetro({payload_bruto:{ValorTotal:'9.461,43'}}),9461.43)
assert.equal(core.centavosVendaWVetro(10217.92),1021792)
assert.equal(core.centavosVendaWVetro(10217.923),null)
assert.equal(core.centavosVendaWVetro(-1),null)
assert.equal(core.centavosVendaWVetro(0),null)

const clone=v=>JSON.parse(JSON.stringify(v))
let row, vendas, feedback, historico, allowed, scope, conflict, feedbackFail, said
function reset(){
 row={id:'orc896',empresa_id:'empresa1',criado_por_id:'u1',status:'rascunho',updated_at:'t0',
 valor_estimado:9461.43,itens:[{id:'porta1',largura_mm:1000,preco_total:7000}],
 anexos:[{url:'pdf-manual'}],fotos_urls:['foto1'],
 wvetro_fluxo:{origem:'wvetro_api',numero:'896',validacao_status:'aguardando',
 payload_bruto:{ValorTotal:'9.461,43'},validacoes_itens:{porta1:{resultado:'correto'}}}}
 vendas=[];feedback=[];historico=[];allowed=true;scope='todos';conflict=false;feedbackFail=false;said=[]
}
function query(table){
 let op='select',payload,conditions=[]
 const q={}
 q.select=()=>q
 q.update=v=>{op='update';payload=v;return q}
 q.insert=v=>{op='insert';payload=v;return q}
 q.delete=()=>{op='delete';return q}
 q.eq=(c,v)=>{conditions.push([c,v]);return q}
 q.is=(c,v)=>{conditions.push([c,v]);return q}
 q.limit=()=>q
 const has=(c,v)=>conditions.some(x=>x[0]===c&&x[1]===v)
 function run(){
  if(table==='orcamentos'){
   assert.ok(has('empresa_id','empresa1'),'Tenant filtrado')
   if(op==='update'){
    if(conflict||!has('updated_at',row.updated_at))return {data:null,error:null}
    Object.assign(row,clone(payload))
   }
   return {data:clone(row),error:null}
  }
  if(table==='vendas_obras')return {data:clone(vendas),error:null}
  if(table==='ai_orcamento_feedback'){
   if(op==='insert'){if(feedbackFail)return {data:null,error:{message:'feedback fora do ar'}};feedback.push(clone(payload))}
   if(op==='delete')feedback=feedback.filter(x=>x.id!==conditions.find(c=>c[0]==='id')[1])
   return {data:null,error:null}
  }
  if(table==='historico'){if(op==='insert')historico.push(clone(payload));return {data:null,error:null}}
  throw Error('Tabela inesperada: '+table)
 }
 q.maybeSingle=async()=>run()
 q.then=(resolve,reject)=>Promise.resolve(run()).then(resolve,reject)
 return q
}
const server=load('lib/wvetroValorVendaValidacaoServer.ts',{
 'node:crypto':{randomUUID:require('node:crypto').randomUUID},
 'next/server':{NextResponse:{json:(data,o={})=>({data,status:o.status||200})}},
 './supabaseAdmin':{supabaseAdmin:{from:query}},
 './acessoUsuarioServer':{usuarioPodeAcaoServer:async()=>allowed},
 './ai/permissoesServer':{carregarPermissoesIA:async()=>({dominios:{orcamento:{permitido:true,escopo:scope}}})},
 './wvetroValorVendaValidacao':core,
})
const usuario={id:'u1',nome:'Teste',role:'master',empresa_id:'empresa1'}
const request=(modo,extra={})=>server.conferirValorVendaImportadoWVetro(usuario,{
 cardId:'orc896',modo,valorAnterior:row.valor_estimado,atualizadoEm:row.updated_at,...extra,
})
;(async()=>{
 reset()
 let r=await request('validar')
 assert.equal(r.status,200)
 assert.equal(row.valor_estimado,9461.43)
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.status,'validado')
 assert.equal(feedback.length,1)
 assert.equal(historico.length,1)
 assert.equal(row.itens[0].preco_total,7000,'Não altera itens')
 assert.equal(row.anexos[0].url,'pdf-manual')
 assert.equal(row.fotos_urls[0],'foto1')
 reset()
 r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'Conforme proposta fechada'})
 assert.equal(r.status,200)
 assert.equal(row.valor_estimado,10217.92)
 assert.equal(row.wvetro_fluxo.payload_bruto.ValorTotal,'9.461,43','Preserva origem')
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.valor_anterior,9461.43)
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.valor_origem_wvetro,9461.43)
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.valor_final,10217.92)
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.justificativa,'Conforme proposta fechada')
 assert.equal(row.wvetro_fluxo.validacoes_itens.porta1.resultado,'correto')
 assert.equal(row.itens[0].preco_total,7000,'Correção do total não modifica valor unitário ou composição')
 assert.ok(historico[0].detalhes.includes('R$\\u00a010.217,92')||
   historico[0].detalhes.includes('10.217,92'))
 assert.equal(feedback.at(-1).diferencas.valor_estimado.depois,10217.92)
 const valida=load('lib/wvetroValidacaoItem.ts')
 const preservacao=load('lib/wvetroPreservacaoSincronizacao.ts',{'./wvetroValidacaoItem':valida})
 assert.equal(preservacao.houveConferenciaHumanaWVetro(row.wvetro_fluxo),true)
 const origin=clone(row.wvetro_fluxo)
 const rec=preservacao.reconciliarSincronizacaoWVetro(row,[],{
 origem:'wvetro_api',numero:'896',payload_hash:'mesmo',validacao_status:'aguardando',
 },true)
 assert.equal(rec.fluxo.valor_venda_conferencia.valor_final,10217.92,'Reimportação igual preserva ajuste')
 const mudanca=preservacao.reconciliarSincronizacaoWVetro(row,[],{origem:'wvetro_api'},false)
 assert.equal(mudanca.bloqueado,true,'Mudança de arquivo exige revisão')
 const sync=fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts','utf8')
 assert.match(sync,/valor_venda_conferencia/)
 assert.match(sync,/\? existente\.valor_estimado : \(valor > 0/)
 assert.equal(row.wvetro_fluxo.valor_venda_conferencia.valor_final,10217.92)
 reset();r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'x'})
 assert.equal(r.status,400);assert.equal(feedback.length,0)
 reset();r=await request('corrigir',{valorCorrigido:9461.43,justificativa:'Sem mudança'})
 assert.equal(r.status,400)
 reset();r=await request('corrigir',{valorCorrigido:10217.923,justificativa:'Valor correto'})
 assert.equal(r.status,400)
 reset();r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'Corrigido',atualizadoEm:'anterior'})
 assert.equal(r.status,409)
 reset();r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'Corrigido',valorAnterior:100})
 assert.equal(r.status,409)
 reset();vendas=[{id:'venda1'}];r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'Corrigido'})
 assert.equal(r.status,409);assert.equal(row.valor_estimado,9461.43)
 reset();row.status='vendido';r=await request('validar');assert.equal(r.status,409)
 reset();allowed=false;r=await request('validar');assert.equal(r.status,403)
 reset();scope='proprio';row.criado_por_id='outro';r=await request('validar');assert.equal(r.status,404)
 reset();conflict=true;r=await request('corrigir',{valorCorrigido:10217.92,justificativa:'Corrigido'})
 assert.equal(r.status,409);assert.equal(feedback.length,0,'CAS remove feedback de operação não aplicada')
 reset();feedbackFail=true;await assert.rejects(request('corrigir',{valorCorrigido:10217.92,justificativa:'Corrigido'}))
 assert.equal(row.valor_estimado,9461.43)
 const ui=fs.readFileSync('components/system/KanbanPageFixed.tsx','utf8')
 assert.match(ui,/Validar valor atual/)
 assert.match(ui,/Corrigir valor de venda/)
 assert.match(ui,/conferir_valor_venda_importacao/)
 assert.match(ui,/valor_estimado: editando\.valor_estimado \}/)
 console.log('PASS: 896, 9.461,43 -> 10.217,92; validação, correção, preservação, concorrência, venda fechada, RLS, feedback e UI.')
})().catch(e=>{console.error(e);process.exitCode=1})
