const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const src = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts','utf8')
const ini = src.indexOf('  const existentes = new Map<string, any>()')
const fim = src.indexOf('  return { refs, linhas, tipologias, clientes', ini)
assert(ini > 0 && fim > ini, 'Índices de importação localizáveis')
const context = {
  obj: x => x && typeof x === 'object' ? x : {},
  txt: (...v) => v.map(x=>String(x??'').trim()).find(Boolean) || '',
}
const snippet = 'function montar(orcR: any) {\n' + src.slice(ini,fim) + '\nreturn { existentes, vinculados }\n}\nthis.montar = montar;'
vm.runInNewContext(ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context)
const arquivado={id:'importado-366',modo_entrada:'wvetro_api_vinculado',wvetro_fluxo:{numero:'1007',oculto_por_vinculo:true}}
const ativo={id:'outro',modo_entrada:'wvetro_api',wvetro_fluxo:{numero:'1007'}}
let m=context.montar({data:[arquivado]})
assert.equal(m.vinculados.get('1007').id,'importado-366')
assert.equal(m.existentes.has('1007'),false)
for(const registros of [[arquivado,ativo],[ativo,arquivado]]){
 m=context.montar({data:registros})
 assert.equal(m.vinculados.get('1007').id,'importado-366','Vinculado é reconhecido em qualquer ordem')
 assert.equal(m.existentes.get('1007').id,'outro','Índice ativo não é alterado')
}
const inicioImport = src.indexOf('for (const entrada of registros)')
const guarda = src.indexOf('const importadoVinculado = ctx.vinculados.get(numeroW)',inicioImport)
const resolucao = src.indexOf('const clienteResolvido =', inicioImport)
assert(inicioImport > 0 && guarda > inicioImport && resolucao > guarda, 'Registros já vinculados são ignorados antes da atualização do cliente')
assert.match(src.slice(guarda,resolucao),/modo_entrada === 'wvetro_api_vinculado'[\s\S]*?semAlteracao \+= 1[\s\S]*?continue/)
console.log('PASS: W.Vetro vinculado não reaparece após sincronização nem altera orçamento/venda correta')
