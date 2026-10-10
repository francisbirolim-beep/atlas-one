const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const fonte = fs.readFileSync('app/api/producao/medicoes-finais/sincronizar/route.ts', 'utf8')
const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const idMedicao = '11111111-1111-4111-8111-111111111111'

function preparar(existente) {
  const alteracoes = []
  const consultas = []
  const db = {
    from(tabela) {
      const filtros = []
      const q = {
        select() { return this },
        eq(campo, valor) { filtros.push([campo, valor]); return this },
        in(campo, valores) { filtros.push([campo, valores]); return this },
        ilike() { return this },
        order() { return this },
        limit() { return this },
        maybeSingle() {
          consultas.push({ tabela, filtros })
          if (tabela === 'setor_kanban_itens') return Promise.resolve({ data: existente ? { id: 'card-existente', coluna_id: 'etapa-final', liberado_producao_em: null } : null, error: null })
          throw new Error('maybeSingle inesperado: ' + tabela)
        },
        insert(payload) { alteracoes.push(['insert', tabela, payload]); return Promise.resolve({ error: null }) },
        update(payload) { alteracoes.push(['update', tabela, payload]); return { eq() { return Promise.resolve({ error: null }) } } },
        then(resolve, reject) {
          consultas.push({ tabela, filtros })
          if (tabela === 'setor_kanban_colunas') return Promise.resolve({ data: [ { id: 'etapa-inicial', nome: 'VALIDAR MEDIDA FINAL', ordem: 0 }, { id: 'etapa-final', nome: 'LIBERADO PARA PRODUZIR', ordem: 1 } ], error: null }).then(resolve, reject)
          if (tabela === 'medicoes_finais') return Promise.resolve({ data: [{ id: idMedicao, orcamento_id: 'orcamento', cliente_id: null, cliente_nome: 'Cliente teste', obra_id: null, status_operacional: 'concluido' }], error: null }).then(resolve, reject)
          throw new Error('query inesperada: ' + tabela)
        },
      }
      return q
    },
  }
  const modulo = { exports: {} }
  const deps = {
    'next/server': { NextResponse: { json(body, options) { return { body, status: options?.status || 200 } } } },
    '@/lib/tenantServer': { autenticarTenant: async () => ({ empresa_id: 'empresa', id: 'operador', nome: 'Teste' }) },
    '@/lib/supabaseAdmin': { supabaseAdmin: db },
  }
  vm.runInNewContext(js, { module: modulo, exports: modulo.exports, require: x => deps[x] || {}, console })
  return { post: modulo.exports.POST, alteracoes, consultas }
}

;(async () => {
  const atual = preparar(true)
  const r1 = await atual.post({ json: async () => ({ medicaoId: idMedicao }) })
  assert.equal(r1.status, 200)
  assert.equal(r1.body.ignorados, 1)
  assert.equal(r1.body.atualizados, 0)
  assert.equal(r1.body.criados, 0)
  assert.equal(atual.alteracoes.length, 0, 'Sincronização não deve mover ou sobrescrever um card existente')
  assert.ok(atual.consultas.find(c => c.tabela === 'medicoes_finais')?.filtros.some(([k,v]) => k === 'id' && v === idMedicao), 'Envio individual deve filtrar medição')
  assert.ok(atual.consultas.every(c => c.filtros.some(([k, v]) => k === 'empresa_id' && v === 'empresa')), 'Todas as consultas precisam preservar tenant')

  const novo = preparar(false)
  const r2 = await novo.post({ json: async () => ({ medicaoId: idMedicao }) })
  assert.equal(r2.status, 200)
  assert.equal(r2.body.criados, 1)
  assert.equal(novo.alteracoes.length, 1)
  assert.equal(novo.alteracoes[0][0], 'insert')
  assert.equal(novo.alteracoes[0][2].coluna_id, 'etapa-inicial')

  const invalido = preparar(false)
  const r3 = await invalido.post({ json: async () => ({ medicaoId: 'invalida' }) })
  assert.equal(r3.status, 400)
  assert.equal(invalido.alteracoes.length, 0)
  console.log('PASS: sincronização preserva cards existentes, cadastra novos na entrada, filtra tenant e rejeita IDs inválidos.')
})().catch(e => { console.error(e); process.exitCode = 1 })
