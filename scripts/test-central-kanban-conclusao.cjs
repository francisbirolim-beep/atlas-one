const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function importarTS(arquivo){
 const modulo={exports:{}}
 const source=fs.readFileSync(arquivo,'utf8')
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 new Function('module','exports',code)(modulo,modulo.exports)
 return modulo.exports
}
const {indiceConclusaoOperacional,ehColunaConclusaoOperacional}=importarTS('lib/centralKanban.ts')
const {avaliarFluxoVenda}=importarTS('lib/vendaFluxoResumo.ts')
for(const setor of ['compras','producao','instalacao','financeiro']){
 const fim=indiceConclusaoOperacional(setor)
 assert.ok(Number.isInteger(fim)&&fim>=1)
 assert.equal(ehColunaConclusaoOperacional(setor,fim),true)
 assert.equal(ehColunaConclusaoOperacional(setor,fim-1),false)
 assert.equal(ehColunaConclusaoOperacional(setor,fim+1),false,'Coluna personalizada nao significa conclusao')
}
assert.equal(indiceConclusaoOperacional('engenharia'),null,'Engenharia continua com fluxo tecnico proprio')
const bom={
 valorVenda:1000,
 contas:[{valor:1000,valor_pago:1000,valor_desconto:0,status:'pago'}],
 compras:[{status:'recebido',recebido_em:'2026-10-12'}],
 ordens:[{status:'concluida',bloqueada:false}],
 instalacoes:[{status:'instalado',quantidade:2,quantidade_instalada:2,pendencia:null,
  checklist:{nivelamento:true,vedacao:true,acabamento:true,limpeza:true}}]
}
function etapa(caso,nome){return avaliarFluxoVenda(caso).etapas.find(e=>e.id===nome)?.concluida}
for(const setor of ['compras','producao','instalacao','financeiro'])assert.equal(etapa(bom,setor),true)
assert.equal(etapa({...bom,compras:[]},'compras'),false,'Sem recebimento fisico nao ha conclusao')
assert.equal(etapa({...bom,ordens:[{status:'concluida',bloqueada:true}]},'producao'),false)
assert.equal(etapa({...bom,instalacoes:[{...bom.instalacoes[0],checklist:{nivelamento:true}}]},'instalacao'),false)
assert.equal(etapa({...bom,contas:[{valor:1500,valor_pago:1500,status:'pago'}]},'financeiro'),false)
const api=fs.readFileSync('app/api/kanban-central/route.ts','utf8')
const ui=fs.readFileSync('components/system/CentralKanbans.tsx','utf8')
assert.match(api,/if\(ehColunaConclusaoOperacional\(setor,col\.data\.ordem\)\)/)
assert.match(api,/if\(!await conclusaoOperacional\(venda,setor\)\)/)
assert.match(ui,/ehColunaConclusaoOperacional\(s,b\.ordem\)/)
assert.match(ui,/if\(etapaFinal&&concluida\)return etapaFinal\.id/)
console.log('PASS: etapa final exige confirmacao operacional, nunca so movimento administrativo.')
