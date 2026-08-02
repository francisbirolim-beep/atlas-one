import { supabase } from './supabase'
import { Evento, EventoConvidado } from './tipos'
import { TipoRecorrencia, gerarProximasOcorrencias } from './recorrencia'

export type EventoComConvite = Evento & { meuStatus?: 'proprio' | 'pendente' | 'aceito' | 'recusado' }

export async function listarEventosDoUsuario(usuarioId: string): Promise<EventoComConvite[]> {
  const { data: proprios, error: errProprios } = await supabase
    .from('eventos')
    .select('*')
    .eq('usuario_id', usuarioId)

  const { data: convites, error: errConvites } = await supabase
    .from('evento_convidados')
    .select('status, eventos(*)')
    .eq('usuario_id', usuarioId)

  if (errProprios) console.error('Erro ao listar eventos proprios:', errProprios)
  if (errConvites) console.error('Erro ao listar convites:', errConvites)

  const listaProprios: EventoComConvite[] = (proprios || []).map((e: any) => ({ ...e, meuStatus: 'proprio' }))
  const listaConvites: EventoComConvite[] = (convites || [])
    .filter((c: any) => c.eventos)
    .map((c: any) => ({ ...c.eventos, meuStatus: c.status }))

  return [...listaProprios, ...listaConvites]
}

export async function criarEvento(
  usuarioId: string,
  dados: { titulo: string; descricao?: string; local?: string; data_inicio: string; data_fim?: string | null },
  convidadosIds: string[] = []
): Promise<Evento | null> {
  const { data, error } = await supabase
    .from('eventos')
    .insert({
      usuario_id: usuarioId,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      local: dados.local || null,
      data_inicio: dados.data_inicio,
      data_fim: dados.data_fim || null,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Erro ao criar evento:', error)
    return null
  }

  if (convidadosIds.length > 0) {
    const linhas = convidadosIds.map((usuario_id) => ({ evento_id: data.id, usuario_id }))
    const { error: errConv } = await supabase.from('evento_convidados').insert(linhas)
    if (errConv) console.error('Erro ao convidar usuarios:', errConv)
  }

  return data as Evento
}

export async function excluirEvento(eventoId: string): Promise<boolean> {
  const { error } = await supabase.from('eventos').delete().eq('id', eventoId)
  return !error
}

export async function listarConvidados(eventoId: string): Promise<(EventoConvidado & { nome?: string })[]> {
  const { data, error } = await supabase
    .from('evento_convidados')
    .select('*, usuarios(nome)')
    .eq('evento_id', eventoId)

  if (error || !data) {
    console.error('Erro ao listar convidados:', error)
    return []
  }
  return data.map((c: any) => ({ ...c, nome: c.usuarios?.nome }))
}

export async function responderConvite(eventoId: string, usuarioId: string, status: 'aceito' | 'recusado'): Promise<boolean> {
  const { error } = await supabase
    .from('evento_convidados')
    .update({ status })
    .eq('evento_id', eventoId)
    .eq('usuario_id', usuarioId)
  return !error
}

export function gerarIcs(evento: Evento): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').split('.')[0] + 'Z'
  const inicio = fmt(new Date(evento.data_inicio).toISOString())
  const fim = fmt(new Date(evento.data_fim || evento.data_inicio).toISOString())
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atlas One//Calendario//PT',
    'BEGIN:VEVENT',
    'UID:' + evento.id + '@atlas-one',
    'DTSTAMP:' + inicio,
    'DTSTART:' + inicio,
    'DTEND:' + fim,
    'SUMMARY:' + evento.titulo,
    evento.local ? 'LOCATION:' + evento.local : '',
    evento.descricao ? 'DESCRIPTION:' + evento.descricao : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export async function listarUsuariosConvidaveis(excluirId: string): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('usuarios').select('id, nome').neq('id', excluirId).order('nome')
  if (error || !data) {
    console.error('Erro ao listar usuarios:', error)
    return []
  }
  return data
}

export async function criarEventoRecorrente(
  usuarioId: string,
  dados: { titulo: string; descricao?: string; local?: string; data_inicio: string; data_fim?: string | null },
  tipo: TipoRecorrencia,
  valor: number,
  convidadosIds: string[] = []
): Promise<Evento | null> {
  const base = await criarEvento(usuarioId, dados, convidadosIds)
  if (!base) return null

  await supabase.from('eventos').update({ recorrencia_tipo: tipo, recorrencia_valor: valor }).eq('id', base.id)

  const duracaoMs = dados.data_fim ? new Date(dados.data_fim).getTime() - new Date(dados.data_inicio).getTime() : 0
  const proximas = gerarProximasOcorrencias(new Date(dados.data_inicio), tipo, valor)

  for (const data of proximas) {
    const { data: novo, error } = await supabase
      .from('eventos')
      .insert({
        usuario_id: usuarioId,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        local: dados.local || null,
        data_inicio: data.toISOString(),
        data_fim: duracaoMs > 0 ? new Date(data.getTime() + duracaoMs).toISOString() : null,
        regra_origem_id: base.id,
      })
      .select()
      .single()

    if (error || !novo) {
      console.error('Erro ao gerar ocorrencia de evento:', error)
      continue
    }

    if (convidadosIds.length > 0) {
      const linhas = convidadosIds.map((usuario_id) => ({ evento_id: novo.id, usuario_id }))
      await supabase.from('evento_convidados').insert(linhas)
    }
  }

  return { ...base, recorrencia_tipo: tipo, recorrencia_valor: valor }
}
