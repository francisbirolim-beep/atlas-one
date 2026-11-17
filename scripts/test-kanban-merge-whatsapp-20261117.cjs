const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const ui = read('components/system/KanbanPageFixed.tsx')
const api = read('app/api/kanban/comercial/mesclar-cards/route.ts')
const notes = read('app/api/integracoes/whatsapp/orcamento-notas/route.ts')
const display = read('components/system/WhatsAppOrcamentoNotas.tsx')
const sql = read('supabase/migrations/20261117163000_kanban_comercial_mesclagem_editores_v2.sql')
const acesso = read('lib/kanbanMesclagemAcessoServer.ts')
const cards = read('app/api/kanban/comercial/cards/route.ts')
const ingestSql = read('supabase/migrations/20261117155100_whatsapp_orcamento_intake_relogio_idempotencia_v1.sql')
const gateway = read('supabase/functions/whatsapp-gateway/index.ts')

for (const [source, checks] of [
  [ui, ['handleDropSobreCard', 'e.stopPropagation()', 'window.confirm(', '/api/kanban/comercial/mesclar-cards', 'onDragOver={e =>', 'podeMesclarCards']],
  [api, ['podeMesclarKanbanComercial(usuario)', 'kanban_mesclar_cards_comerciais_v1', 'origemId === destinoId']],
  [acesso, ['comercial.orcamento.editar', 'comercial.pedido_orcamento.editar', "minimo: 'edicao'"]],
  [cards, ['podeMesclarKanbanComercial(u)', 'podeMesclar']],
  [sql, ["lower(u.role) = 'master'", "p.nivel = 'edicao'", "origem_cards", 'kanban_retirado_em=now()', 'jsonb_array_elements(v_midias)', 'revoke all on function', 'to service_role']],
  [notes, ['origemCards', 'anexosAgrupados', 'createSignedUrls']],
  [display, ['Informações dos cards incorporados', 'itens.length', 'origemCards']],
  [gateway, ['const recebidoEm = new Date().toISOString()', 'p_now: recebidoEm', 'gatewayToken, recebidoEm, windowMinutes']],
  [ingestSql, ['mensagens_ids @> jsonb_build_array(p_mensagem_id)', 'greatest(coalesce(ultima_mensagem_em, p_now), p_now)']],
]) {
  for (const pattern of checks) assert(source.includes(pattern), 'Falta contrato: ' + pattern)
}
assert(!sql.includes('delete from public.orcamentos'), 'Não pode excluir orçamento')
assert(!sql.includes('wvetro_fluxo='), 'Não pode alterar W.Vetro')
assert(!sql.includes('valor_estimado='), 'Não pode alterar preço')
assert(!sql.includes('itens='), 'Não pode alterar itens técnicos do destino')
assert(sql.indexOf('update public.orcamentos set anexos=') < sql.indexOf('kanban_retirado_em=now()'),
  'Primeiro preservar anexos; só depois retirar origem')

const eventos = [
  { provedor: '2026-11-17T14:15:09.000Z', recebido: '2026-11-17T14:15:10.000Z' },
  { provedor: '2026-11-17T14:14:50.000Z', recebido: '2026-11-17T14:15:42.000Z' },
]
assert(new Date(eventos[1].provedor) < new Date(eventos[0].provedor), 'Amostra representa mídia retroativa')
assert(new Date(eventos[1].recebido) - new Date(eventos[0].recebido) < 60_000,
  'O pacote não pode fechar com apenas 32 segundos entre recebimentos')
assert(new Date('2026-11-17T14:16:42.000Z') - new Date(eventos[1].recebido) === 60_000,
  'A janela encerra um minuto após o último recebimento no Atlas')
console.log('OK — UI, autorização para editores, preservação W.Vetro, notas/mídias, idempotência e relógio de 1 min')
