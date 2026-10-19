// Regressão isolada, sem acesso ao banco ou atualização de cadastros.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function lerModulo(path){
  const mod={exports:{}}
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
  }).outputText
  vm.runInNewContext(js,{module:mod,exports:mod.exports})
  return mod.exports
}
const {podeAtualizarCandidatoCatalogo}=lerModulo('lib/ai/catalogoReanalise.ts')
const base={status:'pendente',validado_em:null,dados:{codigo:'F42-014'}}
assert.equal(podeAtualizarCandidatoCatalogo(base),true)
for(const status of ['corrigido','aprovado','aplicado','rejeitado'])
  assert.equal(podeAtualizarCandidatoCatalogo({...base,status}),false,status)
assert.equal(podeAtualizarCandidatoCatalogo({...base,validado_em:'2026-10-18T10:00:00Z'}),false)
assert.equal(podeAtualizarCandidatoCatalogo({...base,dados:{...base.dados,revisado_manualmente:true}}),false)
assert.equal(podeAtualizarCandidatoCatalogo({...base,dados:{...base.dados,arquivado_em:'2026-10-18'}}),false)
// Não executar o endpoint real: exige sessão, permissões e poderia gravar no banco.
const route=fs.readFileSync('app/api/ia/central-aprendizado/route.ts','utf8')
const inicio=route.indexOf('async function remapearCatalogoExistente(')
const fim=route.indexOf('\nasync function analisar(',inicio)
const trecho=route.slice(inicio,fim)
assert.ok(inicio>=0&&fim>inicio)
assert.match(trecho,/if\(!podeAtualizarCandidatoCatalogo\(c\)\)return/)
assert.match(trecho,/\.eq\('updated_at',c\.updated_at\)\.select\('id'\)\.maybeSingle\(\)/)
assert.match(trecho,/if\(gravado&&pagina\)mapeados\+\+/)
const ui=fs.readFileSync('app/atlas-ia/aprendizado/page.tsx','utf8')
assert.match(ui,/const semImagem=produtos\.filter\(c=>!imagemProdutoCandidato\(c\)\)/)
assert.match(ui,/filtro==='sem_imagem'/)
console.log('PASS: revisão manual preservada, remapeamento concorrente protegido e filtro de imagens presente.')
