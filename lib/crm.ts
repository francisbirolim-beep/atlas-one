import { supabase } from './supabase'
import { Tarefa, Interacao, Meta, TipoInteracao, Anexo, Usuario, OrcamentoRapido } from './tipos'

// ---------- Tarefas e retornos ----------

export async function listarTarefasCliente(clienteId: string): Promise<Tarefa[]> {
  const { data } = await supabase
    .from('crm_tarefas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('concluida', { ascending: true })
    .order('data_vencimento', { ascending: true, nullsFirst: false })
  return (data as Tarefa[]) || []
}

export async function listarTarefasPendentes(): Promise<Tarefa[]> {
  const { data } = await supabase
    .from('crm_tarefas')
    .select('*')
    .eq('concluida', false)
    .order('data_vencimento', { ascending: true, nullsFirst: false })
  return (data as Tarefa[]) || []
}

export async function criarTarefa(
  clienteId: string | null,
  clienteNome: string | null,
  titulo: string,
  dataVencimento: string | null,
  usuario: Usuario | null,
  descricao?: string,
  orcamentoId?: string | null
) {
  return supabase.from('crm_tarefas').insert({
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    orcamento_id: orcamentoId || null,
    titulo,
    descricao: descricao || null,
    data_vencimento: dataVencimento,
    responsavel_id: usuario?.id || null,
    responsavel_nome: usuario?.nome || null,
  })
}

export async function concluirTarefa(id: string, concluida: boolean) {
  return supabase
    .from('crm_tarefas')
    .update({ concluida, concluida_em: concluida ? new Date().toISOString() : null })
    .eq('id', id)
}

export async function excluirTarefa(id: string) {
  return supabase.from('crm_tarefas').delete().eq('id', id)
}

// ---------- Interações (histórico de atendimento / negociações) ----------

export async function listarInteracoesCliente(clienteId: string): Promise<Interacao[]> {
  const { data } = await supabase
    .from('crm_interacoes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  return (data as Interacao[]) || []
}

export async function registrarInteracao(
  clienteId: string,
  tipo: TipoInteracao,
  descricao: string,
  usuario: Usuario | null,
  anexos?: Anexo[],
  orcamentoId?: string | null
) {
  return supabase.from('crm_interacoes').insert({
    cliente_id: clienteId,
    orcamento_id: orcamentoId || null,
    tipo,
    descricao,
    anexos: anexos || [],
    usuario_id: usuario?.id || null,
    usuario_nome: usuario?.nome || null,
  })
}

// ---------- Metas comerciais ----------

export function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function listarMetas(mes: string): Promise<Meta[]> {
  const { data } = await supabase.from('crm_metas').select('*').eq('mes', mes)
  return (data as Meta[]) || []
}

export async function salvarMeta(
  mes: string,
  usuarioId: string | null,
  usuarioNome: string | null,
  metaValor: number | null,
  metaQuantidade: number | null
) {
  const payload = {
    mes,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    meta_valor: metaValor,
    meta_quantidade: metaQuantidade,
    updated_at: new Date().toISOString(),
  }

  // Upsert com onConflict não funciona quando usuario_id é null (a meta "empresa toda"),
  // porque unique constraints tratam NULL como valores distintos entre si no Postgres.
  // Então, para usuario_id null, busca a linha existente manualmente antes de decidir
  // entre update e insert.
  if (usuarioId === null) {
    const { data: existente } = await supabase
      .from('crm_metas')
      .select('id')
      .eq('mes', mes)
      .is('usuario_id', null)
      .maybeSingle()

    if (existente) {
      return supabase.from('crm_metas').update(payload).eq('id', existente.id)
    }
    return supabase.from('crm_metas').insert(payload)
  }

  return supabase.from('crm_metas').upsert(payload, { onConflict: 'mes,usuario_id' })
}

// ---------- Taxa de conversão / funil de vendas ----------

export const STATUS_FUNIL: { valor: string; label: string; cor: string }[] = [
  { valor: 'rascunho', label: 'Rascunho', cor: 'bg-slate-100 text-slate-600' },
  { valor: 'enviado', label: 'Enviado', cor: 'bg-brand-navyLight text-brand-navy' },
  { valor: 'aprovado', label: 'Aprovado', cor: 'bg-brand-tealLight text-brand-teal' },
  { valor: 'convertido', label: 'Convertido', cor: 'bg-purple-100 text-purple-600' },
  { valor: 'recusado', label: 'Perdido', cor: 'bg-red-100 text-red-600' },
]

export function calcularTaxaConversao(orcamentos: OrcamentoRapido[]): number {
  const relevantes = orcamentos.filter(o => o.status !== 'rascunho')
  if (relevantes.length === 0) return 0
  const ganhos = relevantes.filter(o => o.status === 'aprovado' || o.status === 'convertido').length
  return Math.round((ganhos / relevantes.length) * 100)
}
