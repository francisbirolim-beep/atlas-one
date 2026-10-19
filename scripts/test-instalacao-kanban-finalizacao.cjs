const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const mod={exports:{}}
const compiled=ts.transpileModule(fs.readFileSync('lib/instalacaoKanban.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText
new Function('module','exports',compiled)(mod,mod.exports)
const {etapaKanbanInstalacao,validarFinalizacaoInstalacao}=mod.exports

assert.equal(etapaKanbanInstalacao({status:'pendente',quantidade_instalada:0}),'a_instalar')
assert.equal(etapaKanbanInstalacao({status:'em_instalacao',quantidade_instalada:0}),'em_instalacao')
assert.equal(etapaKanbanInstalacao({status:'em_instalacao',quantidade_instalada:1}),'em_instalacao')
assert.equal(etapaKanbanInstalacao({status:'pendencia',pendencia:'Falta arremate'}),'com_pendencia')
assert.equal(etapaKanbanInstalacao({status:'instalado',quantidade:1,quantidade_instalada:1,pendencia:'Falta acabamento'}),'com_pendencia')
assert.equal(etapaKanbanInstalacao({status:'instalado',quantidade:1,quantidade_instalada:1}),'finalizados')
assert.equal(etapaKanbanInstalacao({status:'instalado',quantidade:2,quantidade_instalada:1}),'com_pendencia')
const finalizar=(confirmadoInstalado,resolverPendencia,pendencia='',quantidadePrevista=1)=>
  validarFinalizacaoInstalacao({quantidadePrevista,confirmadoInstalado,resolverPendencia,pendencia})
assert.match(finalizar(false,false),/Confirme/)
assert.match(finalizar(true,false,'Falta vedação'),/pendência/)
assert.equal(finalizar(true,true,'Falta vedação'),null)
assert.equal(finalizar(true,false),null)
assert.match(finalizar(true,false,'',0),/inválida/)

const route=fs.readFileSync('app/api/vendas/instalacao/item/route.ts','utf8')
const tela=fs.readFileSync('components/clientes/VendaInstalacaoDetalhada.tsx','utf8')
assert.match(route,/confirmadoInstalado:body\?\.confirmadoInstalado===true/)
assert.match(route,/resolverPendencia:body\?\.resolverPendencia===true/)
assert.match(route,/patch\.pendencia=null/)
assert.match(route,/status==='instalado'\)\)\{/)
assert.match(tela,/accept="image\/\*" multiple/)
assert.match(tela,/for\(const foto of fotosFinalizacao\)/)
assert.match(tela,/onDrop=/)
assert.match(tela,/onClick=\{\(\)=>abrirAcoes\(x\)\}/)
assert.doesNotMatch(tela,/id=\{'instalar-'/)
assert.doesNotMatch(tela,/>Nivelamento</)
assert.doesNotMatch(tela,/>Vedação</)
console.log('PASS: quatro etapas, finalização manual sem vínculo de obra/OP, pendência resolvida, fotos múltiplas e remoção do bloco inferior.')
