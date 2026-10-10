const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const fonte = fs.readFileSync('lib/setorKanban.ts', 'utf8')
const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText

async function mover(setorId) {
  const chamadas = []
  const supabase = {
    from(tabela) {
      return {
        select() { return this },
        eq() { return this },
        maybeSingle() {
          if (tabela === 'setor_kanban_colunas') return Promise.resolve({ data: { setor_id: setorId, nome: 'LIBERADO PARA PRODUZIR' } })
          return Promise.resolve({ data: { orcamento_id: 'orcamento-teste' } })
        },
        update(payload) {
          chamadas.push(['update', tabela, payload])
          return { eq() { return Promise.resolve({ error: null }) } }
        },
      }
    },
    async rpc(nome) { chamadas.push(['rpc', nome]); return { error: null } },
  }
  const modulo = { exports: {} }
  const dependencias = {
    './supabase': { supabase },
    './auth': { usuarioAtual: async () => ({ id: 'operador', nome: 'Teste' }) },
    './materialPlanejamento': {},
    './medicaoFinal': {},
    './tipos': {},
  }
  vm.runInNewContext(js, { module: modulo, exports: modulo.exports, require: id => dependencias[id] || {} })
  const ok = await modulo.exports.moverItemSetor('card-teste', 'coluna-destino')
  assert.equal(ok, true)
  return chamadas
}

;(async () => {
  const producao = await mover('producao')
  assert.equal(producao.filter(c => c[0] === 'update').length, 1, 'Produção deve permitir mover cards diretamente')
  assert.equal(producao.filter(c => c[0] === 'rpc').length, 0, 'Produção não pode chamar a RPC de Engenharia')
  const engenharia = await mover('engenharia-projeto')
  assert.equal(engenharia.filter(c => c[0] === 'rpc' && c[1] === 'fn_engenharia_liberar_para_producao').length, 1, 'A validação da Engenharia deve ser preservada')
  console.log('PASS: múltiplos cards na Produção não acionam a RPC de Engenharia; gate técnico preservado.')
})().catch(err => { console.error(err); process.exitCode = 1 })
