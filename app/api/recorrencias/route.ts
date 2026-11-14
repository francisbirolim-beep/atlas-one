import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { diaSemana, ehDiaValido, proximaDataRecorrencia, type FrequenciaAtlas } from '@/lib/agendaRecorrencia'
import { feriadosEmpresa, materializarRecorrencia, type RegraPersistida } from '@/lib/agendaRecorrenciaServer'

const FREQUENCIAS = new Set(['diaria', 'semanal', 'mensal', 'dia_util_mes', 'anual'])
const PRIORIDADES = new Set(['baixa','normal','alta','urgente'])

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'').trim()
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { data: auth, error: authErro } = await supabaseAdmin.auth.getUser(token)
    if (authErro || !auth.user) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    const { data: usuario, error: perfilErro } = await supabaseAdmin.from('usuarios')
      .select('id,nome,empresa_id').eq('id', auth.user.id).single()
    if (perfilErro || !usuario?.empresa_id) return NextResponse.json({ error: 'Usuário sem empresa' }, { status: 403 })

    const body = await req.json()
    const tipoRegistro = body.tipoRegistro === 'agenda' ? 'agenda' : 'tarefa'
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''
    const baseData = typeof body.baseData === 'string' ? body.baseData : ''
    const horaInicio = typeof body.horaInicio === 'string' ? body.horaInicio : ''
    const frequencia = body.frequencia as FrequenciaAtlas
    const ateData = typeof body.ateData === 'string' && body.ateData ? body.ateData : null
    const prioridades = PRIORIDADES.has(body.prioridade) ? body.prioridade : 'normal'
    const responsaveisIds = [...new Set((Array.isArray(body.responsaveisIds) ? body.responsaveisIds : [])
      .filter((id: unknown): id is string => typeof id === 'string'))] as string[]
    const convidadosIds = [...new Set((Array.isArray(body.convidadosIds) ? body.convidadosIds : [])
      .filter((id: unknown): id is string => typeof id === 'string'))] as string[]
    const diasSemana = (Array.isArray(body.diasSemana) ? body.diasSemana : [])
      .filter((d: unknown): d is number => Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6)
    const diaMes = Number(body.diaMes) || Number(baseData.slice(-2))
    const nDiaUtil = Number(body.nDiaUtil) || 5
    const duracaoMinutos = Number(body.duracaoMinutos) || 60

    if (!titulo || titulo.length > 300 || descricao.length > 3000 ||
        !ehDiaValido(baseData) || !/^\d{2}:\d{2}$/.test(horaInicio) ||
        Number(horaInicio.slice(0,2)) > 23 || Number(horaInicio.slice(3)) > 59 ||
        !FREQUENCIAS.has(frequencia) || (ateData !== null && (!ehDiaValido(ateData) || ateData < baseData))) {
      return NextResponse.json({ error: 'Confira título, data, horário e repetição' }, { status: 400 })
    }
    if (diasSemana.length > 7 || diaMes < 1 || diaMes > 31 || nDiaUtil < 1 || nDiaUtil > 23 ||
        !Number.isInteger(duracaoMinutos) || duracaoMinutos < 1 || duracaoMinutos > 1440) {
      return NextResponse.json({ error: 'Parâmetros de recorrência inválidos' }, { status: 400 })
    }
    if (tipoRegistro === 'tarefa' && (responsaveisIds.length < 1 || responsaveisIds.length > 20)) {
      return NextResponse.json({ error: 'Selecione de 1 a 20 responsáveis' }, { status: 400 })
    }
    if (convidadosIds.length > 20) {
      return NextResponse.json({ error: 'Limite de 20 convidados por compromisso' }, { status: 400 })
    }

    const ids = [...new Set([usuario.id, ...responsaveisIds, ...convidadosIds])]
    const { data: pessoas, error: pessoasErro } = await supabaseAdmin.from('usuarios')
      .select('id').eq('empresa_id', usuario.empresa_id).in('id', ids)
    if (pessoasErro || !pessoas || pessoas.length !== ids.length) {
      return NextResponse.json({ error: 'Um dos participantes não pertence à empresa' }, { status: 403 })
    }

    const feriados = await feriadosEmpresa(usuario.empresa_id,
      [Number(baseData.slice(0,4)), Number(baseData.slice(0,4)) + 1, Number(baseData.slice(0,4)) + 2])
    const primeira = proximaDataRecorrencia({
      empresa_id: usuario.empresa_id, base_data: baseData, hora_inicio: horaInicio,
      frequencia, dias_semana: diasSemana.length ? diasSemana : [diaSemana(baseData)],
      dia_mes: diaMes, n_dia_util: nDiaUtil, ate_data: ateData,
    }, baseData, feriados)
    if (!primeira) return NextResponse.json({ error: 'Não existe data para essa repetição no período escolhido' }, { status: 400 })

    const { data: regra, error } = await supabaseAdmin.from('atlas_recorrencias').insert({
      empresa_id: usuario.empresa_id, criador_id: usuario.id,
      tipo_registro: tipoRegistro, titulo, descricao: descricao || null,
      prioridade: prioridades, responsaveis_ids: responsaveisIds,
      convidados_ids: convidadosIds.filter(id => id !== usuario.id),
      local: typeof body.local === 'string' ? body.local.trim().slice(0,300) : null,
      base_data: baseData, hora_inicio: horaInicio,
      duracao_minutos: duracaoMinutos, frequencia,
      dias_semana: diasSemana.length ? diasSemana : [diaSemana(baseData)],
      dia_mes: diaMes, n_dia_util: nDiaUtil,
      proxima_data: primeira, ate_data: ateData,
    }).select('*').single()
    if (error || !regra) throw error || new Error('Não foi possível salvar a regra')

    try {
      const proxima = await materializarRecorrencia(regra as RegraPersistida, primeira)
      return NextResponse.json({ ok: true, regraId: regra.id, primeira, proxima })
    } catch (erro) {
      console.error('A regra foi salva, mas a ocorrência ficará pendente:', erro)
      return NextResponse.json({
        ok: true, regraId: regra.id, primeira,
        aviso: 'A regra foi salva, mas a primeira ocorrência ainda não foi gerada. O processamento automático tentará novamente.',
      }, { status: 202 })
    }
  } catch (e) {
    console.error('Erro ao cadastrar recorrência:', e)
    return NextResponse.json({ error: 'Não foi possível cadastrar a repetição' }, { status: 500 })
  }
}
