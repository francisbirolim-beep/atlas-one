/**
 * Regressão rápida da personalização da Home.
 * Execução: node scripts/test-home-atalhos.cjs
 * Não precisa de credenciais, banco nem deploy.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const raiz = path.resolve(__dirname, '..')
const arquivos = [
  'lib/homeAtalhos.ts',
  'lib/homeUsuario.ts',
  'components/system/HomeAtalhosPersonalizados.tsx',
  'components/system/HomeDashboard.tsx',
]

for (const arquivo of arquivos) {
  const fonte = fs.readFileSync(path.join(raiz, arquivo), 'utf8')
  const tipo = arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const arvore = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, tipo)
  const resultado = ts.transpileModule(fonte, {
    fileName: arquivo, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const erros = [...arvore.parseDiagnostics, ...(resultado.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)]
  assert.equal(erros.length, 0, 'Erro de sintaxe em ' + arquivo + ': ' + erros.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; '))
}

const fonte = fs.readFileSync(path.join(raiz, arquivos[0]), 'utf8')
const codigo = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const modulo = { exports: {} }
const icones = new Proxy({}, { get: (_obj, nome) => function Icon() { return nome } })
const importar = (nome) => {
  if (nome === 'lucide-react') return icones
  if (nome === './guias') return { GUIAS: [
    { href: '/', label: 'Início', grupo: 'Geral', icon: () => null },
    { href: '/prospeccao', label: 'Prospecção', grupo: 'Comercial', icon: () => null },
    { href: '/cadastro', label: 'Cadastros', grupo: 'Cadastros', icon: () => null, masterOnly: true },
  ] }
  throw new Error('Importação não esperada: ' + nome)
}
vm.runInNewContext(codigo, { module: modulo, exports: modulo.exports, require: importar, Set, Array, console })
const atalhos = modulo.exports

assert.deepEqual(Array.from(atalhos.HOME_ATALHOS_PADRAO), [
  '/orcamento-rapido', '/previews/consulta-preco', '/previews/orcamento',
  '/previews/venda', '/clientes/identificar',
])
assert.equal(atalhos.HOME_ATALHOS.length, 7, 'Não duplicar a Home nem os cinco atalhos atuais')
assert.equal(atalhos.normalizarAtalhosInicio(undefined), undefined)
assert.deepEqual(Array.from(atalhos.normalizarAtalhosInicio([])), [], 'Remover todos é uma escolha legítima')
assert.deepEqual(
  Array.from(atalhos.normalizarAtalhosInicio(['/prospeccao', '/prospeccao', '/rota-falsa', '/previews/venda'])),
  ['/prospeccao', '/previews/venda'],
  'Remover rotas inexistentes e duplicadas mantendo ordem',
)
assert.deepEqual(Array.from(atalhos.atalhosInicioEfetivos(null)), Array.from(atalhos.HOME_ATALHOS_PADRAO))

const config = fs.readFileSync(path.join(raiz, 'lib/homeUsuario.ts'), 'utf8')
assert(config.includes("onConflict: 'empresa_id,chave'"), 'Escrita deve manter escopo da empresa')
assert(config.includes('...atual,'), 'Não sobrescrever dashboard, módulos e permissões ao salvar favoritos')
assert(config.includes('if (error) return false'), 'Leitura falha não pode apagar configurações')
console.log('Home: sintaxe e regras de atalhos validadas.')
