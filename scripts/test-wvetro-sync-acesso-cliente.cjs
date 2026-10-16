const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const codigo = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts', 'utf8')
const compilado = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
let usuario = { id: 'u-1', role: 'funcionario', empresa_id: 'empresa-1', nome: 'Funcionaria' }
let permitido = true
let clienteExiste = true
let erroPermissao = false
const consultas = []
const validId = '11111111-1111-4111-8111-111111111111'
const registros = [{ id: 'orc-1', numero: 123, cliente_id: validId, wvetro_fluxo: { numero: '456' }, itens: [], valor_estimado: 100 }]

function query(tabela) {
  const filtros = []
  const q = {
    filtros,
    select() { return q },
    eq(k, v) { filtros.push([k, v]); return q },
    contains(k, v) { filtros.push([k, v]); return q },
    neq(k, v) { filtros.push([k, v]); return q },
    order() { return q },
    limit() { return q },
    maybeSingle: async () => ({ data: clienteExiste ? { id: validId } : null, error: null }),
    then(ok, fail) { return Promise.resolve({ data: registros, error: null }).then(ok, fail) },
  }
  consultas.push({ tabela, filtros })
  return q
}
const imports = {
  'crypto': require('node:crypto'),
  'next/server': { NextResponse: { json: (data, opts={}) => ({ data, status: opts.status || 200 }) } },
  '@/lib/wvetroAcessoServer': {
    autenticarUsuarioWVetro: async () => usuario,
    autenticarMasterWVetro: async () => usuario?.role === 'master' ? usuario : null,
  },
  '@/lib/wvetroSchedulerServer': { autenticarSchedulerWVetro: async () => null },
  '@/lib/acessoUsuarioServer': { usuarioPodeAcaoServer: async (params) => {
    assert.equal(params.setorId, 'fazer-orcamento-msanfyvj')
    assert.equal(params.acaoId, 'comercial.orcamento.editar')
    assert.equal(params.minimo, 'edicao')
    assert.equal(params.empresaId, 'empresa-1')
    if (erroPermissao) throw new Error('DB indisponivel')
    return permitido
  } },
  '@/lib/supabaseAdmin': { supabaseAdmin: { from: query } },
}
const modulo = { exports: {} }
vm.runInNewContext(compilado, {
  exports: modulo.exports,
  module: modulo,
  require: name => name in imports ? imports[name] : {},
  console, process,
})
const route = modulo.exports
const req = (search='') => ({
  nextUrl: new URL('https://atlasonesystem.com/api/integracoes/wvetro/orcamentos/sincronizar' + search),
  headers: { get: () => '' },
})

;(async () => {
  // Funcionária com edição: consulta APENAS orçamentos do cliente selecionado.
  let res = await route.GET(req('?clienteId=' + validId))
  assert.equal(res.status, 200)
  assert.equal(res.data.orcamentos[0].numeroWvetro, '456')
  assert.deepEqual(consultas.map(q => q.tabela), ['clientes','orcamentos'])
  assert.ok(consultas[0].filtros.some(x => x[0] === 'empresa_id' && x[1] === 'empresa-1'))
  assert.ok(consultas[1].filtros.some(x => x[0] === 'empresa_id' && x[1] === 'empresa-1'))
  assert.ok(consultas[1].filtros.some(x => x[0] === 'cliente_id' && x[1] === validId))

  consultas.length = 0
  res = await route.GET(req())
  assert.equal(res.status, 403, 'Funcionaria sem filtro nao pode listar todos')
  assert.equal(consultas.length, 0)

  res = await route.GET(req('?clienteId=invalido'))
  assert.equal(res.status, 400)

  permitido = false
  consultas.length = 0
  res = await route.GET(req('?clienteId=' + validId))
  assert.equal(res.status, 403, 'Permissao somente consulta nao pode listar para sincronizar')
  assert.equal(consultas.length, 0)

  permitido = true
  clienteExiste = false
  consultas.length = 0
  res = await route.GET(req('?clienteId=' + validId))
  assert.equal(res.status, 404)
  assert.deepEqual(consultas.map(q => q.tabela), ['clientes'], 'Sem acesso ao cliente, nao consulta orcamentos')

  clienteExiste = true
  erroPermissao = true
  consultas.length = 0
  res = await route.GET(req('?clienteId=' + validId))
  assert.equal(res.status, 503, 'Falha de permissao deve fechar o acesso')
  assert.equal(consultas.length, 0)
  erroPermissao = false

  usuario = null
  res = await route.GET(req('?clienteId=' + validId))
  assert.equal(res.status, 401)

  usuario = { id: 'master-1', role: 'master', empresa_id: 'empresa-1' }
  consultas.length = 0
  res = await route.GET(req())
  assert.equal(res.status, 200, 'Master conserva listagem global')
  assert.deepEqual(consultas.map(q=>q.tabela), ['orcamentos'])

  assert.match(codigo, /export async function POST\(req: NextRequest\) \{ return sincronizar\(req\) \}/,
    'POST geral conserva autenticacao de Master')
  assert.match(codigo, /const usuarioCron = await autenticarSchedulerWVetro\(req\)/,
    'Scheduler existente conservado')
  console.log('PASS 8 cenarios: Daiane por cliente, bloqueio global, ID invalido, consulta, outro cliente, falha permissao, anonimo, Master, POST e cron preservados')
})().catch(e => { console.error(e); process.exitCode = 1 })