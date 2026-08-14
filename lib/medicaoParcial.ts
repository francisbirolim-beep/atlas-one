import { supabase } from './supabase'
import type { Usuario } from './tipos'

export type EventoHistoricoMedicao = {
  id: string
  tipo: 'inicio' | 'parcial' | 'retomada'
  data: string
  pecasMedidas: number | null
  pecasAbertas: number | null
  usuario: string | null
}

export type EstadoParcialMedicao = {
  parcial: boolean
  eventos: EventoHistoricoMedicao[]
  tempoAtivoMs: number
}

async function resumoPecas(medicaoId: string) {
  const { data, error } = await supabase
    .from('medicao_itens')
    .select('id, quantidade, medido')
    .eq('medicao_id', medicaoId)

  if (error) throw error

  const itens = data || []
  const total = itens.reduce((soma, item) => soma + Math.max(1, item.quantidade || 1), 0)
  const medidas = itens.reduce((soma, item) => soma + (item.medido ? 1 : 0), 0)
  return { total, medidas, abertas: Math.max(0, total - medidas) }
}

async function proximaVersao(medicaoId: string) {
  const { data } = await supabase
    .from('medicao_revisoes')
    .select('versao')
    .eq('medicao_id', medicaoId)
    .order('versao', { ascending: false })
    .limit(1)

  return Math.max(1, Number(data?.[0]?.versao || 0) + 1)
}

async function registrarEvento(
  medicaoId: string,
  tipo: 'parcial' | 'retomada',
  usuario: Usuario | null,
) {
  const [resumo, versao] = await Promise.all([resumoPecas(medicaoId), proximaVersao(medicaoId)])
  const agora = new Date().toISOString()
  const motivo = tipo === 'parcial' ? 'Medição parcial' : 'Retomada da medição'

  const { error } = await supabase.from('medicao_revisoes').insert({
    medicao_id: medicaoId,
    versao,
    motivo,
    snapshot: {
      evento: tipo,
      registrado_em: agora,
      pecas_medidas: resumo.medidas,
      pecas_abertas: resumo.abertas,
      total_pecas: resumo.total,
    },
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  })

  if (error) {
    console.error('Erro ao registrar histórico da Medição Final:', error)
    return false
  }

  await supabase.from('medicoes_finais').update({ versao }).eq('id', medicaoId)
  return true
}

async function ultimoEventoParcial(medicaoId: string) {
  const { data, error } = await supabase
    .from('medicao_revisoes')
    .select('motivo')
    .eq('medicao_id', medicaoId)
    .in('motivo', ['Medição parcial', 'Retomada da medição'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Erro ao consultar último evento da medição:', error)
    return null
  }

  return data?.[0]?.motivo || null
}

export async function salvarMedicaoParcial(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<{ ok: boolean; mensagem?: string }> {
  const [{ data: medicao, error }, ultimo] = await Promise.all([
    supabase
      .from('medicoes_finais')
      .select('status_operacional, iniciado_em')
      .eq('id', medicaoId)
      .maybeSingle(),
    ultimoEventoParcial(medicaoId),
  ])

  if (error || !medicao) return { ok: false, mensagem: 'Não foi possível carregar a medição.' }
  if (!medicao.iniciado_em) return { ok: false, mensagem: 'Inicie a medição antes de salvá-la como parcial.' }
  if (!['em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return { ok: false, mensagem: 'A medição precisa estar em andamento para ser marcada como parcial.' }
  }
  if (ultimo === 'Medição parcial') return { ok: false, mensagem: 'Esta medição já está salva como parcial.' }

  const registrado = await registrarEvento(medicaoId, 'parcial', usuario)
  if (!registrado) return { ok: false, mensagem: 'Não foi possível registrar o histórico da medição parcial.' }
  return { ok: true }
}

export async function retomarMedicaoParcial(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<{ ok: boolean; mensagem?: string }> {
  const ultimo = await ultimoEventoParcial(medicaoId)
  if (ultimo !== 'Medição parcial') return { ok: false, mensagem: 'Esta medição não está pausada como parcial.' }

  const registrado = await registrarEvento(medicaoId, 'retomada', usuario)
  if (!registrado) return { ok: false, mensagem: 'Não foi possível registrar a retomada no histórico.' }
  return { ok: true }
}

function calcularTempoAtivo(iniciadoEm: string | null, eventos: EventoHistoricoMedicao[], agora = Date.now()) {
  if (!iniciadoEm) return 0

  let inicioSessao = new Date(iniciadoEm).getTime()
  if (!Number.isFinite(inicioSessao)) return 0
  let total = 0

  const ordenados = eventos
    .filter(evento => evento.tipo !== 'inicio')
    .slice()
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

  for (const evento of ordenados) {
    const momento = new Date(evento.data).getTime()
    if (!Number.isFinite(momento)) continue

    if (evento.tipo === 'parcial' && inicioSessao > 0) {
      total += Math.max(0, momento - inicioSessao)
      inicioSessao = 0
    } else if (evento.tipo === 'retomada' && inicioSessao === 0) {
      inicioSessao = momento
    }
  }

  if (inicioSessao > 0) total += Math.max(0, agora - inicioSessao)
  return total
}

export async function carregarEstadoParcialMedicao(medicaoId: string): Promise<EstadoParcialMedicao> {
  const [{ data: medicao }, { data: revisoes, error }] = await Promise.all([
    supabase
      .from('medicoes_finais')
      .select('iniciado_em, responsavel_nome')
      .eq('id', medicaoId)
      .maybeSingle(),
    supabase
      .from('medicao_revisoes')
      .select('id, motivo, snapshot, criado_por_nome, created_at')
      .eq('medicao_id', medicaoId)
      .in('motivo', ['Medição parcial', 'Retomada da medição'])
      .order('created_at', { ascending: true }),
  ])

  if (error) console.error('Erro ao carregar histórico da Medição Final:', error)

  const eventos: EventoHistoricoMedicao[] = []
  if (medicao?.iniciado_em) {
    eventos.push({
      id: 'inicio',
      tipo: 'inicio',
      data: medicao.iniciado_em,
      pecasMedidas: null,
      pecasAbertas: null,
      usuario: medicao.responsavel_nome || null,
    })
  }

  for (const revisao of revisoes || []) {
    const snapshot = revisao.snapshot && typeof revisao.snapshot === 'object' ? revisao.snapshot as Record<string, unknown> : {}
    eventos.push({
      id: revisao.id,
      tipo: revisao.motivo === 'Medição parcial' ? 'parcial' : 'retomada',
      data: revisao.created_at,
      pecasMedidas: Number.isFinite(Number(snapshot.pecas_medidas)) ? Number(snapshot.pecas_medidas) : null,
      pecasAbertas: Number.isFinite(Number(snapshot.pecas_abertas)) ? Number(snapshot.pecas_abertas) : null,
      usuario: revisao.criado_por_nome || null,
    })
  }

  const ultimo = eventos[eventos.length - 1]
  const parcial = ultimo?.tipo === 'parcial'

  return {
    parcial,
    eventos,
    tempoAtivoMs: calcularTempoAtivo(medicao?.iniciado_em || null, eventos),
  }
}
