import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type DistribuicaoWhatsApp = {
  empresa_id: string
  usuario_principal_id: string | null
  secundarios_ids: string[]
  prazo_minutos: number
  ativo: boolean
}

export async function obterDistribuicaoWhatsApp(empresaId: string): Promise<DistribuicaoWhatsApp | null> {
  const { data, error } = await supabaseAdmin
    .from('atendimento_whatsapp_distribuicao')
    .select('empresa_id,usuario_principal_id,secundarios_ids,prazo_minutos,ativo')
    .eq('empresa_id', empresaId).maybeSingle()
  if (error) throw error
  return data as DistribuicaoWhatsApp | null
}

export type ConversaEscalonavel = {
  responsavel_id?: string | null
  status?: string | null
  whatsapp_chat_tipo?: string | null
  ultima_entrada_em?: string | null
  ultima_saida_em?: string | null
  ultima_mensagem_em?: string | null
}

export function elegivelAoSecundario(
  conversa: ConversaEscalonavel,
  distribuicao: DistribuicaoWhatsApp | null,
  usuarioId: string,
  canalPrincipal: boolean,
  agora = Date.now(),
): boolean {
  if (!canalPrincipal || !distribuicao?.ativo || !distribuicao.usuario_principal_id ||
      !distribuicao.secundarios_ids.includes(usuarioId) ||
      conversa.responsavel_id !== distribuicao.usuario_principal_id ||
      conversa.whatsapp_chat_tipo === 'grupo' || conversa.status !== 'aguardando') return false
  const chegada = Date.parse(conversa.ultima_entrada_em || '')
  const ultimaSaida = Date.parse(conversa.ultima_saida_em || '')
  if (!Number.isFinite(chegada) || (Number.isFinite(ultimaSaida) && ultimaSaida >= chegada)) return false
  const minutos = Number(distribuicao.prazo_minutos)
  return Number.isInteger(minutos) && minutos >= 1 && minutos <= 1440 &&
    agora - chegada >= minutos * 60_000
}
