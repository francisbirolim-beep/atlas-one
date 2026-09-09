import { supabase } from './supabase'
import { carregarOrdemProducao, type OrdemProducao } from './ordensProducao'
import type { MaterialPacote, PacoteTecnico } from './materialPlanejamento'

export type MaterialFichaProducao = MaterialPacote & {
  imagem_url?: string | null
  cortes: Array<{ id: string; comprimento_mm: number; perda_corte_mm: number; barra_id: string; barra_sobra_final_mm?: number | null; sobra_exclusiva_item?: boolean }>
}
export type RevisaoFichaProducao = { id: string; versao: number; tipo: string; justificativa?: string | null; criado_por_nome?: string | null; created_at: string }
export type FichaProducao = {
  ordem: OrdemProducao; orcamento: any | null; medicaoFinal: any | null; pacote: PacoteTecnico | null; tipologia: any | null; item: any
  materiais: MaterialFichaProducao[]; revisoes: RevisaoFichaProducao[]; situacaoTecnica: any | null
  situacao: 'liberado' | 'previa'; motivosBloqueio: string[]; observacoesProducao: string[]; linkInternoPath: string
}
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
const itemRef = (item: any, i: number) => String(item?.id || `item-${i + 1}`)
function localizarItem(snapshot: any[], ref?: string | null) { if (!Array.isArray(snapshot) || !snapshot.length) return null; if (!ref) return snapshot[0]; return snapshot.find((x, i) => itemRef(x, i) === String(ref)) || null }
async function carregarPacote(orcamentoId: string, ref?: string | null) {
  const { data } = await supabase.from('pacotes_tecnicos').select('*').eq('orcamento_id', orcamentoId).neq('status', 'substituido').order('created_at', { ascending: false })
  const lista = (data || []) as PacoteTecnico[]; const finais = lista.filter(p => p.origem === 'medicao_final'); const candidatos = finais.length ? finais : lista
  if (!ref) return candidatos[0] || null
  return candidatos.find(p => (Array.isArray(p.snapshot_itens) ? p.snapshot_itens : []).some((x, i) => itemRef(x, i) === String(ref))) || candidatos[0] || null
}
function observacoes(item: any, pacote: PacoteTecnico | null) {
  const out: string[] = []
  for (const v of [item?.observacoes_producao, item?.observacao_producao, item?.observacoes, item?.observacao, pacote?.observacoes]) if (typeof v === 'string' && v.trim() && !out.includes(v.trim())) out.push(v.trim())
  return out
}
export async function carregarFichaProducao(ordemId: string): Promise<FichaProducao | null> {
  const ordem = await carregarOrdemProducao(ordemId); if (!ordem) return null
  const orcamentoId = ordem.orcamento_id || null; let orcamento: any = null; let medicaoFinal: any = null; let pacote: PacoteTecnico | null = null; let revisoes: RevisaoFichaProducao[] = []
  if (orcamentoId) {
    const [o, m] = await Promise.all([
      supabase.from('orcamentos').select('id,numero,cliente_nome,cidade,obra_cidade,created_at,itens,clientes(id,nome),obras(id,nome,cidade)').eq('id', orcamentoId).maybeSingle(),
      supabase.from('medicoes_finais').select('id,status_operacional,versao,aprovado_em,aprovado_por_nome,responsavel_nome,observacoes,created_at').eq('orcamento_id', orcamentoId).order('versao', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    orcamento = o.data || null; medicaoFinal = m.data || null; pacote = await carregarPacote(orcamentoId, ordem.item_ref)
  }
  if (ordem.venda_obra_id) { const { data } = await supabase.from('venda_obra_revisoes').select('id,versao,tipo,justificativa,criado_por_nome,created_at').eq('venda_obra_id', ordem.venda_obra_id).order('versao', { ascending: false }); revisoes = (data || []) as RevisaoFichaProducao[] }
  const snapshot = Array.isArray(pacote?.snapshot_itens) ? pacote!.snapshot_itens : (Array.isArray(orcamento?.itens) ? orcamento.itens : [])
  const item = localizarItem(snapshot, ordem.item_ref) || ordem.item_snapshot || {}; const tipologiaId = item?.tipologia_id || item?.tipologiaId || null
  let tipologia: any = null
  if (tipologiaId) { const { data } = await supabase.from('tipologias').select('id,chave,label,categoria,foto_url,versao_tecnica').eq('id', tipologiaId).maybeSingle(); tipologia = data || null }
  let situacaoTecnica: any = null
  if (orcamentoId && ordem.item_ref) { const { data } = await supabase.from('orcamento_item_precificacao').select('situacao_tecnica,situacao_tecnica_motivo,validado_tecnicamente_em,validado_tecnicamente_por').eq('orcamento_id', orcamentoId).eq('item_ref', ordem.item_ref).maybeSingle(); situacaoTecnica = data || null }
  let materiaisBase: MaterialPacote[] = []
  if (pacote) { let q = supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacote.id).eq('excluido', false).order('categoria').order('ordem'); if (ordem.item_ref) q = q.eq('item_ref', ordem.item_ref); materiaisBase = ((await q).data || []) as MaterialPacote[] }
  const ids = Array.from(new Set(materiaisBase.map(m => m.produto_id).filter(Boolean))) as string[]
  const produtos = ids.length ? (((await supabase.from('produtos').select('id,foto_url').in('id', ids)).data || []) as any[]) : []; const imgs = new Map(produtos.map(p => [p.id, p.foto_url || null]))
  const cortesMap = new Map<string, MaterialFichaProducao['cortes']>()
  if (pacote && materiaisBase.length) {
    const mids = materiaisBase.map(m => m.id); const { data: cortes } = await supabase.from('pacote_tecnico_cortes').select('id,material_id,item_ref,barra_id,comprimento_mm,perda_corte_mm,pacote_tecnico_barras!inner(pacote_id,sobra_final_mm)').in('material_id', mids).eq('pacote_tecnico_barras.pacote_id', pacote.id)
    const bids = Array.from(new Set((cortes || []).map((c: any) => c.barra_id).filter(Boolean))) as string[]; const todos = bids.length ? (((await supabase.from('pacote_tecnico_cortes').select('barra_id,item_ref').in('barra_id', bids)).data || []) as any[]) : []
    const refs = new Map<string, Set<string>>(); for (const c of todos) { const s = refs.get(String(c.barra_id)) || new Set<string>(); s.add(String(c.item_ref || '')); refs.set(String(c.barra_id), s) }
    for (const c of (cortes || []) as any[]) { if (!c.material_id) continue; const arr = cortesMap.get(String(c.material_id)) || []; const b = Array.isArray(c.pacote_tecnico_barras) ? c.pacote_tecnico_barras[0] : c.pacote_tecnico_barras; const r = refs.get(String(c.barra_id)) || new Set<string>(); arr.push({ id:c.id, comprimento_mm:n(c.comprimento_mm), perda_corte_mm:n(c.perda_corte_mm), barra_id:String(c.barra_id), barra_sobra_final_mm:b?.sobra_final_mm == null ? null : n(b.sobra_final_mm), sobra_exclusiva_item:r.size <= 1 && r.has(String(c.item_ref || '')) }); cortesMap.set(String(c.material_id), arr) }
  }
  const materiais: MaterialFichaProducao[] = materiaisBase.map(m => ({ ...m, imagem_url:m.produto_id ? imgs.get(m.produto_id) || null : null, cortes:cortesMap.get(m.id) || [] }))
  const motivosBloqueio: string[] = []
  if (!orcamentoId) motivosBloqueio.push('Ordem sem orçamento técnico vinculado.')
  if (medicaoFinal?.status_operacional !== 'aprovado') motivosBloqueio.push('Medição Final ainda não aprovada.')
  if (!pacote) motivosBloqueio.push('Pacote técnico não encontrado.'); else if (pacote.origem !== 'medicao_final') motivosBloqueio.push('Pacote técnico ainda não foi regenerado a partir da Medição Final.')
  if (materiais.some(m => m.status_calculo === 'pendente_formula')) motivosBloqueio.push('Existem materiais/fórmulas técnicas pendentes.')
  if (situacaoTecnica?.situacao_tecnica !== 'validada') motivosBloqueio.push(situacaoTecnica?.situacao_tecnica_motivo || 'Composição da tipologia ainda não possui validação técnica vigente.')
  if (ordem.bloqueada) motivosBloqueio.push(ordem.bloqueio_motivo || 'Ordem de Produção está bloqueada.')
  if (!materiais.length) motivosBloqueio.push('Nenhum material técnico válido foi localizado para esta tipologia.')
  return { ordem, orcamento, medicaoFinal, pacote, tipologia, item, materiais, revisoes, situacaoTecnica, situacao: motivosBloqueio.length ? 'previa' : 'liberado', motivosBloqueio, observacoesProducao: observacoes(item, pacote), linkInternoPath:`/producao/ordens/${ordem.id}/ficha` }
}
