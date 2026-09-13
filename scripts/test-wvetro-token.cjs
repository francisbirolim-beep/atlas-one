const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync('lib/wvetroApi.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
test('consultas paralelas compartilham login e renovação; 403 persistente não entra em loop', async () => {
  let logins = 0, calls = 0, negar = false
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, URL, AbortSignal,
    process: { env: { WVETRO_LICENSE_ID: 'test', WVETRO_USERNAME: 'test', WVETRO_PASSWORD: 'test' } },
    fetch: async (url, options) => {
      if (String(url).includes('ValidarUsuario')) {
        const n = ++logins
        await new Promise(resolve => setTimeout(resolve, 5))
        return new Response(JSON.stringify({ ValidaUsuario: `opaque-token-${n}` }))
      }
      calls++
      return negar || options.headers.token === 'opaque-token-1'
        ? new Response('invalid token', { status: 403 })
        : new Response('[]')
    },
  })
  await Promise.all([exports.listarLinhasWVetro(), exports.listarCoresWVetro()])
  assert.equal(logins, 2)
  assert.equal(calls, 4)
  await exports.listarLinhasWVetro()
  assert.equal(logins, 2)
  negar = true
  await assert.rejects(exports.listarLinhasWVetro(), /403/)
  assert.equal(logins, 3)
  assert.equal(calls, 7)
})
