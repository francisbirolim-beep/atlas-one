/* Regressões de venda confirmada, leitura manual e encerramento do cronômetro. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const oldTs = require.extensions['.ts']
require.extensions['.ts'] = (mod, file) => {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText
  mod._compile(js,file)
}

const {orcamentoVendidoParaMedicao} = require('../lib/medicaoOrcamentosVendidos.ts')
const {interpretarTresLeiturasTrena} = require('../lib/medicaoLeituraManual.ts')
const vendas = new Set(['vendido-atlas'])
assert.equal(orcamentoVendidoParaMedicao({id:'vendido-atlas'},vendas),true)
assert.equal(orcamentoVendidoParaMedicao({id:'proposta-aberta'},vendas),false)
assert.equal(orcamentoVendidoParaMedicao({id:'w1',wvetro_fluxo:{origem:'wvetro',situacao:'V',validacao_manual_cliente:true}},vendas),true)
assert.equal(orcamentoVendidoParaMedicao({id:'w2',wvetro_fluxo:{origem:'wvetro',situacao:'F',fonte_registro:'historico_validado'}},vendas),true)
assert.equal(orcamentoVendidoParaMedicao({id:'w3',wvetro_fluxo:{origem:'wvetro',situacao:'V'}},vendas),false)
assert.equal(orcamentoVendidoParaMedicao({id:'w4',wvetro_fluxo:{origem:'wvetro',situacao:'O',validacao_manual_cliente:true}},vendas),false)
assert.equal(orcamentoVendidoParaMedicao({id:'outro',wvetro_fluxo:{origem:'atlas',situacao:'V',validacao_manual_cliente:true}},vendas),false)

assert.deepEqual(interpretarTresLeiturasTrena('1.509 1.507 1.501'),[1509,1507,1501])
assert.deepEqual(interpretarTresLeiturasTrena('2,265;2,267;2,264'),[2265,2267,2264])
assert.deepEqual(interpretarTresLeiturasTrena('1509 / 1507 / 1501'),[1509,1507,1501])
assert.equal(interpretarTresLeiturasTrena('1.509 1.507'),null)
assert.equal(interpretarTresLeiturasTrena('1.509 abc 1.501'),null)
assert.equal(interpretarTresLeiturasTrena('99999 1507 1501'),null)

let medicao = { iniciado_em:'2026-11-16T14:00:00Z', concluido_em:'2026-11-16T14:30:00Z',
 status_operacional:'concluido', responsavel_nome:'Operador' }
let eventos = []
const supabase = {
  from(table) {
    return {
      select() { return this },
      eq() { return this },
      in() { return this },
      order() {return Promise.resolve({data:table==='medicao_revisoes'?eventos:[],error:null})},
      maybeSingle() {return Promise.resolve({data:medicao,error:null})},
    }
  },
}
const oldLoad=Module._load
Module._load=function(request,parent,...args) {
  if(request==='./supabase' && parent?.filename.endsWith('/lib/medicaoParcial.ts')) return {supabase}
  return oldLoad.apply(this,[request,parent,...args])
}
const {carregarEstadoParcialMedicao} = require('../lib/medicaoParcial.ts')
Module._load=oldLoad

async function run() {
  const terminado=await carregarEstadoParcialMedicao('m1')
  assert.equal(terminado.encerrada,true,'concluída tem relógio zerado no UI')
  assert.equal(terminado.tempoAtivoMs,30*60*1000,'duração real fica preservada')
  medicao={...medicao,concluido_em:null,status_operacional:'em_medicao',iniciado_em:new Date(Date.now()-25000).toISOString()}
  const aberta=await carregarEstadoParcialMedicao('m1')
  assert.equal(aberta.encerrada,false)
  assert.ok(aberta.tempoAtivoMs>=20000,'cronômetro continua enquanto está em medição')

  const cliente=fs.readFileSync('app/producao/medicao-final/cliente/[clienteId]/page.tsx','utf8')
  assert.match(cliente,/orcamentoVendidoParaMedicao\(o, orcamentosComVenda\)/)
  assert.match(cliente,/from\('vendas_obras'\)/)
  assert.doesNotMatch(cliente,/>Iniciar sem orçamento</,'não permitir avulsa dentro da venda')

  const resumo=fs.readFileSync('components/system/MedicaoFinalFieldSummary.tsx','utf8')
  assert.match(resumo,/pecasEmAndamento/)
  assert.match(resumo,/percentualIniciadas/)
  assert.match(resumo,/addEventListener\('atlas-medicao-atualizada'/)
  const painel=fs.readFileSync('components/system/MedicaoParcialPanel.tsx','utf8')
  assert.match(painel,/encerrada \? 0/)
  assert.match(painel,/MiniCroquiTipologia/)
  const leitor=fs.readFileSync('components/system/LeituraTrenaIA.tsx','utf8')
  assert.match(leitor,/confianca < 75/)
  assert.match(leitor,/interpretarTresLeiturasTrena/)
  console.log('PASS: só vendas comprovadas, medição fechada=zero, tempo histórico preservado, progresso reativo, croqui e leitura manual segura.')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{require.extensions['.ts']=oldTs})
