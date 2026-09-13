const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const source = fs.readFileSync('app/api/integracoes/wvetro/produtos/sincronizar/route.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

async function request({ token = 'valid', role = 'master', metadata = {}, authError = null, dbError = null } = {}) {
  let queries = 0
  const exports = {}
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: metadata } }, error: authError }) },
    from(table) {
      queries++
      assert.equal(table, 'usuarios')
      return { select: () => ({ eq: (column, id) => {
        assert.equal(column, 'id')
        assert.equal(id, 'user-1')
        return { maybeSingle: async () => ({ data: role ? { id, role } : null, error: dbError }) }
      } }) }
    },
  }
  vm.runInNewContext(compiled, {
    exports,
    process: { env: { CRON_SECRET: 'cron-secret' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }
      if (name === '@/lib/supabaseAdmin') return { supabaseAdmin: admin }
      // 503 proves authorization passed, without making external calls or changing data.
      if (name === '@/lib/wvetroApi') return { statusConfiguracaoWVetro: () => ({ pronto: false }) }
      return {}
    },
  })
  const result = await exports.POST({ headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}) })
  return { ...result, queries }
}

test('Master do cadastro passa mesmo sem role nos metadados', async () => {
  const result = await request()
  assert.equal(result.status, 503)
  assert.equal(result.queries, 1)
})
test('Metadados editáveis não promovem funcionário a Master', async () => {
  assert.equal((await request({ role: 'funcionario', metadata: { role: 'master' } })).status, 403)
})
test('Sem sessão não consulta o cadastro', async () => {
  const result = await request({ token: '' })
  assert.equal(result.status, 403)
  assert.equal(result.queries, 0)
})
test('Token inválido não consulta o cadastro', async () => {
  const result = await request({ authError: new Error('invalid token') })
  assert.equal(result.status, 403)
  assert.equal(result.queries, 0)
})
test('Cadastro ausente ou consulta falha nega acesso', async () => {
  assert.equal((await request({ role: null })).status, 403)
  assert.equal((await request({ dbError: new Error('database unavailable') })).status, 403)
})
test('Segredo cron não contorna a autenticação do usuário', async () => {
  assert.equal((await request({ token: 'cron-secret', authError: new Error('invalid token') })).status, 403)
})
