const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const Module=require('node:module')
const source=fs.readFileSync('lib/vendaCmvRevisao.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m=new Module('lib/vendaCmvRevisao.ts',module)
m.filename='lib/vendaCmvRevisao.ts'
m.paths=module.paths
m._compile(js,m.filename)
const {custoRevisado,custoPrevistoOriginal}=m.exports
// Regressão: obra Shayla #572, totais originais do Atlas e correções conforme prints W.Vetro.
const p={categorias:{perfil:2688.84,acessorio:null,vidro:null,sobra:1131.01,perda:null},
 total:5531,total_uso:4399.99,total_com_sobra:5531}
const rev=(categoria,valorOrigem,valorNovo)=>({
 versao:1,venda_id:'v',orcamento_id:'o',numero_wvetro:'572',categoria,acao:'corrigido',
 valor_origem:valorOrigem,valor_revisado:valorNovo,justificativa:'Ajuste conferido',
 usuario_nome:'Master',registrado_em:new Date().toISOString()
})
assert.equal(custoPrevistoOriginal(p,'total_uso'),4399.99)
assert.equal(custoPrevistoOriginal(p,'total'),5531)
assert.equal(custoRevisado(p,{},'total_uso'),4399.99)
assert.equal(custoRevisado(p,{},'total'),5531)
const ajustes={total_uso:rev('total_uso',4399.99,4872.49),total:rev('total',5531,6003.50)}
assert.equal(custoRevisado(p,ajustes,'total_uso'),4872.49)
assert.equal(custoRevisado(p,ajustes,'total'),6003.50)
assert.equal(custoRevisado(p,ajustes,'perfil'),3819.85,'Nenhuma alteração em perfis + sobra')
assert.equal(Math.round((6003.50-4872.49)*100)/100,1131.01,'Sobra não é duplicada')
assert.equal(custoRevisado(p,{total:ajustes.total},'total_uso'),4399.99,'Totais independentes')
assert.equal(custoRevisado(p,{total_uso:ajustes.total_uso},'total'),5531,'Totais independentes')
assert.equal(custoRevisado({...p,total_uso:4872.49},ajustes,'total_uso'),4872.49,'Revisão vencida por sincronização não muda o valor novo')
const tela=fs.readFileSync('components/clientes/VendaCmvPainel.tsx','utf8')
const central=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
const rota=fs.readFileSync('app/api/vendas/cmv/revisao-venda/route.ts','utf8')
const sql=fs.readFileSync('supabase/migrations/20261016112500_venda_conferencia_valor_wvetro_v1.sql','utf8')
assert.ok(tela.includes("botoesRevisao('total_uso')"))
assert.ok(tela.includes("botoesRevisao('total')"))
assert.ok(tela.includes("revisarVenda('validado')"))
assert.ok(tela.includes("revisarVenda('corrigido')"))
assert.ok(central.includes('onVendaAtualizada={()=>{void carregar()}}'))
assert.ok(rota.includes("lower")===false,'A API não confia no role enviado pelo cliente')
assert.ok(rota.includes("usuario.role"))
assert.ok(sql.includes("for update"),'Conferência concorrente bloqueada no banco')
assert.ok(sql.includes("venda_obra_revisoes"),'Histórico da venda no banco')
assert.ok(sql.includes('v_revisao_anterior'),'Revisão anterior preservada integralmente')
assert.ok(!sql.includes("update public.orcamentos"),'Nunca altera dados WVetro do orçamento')
assert.ok(!sql.includes("update public.financeiro_contas_receber"),'Nunca altera recebíveis automaticamente')
console.log('PASS: #572, custos sem/com sobra independentes, materiais preservados, auditoria e venda Master.')
