const fs=require('node:fs')
const assert=require('node:assert/strict')
const ts=require('typescript')
const summary=fs.readFileSync('components/clientes/VendaMateriaisTipologiasResumo.tsx','utf8')
const modal=fs.readFileSync('components/clientes/VendaMaterialEdicaoRapida.tsx','utf8')
for(const [file,code] of [['resumo',summary],['editor',modal]]){
 const parsed=ts.transpileModule(code,{fileName:file+'.tsx',reportDiagnostics:true,
   compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext}})
 assert.equal((parsed.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'JSX inválido: '+file)
}
assert.match(summary,/master&&<div[^>]*mt-2 flex flex-wrap/,'ações devem ser exclusivas do Master')
for(const acao of ['ajustar','substituir','excluir']){
 assert.match(summary,new RegExp("iniciarAcao\\('"+acao+"',m\\.materialIds\\)"),acao+' acessível na própria linha')
 assert.ok(modal.includes(acao+':')||modal.includes("acao==='"+acao+"'"),acao+' precisa ter rótulo/fluxo específico')
}
assert.match(summary,/registros.length>1\)setEscolha/,'linhas consolidadas exigem seleção de registro')
assert.match(modal,/itemRef:material\.item_ref/,'escrita precisa preservar vínculo com tipologia')
assert.match(modal,/materialId:material\.id/,'escrita deve modificar só um registro')
assert.match(modal,/api\/vendas\/tipologias-materiais/,'usar API auditada existente')
assert.match(modal,/justificativa\.trim\(\)\.length<5/,'justificativa obrigatória')
assert.match(modal,/foto\(p\.foto_url\)/,'imagem do produto na busca de substituição')
assert.match(summary,/await atualizar\(\)/,'recarregar composição após salvar')
console.log('PASS: 12 verificações do editor, permissões, isolamento, busca por imagem e atualização.')
