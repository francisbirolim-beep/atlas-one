import { NextRequest, NextResponse } from 'next/server'
import {
  verificarUsuario,
  executarFerramenta,
  obterOuCriarConversaHoje,
  criarConversaAgente,
  validarConversaAgente,
  salvarMensagem,
} from '@/lib/agente'
import { consultarOpenCode, statusOpenCode, type OpenCodeAnexo } from '@/lib/ai/opencode'
import { registrarUsoIA } from '@/lib/ai/auditoria'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const TAMANHO_MAX_BASE64 = 12_000_000

function normalizar(texto: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function tarefaResumida(texto: string) {
  const t = normalizar(texto)
  if (/orcamento|orcamentos|venda|vendas/.test(t)) return 'Consultando dados de orçamento e vendas'
  if (/cliente|clientes/.test(t)) return 'Consultando dados de clientes'
  if (/financeir|caixa|receber|pagar|custo/.test(t)) return 'Consultando dados financeiros'
  if (/estoque|produto|catalogo|perfil|acessorio/.test(t)) return 'Consultando produtos, catálogo e estoque'
  if (/producao|instalacao|obra|medicao|engenharia/.test(t)) return 'Consultando operação e andamento das obras'
  return 'Analisando uma pergunta na IA geral'
}

function dataLocalISO(valor: string | Date = new Date()) {
  const data = valor instanceof Date ? valor : new Date(valor)
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data)
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${mapa.year}-${mapa.month}-${mapa.day}`
}

function horarioLocal(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(valor))
}

function moeda(valor: unknown) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function extrairHistoricoTexto(historico: any[]) {
  if (!Array.isArray(historico)) return []
  return historico.slice(-10).map((m: any) => {
    if (typeof m?.content === 'string') return { role: m.role, content: m.content.slice(0, 4000) }
    if (Array.isArray(m?.content)) {
      const texto = m.content
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('\n')
        .slice(0, 4000)
      return texto ? { role: m.role, content: texto } : null
    }
    return null
  }).filter(Boolean)
}

async function montarContextoAtlas(texto: string, usuario: any) {
  const t = normalizar(texto)
  const contexto: Record<string, any> = {
    data_hoje: dataLocalISO(),
    timezone: 'America/Sao_Paulo',
  }

  if (/orcamento|orcamentos|venda|vendas/.test(t)) {
    const r: any = await executarFerramenta(
      'buscar_orcamentos',
      { limite: 50 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
    const lista = Array.isArray(r?.orcamentos) ? r.orcamentos : []
    const enriquecida = lista.map((o: any) => ({
      ...o,
      data_local: o.created_at ? dataLocalISO(o.created_at) : null,
      horario_local: o.created_at ? horarioLocal(o.created_at) : null,
    }))
    const hoje = enriquecida.filter((o: any) => o.data_local === contexto.data_hoje)
    contexto.orcamentos_recentes = enriquecida
    contexto.orcamentos_hoje = {
      quantidade: hoje.length,
      valor_total: hoje.reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0),
      itens: hoje,
    }
  }

  if (/cliente|clientes/.test(t)) {
    contexto.clientes = await executarFerramenta(
      'buscar_clientes',
      { limite: 50 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/financeir|caixa|receber|pagar|custo/.test(t)) {
    contexto.financeiro = await executarFerramenta(
      'buscar_financeiro',
      { tipo: 'ambos', limite: 30 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/assistencia|manutencao|pos venda/.test(t)) {
    contexto.assistencias = await executarFerramenta(
      'buscar_assistencias',
      { limite: 30 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/tarefa|tarefas/.test(t)) {
    contexto.tarefas = await executarFerramenta(
      'buscar_tarefas',
      { limite: 30 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/agenda|evento|eventos|calendario/.test(t)) {
    contexto.eventos = await executarFerramenta(
      'buscar_eventos',
      { limite: 30 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/perfil|acessorio|vidro|tipologia|linha|catalogo|produto/.test(t)) {
    contexto.base_tecnica = await executarFerramenta(
      'buscar_base_tecnica',
      { busca: texto, limite: 12 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  if (/producao|instalacao|obra|medicao|engenharia|procedimento|regra interna/.test(t)) {
    contexto.conhecimento_interno = await executarFerramenta(
      'buscar_conhecimento_especialistas',
      { busca: texto, limite: 10 },
      usuario.id,
      usuario.role,
      usuario.nome,
      usuario.empresa_id,
    )
  }

  return contexto
}

function respostaDiretaSemModelo(texto: string, contexto: any): string | null {
  const t = normalizar(texto)
  const hoje = contexto?.orcamentos_hoje
  if (!hoje || !/orcamento|orcamentos/.test(t) || !/hoje/.test(t)) return null

  const itens = Array.isArray(hoje.itens) ? hoje.itens : []
  const linhas = itens.map((o: any, i: number) => {
    const valor = Number(o.valor_estimado || 0)
    const valorTxt = valor > 0 ? ` (${moeda(valor)})` : ''
    return `${i + 1}. ${o.cliente_nome || 'Cliente a identificar'} — ${o.horario_local || 'sem horário'}${valorTxt}`
  })

  const cabecalho = `Hoje foram criados ${hoje.quantidade} orçamento(s) no Atlas.`
  if (!linhas.length) return cabecalho
  return cabecalho + '\n\n' + linhas.join('\n')
}

export async function POST(req: NextRequest) {
  let atividadeId: string | null = null
  try {
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const usuario = await verificarUsuario(authHeader)
    if (!usuario) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const mensagemTexto = String(body.mensagem || '').trim()
    const historico = Array.isArray(body.messages) ? body.messages : []
    const anexo = body.anexo && typeof body.anexo === 'object' ? body.anexo : null
    const conversaSolicitada = String(body.conversaId || '').trim()
    const forcarNovaConversa = body.novaConversa === true

    if (!mensagemTexto && !anexo) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }
    if (anexo && typeof anexo.dados === 'string' && anexo.dados.length > TAMANHO_MAX_BASE64) {
      return NextResponse.json({ error: 'Arquivo anexado muito grande' }, { status: 400 })
    }

    const { data: atividade } = await supabaseAdmin.from('ia_agente_atividade').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome || null,
      agente_id: 'supervisor',
      agente_nome: 'Supervisor IA',
      contexto: 'atlas_ia_geral',
      tarefa: tarefaResumida(mensagemTexto),
      status: 'processando',
      atualizou_em: new Date().toISOString(),
      detalhe: { possui_anexo: Boolean(anexo), motor: 'opencode_freellmapi' },
    }).select('id').single()
    atividadeId = atividade?.id || null

    let conversaId: string
    if (conversaSolicitada) {
      const validada = await validarConversaAgente(conversaSolicitada, usuario.id, usuario.empresa_id)
      if (!validada) return NextResponse.json({ error: 'Conversa não encontrada para este usuário.' }, { status: 404 })
      conversaId = validada
    } else if (forcarNovaConversa) {
      conversaId = await criarConversaAgente(usuario.id, usuario.empresa_id)
    } else {
      conversaId = await obterOuCriarConversaHoje(usuario.id, usuario.empresa_id)
    }

    let textoParaSalvar = mensagemTexto
    if (anexo) textoParaSalvar = (mensagemTexto ? mensagemTexto + '\n\n' : '') + '[Anexo: ' + (anexo.nome || 'arquivo') + ']'
    await salvarMensagem(conversaId, 'user', textoParaSalvar)

    const contexto = await montarContextoAtlas(mensagemTexto, usuario)
    const direta = respostaDiretaSemModelo(mensagemTexto, contexto)

    let resposta = direta || ''
    let providerId = direta ? 'atlas-interno' : 'freellmapi'
    let modelId = direta ? 'consulta-direta' : 'free-router'

    if (!direta) {
      const status = await statusOpenCode()
      if (!status.configurado) {
        throw new Error('Gateway gratuito OpenCode/FreeLLMAPI indisponível. Nenhum provedor pago foi acionado.')
      }

      const anexos: OpenCodeAnexo[] = []
      let complementoAnexo = ''
      if (anexo?.tipo === 'imagem' && anexo?.dados) {
        anexos.push({
          nome: String(anexo.nome || 'imagem'),
          mediaType: String(anexo.mediaType || 'image/png'),
          dados: String(anexo.dados),
        })
      } else if (anexo?.tipo === 'texto' && anexo?.dados) {
        complementoAnexo = '\n\nCONTEÚDO DO ANEXO:\n' + String(anexo.dados).slice(0, 30000)
      } else if (anexo?.tipo === 'pdf') {
        complementoAnexo = '\n\nOBSERVAÇÃO: há um PDF anexado. Este motor gratuito não deve inventar conteúdo do PDF se ele não estiver no contexto textual.'
      }

      const system = [
        'Você é a IA Geral do Atlas One, sistema interno da Esquadrifácio.',
        'Responda em português do Brasil, de forma direta e objetiva.',
        'Para dados internos, use SOMENTE o CONTEXTO ATLAS fornecido. Nunca invente valores, nomes, datas, status ou quantidades.',
        'Os valores monetários no contexto já vêm do banco do Atlas. Não divida, multiplique ou reinterprete casas decimais.',
        'Quando o contexto trouxer resumo calculado pelo Atlas, trate esse resumo como fonte principal.',
        'Se um dado interno não estiver presente ou vier com erro de permissão, informe isso claramente.',
        'Não afirme que criou, alterou, excluiu ou aprovou registros. Ações no Atlas exigem confirmação específica pela interface.',
        'Este fluxo usa OpenCode + FreeLLMAPI e NÃO pode fazer fallback para Anthropic, OpenAI ou qualquer provedor pago.',
      ].join('\n')

      const prompt = [
        'CONTEXTO ATLAS:',
        JSON.stringify(contexto),
        '',
        'HISTÓRICO RESUMIDO:',
        JSON.stringify(extrairHistoricoTexto(historico)),
        '',
        'PERGUNTA DO USUÁRIO:',
        mensagemTexto || 'Analise o anexo.',
        complementoAnexo,
      ].join('\n')

      const inicio = Date.now()
      const resultado = await consultarOpenCode({
        accessToken,
        tituloSessao: `Atlas IA - ${usuario.nome || usuario.id}`,
        system,
        prompt,
        anexos,
      })
      resposta = resultado.resposta
      providerId = resultado.providerId
      modelId = resultado.modelId

      await registrarUsoIA({
        agenteId: null,
        agenteNome: 'Atlas IA gratuita',
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        empresa: 'Atlas One',
        setorId: null,
        provider: providerId || 'freellmapi',
        modelo: modelId || 'free-router',
        passos: 1,
        sucesso: true,
        tokensEntrada: null,
        tokensSaida: null,
        custoEstimado: 0,
        duracaoMs: Date.now() - inicio,
        fallbackPolicy: 'free_only_no_paid_fallback',
      })
    } else {
      await registrarUsoIA({
        agenteId: null,
        agenteNome: 'Atlas IA consulta interna direta',
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        empresa: 'Atlas One',
        setorId: null,
        provider: 'atlas-interno',
        modelo: 'consulta-direta',
        passos: 0,
        sucesso: true,
        custoEstimado: 0,
        duracaoMs: 0,
        fallbackPolicy: 'internal_direct_zero_cost',
      })
    }

    await salvarMensagem(conversaId, 'assistant', resposta)

    if (atividadeId) {
      await supabaseAdmin.from('ia_agente_atividade').update({
        status: 'concluido',
        atualizou_em: new Date().toISOString(),
        finalizou_em: new Date().toISOString(),
        detalhe: { motor: providerId, modelo: modelId, custo_estimado: 0 },
      }).eq('id', atividadeId)
    }

    const messages = [
      ...historico,
      { role: 'user', content: mensagemTexto },
      { role: 'assistant', content: [{ type: 'text', text: resposta }] },
    ]

    return NextResponse.json({
      text: resposta,
      done: true,
      pendingAction: null,
      messages,
      conversaId,
      provider: providerId,
      modelo: modelId,
      custoEstimado: 0,
    })
  } catch (e: any) {
    if (atividadeId) {
      await supabaseAdmin.from('ia_agente_atividade').update({
        status: 'erro',
        atualizou_em: new Date().toISOString(),
        finalizou_em: new Date().toISOString(),
        detalhe: {
          erro: String(e && e.message ? e.message : e).slice(0, 500),
          fallback_pago: false,
        },
      }).eq('id', atividadeId)
    }
    return NextResponse.json({
      error: 'Erro na IA gratuita do Atlas: ' + String(e && e.message ? e.message : e),
      paidFallbackUsed: false,
    }, { status: 500 })
  }
}
