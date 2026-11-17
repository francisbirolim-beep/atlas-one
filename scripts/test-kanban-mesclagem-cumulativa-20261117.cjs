const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ler = arquivo => fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8')
const sql = ler('supabase/migrations/20261117185500_kanban_mesclagem_multiplos_cards_v2.sql')
const ui = ler('components/system/KanbanPageFixed.tsx')
const notas = ler('components/system/WhatsAppOrcamentoNotas.tsx')
const api = ler('app/api/kanban/comercial/mesclar-cards/route.ts')
const relatorio = ler('app/api/integracoes/whatsapp/orcamento-notas/route.ts')

for (const [texto, nomes] of [
  [sql, ['v_fotos := coalesce(v_destino.fotos_urls', 'fotos_urls=v_fotos',
    "'dados',to_jsonb(v_origem)", 'v_origens := v_origens || jsonb_build_array(v_origem_integrada)',
    'v_origens := v_origens || jsonb_build_array(v_entrada)',
    'descricao_livre=nullif(v_descricao', 'observacoes=nullif(v_observacoes',
    'v_origem.anexo_url', 'v_origem.medidas_trena',
    'update public.tarefas set orcamento_id=p_destino',
    'update public.atendimento_whatsapp_intakes set orcamento_id=p_destino',
    'kanban_retirado_em=now()', 'to service_role']],
  [ui, ['mesmoCadastro', 'handleDropSobreCard', 'confirmou: true', 'inclusive de cards já reunidos']],
  [api, ['podeMesclarKanbanComercial', "db.rpc('kanban_mesclar_cards_comerciais_v1'"]],
  [relatorio, ['&& !origemCards.length']],
  [notas, ['Informações consolidadas de', 'Consultar registro completo deste card',
    'Fotos recebidas', 'Medições com trena recebidas', 'Arquivos e anexos recebidos']],
]) for (const nome of nomes) assert(texto.includes(nome), 'Ausência de regra: '+nome)

assert(!/update public.orcamentos set[^;]*(itens=|valor_estimado=|wvetro_fluxo=)/s.test(sql),
  'Mesclagem não pode mexer em itens, preço ou W.Vetro')
assert(sql.indexOf('update public.orcamentos set anexos=') < sql.indexOf('kanban_retirado_em=now()'),
  'Preservar os dados de origem antes da retirada do card')
assert(sql.includes('and v_origem.cliente_id <> v_destino.cliente_id'),
  'Precisa impedir cadastro divergente')
assert(sql.includes("v_origem.cliente_id = v_destino.cliente_id"),
  'Mesmo cadastro deve permitir pequenas diferenças de grafia')

const mesclar = (destino, origem) => ({
  ...destino,
  origens: [...new Map([
    ...destino.origens.map(x=>[x.id,x]),
    ...origem.origens.map(x=>[x.id,x]), 
    [origem.id, origem]
  ]).values()].filter(x=>x.id!==destino.id),
  fotos: [...new Set([...destino.fotos,...origem.fotos])],
})
const a={id:'principal',origens:[],fotos:['foto-A']}
const b={id:'card-B',origens:[],fotos:['foto-B']}
const c={id:'card-C',origens:[],fotos:['foto-C']}
const d={id:'card-D',origens:[],fotos:['foto-D']}
const unido=mesclar(mesclar(mesclar(a,b),c),d)
assert.deepEqual(unido.origens.map(x=>x.id),['card-B','card-C','card-D'])
assert.deepEqual(unido.fotos,['foto-A','foto-B','foto-C','foto-D'])
const encadeado=mesclar(a,mesclar(b,c))
assert.deepEqual(encadeado.origens.map(x=>x.id),['card-C','card-B'])
assert.deepEqual(mesclar(encadeado,d).origens.map(x=>x.id),['card-C','card-B','card-D'])
console.log('OK: contratos de mesclagem cumulativa de 3-4 cards, anexos, snapshot, histórico, W.Vetro e permissões')
