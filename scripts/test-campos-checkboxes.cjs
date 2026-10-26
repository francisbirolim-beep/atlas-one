const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'app/configuracoes/campos/page.tsx'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
})

const example = (id, mostrarEm, obrigatorioEm = []) => ({
  id, chave: id, label: id === 'visivel' ? 'Campo visível' : 'Campo oculto', tipo: 'texto',
  ativo: true, ordem: id === 'visivel' ? 10 : 20, mostrarEm, obrigatorioEm,
})
const state = [[example('visivel', ['cliente']), example('oculto', [])], false, false, true, 'cliente', '', null, false]
let index = 0
let ultimaGravacao = null
const react = {
  useState(initial) {
    const current = index++
    if (!(current in state)) state[current] = initial
    return [state[current], (update) => {
      state[current] = typeof update === 'function' ? update(state[current]) : update
    }]
  },
  useMemo(factory) { return factory() },
  useEffect() {},
}
const element = (type, props) => typeof type === 'function' ? type(props || {}) : ({ type, props: props || {} })
const mod = { exports: {} }
const modules = {
  react, 'react/jsx-runtime': { jsx: element, jsxs: element },
  'lucide-react': Object.fromEntries(['ArrowDown', 'ArrowUp', 'ChevronDown', 'ChevronUp', 'Plus', 'Save', 'Search', 'Settings2', 'Trash2'].map((v) => [v, v])),
  '@/lib/auth': { usuarioAtual: async () => ({ role: 'master' }) },
  '@/lib/camposConfiguraveis': {
    CONTEXTOS_CAMPO: [{ valor: 'cliente', label: 'Cadastro do cliente' }, { valor: 'orcamento', label: 'Orçamento' }],
    TIPOS_CAMPO: [{ valor: 'texto', label: 'Texto' }],
    novaChaveCampo: (label) => label.toLowerCase().replaceAll(' ', '_'),
    listarCamposConfiguraveis: async () => state[0],
    salvarCamposConfiguraveis: async (campos) => { ultimaGravacao = structuredClone(campos); return true },
  },
}
vm.runInNewContext(outputText, {
  module: mod, exports: mod.exports,
  require: (key) => {
    if (!(key in modules)) throw new Error('Import não esperado: ' + key)
    return modules[key]
  },
  window: { alert() {} },
  console,
})
function render() { index = 0; return mod.exports.default() }
function search(node, callback, found = []) {
  if (Array.isArray(node)) { node.forEach((part) => search(part, callback, found)); return found }
  if (!node || typeof node !== 'object') return found
  if (callback(node)) found.push(node)
  search(node.props?.children, callback, found)
  return found
}
function checkbox(trecho) {
  const result = search(render(), (node) => node.type === 'button' &&
    node.props.role === 'checkbox' && node.props['aria-label']?.includes(trecho))
  assert.equal(result.length, 1, 'Checkbox não encontrada: ' + trecho)
  return result[0]
}
function flag(campo, nome, marcado) {
  const c = checkbox(nome + ' ' + campo)
  assert.equal(c.props['aria-checked'], !marcado, 'Antes do clique deve estar no estado oposto')
  c.props.onClick()
  assert.equal(checkbox(nome + ' ' + campo).props['aria-checked'], marcado, 'Apenas o controle escolhido muda')
}
function entry(id) { return state[0].find((c) => c.id === id) }

assert.equal(search(render(), (e) => e.type === 'section' && e.props?.className?.includes('overflow-hidden')).length, 2,
  'Mostrar todos os campos mesmo quando não associados à etapa')
flag('Campo visível', 'Mostrar', false)
assert.deepEqual(Array.from(entry('visivel').mostrarEm), [])
assert.equal(checkbox('Mostrar Campo visível').props['aria-checked'], false, 'Campo desmarcado continua renderizado')
flag('Campo visível', 'Mostrar', true)
assert.deepEqual(Array.from(entry('visivel').mostrarEm), ['cliente'])
flag('Campo visível', 'Obrigatório:', true)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), ['cliente'])
flag('Campo visível', 'Mostrar', false)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), [], 'Remover Mostrar também remove Obrigatório')
// Ativo nunca deve marcar Obrigatório, nem mudar Mostrar.
const mostrarOriginal = [...entry('visivel').mostrarEm]
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), [])
flag('Campo visível', 'Ativo:', false)
assert.equal(entry('visivel').ativo, false)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), [])
assert.deepEqual(Array.from(entry('visivel').mostrarEm), mostrarOriginal)
flag('Campo visível', 'Ativo:', true)
assert.equal(entry('visivel').ativo, true)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), [])
assert.deepEqual(Array.from(entry('visivel').mostrarEm), mostrarOriginal)
// Quando Obrigatório já está marcado, mudar Ativo também não o desmarca.
flag('Campo visível', 'Obrigatório:', true)
flag('Campo visível', 'Ativo:', false)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), ['cliente'])
flag('Campo visível', 'Ativo:', true)
assert.deepEqual(Array.from(entry('visivel').obrigatorioEm), ['cliente'])
flag('Campo visível', 'Obrigatório:', false)
flag('Campo visível', 'Mostrar', false)
flag('Campo oculto', 'Obrigatório:', true)
assert.deepEqual(Array.from(entry('oculto').mostrarEm), ['cliente'], 'Obrigatório força Mostrar')
assert.deepEqual(Array.from(entry('oculto').obrigatorioEm), ['cliente'])
const onlyStep = search(render(), (e) => e.type === 'input' && e.props.type === 'checkbox' && !e.props['aria-label'])
assert.equal(onlyStep.length, 1, 'Controle de filtro da etapa')
onlyStep[0].props.onChange({ target: { checked: true } })
assert.equal(search(render(), (e) => e.type === 'section' && e.props?.className?.includes('overflow-hidden')).length, 1)
search(render(), (e) => e.type === 'input' && e.props.type === 'checkbox' && !e.props['aria-label'])[0].props.onChange({ target: { checked: false } })
assert.equal(checkbox('Mostrar Campo visível').props['aria-checked'], false, 'Campo volta quando exibindo Todos')
async function testSave() {
  const button = search(render(), (e) => e.type === 'button' && Array.isArray(e.props.children) && e.props.children.includes('Salvar alterações'))[0]
  assert.ok(button, 'Botão salvar')
  await button.props.onClick()
  assert.deepEqual(Array.from(ultimaGravacao.find((c) => c.id === 'visivel').mostrarEm), [], 'Persistência contém o flag alterado')
  console.log('PASSOU: Ativo e Obrigatório independentes; Mostrar, filtro e salvamento preservados')
}
testSave().catch((err) => { console.error(err); process.exitCode = 1 })