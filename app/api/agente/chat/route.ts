import { NextRequest, NextResponse } from 'next/server'
import {
  verificarUsuario,
  executarFerramenta,
  obterOuCriarConversaHoje,
  criarConversaAgente,
  validarConversaAgente,
  salvarMensagem,
} from '@/lib/agente'
import { consultarOpenCode, type OpenCodeAnexo } from '@/lib/ai/opencode'
import { registrarUsoIA } from '@/lib/ai/auditoria'
import { compararListasItens, extrairItensComparacao, extrairTextoDeAnexo } from '@/lib/ai/documentoComparador'
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

function perguntaEfetiva(textoAtual: string, historico: any[]) {
  const atual = normalizar(textoAtual).trim()
  const ehReferenciaInterna = /^(esta|essa|aquela)?\s*(pergunta\s+)?(e|eh|é)?\s*(uma\s+)?(pergunta\s+)?interna[.!? ]*$/.test(atual)
    || /^(isso|isto)\s+(e|eh|é)\s+intern[oa][.!? ]*$/.test(atual)
  if (!ehReferenciaInterna) return textoAtual

  const anteriores = extrairHistoricoTexto(historico)
    .filter((m: any) => m?.role === 'user' && String(m?.content || '').trim())
    .map((m: any) => String(m.content).trim())
    .filter((v: string) => normalizar(v) !== atual)

  return anteriores.at(-1) || textoAtual
}

function statusEmAberto(status: unknown) {
  const s = normalizar(String(status || ''))
  return !/(pago|quitado|cancelado|cancelada|baixado|baixa total|recebido)/.test(s)
}

function dataVencimentoLocal(valor: unknown) {
  if (!valor) return null
  try { return dataLocalISO(String(valor)) } catch { return null }
}

function linhaContaPagar(c: any, i: number) {
  const pago = Number(c?.valor_pago || 0)
  const valor = Number(c?.valor || 0)
  const saldo = Math.max(0, valor - pago)
  const detalhe = c?.descricao || c?.documento || 'Sem descrição'
  return `${i + 1}. ${c?.fornecedor_nome || 'Fornecedor não informado'} — ${detalhe} — ${moeda(saldo || valor)} — ${c?.status || 'sem status'}`
}

function linhaContaReceber(c: any, i: number) {
  const pago = Number(c?.valor_pago || 0)
  const valor = Number(c?.valor || 0)
  const saldo = Math.max(0, valor - pago)
  const detalhe = c?.documento || (c?.parcela ? 'Parcela ' + c.parcela : 'Sem documento')
  return `${i + 1}. ${c?.cliente_nome || 'Cliente não informado'} — ${detalhe} — ${moeda(saldo || valor)} — ${c?.status || 'sem status'}`
}

async function contarCadastroTecnico(texto: string, usuario: any) {
  const t = normalizar(texto)
  const pedeContagem = /quantos|quantas|quantidade|total|numero/.test(t)
  if (!pedeContagem || !usuario?.empresa_id) return null

  let categoria: string | null = null
  let rotulo = ''
  if (/\bperfil|\bperfis/.test(t)) {
    categoria = 'perfil'
    rotulo = 'perfis'
  } else if (/acessorio|acessorios/.test(t)) {
    categoria = 'acessorio'
    rotulo = 'acessórios'
  } else if (/produto|produtos|cadastro tecnico|base tecnica/.test(t)) {
    categoria = null
    rotulo = 'produtos'
  } else {
    return null
  }

  let qTotal = supabaseAdmin
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', usuario.empresa_id)
  let qAtivos = supabaseAdmin
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', usuario.empresa_id)
    .eq('ativo', true)

  if (categoria) {
    qTotal = qTotal.eq('categoria', categoria)
    qAtivos = qAtivos.eq('categoria', categoria)
  }

  const [totalResp, ativosResp] = await Promise.all([qTotal, qAtivos])
  if (totalResp.error) return { erro: totalResp.error.message, rotulo, categoria }
  if (ativosResp.error) return { erro: ativosResp.error.message, rotulo, categoria }

  return {
    rotulo,
    categoria,
    total: Number(totalResp.count || 0),
    ativos: Number(ativosResp.count || 0),
  }
}

async function montarContextoAtlas(texto: string, usuario: any) {
  const t = normalizar(texto)
  const contexto: Record<string, any> = {
    data_hoje: dataLocalISO(),
    timezone: 'America/Sao_Paulo',
  }

  const contagemCadastro = await contarCadastroTecnico(texto, usuario)
  if (contagemCadastro) contexto.contagem_cadastro_tecnico = contagemCadastro

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

function respostaDiretaSemModelo(texto: string, contexto: any, usuario?: any): string | null {
  const t = normalizar(texto).trim()

  if (/^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|tudo bem|blz|beleza)[!?. ]*$/.test(t)) {
    const primeiroNome = String(usuario?.nome || '').trim().split(/\s+/)[0]
    const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'
    return saudacao + ' Estou online no Atlas. Posso consultar orçamentos, clientes, tarefas, eventos, financeiro, produtos e informações da operação.'
  }

  if (/(vou|quero|irei).*(mandar|enviar|anexar).*(duas|2).*(coisa|arquivo|pedido|cotacao|documento)|((comparar|conferir|analisar).*(pedido|fornecedor|cotacao))/.test(t)) {
    return 'Pode mandar os dois materiais. Envie primeiro o pedido/original e depois o retorno ou cotação do fornecedor. Eu vou conferir item por item, quantidade, código/descrição, cor, valores quando houver e destacar qualquer divergência.'
  }

  if (/^(obrigado|obrigada|valeu|vlw|show|perfeito|ok|certo)[!?. ]*$/.test(t)) {
    return 'Disponha. Pode mandar a próxima consulta.'
  }

  const contagemCadastro = contexto?.contagem_cadastro_tecnico
  if (contagemCadastro) {
    if (contagemCadastro.erro) {
      return 'Não consegui consultar a contagem do cadastro técnico agora: ' + String(contagemCadastro.erro)
    }
    const total = Number(contagemCadastro.total || 0)
    const ativos = Number(contagemCadastro.ativos || 0)
    const rotulo = String(contagemCadastro.rotulo || 'itens')
    if (total === ativos) {
      return 'Temos ' + new Intl.NumberFormat('pt-BR').format(total) + ' ' + rotulo + ' cadastrados no banco de dados do Atlas, todos ativos.'
    }
    return 'Temos ' + new Intl.NumberFormat('pt-BR').format(total) + ' ' + rotulo + ' cadastrados no banco de dados do Atlas. Destes, ' + new Intl.NumberFormat('pt-BR').format(ativos) + ' estão ativos.'
  }

  const financeiro = contexto?.financeiro
  const querFinanceiro = /financeir|conta|contas|pagar|receber|vencid|atrasad/.test(t)
  if (querFinanceiro && financeiro?.erro) {
    return String(financeiro.erro).toLowerCase().includes('acesso negado')
      ? 'Esta é uma consulta interna do Financeiro, mas seu usuário não possui permissão para visualizar esses dados.'
      : 'Não consegui consultar o Financeiro agora: ' + String(financeiro.erro)
  }

  if (querFinanceiro && /pagar/.test(t)) {
    const bruto = financeiro?.contas_pagar
    if (bruto?.erro) {
      return String(bruto.erro).toLowerCase().includes('acesso negado')
        ? 'Esta é uma consulta interna de contas a pagar, mas seu usuário não possui permissão para visualizar esses dados.'
        : 'Não consegui consultar as contas a pagar agora: ' + String(bruto.erro)
    }
    const todas = Array.isArray(bruto) ? bruto : []
    let lista = todas.filter((c: any) => statusEmAberto(c?.status))
    let titulo = 'Contas a pagar em aberto'
    if (/hoje/.test(t)) {
      lista = lista.filter((c: any) => dataVencimentoLocal(c?.vencimento) === contexto?.data_hoje)
      titulo = 'Contas a pagar com vencimento hoje'
    } else if (/vencid|atrasad/.test(t)) {
      lista = lista.filter((c: any) => {
        const d = dataVencimentoLocal(c?.vencimento)
        return Boolean(d && contexto?.data_hoje && d < contexto.data_hoje)
      })
      titulo = 'Contas a pagar vencidas'
    }
    const total = lista.reduce((s: number, c: any) => s + Math.max(0, Number(c?.valor || 0) - Number(c?.valor_pago || 0)), 0)
    if (!lista.length) return titulo + ': nenhuma conta encontrada.'
    return titulo + ': ' + lista.length + ' conta(s), total em aberto de ' + moeda(total) + '.\n\n' + lista.slice(0, 30).map(linhaContaPagar).join('\n')
  }

  if (querFinanceiro && /receber/.test(t)) {
    const bruto = financeiro?.contas_receber
    if (bruto?.erro) {
      return String(bruto.erro).toLowerCase().includes('acesso negado')
        ? 'Esta é uma consulta interna de contas a receber, mas seu usuário não possui permissão para visualizar esses dados.'
        : 'Não consegui consultar as contas a receber agora: ' + String(bruto.erro)
    }
    const todas = Array.isArray(bruto) ? bruto : []
    let lista = todas.filter((c: any) => statusEmAberto(c?.status))
    let titulo = 'Contas a receber em aberto'
    if (/hoje/.test(t)) {
      lista = lista.filter((c: any) => dataVencimentoLocal(c?.vencimento) === contexto?.data_hoje)
      titulo = 'Contas a receber com vencimento hoje'
    } else if (/vencid|atrasad/.test(t)) {
      lista = lista.filter((c: any) => {
        const d = dataVencimentoLocal(c?.vencimento)
        return Boolean(d && contexto?.data_hoje && d < contexto.data_hoje)
      })
      titulo = 'Contas a receber vencidas'
    }
    const total = lista.reduce((s: number, c: any) => s + Math.max(0, Number(c?.valor || 0) - Number(c?.valor_pago || 0)), 0)
    if (!lista.length) return titulo + ': nenhuma conta encontrada.'
    return titulo + ': ' + lista.length + ' conta(s), total em aberto de ' + moeda(total) + '.\n\n' + lista.slice(0, 30).map(linhaContaReceber).join('\n')
  }

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

function itensReferenciaHistorico(historico: any[]) {
  const anteriores = extrairHistoricoTexto(historico)
    .filter((m: any) => m?.role === 'user')
    .map((m: any) => ({
      texto: String(m?.content || ''),
      itens: extrairItensComparacao(String(m?.content || '')),
    }))
    .filter((x: any) => x.itens.length >= 2)

  return anteriores.at(-1)?.itens || []
}

function respostaDocumentoSemModelo(texto: string, historico: any[], textoAnexo: string) {
  const itensMensagem = extrairItensComparacao(texto)
  const itensAnexo = extrairItensComparacao(textoAnexo)
  const itensHistorico = itensReferenciaHistorico(historico)

  if (itensAnexo.length >= 1) {
    const referencia = itensMensagem.length >= 2 ? itensMensagem : itensHistorico
    if (referencia.length >= 2) {
      return compararListasItens(referencia, itensAnexo)
    }
  }

  if (itensMensagem.length >= 2 && itensHistorico.length >= 2) {
    return compararListasItens(itensHistorico, itensMensagem)
  }

  if (itensMensagem.length >= 2) {
    const total = itensMensagem.reduce((s, i) => s + i.quantidade, 0)
    return 'Recebi o pedido e identifiquei ' + itensMensagem.length + ' código(s), totalizando ' + total + ' unidade(s). Envie agora o material do fornecedor (PDF, texto ou lista) que eu confiro item por item.'
  }

  return null
}

function respostaQuandoRuntimeIndisponivel(texto: string, contexto: any, usuario?: any) {
  const direta = respostaDiretaSemModelo(texto, contexto, usuario)
  if (direta) return direta

  return [
    'O motor conversacional gratuito está temporariamente indisponível, mas o Atlas continua online.',
    'As consultas internas diretas continuam funcionando sem custo.',
    'Tente uma pergunta objetiva sobre orçamentos, clientes, tarefas, eventos, financeiro, produtos ou operação.',
  ].join(' ')
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
    const mensagemConsulta = perguntaEfetiva(mensagemTexto, historico)
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
      tarefa: tarefaResumida(mensagemConsulta),
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

    const textoAnexo = await extrairTextoDeAnexo(anexo)
    const contexto = await montarContextoAtlas(mensagemConsulta, usuario)
    const diretaDocumento = respostaDocumentoSemModelo(mensagemConsulta, historico, textoAnexo)
    const direta = diretaDocumento || respostaDiretaSemModelo(mensagemConsulta, contexto, usuario)

    let resposta = direta || ''
    let providerId = direta ? 'atlas-interno' : 'freellmapi'
    let modelId = direta ? 'consulta-direta' : 'free-router'

    if (!direta) {
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
        complementoAnexo = textoAnexo
          ? '\n\nTEXTO EXTRAÍDO DO PDF:\n' + textoAnexo.slice(0, 30000)
          : '\n\nOBSERVAÇÃO: há um PDF anexado, mas não foi possível extrair texto dele.'
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
        mensagemConsulta || 'Analise o anexo.',
        complementoAnexo,
      ].join('\n')

      const inicio = Date.now()
      try {
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
      } catch (runtimeErro: any) {
        resposta = respostaQuandoRuntimeIndisponivel(mensagemConsulta, contexto, usuario)
        providerId = 'atlas-interno'
        modelId = 'fallback-runtime-gratuito'

        await registrarUsoIA({
          agenteId: null,
          agenteNome: 'Atlas IA fallback interno',
          usuarioId: usuario.id,
          usuarioNome: usuario.nome,
          empresa: 'Atlas One',
          setorId: null,
          provider: providerId,
          modelo: modelId,
          passos: 0,
          sucesso: true,
          erro: String(runtimeErro?.message || runtimeErro || '').slice(0, 500),
          custoEstimado: 0,
          duracaoMs: Date.now() - inicio,
          fallbackPolicy: 'internal_fallback_zero_cost',
        })
      }
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
