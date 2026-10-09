const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function load(file, requireMock, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const context = { exports: {}, require: requireMock, ...globals }
  vm.runInNewContext(compiled, context)
  return context.exports
}
const { medicaoIdDaRota } = load('lib/medicaoRota.ts')
const clientId = '23a0ab04-5736-454c-8b74-8c04f569e467'
const measurementId = '9ae953a7-df8e-4e1c-a87d-f10d5d0cd834'
assert.equal(medicaoIdDaRota(`/producao/medicao-final/cliente/${clientId}`), null)
assert.equal(medicaoIdDaRota('/producao/medicao-final/cliente'), null)
assert.equal(medicaoIdDaRota('/producao/medicao-final'), null)
assert.equal(medicaoIdDaRota(`/producao/medicao-final/${measurementId}`), measurementId)
assert.equal(medicaoIdDaRota(`/producao/medicao-final/${measurementId}/`), measurementId)
assert.equal(medicaoIdDaRota(`/producao/medicao-final/${measurementId}/extra`), null)
async function scenario({ data, error, online = true, storageFails = false, cached = null, reject = false }) {
  const navigations = [], states = [], filters = []
  let effect
  function resultFor(table) {
    if (reject) throw Error('network')
    if (error) return { data: null, error }
    if (table === 'clientes') return { data: data === null ? null : { id: clientId, nome: 'Cliente teste' }, error: data === null ? { message: 'Cliente não encontrado.' } : null }
    if (table === 'medicoes_finais') return { data: data ? [data] : [], error: null }
    return { data: [], error: null }
  }
  function queryFor(table) {
    const query = {
      select: () => query,
      eq: (...args) => { filters.push([table, ...args]); return query },
      or: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => resultFor(table),
      then: (resolve, rejectPromise) => Promise.resolve().then(() => resultFor(table)).then(resolve, rejectPromise),
    }
    return query
  }
  const page = load('app/producao/medicao-final/cliente/[clienteId]/page.tsx', name => {
    if (name === 'react') return {
      useState: v => [v, value => states.push(value)],
      useEffect: fn => { effect = fn },
      useMemo: fn => fn(),
    }
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null }
    if (name === 'next/link') return { __esModule: true, default: 'Link' }
    if (name === 'next/navigation') return { useParams: () => ({clienteId: clientId}), useRouter: () => ({ replace: p => navigations.push(p) }) }
    if (name === 'lucide-react') return new Proxy({}, { get: (_, prop) => prop })
    if (name === '@/lib/supabase') return { supabase: { from: table => queryFor(table) } }
    if (name === '@/lib/medicaoFinal') return {
      criarMedicaoDoOrcamento: async () => null,
      criarMedicaoManualCliente: async () => null,
      verificarFluxoVendaOrcamento: async () => ({ ok: true }),
    }
    if (name === '@/lib/auth') return { tokenAtual: async () => '', usuarioAtual: async () => null }
    throw Error(name)
  }, { navigator: { onLine: online }, localStorage: { setItem: () => { if (storageFails) throw Error('storage') }, getItem: () => cached } })
  page.default(); effect()
  await new Promise(resolve => setImmediate(resolve))
  return {navigations, states, filters}
}
;(async () => {
  for (const storageFails of [false, true]) {
    const r = await scenario({ data: {id: measurementId}, storageFails })
    assert.deepEqual(r.navigations, [])
    assert.ok(r.filters.some(f => f[0] === 'medicoes_finais' && f[1] === 'cliente_id' && f[2] === clientId))
  }
  for (const input of [{error: {message: 'denied'}}, {reject: true}]) {
    const r = await scenario(input)
    assert.equal(r.navigations.length, 0)
    assert.ok(r.states.some(x => typeof x === 'string' && x.length > 0))
  }
  const empty = await scenario({data: null})
  assert.equal(empty.navigations.length, 0)
  const offline = await scenario({online: false, cached: measurementId})
  assert.deepEqual(offline.navigations, [`/producao/medicao-final/${measurementId}`])
  console.log('PASS: client route isolated, canonical measurement ID, query errors, empty result, blocked storage and offline cache.')
})().catch(e => { console.error(e); process.exitCode = 1 })

// Exercise AppShell itself: client resolver must mount, while detail panels
// must receive only the canonical measurement ID.
function shell(pathname) {
  const jsx = (type, props) => ({type, props})
  return load('components/system/AppShell.tsx', name => {
    if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx}
    if (name === 'next/navigation') return {usePathname: () => pathname}
    if (name === '@/lib/medicaoRota') return {medicaoIdDaRota}
    return {default: name}
  }).default({children: 'CLIENT_RESOLVER'})
}
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (!node || typeof node !== 'object') return [node]
  return [node, ...flatten(node.props?.children)]
}
const clientTree = flatten(shell(`/producao/medicao-final/cliente/${clientId}`))
assert.ok(clientTree.includes('CLIENT_RESOLVER'))
assert.equal(clientTree.filter(n => n?.props?.medicaoId).length, 0)
const detailTree = flatten(shell(`/producao/medicao-final/${measurementId}`))
const panels = detailTree.filter(n => n?.props?.medicaoId)
assert.equal(panels.length, 5)
assert.ok(panels.every(n => n.props.medicaoId === measurementId))
console.log('PASS: AppShell mounts client resolver and passes real measurement ID to all five panels.')
