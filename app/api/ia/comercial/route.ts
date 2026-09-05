import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type UsuarioMin = { id: string; nome?: string | null; role?: string | null; empresa_id: string }

function extrairTextoResposta(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  const partes: string[] = []
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue
    for (const c of item?.content || []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') partes.push(c.text)
    }
  }
  return partes.join('\n').trim()
}

function resumirOrcamento(o: any) {
  return {
    id: o.id,
    cliente: o.cliente_nome,
    cidade: o.cidade,
    temperatura: o.temperatura,
    acabamento: o.acabamento,
    contramarco: o.contramarco,
    tipo_medida: o.tipo_medida,
    valor: o.valor_estimado,
    status: o.status,
    vendedor: o.criado_por_nome,
    criado_em: o.created_at,
    itens: Array.isArray(o.itens)
      ? o.itens.slice(0, 20).map((i: any) => ({
          ambiente: i.ambiente,
          tipo: i.tipo_outro_texto || i.tipo_esquadria,
          largura_mm: i.largura_mm,
          altura_mm: i.altura_mm,
          quantidade: i.quantidade,
          produto_id: i.produto_id,
          preco_unit: i.preco_unit,
          descricao: i.descricao,
        }))
      : [],
  }
}

async function autenticar(req: NextRequest): Promise<UsuarioMin | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data: authData } = await supabaseAdmin.auth.getUser(token)
  if (!authData.user) return null
  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (!data?.empresa_id) return null
  return data as UsuarioMin
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticar(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const body = await req.json()
    const pergunta = String(body?.pergunta || '').trim()
    if (!pergunta) return NextResponse.json({ error: 'Digite uma pergunta' }, { status: 400 })
    if (pergunta.length > 4000) return NextResponse.json({ error: 'Pergunta muito longa' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'IA ainda não ativada: falta configurar OPENAI_API_KEY no ambiente de produção.', codigo: 'OPENAI_KEY_MISSING' },
        { status: 503 }
      )
    }

    const [orcResp, prodResp, tipoResp, memResp, interResp, feedbackResp] = await Promise.all([
      supabaseAdmin
        .from('orcamentos')
        .select('id,cliente_nome,cidade,temperatura,acabamento,contramarco,tipo_medida,itens,valor_estimado,status,created_at,criado_por_nome')
        .eq('empresa_id', usuario.empresa_id)
        .order('created_at', { ascending: false })
        .limit(18),
      supabaseAdmin.from('produtos').select('*').eq('empresa_id', usuario.empresa_id).eq('ativo', true).not('unidade', 'is', null).neq('unidade', '').limit(50),
      supabaseAdmin.from('tipologias').select('*').limit(80),
      supabaseAdmin.from('ai_memorias').select('titulo,conteudo,updated_at').eq('empresa_id', usuario.empresa_id).eq('escopo', 'comercial').eq('ativo', true).order('updated_at', { ascending: false }).limit(20),
      supabaseAdmin.from('ai_interacoes').select('id,pergunta,resposta,created_at').eq('empresa_id', usuario.empresa_id).eq('contexto', 'comercial').eq('status', 'ok').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('ai_feedback').select('interacao_id,avaliacao,correcao,created_at').eq('empresa_id', usuario.empresa_id).order('created_at', { ascending: false }).limit(30),
    ])

    const feedbackMap = new Map((feedbackResp.data || []).map((f: any) => [f.interacao_id, f]))
    const exemplosHumanos = (interResp.data || [])
      .map((i: any) => ({ ...i, feedback: feedbackMap.get(i.id) }))
      .filter((i: any) => i.feedback?.avaliacao === 'aprovado' || i.feedback?.avaliacao === 'corrigido')
      .slice(0, 8)
      .map((i: any) => ({
        pergunta: i.pergunta,
        resposta_aprovada: i.feedback?.avaliacao === 'corrigido' && i.feedback?.correcao ? i.feedback.correcao : i.resposta,
      }))

    const contexto = {
      usuario: { nome: usuario.nome, role: usuario.role },
      orcamentos_recentes: (orcResp.data || []).map(resumirOrcamento),
      produtos_ativos: (prodResp.data || []).slice(0, 50).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        unidade: p.unidade,
        largura_mm: p.largura_mm,
        altura_mm: p.altura_mm,
      })),
      tipologias: (tipoResp.data || []).slice(0, 80).map((t: any) => ({
        chave: t.chave,
        label: t.label || t.nome,
        ativo: t.ativo,
      })),
      memorias_aprovadas: memResp.data || [],
      exemplos_aprovados: exemplosHumanos,
    }

    const modelo = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
    const instructions = [
      'Você é o Assistente Comercial do Atlas One, sistema interno da Esquadrifácio.',
      'Responda em português do Brasil, de forma objetiva e prática.',
      'Use os dados do CONTEXTO ATLAS como fonte principal. Se o dado não estiver disponível, diga claramente que não encontrou no Atlas.',
      'Nunca invente preço, medida, cliente, prazo, desconto ou regra técnica.',
      'Você pode analisar, comparar, resumir, sugerir perguntas ao cliente e apontar pendências comerciais.',
      'Você NÃO tem permissão para criar, editar, excluir, aprovar ou mover registros. Suas respostas são sugestões.',
      'Quando houver correção humana ou memória aprovada, priorize-a em relação a padrões inferidos.',
      'Não trate uma sugestão histórica como regra absoluta; diferencie fato registrado de inferência.',
    ].join('\n')

    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        instructions,
        input: `CONTEXTO ATLAS:\n${JSON.stringify(contexto)}\n\nPERGUNTA DO USUÁRIO:\n${pergunta}`,
        max_output_tokens: 900,
        store: false,
      }),
    })

    const openaiData = await openaiResp.json().catch(() => ({}))
    if (!openaiResp.ok) {
      const detalhe = openaiData?.error?.message || `OpenAI respondeu ${openaiResp.status}`
      await supabaseAdmin.from('ai_interacoes').insert({
        empresa_id: usuario.empresa_id,
        contexto: 'comercial',
        usuario_id: usuario.id,
        usuario_nome: usuario.nome || null,
        pergunta,
        resposta: detalhe,
        modelo,
        contexto_json: { erro_openai: true },
        status: 'erro',
      })
      return NextResponse.json({ error: detalhe }, { status: 502 })
    }

    const resposta = extrairTextoResposta(openaiData)
    if (!resposta) return NextResponse.json({ error: 'A IA não retornou texto.' }, { status: 502 })

    const { data: interacao, error: erroInsert } = await supabaseAdmin
      .from('ai_interacoes')
      .insert({
        empresa_id: usuario.empresa_id,
        contexto: 'comercial',
        usuario_id: usuario.id,
        usuario_nome: usuario.nome || null,
        pergunta,
        resposta,
        modelo,
        contexto_json: {
          qtd_orcamentos: contexto.orcamentos_recentes.length,
          qtd_produtos: contexto.produtos_ativos.length,
          qtd_tipologias: contexto.tipologias.length,
          qtd_memorias: contexto.memorias_aprovadas.length,
          qtd_exemplos_aprovados: contexto.exemplos_aprovados.length,
        },
        status: 'ok',
      })
      .select('id')
      .single()

    if (erroInsert) console.error('Falha ao registrar interação IA:', erroInsert)

    return NextResponse.json({
      resposta,
      interacaoId: interacao?.id || null,
      modelo,
      somenteSugestao: true,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado na IA comercial' }, { status: 500 })
  }
}
