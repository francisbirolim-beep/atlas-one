const assert=require('node:assert/strict')
const fs=require('node:fs')
const ler=p=>fs.readFileSync(p,'utf8')
const sql=ler('supabase/migrations/20261110110000_kanban_principal_movimento_visual.sql')
const api=ler('app/api/visao-geral-projetos/mover/route.ts')
const get=ler('app/api/visao-geral-projetos/route.ts')
const venda=ler('components/clientes/VendaKanbanObra.tsx')
const geral=ler('app/visao-geral-projetos/page.tsx')

for(const s of [
  "check (estado in ('finalizado','oculto','manual'))",
  "add column if not exists etapa_visual text",
  "create or replace function public.mover_card_principal_kanban_obra_v1",
  "language plpgsql security invoker",
  "where id=p_usuario and empresa_id=p_empresa",
  "where id=p_venda and empresa_id=p_empresa",
  "v_setor is distinct from 'edicao'",
  "{modulos,kanban-obra}",
  "{acoes,clientes.kanban_obra.mover}",
  "estado='manual'",
  "insert into public.visao_geral_cards_historico",
  "revoke all on function public.mover_card_principal_kanban_obra_v1",
  "grant execute on function public.mover_card_principal_kanban_obra_v1",
]){
  assert.ok(sql.includes(s),'Proteção ou auditoria faltante: '+s)
}
assert.ok(!/update public\.(vendas_obras|ordens_producao|compras_solicitacoes)/.test(sql),'Fluxo operacional não pode ser alterado')
assert.match(api,/autenticarCompras\(req\)/)
assert.match(api,/permissoesKanbanObra\(u\)/)
assert.match(api,/!permissao\.mover/)
assert.match(api,/ETAPAS_OPERACIONAIS/)
assert.match(api,/db\.rpc\('mover_card_principal_kanban_obra_v1'/)
assert.ok(get.includes("controle?.estado==='manual'")&&get.includes("etapaVisual")===false)
assert.ok(get.includes('etapa_visual,updated_at')&&get.includes("podeMoverCards"))
assert.ok(get.includes("controle?.estado==='finalizado'"),'Compatibilidade com status anterior')
assert.ok(get.includes("controleMaster!=='oculto'"),'Card oculto não pode reaparecer')
assert.ok(venda.includes('arrastandoPrincipal')&&venda.includes('onDragStart={e=>'))
assert.ok(venda.includes('Mover card principal')&&venda.includes('moverPrincipal(destino)'))
assert.ok(geral.includes('moverCardVisual(id,destinoVisual)'))
assert.ok(geral.includes('Mover card principal para etapa')&&geral.includes('podeMoverCards&&!demo'))
assert.ok(api.includes('Motivo')||api.includes('motivo'))
console.log('PASS: card principal em 8 colunas, ACL explícita, histórico auditado e estado operacional preservado')
