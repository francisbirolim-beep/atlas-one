const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const path = require('node:path')
function carregar(arquivo, dependencias = {}) {
  const filename = path.resolve(__dirname, '..', arquivo)
  const mod = new Module(filename, module)
  mod.paths = module.paths
  mod.require = nome => dependencias[nome] || require(nome)
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
  return mod.exports
}
const dominio = carregar('lib/configuradorSobMedida.ts')
let role = 'master', erroBanco = false, persistido = null, gravacoes = 0
const consultas = []
const admin = {
  auth: { getUser: async token => ({ data: { user: token === 'sessao-teste' ? { id: 'usuario-teste' } : null } }) },
  from: tabela => {
    const filtros = []
    const obter = () => {
      consultas.push({ tabela, filtros })
      if (tabela === 'usuarios') return { data: { id: 'usuario-teste', role, empresa_id: 'empresa-teste' } }
      if (erroBanco) return { data: null, error: { message: 'falha controlada' } }
      if (tabela === 'linhas_tecnicas') return { data: [{ id: 'linha-teste', nome: 'Linha teste' }] }
      return { data: persistido }
    }
    const q = { select: () => q, eq: (...f) => { filtros.push(f); return q }, order: () => q, maybeSingle: async () => obter(),
      then: (resolve, reject) => Promise.resolve(obter()).then(resolve, reject),
      upsert: async valor => { gravacoes++; persistido = valor; return { error: erroBanco ? {} : null } },
    }
    return q
  },
}
const rota = carregar('app/api/orcamento/configurador/route.ts', { '@/lib/supabaseAdmin': { supabaseAdmin: admin }, '@/lib/configuradorSobMedida': dominio })
const req = (method = 'GET', token = 'sessao-teste', body) => new Request('http://localhost/api/orcamento/configurador', { method, headers: { authorization: `Bearer ${token}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
;(async () => {
  assert.equal((await rota.GET(req('GET', 'invalida'))).status, 401)
  console.log('OK leitura exige sessão verificada')
  const inicial = await rota.GET(req())
  assert.equal(inicial.status, 200); assert.deepEqual((await inicial.json()).cadastro, dominio.CADASTRO_INICIAL)
  assert(consultas.some(q => q.tabela === 'configuracoes_gerais' && q.filtros.some(f => f[0] === 'empresa_id' && f[1] === 'empresa-teste')))
  console.log('OK cadastro inicial e leitura restrita à empresa')
  role = 'funcionario'
  assert.equal((await rota.PUT(req('PUT', 'sessao-teste', dominio.CADASTRO_INICIAL))).status, 403)
  assert.equal(gravacoes, 0)
  console.log('OK funcionário não grava regras')
  role = 'master'
  assert.equal((await rota.PUT(req('PUT', 'sessao-teste', {}))).status, 400)
  assert.equal(gravacoes, 0)
  console.log('OK cadastro inválido não chega à gravação')
  const salvo = await rota.PUT(req('PUT', 'sessao-teste', dominio.CADASTRO_INICIAL))
  assert.equal(salvo.status, 200); assert.equal(persistido.empresa_id, 'empresa-teste')
  assert.equal(persistido.chave, `${dominio.CHAVE_CONFIGURADOR}:empresa-teste`)
  assert.deepEqual((await (await rota.GET(req())).json()).cadastro, dominio.CADASTRO_INICIAL)
  console.log('OK gravação e releitura preservam cadastro e empresa')
  const regra = { id: 'r', nome: 'Teste', evidencia: 'Fixture', ativa: true, nivel: 'Obrigatória', quando: [], acao: 'bloquear_linha', alvo: 'inexistente', valor: '' }
  assert.equal((await rota.PUT(req('PUT', 'sessao-teste', { ...dominio.CADASTRO_INICIAL, regras: [regra] }))).status, 400)
  assert.equal(gravacoes, 1)
  console.log('OK linha inexistente rejeitada')
  erroBanco = true
  assert.equal((await rota.GET(req())).status, 500)
  console.log('OK erro de banco não usa fallback permissivo')
  erroBanco = false; persistido = { valor: '{corrompido' }
  assert.equal((await rota.GET(req())).status, 500)
  console.log('OK cadastro corrompido bloqueia leitura')
  console.log('8 testes de contrato da API aprovados (banco simulado).')
})().catch(e => { console.error(e); process.exitCode = 1 })
