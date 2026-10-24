const assert = require('node:assert/strict')
async function testar() {
  const { avaliarEstadoAutomacaoMedicao: status } = await import('../lib/medicaoAutomacaoEstado.ts')
  const casos = [
    ['desativada', { ativa: false }, false, false],
    ['duas tarefas novas', { ativa: true, criadas: 2, existentes: 0, total: 2 }, true, false],
    ['reenvio idempotente', { ativa: true, criadas: 0, existentes: 2, total: 2 }, true, false],
    ['erro mesmo com card salvo', { ativa: true, erro: 'pendente' }, true, true],
    ['sem destinatários', { ativa: true, criadas: 0, existentes: 0, total: 0 }, true, true],
    ['atribuição incompleta', { ativa: true, criadas: 1, existentes: 0, total: 2 }, true, true],
    ['resposta inválida', { ativa: true }, true, true],
  ]
  for (const [nome, entrada, ativa, pendente] of casos) {
    const r = status(entrada)
    assert.equal(r.ativa, ativa, nome)
    assert.equal(r.pendente, pendente, nome)
    assert.match(r.mensagem, /Produção/, nome)
    console.log('PASS: ' + nome)
  }
  const fs = require('node:fs')
  const helper = fs.readFileSync('lib/medicaoFinalAutomacaoServer.ts', 'utf8')
  const ui = fs.readFileSync('components/system/MedicaoFinalFieldSummary.tsx', 'utf8')
  const api = fs.readFileSync('app/api/producao/medicoes-finais/sincronizar/route.ts', 'utf8')
  const core = fs.readFileSync('lib/medicaoFinalV2.ts', 'utf8')
  assert.match(helper, /total:ids.length/)
  assert.match(helper, /aguardando_conferencia/)
  assert.match(api, /executarAutomacaoMedidaFinal/)
  assert.match(core, /avaliarEstadoAutomacaoMedicao/)
  assert.match(ui, /resultado.automacaoPendente/)
  console.log('PASS: API, reenvio e alerta da interface conectados')
}
testar().catch(e => { console.error(e); process.exitCode=1 })
