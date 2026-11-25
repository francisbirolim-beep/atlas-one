import { supabase } from './supabase'
import { Evento, EventoConvidado } from './tipos'
import { TipoRecorrencia, gerarProximasOcorrencias } from './recorrencia'
import { camposSaoPaulo, gerarDatasEquipe } from './tarefasEquipeRecorrencia'

export type EventoComConvite = Evento & { meuStatus?: 'proprio' | 'pendente' | 'aceito' | 'recusado' }

export async function listarEventosDoUsuario(usuarioId: string): Promise<EventoComConvite[]> {
  const [{ data: proprios, error: errProprios }, { data: convites, error: errConvites }] = await Promise.all([
    supabase.from('eventos').select('*').eq('usuario_id', usuarioId),
    supabase.from('evento_convidados').select('status, eventos(*)').eq('usuario_id', usuarioId),
  ])

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
  convidadosIds: string[] = [],
  personalizada?: { diasSemana: number[] }
): Promise<Evento | null> {
  const duracaoMs = dados.data_fim ? new Date(dados.data_fim).getTime() - new Date(dados.data_inicio).getTime() : 0
  // Chamadas anteriores mantêm a lógica original. A nova tela usa a data como limite inicial.
  const datas = personalizada ? gerarDatasEquipe(dados.data_inicio, tipo==='dia_fixo_mes'?'mensal':tipo, valor, personalizada.diasSemana) : null
  if (datas && !datas.length) return null
  const inicioBase = datas?.[0] ?? dados.data_inicio
  const dadosBase = datas ? {...dados, data_inicio:inicioBase, data_fim:duracaoMs>0?new Date(new Date(inicioBase).getTime()+duracaoMs).toISOString():null} : dados
  const base = await criarEvento(usuarioId, dadosBase, convidadosIds)
  if (!base) return null

  // Semanal personalizado: máscara dos dias (bit 0=domingo), sem mudança de schema.
  const valorSalvo = personalizada && tipo==='semanal'
    ? (personalizada.diasSemana.length ? personalizada.diasSemana : [(()=>{const d=camposSaoPaulo(inicioBase);return new Date(Date.UTC(d.ano,d.mes-1,d.dia)).getUTCDay()})()]).reduce((m,d)=>m|(1<<d),0)
    : valor
  await supabase.from('eventos').update({ recorrencia_tipo: tipo, recorrencia_valor: valorSalvo }).eq('id', base.id)

  const proximas = datas ? datas.slice(1).map(d=>new Date(d)) : gerarProximasOcorrencias(new Date(dados.data_inicio), tipo, valor)

  // Lote para não disparar uma requisição por dia na recorrência diária.
  if (personalizada && proximas.length) {
    const linhas=proximas.map(data=>({usuario_id:usuarioId,titulo:dados.titulo,descricao:dados.descricao||null,local:dados.local||null,data_inicio:data.toISOString(),data_fim:duracaoMs>0?new Date(data.getTime()+duracaoMs).toISOString():null,regra_origem_id:base.id}))
    const {data:novos,error}=await supabase.from('eventos').insert(linhas).select('id')
    if(error||!novos) {
      console.error('Erro ao gerar ocorrências de evento:',error)
      // Não informar sucesso se a série não foi gerada. Remover apenas a raiz recém-criada.
      await excluirEvento(base.id)
      return null
    }
    if(convidadosIds.length){
      const {error:erroConvites}=await supabase.from('evento_convidados').insert(novos.flatMap(n=>convidadosIds.map(usuario_id=>({evento_id:n.id,usuario_id}))))
      if(erroConvites)console.error('Erro ao convidar usuários da série:',erroConvites)
    }
    return {...base,recorrencia_tipo:tipo,recorrencia_valor:valorSalvo}
  }

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

  return { ...base, recorrencia_tipo: tipo, recorrencia_valor: valorSalvo }
}

/**
 * Conclusões individuais de eventos: o compromisso continua existindo para
 * organizador e convidados; apenas some das pendências daquele usuário.
 */
export async function listarConclusoesEventosUsuario(usuarioId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('evento_conclusoes_usuario')
    .select('evento_id, concluida_em')
    .eq('usuario_id', usuarioId)

  if (error) {
    console.error('Erro ao consultar conclusões pessoais da agenda:', error)
    return {}
  }

  return Object.fromEntries((data || []).map(item => [item.evento_id as string, item.concluida_em as string]))
}

export async function concluirEventoUsuario(eventoId: string, usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('evento_conclusoes_usuario')
    .insert({ evento_id: eventoId, usuario_id: usuarioId })
    .select('concluida_em')
    .single()

  if (!error && data) return data.concluida_em as string

  // Duas abas podem concluir o mesmo compromisso quase simultaneamente.
  if (error?.code === '23505') {
    const { data: existente, error: erroConsulta } = await supabase
      .from('evento_conclusoes_usuario')
      .select('concluida_em')
      .eq('evento_id', eventoId)
      .eq('usuario_id', usuarioId)
      .maybeSingle()
    if (!erroConsulta && existente) return existente.concluida_em as string
  }

  console.error('Erro ao concluir compromisso para o usuário:', error)
  return null
}

export async function reabrirEventoUsuario(eventoId: string, usuarioId: string): Promise<boolean> {
  const { error } = await supabase
    .from('evento_conclusoes_usuario')
    .delete()
    .eq('evento_id', eventoId)
    .eq('usuario_id', usuarioId)

  if (error) console.error('Erro ao reabrir compromisso para o usuário:', error)
  return !error
}
