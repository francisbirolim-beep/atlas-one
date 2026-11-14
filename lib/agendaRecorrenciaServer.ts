import 'server-only'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'
import {
  dataMaisDias, feriadosNacionaisFixos, horarioSaoPauloIso,
  proximaDataRecorrencia, type RegraAtlas, type FrequenciaAtlas, type TipoRegistroAtlas,
} from './agendaRecorrencia'

export interface RegraPersistida extends RegraAtlas {
  id: string
  empresa_id: string
  criador_id: string
  tipo_registro: TipoRegistroAtlas
  titulo: string
  descricao: string | null
  prioridade: string
  responsaveis_ids: string[]
  convidados_ids: string[]
  local: string | null
  duracao_minutos: number
  proxima_data: string
  ativo: boolean
  frequencia: FrequenciaAtlas
}

export async function feriadosEmpresa(empresaId: string, anos: number[]): Promise<Set<string>> {
  const feriados = new Set<string>()
  for (const ano of anos) for (const data of feriadosNacionaisFixos(ano)) feriados.add(data)
  if (anos.length === 0) return feriados
  const { data, error } = await supabaseAdmin.from('atlas_feriados').select('data')
    .eq('empresa_id', empresaId)
    .gte('data', String(Math.min(...anos)) + '-01-01')
    .lte('data', String(Math.max(...anos)) + '-12-31')
  if (error) throw error
  for (const feriado of data || []) feriados.add(feriado.data)
  return feriados
}

async function primeiraColuna(usuarioId: string, empresaId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('tarefa_colunas')
    .select('id').eq('empresa_id', empresaId).eq('usuario_id', usuarioId)
    .order('ordem').limit(1)
  if (error) throw error
  if (data?.[0]) return data[0].id
  const nomes = ['A fazer', 'Em andamento', 'Aguardando', 'Concluído']
  const { data: novas, error: erro } = await supabaseAdmin.from('tarefa_colunas')
    .insert(nomes.map((nome, ordem) => ({
      empresa_id: empresaId, usuario_id: usuarioId, nome, ordem,
    }))).select('id,ordem').order('ordem')
  if (erro || !novas?.[0]) throw erro || new Error('Não foi possível criar as colunas')
  return novas[0].id
}

async function materializarTarefa(regra: RegraPersistida, dia: string, grupoId: string) {
  const participantes = [...new Set([regra.criador_id, ...regra.responsaveis_ids])]
  if (!regra.responsaveis_ids.length || participantes.length > 20) throw new Error('Responsáveis inválidos na regra')
  const { data: pessoas, error: pessoasErro } = await supabaseAdmin.from('usuarios')
    .select('id,nome').eq('empresa_id', regra.empresa_id).in('id', participantes)
  if (pessoasErro || !pessoas || pessoas.length !== participantes.length) {
    throw pessoasErro || new Error('Um dos responsáveis saiu da empresa')
  }
  const nomeCriador = pessoas.find(p => p.id === regra.criador_id)?.nome || 'Usuário'
  const nomes = regra.responsaveis_ids.map(id => pessoas.find(p => p.id === id)?.nome || 'Usuário')
  const dataHora = horarioSaoPauloIso(dia, regra.hora_inicio)
  const rows = await Promise.all(participantes.map(async id => ({
    empresa_id: regra.empresa_id,
    usuario_id: id, coluna_id: await primeiraColuna(id, regra.empresa_id),
    titulo: regra.titulo, descricao: regra.descricao, data_hora: dataHora,
    prioridade: regra.prioridade, solicitante_id: regra.criador_id,
    solicitante_nome: nomeCriador,
    atribuida_em: id === regra.criador_id ? null : new Date().toISOString(),
    tarefa_grupo_id: participantes.length > 1 ? grupoId : null,
    responsaveis_nomes: nomes,
    recorrencia_regra_id: regra.id, recorrencia_data: dia,
  })))
  const { error } = await supabaseAdmin.from('tarefas').upsert(rows, {
    onConflict: 'recorrencia_regra_id,recorrencia_data,usuario_id', ignoreDuplicates: true,
  })
  if (error) throw error
}

async function materializarEvento(regra: RegraPersistida, dia: string) {
  const dataInicio = horarioSaoPauloIso(dia, regra.hora_inicio)
  const dataFim = new Date(new Date(dataInicio).getTime() + regra.duracao_minutos * 60_000).toISOString()
  const { data: existente, error: erroConsulta } = await supabaseAdmin.from('eventos').select('id')
    .eq('empresa_id', regra.empresa_id).eq('recorrencia_regra_id', regra.id)
    .eq('recorrencia_data', dia).maybeSingle()
  if (erroConsulta) throw erroConsulta
  let eventoId = existente?.id
  if (!eventoId) {
    const { data: criado, error } = await supabaseAdmin.from('eventos').insert({
      empresa_id: regra.empresa_id, usuario_id: regra.criador_id,
      titulo: regra.titulo, descricao: regra.descricao, local: regra.local,
      data_inicio: dataInicio, data_fim: dataFim,
      recorrencia_regra_id: regra.id, recorrencia_data: dia,
    }).select('id').single()
    if (error && error.code !== '23505') throw error
    eventoId = criado?.id
    if (!eventoId) {
      const { data: simultaneo, error: erro } = await supabaseAdmin.from('eventos')
        .select('id').eq('recorrencia_regra_id', regra.id).eq('recorrencia_data', dia).single()
      if (erro || !simultaneo) throw erro || new Error('Evento não encontrado após criação')
      eventoId = simultaneo.id
    }
  }
  const convidados = [...new Set(regra.convidados_ids)].filter(id => id !== regra.criador_id)
  if (convidados.length) {
    const { data: convites, error: erroConvites } = await supabaseAdmin.from('evento_convidados')
      .select('usuario_id').eq('evento_id', eventoId)
    if (erroConvites) throw erroConvites
    const existentes = new Set((convites || []).map(c => c.usuario_id))
    const pendentes = convidados.filter(id => !existentes.has(id))
    if (pendentes.length) {
      const { error } = await supabaseAdmin.from('evento_convidados')
        .insert(pendentes.map(usuario_id => ({
          empresa_id: regra.empresa_id, evento_id: eventoId, usuario_id,
        })))
      if (error && error.code !== '23505') throw error
    }
  }
}

export async function materializarRecorrencia(regra: RegraPersistida, dataLocal: string) {
  const { error: insertErro } = await supabaseAdmin.from('atlas_recorrencia_ocorrencias').upsert({
    recorrencia_id: regra.id, empresa_id: regra.empresa_id,
    data_local: dataLocal, status: 'pendente',
  }, { onConflict: 'recorrencia_id,data_local', ignoreDuplicates: true })
  if (insertErro) throw insertErro
  const { data: ocorrencia, error: erroConsulta } = await supabaseAdmin
    .from('atlas_recorrencia_ocorrencias').select('id,status')
    .eq('recorrencia_id', regra.id).eq('data_local', dataLocal).single()
  if (erroConsulta || !ocorrencia) throw erroConsulta || new Error('Ocorrência não localizada')

  if (ocorrencia.status !== 'criada') {
    if (regra.tipo_registro === 'tarefa') {
      // Reutiliza o grupo de uma execução parcial para não separar os participantes.
      const { data: existente, error: erroGrupo } = await supabaseAdmin.from('tarefas')
        .select('tarefa_grupo_id').eq('recorrencia_regra_id', regra.id)
        .eq('recorrencia_data', dataLocal).not('tarefa_grupo_id', 'is', null).limit(1)
      if (erroGrupo) throw erroGrupo
      await materializarTarefa(regra, dataLocal, existente?.[0]?.tarefa_grupo_id || randomUUID())
    } else {
      await materializarEvento(regra, dataLocal)
    }
    const { error } = await supabaseAdmin.from('atlas_recorrencia_ocorrencias')
      .update({ status: 'criada' }).eq('id', ocorrencia.id)
    if (error) throw error
  }

  const ano = Number(dataLocal.slice(0, 4))
  const feriados = await feriadosEmpresa(regra.empresa_id, [ano, ano + 1, ano + 2])
  const proxima = proximaDataRecorrencia(regra, dataMaisDias(dataLocal, 1), feriados)
  const { error: erroAvanco } = await supabaseAdmin.from('atlas_recorrencias')
    .update(proxima ? { proxima_data: proxima } : { ativo: false })
    .eq('id', regra.id).eq('proxima_data', dataLocal)
  if (erroAvanco) throw erroAvanco
  return proxima
}
