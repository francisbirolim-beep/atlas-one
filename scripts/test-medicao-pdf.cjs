const fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm'), assert = require('node:assert/strict')
const extras = { observacao_medicao: 'Texto de campo '.repeat(1500) }
const item = {id:'peca',tipo_esquadria:'janela_correr',descricao:'Janela de correr 02 folhas | Linha: Suprema',quantidade:1,ambiente:'Sala',campos_extras:extras,largura_baixo_mm:1200,largura_meio_mm:1220,largura_cima_mm:1210,altura_direita_mm:1500,altura_meio_mm:1502,altura_esquerda_mm:1500}
const dados = {itens:[item],campos:[],respostas:[],fotos:[]}
const context = {exports:{},require:name=>name==='jspdf'?require('jspdf'):name==='./auth'?{tokenAtual:async()=>null}:{carregarChecklistMedicaoV2:async()=>dados,camposDoItemV2:()=>[],valorRespostaItemV2:()=>null,statusItemChecklistV2:()=> 'concluida'}, console}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/medicaoFinalPdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context)
;(async()=>{
 const doc=await context.exports.gerarPdfMedicaoFinal({id:'medicao',cliente_nome:'Teste de regressão'},[item],false)
 assert.ok(doc.getNumberOfPages()>1,'Checklist longo precisa paginar')
 const content=doc.output()
 assert.ok(content.includes('VERIFICAR / ADICIONAR CANTONEIRA'))
 assert.ok(content.includes('Texto de campo'))
 assert.ok(content.includes('CONFIRMA'))
 console.log('PASS: PDF com checklist longo paginado, alerta de 15 mm e confirmação final.')
})().catch(e=>{console.error(e);process.exitCode=1})
