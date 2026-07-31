import { supabase } from './supabase'
import { HistoricoItem, Usuario } from './tipos'

export async function registrarHistorico(
  orcamentoId: string,
  usuario: Usuario | null,
  acao: string,
  detalhes?: string
) {
  await supabase.from('historico').insert({
    orcamento_id: orcamentoId,
    usuario_nome: usuario?.nome || 'Sistema',
    usuario_id: usuario?.id || null,
    acao,
    detalhes: detalhes || null,
  })
}

export async function listarHistorico(orcamentoId: string): Promise<HistoricoItem[]> {
  const { data } = await supabase
    .from('historico')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .order('created_at', { ascending: false })
  return (data as HistoricoItem[]) || []
}
