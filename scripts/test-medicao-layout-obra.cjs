/** Testes isolados da API A4 por obra: sem banco real, sem rede e sem alterar medições. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')

const U = {
  obraA: '11111111-1111-4111-8111-111111111111',
  obraB: '22222222-2222-4222-8222-222222222222',
  obraOutroTenant: '33333333-3333-4333-8333-333333333333',
  medicao: '44444444-4444-4444-8444-444444444444',
  medicaoAntiga: '55555555-5555-4555-8555-555555555555',
  medicaoOutroTenant: '66666666-6666-4666-8666-666666666666',
  orcamento: '77777777-7777-4777-8777-777777777777',
}
const PADRAO = {
  itensPorPagina: 3, exibirCroqui: true, larguraCroquiMm: 58,
  fonteMedidasPt: 6, alturaFotoMm: 25, fotosPorLinha: 4, fonteChecklistPt: 6.2,
}
const T = {
  obras: [
    { id: U.obraA, empresa_id: 'EMPRESA-A' },
    { id: U.obraB, empresa_id: 'EMPRESA-A' },
    { id: U.obraOutroTenant, empresa_id: 'EMPRESA-B' },
  ],
  medicoes_finais: [
    { id: U.medicao, empresa_id: 'EMPRESA-A', obra_id: U.obraA, orcamento_id: U.orcamento },
    { id: U.medicaoAntiga, empresa_id: 'EMPRESA-A', obra_id: null, orcamento_id: U.orcamento },
    { id: U.medicaoOutroTenant, empresa_id: 'EMPRESA-B', obra_id: U.obraOutroTenant, orcamento_id: U.orcamento },
  ],
  vendas_obras: [{ empresa_id: 'EMPRESA-A', orcamento_id: U.orcamento, obra_id: U.obraA, excluida_em: null }],
  orcamentos: [{ id: U.orcamento, empresa_id: 'EMPRESA-A', obra_id: U.obraA }],
  medicao_final_layouts: [{ empresa_id: 'EMPRESA-A', configuracao: PADRAO, updated_at: '2026-11-09T00:00:00Z' }],
  medicao_final_layouts_obras: [],
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.payload = null }
  select() { return this }
  eq(k, v) { this.filters.push([k, '=', v]); return this }
  is(k, v) { this.filters.push([k, 'is', v]); return this }
  delete() { this.op = 'delete'; return this }
  upsert(payload) { this.op = 'upsert'; this.payload = payload; return this }
  matches(row) { return this.filters.every(([k, , v]) => row[k] === v) }
  maybeSingle() {
    const values = T[this.table].filter(row => this.matches(row))
    assert.ok(values.length <= 1, 'o mock deve produzir no máximo um registro')
    return Promise.resolve({ data: values[0] || null, error: null })
  }
  then(resolve, reject) {
    if (this.op === 'delete') T[this.table] = T[this.table].filter(row => !this.matches(row))
    if (this.op === 'upsert') {
      const keys = this.table === 'medicao_final_layouts_obras' ? ['empresa_id', 'obra_id'] : ['empresa_id']
      const index = T[this.table].findIndex(row => keys.every(k => row[k] === this.payload[k]))
      if (index >= 0) T[this.table][index] = { ...this.payload }
      else T[this.table].push({ ...this.payload })
    }
    return Promise.resolve({ error: null }).then(resolve, reject)
  }
}
const supabaseAdmin = { from: table => { assert.ok(T[table], 'Tabela desconhecida: ' + table); return new Query(table) } }
const usuarios = {
  master: { id: 'USUARIO-MASTER', role: 'master', empresa_id: 'EMPRESA-A' },
  colaborador: { id: 'USUARIO-COLAB', role: 'funcionario', empresa_id: 'EMPRESA-A' },
  outro: { id: 'USUARIO-OUTRO', role: 'master', empresa_id: 'EMPRESA-B' },
}
const originalTs = require.extensions['.ts']
const originalLoad = Module._load
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  mod._compile(output, filename)
}
Module._load = function (name, parent, ...rest) {
  if (parent?.filename.endsWith('/app/api/medicao-final/layout/route.ts')) {
    if (name === 'next/server') return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } }
    if (name === '@/lib/tenantServer') return { autenticarTenant: async req => usuarios[req.headers.get('authorization')] || null }
    if (name === '@/lib/supabaseAdmin') return { supabaseAdmin }
    if (name === '@/lib/medicaoFinalLayoutA4Schema') return require('../lib/medicaoFinalLayoutA4Schema.ts')
  }
  return originalLoad.apply(this, [name, parent, ...rest])
}
const route = require('../app/api/medicao-final/layout/route.ts')
Module._load = originalLoad

const req = (token, query = '', body = undefined) => ({
  headers: { get: name => name === 'authorization' ? token : '' },
  nextUrl: new URL('https://atlas.invalid/api/medicao-final/layout' + query),
  json: async () => body,
})
const config = { ...PADRAO, itensPorPagina: 2, exibirCroqui: false, alturaFotoMm: 48, fotosPorLinha: 3 }
async function executar() {
  assert.equal((await route.GET(req(''))).status, 401)
  assert.equal((await route.PUT(req('', '', { layout: config }))).status, 401)
  assert.equal((await route.DELETE(req('', `?obraId=${U.obraA}`))).status, 401)
  assert.equal((await route.PUT(req('colaborador', '', { layout: config }))).status, 403)
  assert.equal((await route.DELETE(req('colaborador', `?obraId=${U.obraA}`))).status, 403)
  assert.equal((await route.GET(req('master', '?obraId=invalid'))).status, 400)
  assert.equal((await route.GET(req('master', `?obraId=${U.obraOutroTenant}`))).status, 404)
  assert.equal((await route.PUT(req('master', '', { escopo: 'obra', obraId: U.obraOutroTenant, layout: config }))).status, 404)
  assert.equal((await route.GET(req('master', `?medicaoId=${U.medicaoOutroTenant}`))).status, 404)
  assert.equal((await route.PUT(req('master', '', { escopo: 'obra', layout: config }))).status, 400)
  assert.equal((await route.PUT(req('master', '', { escopo: 'geral', layout: [] }))).status, 400)

  const inicial = await route.GET(req('colaborador', `?obraId=${U.obraA}`))
  assert.equal(inicial.status, 200)
  assert.equal(inicial.body.origem, 'geral')
  assert.equal(inicial.body.layout.itensPorPagina, 3)

  const gravarObra = await route.PUT(req('master', '', { escopo: 'obra', obraId: U.obraA, layout: config }))
  assert.equal(gravarObra.status, 200)
  assert.equal(gravarObra.body.escopo, 'obra')
  assert.equal(T.medicao_final_layouts[0].configuracao.itensPorPagina, 3, 'o padrão geral não foi alterado')
  assert.equal(T.medicao_final_layouts_obras.length, 1)
  const porObra = await route.GET(req('colaborador', `?obraId=${U.obraA}`))
  assert.equal(porObra.body.origem, 'obra')
  assert.equal(porObra.body.layout.alturaFotoMm, 48)
  const outraObra = await route.GET(req('colaborador', `?obraId=${U.obraB}`))
  assert.equal(outraObra.body.origem, 'geral')
  assert.equal(outraObra.body.layout.alturaFotoMm, 25)
  const pelaMedicao = await route.GET(req('colaborador', `?medicaoId=${U.medicao}`))
  assert.equal(pelaMedicao.body.origem, 'obra')
  assert.equal(pelaMedicao.body.obraId, U.obraA)
  const historica = await route.GET(req('colaborador', `?medicaoId=${U.medicaoAntiga}`))
  assert.equal(historica.body.origem, 'obra', 'medição antiga sem obra_id herda da venda')
  assert.equal((await route.GET(req('master', `?obraId=${U.obraB}&medicaoId=${U.medicao}`))).status, 403, 'impede cruzamento de obra na medição')

  const geralNovo = await route.PUT(req('master', '', { escopo: 'geral', layout: { ...config, alturaFotoMm: 52 } }))
  assert.equal(geralNovo.status, 200)
  assert.equal((await route.GET(req('colaborador', `?obraId=${U.obraA}`))).body.layout.alturaFotoMm, 48, 'override deve continuar')
  assert.equal((await route.GET(req('colaborador', `?obraId=${U.obraB}`))).body.layout.alturaFotoMm, 52, 'demais obras herdam o geral')

  const rem = await route.DELETE(req('master', `?obraId=${U.obraA}`))
  assert.equal(rem.status, 200)
  assert.equal(T.medicao_final_layouts_obras.length, 0)
  const restaurado = await route.GET(req('colaborador', `?obraId=${U.obraA}`))
  assert.equal(restaurado.body.origem, 'geral')
  assert.equal(restaurado.body.layout.alturaFotoMm, 52)
  console.log('PASS: tela da obra, herança de padrão, edição exclusiva, edição geral, restauração, legado, tenant e Master.')
}
executar().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => { require.extensions['.ts'] = originalTs })
