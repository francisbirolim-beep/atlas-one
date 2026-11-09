// Regressões isoladas do cálculo de lembretes, sem conexão com produção.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const fonte = fs.readFileSync(path.join(__dirname, '../lib/tarefaLembretes.ts'), 'utf8')
const { outputText } = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const carregado = { exports: {} }
// A importação do cliente de banco é substituída por um stub: teste 100% offline.
new Function('module', 'exports', 'require', outputText)(
  carregado, carregado.exports,
  modulo => {
    if (modulo === './supabase') return { supabase: {} }
    throw new Error('Importação inesperada: ' + modulo)
  },
)

const { lembreteTarefaVencido, INTERVALO_REAVISO_TAREFA_MS } = carregado.exports
const agora = Date.parse('2026-11-09T14:00:00.000Z')
assert.equal(INTERVALO_REAVISO_TAREFA_MS, 15 * 60 * 1000)
const estado = (ultimo, adiada = null) => ({ tarefa_id: 'teste', usuario_id: 'teste', ultimo_aviso_em: ultimo, adiada_ate: adiada })

assert.equal(lembreteTarefaVencido(undefined, agora), true, 'Nova tarefa deve aparecer')
assert.equal(lembreteTarefaVencido(estado(null), agora), true, 'Tarefa sem aviso deve aparecer')
assert.equal(lembreteTarefaVencido(estado('2026-11-09T13:59:00.000Z'), agora), false, 'Evitar repetição imediata')
assert.equal(lembreteTarefaVencido(estado('2026-11-09T13:44:00.000Z'), agora), true, 'Repetir após 15 minutos')
assert.equal(lembreteTarefaVencido(estado('2026-11-09T13:00:00.000Z', '2026-11-09T15:00:00.000Z'), agora), false, 'Respeitar adiamento')
assert.equal(lembreteTarefaVencido(estado('2026-11-09T13:00:00.000Z', '2026-11-09T13:59:00.000Z'), agora), true, 'Voltar após o adiamento')
assert.equal(lembreteTarefaVencido(estado('2026-11-09T13:50:00.000Z', '2026-11-09T13:59:00.000Z'), agora), false, 'Respeitar janela mínima após aviso')

console.log('OK: repetição, pausa e retomada de lembretes de tarefas.')
