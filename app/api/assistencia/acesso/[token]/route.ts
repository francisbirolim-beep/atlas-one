import { NextRequest, NextResponse } from 'next/server'
import { carregarDadosExternosAssistencia, buscarAcessoValidoAssistencia } from '@/lib/assistenciaAcessoExternoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function texto(valor: unknown, limite = 10000) {
  return String(valor || '').trim().slice(0, limite)
}

function assinatura(valor: unknown) {
  const conteudo = String(valor || '')
  if (!conteudo.startsWith('data:image/png;base64,')) return ''
  return conteudo.slice(0, 500000)
}

function numeroFinito(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function gpsDoBody(valor: unknown) {
  if (!valor || typeof valor !== 'object') return null
  const bruto = valor as Record<string, unknown>
  const latitude = numeroFinito(bruto.latitude)
  const longitude = numeroFinito(bruto.longitude)
  const precisao = numeroFinito(bruto.precisao)
  if (latitude === null || longitude === null) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return {
    latitude,
    longitude,
    precisao: precisao !== null && precisao >= 0 ? precisao : null,
  }
}

function normalizarNome(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

async function colunaPorFinalidade(finalidade: 'andamento' | 'resolvido', empresaId: string) {
  const { data } = await supabaseAdmin
    .from('assistencia_colunas')
    .select('id, nome, ordem')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })

  const colunas = data || []
  if (!colunas.length) return null

  if (finalidade === 'andamento') {
    return colunas.find(c => {
      const nome = normalizarNome(c.nome || '')
      return nome.includes('atend') || nome.includes('andamento') || nome.includes('execucao')
    }) || colunas[Math.min(1, colunas.length - 1)]
  }

  return colunas.find(c => {
    const nome = normalizarNome(c.nome || '')
    return nome.includes('resolv') || nome.includes('conclu') || nome.includes('finaliz')
  }) || colunas[colunas.length - 1]
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const dados = await carregarDadosExternosAssistencia(params.token)
  if (!dados) {
    return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })
  }
  return NextResponse.json(dados)
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoAssistencia(params.token)
  if (!acesso) {
    return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const acao = texto(body?.acao, 20) || 'concluir'
  const tecnicoNome = texto(body?.tecnicoNome, 180) || acesso.nome_tecnico || ''
  const dataAtendimento = texto(body?.dataAtendimento, 10)
  const gps = gpsDoBody(body?.gps)

  if (!tecnicoNome) {
    return NextResponse.json({ error: 'Informe o nome do tecnico.' }, { status: 400 })
  }

  const { data: assistenciaAtual, error: erroAtual } = await supabaseAdmin
    .from('assistencias')
    .select('id, atendimento_iniciado_em, atendimento_concluido_em, gps_inicio_capturado_em, gps_fim_capturado_em')
    .eq('id', acesso.assistencia_id)
    .eq('empresa_id', acesso.empresa_id)
    .maybeSingle()

  if (erroAtual || !assistenciaAtual) {
    return NextResponse.json({ error: 'Assistencia nao encontrada.' }, { status: 404 })
  }

  const agora = new Date().toISOString()

  if (acao === 'iniciar') {
    if (assistenciaAtual.atendimento_concluido_em) {
      return NextResponse.json({ error: 'Esta assistencia ja foi concluida.' }, { status: 409 })
    }

    if (assistenciaAtual.atendimento_iniciado_em) {
      return NextResponse.json({
        ok: true,
        jaIniciada: true,
        iniciadoEm: assistenciaAtual.atendimento_iniciado_em,
      })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento)) {
      return NextResponse.json({ error: 'Informe a data do atendimento.' }, { status: 400 })
    }

    const coluna = await colunaPorFinalidade('andamento', acesso.empresa_id)
    const atualizacao: Record<string, unknown> = {
      tecnico_nome: tecnicoNome,
      data_atendimento: dataAtendimento,
      atendimento_iniciado_em: agora,
      status: 'em_atendimento',
      atualizado_em: agora,
      coluna_atualizada_em: agora,
    }
    if (coluna?.id) atualizacao.coluna_id = coluna.id
    if (gps) {
      atualizacao.gps_inicio_latitude = gps.latitude
      atualizacao.gps_inicio_longitude = gps.longitude
      atualizacao.gps_inicio_precisao_m = gps.precisao
      atualizacao.gps_inicio_capturado_em = agora
    }

    const { error } = await supabaseAdmin
      .from('assistencias')
      .update(atualizacao)
      .eq('id', acesso.assistencia_id)
      .eq('empresa_id', acesso.empresa_id)

    if (error) {
      return NextResponse.json({ error: 'Nao foi possivel iniciar a assistencia.' }, { status: 500 })
    }

    await supabaseAdmin
      .from('assistencia_acessos_externos')
      .update({ ultimo_acesso_em: agora })
      .eq('id', acesso.id)
      .eq('empresa_id', acesso.empresa_id)

    return NextResponse.json({
      ok: true,
      iniciadoEm: agora,
      etapa: coluna?.nome || 'Em atendimento',
      gpsRegistrado: Boolean(gps),
      precisaoGps: gps?.precisao ?? null,
    })
  }

  if (acao !== 'concluir') {
    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
  }

  const servicoRealizado = texto(body?.servicoRealizado)
  const materiaisUtilizados = texto(body?.materiaisUtilizados)
  const observacoesAtendimento = texto(body?.observacoesAtendimento)
  const assinaturaTecnico = assinatura(body?.assinaturaTecnico)
  const assinaturaCliente = assinatura(body?.assinaturaCliente)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento)) {
    return NextResponse.json({ error: 'Informe a data do atendimento.' }, { status: 400 })
  }
  if (!assinaturaTecnico || !assinaturaCliente) {
    return NextResponse.json({ error: 'As assinaturas do tecnico e do cliente sao obrigatorias para concluir.' }, { status: 400 })
  }

  const iniciadoEm = assistenciaAtual.atendimento_iniciado_em || agora
  const concluidoEm = assistenciaAtual.atendimento_concluido_em || agora
  const duracaoSegundos = Math.max(0, Math.round((new Date(concluidoEm).getTime() - new Date(iniciadoEm).getTime()) / 1000))
  const coluna = await colunaPorFinalidade('resolvido', acesso.empresa_id)

  const atualizacao: Record<string, unknown> = {
    tecnico_nome: tecnicoNome,
    data_atendimento: dataAtendimento,
    servico_realizado: servicoRealizado || null,
    materiais_utilizados: materiaisUtilizados || null,
    observacoes_atendimento: observacoesAtendimento || null,
    assinatura_tecnico: assinaturaTecnico,
    assinatura_cliente: assinaturaCliente,
    atendimento_iniciado_em: iniciadoEm,
    atendimento_concluido_em: concluidoEm,
    duracao_atendimento_segundos: duracaoSegundos,
    status: 'resolvido',
    atualizado_em: agora,
    coluna_atualizada_em: agora,
  }
  if (coluna?.id) atualizacao.coluna_id = coluna.id
  if (gps && !assistenciaAtual.gps_fim_capturado_em) {
    atualizacao.gps_fim_latitude = gps.latitude
    atualizacao.gps_fim_longitude = gps.longitude
    atualizacao.gps_fim_precisao_m = gps.precisao
    atualizacao.gps_fim_capturado_em = agora
  }

  const { error } = await supabaseAdmin
    .from('assistencias')
    .update(atualizacao)
    .eq('id', acesso.assistencia_id)
    .eq('empresa_id', acesso.empresa_id)

  if (error) {
    return NextResponse.json({ error: 'Nao foi possivel salvar o atendimento.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('assistencia_acessos_externos')
    .update({ ultimo_acesso_em: agora })
    .eq('id', acesso.id)
    .eq('empresa_id', acesso.empresa_id)

  return NextResponse.json({
    ok: true,
    concluidoEm,
    duracaoSegundos,
    etapa: coluna?.nome || 'Resolvido',
    gpsRegistrado: Boolean(gps),
  })
}
