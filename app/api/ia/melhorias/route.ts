import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarOpenCode, statusOpenCode } from '@/lib/ai/opencode'

export const runtime = 'nodejs'
export const maxDuration = 45

const STATUS_VALIDOS = new Set([
  'novo', 'ia_analisando', 'informacao_necessaria', 'solucao_proposta',
  'aguardando_aprovacao', 'aprovado', 'em_desenvolvimento', 'teste',
  'pronto_publicar', 'publicado', 'rejeitado',
])
const RISCOS = new Set(['nao_avaliado', 'baixo', 'medio', 'alto', 'critico'])
const URGENCIAS = new Set(['baixa', 'media', 'alta', 'critica'])
const MAX_ANEXO_BASE64 = 16_800_000
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'text/plain': 'txt',
}

type AnaliseRelato = {
  tipo: 'bug' | 'melhoria' | 'ideia'
  titulo: string
  area: string
  resultado_atual: string
  resultado_esperado: string
  impacto: string
  urgencia: 'baixa' | 'media' | 'alta' | 'critica'
  risco: 'baixo' | 'medio' | 'alto' | 'critico'
  justificativa_risco: string
  recomendacao: string
}

function normalizar(texto: string) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function chaveDedupe(descricao: string, tela: string) {
  return createHash('sha256')
    .update(normalizar(tela) + '|' + normalizar(descricao))
    .digest('hex')
}

function analiseFallback(descricao: string, tela: string): AnaliseRelato {
  const base = normalizar(descricao + ' ' + tela)
  const ehBug = /\b(erro|bug|defeito|falha|quebrou|travou|travando|nao funciona|nao aparece|sumiu|perdeu|perdendo)\b/.test(base)
  const ehIdeia = /\b(ideia|sugestao|poderia ter|seria bom|novo recurso)\b/.test(base)
  const sensivel = /\b(financeiro|pagamento|valor|preco|margem|banco|permissao|senha|seguranca|lgpd|producao|corte|medida|estoque|faturamento)\b/.test(base)
  const perda = /\b(perdeu|perdendo|apaga|apagou|dados|duplic|cobranca errada|valor errado)\b/.test(base)
  const risco: AnaliseRelato['risco'] = perda ? 'alto' : sensivel ? 'medio' : 'baixo'
  const urgencia: AnaliseRelato['urgencia'] = perda ? 'alta' : ehBug ? 'media' : 'baixa'
  const titulo = String(descricao || '').replace(/\s+/g, ' ').trim().slice(0, 90)

  return {
    tipo: ehBug ? 'bug' : ehIdeia ? 'ideia' : 'melhoria',
    titulo: titulo || 'Solicitação de melhoria no Atlas',
    area: tela ? tela.split('?')[0].slice(0, 120) : 'Atlas IA',
    resultado_atual: ehBug ? String(descricao).slice(0, 1200) : '',
    resultado_esperado: ehBug
      ? 'Corrigir o comportamento relatado pelo usuário.'
      : String(descricao).slice(0, 1200),
    impacto: ehBug
      ? 'Pode afetar a operação do usuário no fluxo informado.'
      : 'Melhoria de usabilidade, produtividade ou processo.',
    urgencia,
    risco,
    justificativa_risco: risco === 'baixo'
      ? 'Alteração aparentemente localizada, sem indicação de dados críticos.'
      : 'O relato menciona área ou comportamento operacional que exige validação antes de alteração.',
    recomendacao: risco === 'baixo'
      ? 'Pode seguir para análise técnica e preparação de preview; publicação exige aprovação.'
      : 'Exige revisão técnica e aprovação antes de qualquer alteração.',
  }
}

function extrairJson(texto: string) {
  const inicio = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  if (inicio < 0 || fim <= inicio) return null
  try {
    return JSON.parse(texto.slice(inicio, fim + 1))
  } catch {
    return null
  }
}

async function analisarComIA(descricao: string, tela: string, accessToken: string): Promise<AnaliseRelato> {
  const fallback = analiseFallback(descricao, tela)
  try {
    const status = await statusOpenCode()
    if (!status.configurado || !accessToken) return fallback

    const resultado = await consultarOpenCode({
      accessToken,
      tituloSessao: 'Atlas Melhorias - análise gratuita',
      system: [
        'Você classifica relatos de defeitos e melhorias do ERP Atlas One.',
        'Responda SOMENTE JSON válido, sem markdown.',
        'Nunca autorize publicação automática. Mudança em produção sempre exige aprovação humana.',
        'Campos: tipo, titulo, area, resultado_atual, resultado_esperado, impacto, urgencia, risco, justificativa_risco, recomendacao.',
        'tipo: bug|melhoria|ideia. urgencia: baixa|media|alta|critica. risco: baixo|medio|alto|critico.',
        'Considere risco alto ou crítico para financeiro, permissões, segurança, LGPD, banco, cálculos, produção, estoque ou perda de dados.',
        'Este fluxo usa OpenCode + FreeLLMAPI e não pode chamar provedor pago.',
      ].join('\n'),
      prompt: 'Tela/URL: ' + (tela || 'nao informada') + '\nRelato: ' + descricao,
    })

    const bruto = extrairJson(resultado.resposta)
    if (!bruto) return fallback

    return {
      tipo: ['bug', 'melhoria', 'ideia'].includes(bruto.tipo) ? bruto.tipo : fallback.tipo,
      titulo: String(bruto.titulo || fallback.titulo).slice(0, 180),
      area: String(bruto.area || fallback.area).slice(0, 120),
      resultado_atual: String(bruto.resultado_atual || fallback.resultado_atual).slice(0, 2000),
      resultado_esperado: String(bruto.resultado_esperado || fallback.resultado_esperado).slice(0, 2000),
      impacto: String(bruto.impacto || fallback.impacto).slice(0, 1200),
      urgencia: URGENCIAS.has(String(bruto.urgencia)) ? bruto.urgencia : fallback.urgencia,
      risco: RISCOS.has(String(bruto.risco)) && bruto.risco !== 'nao_avaliado' ? bruto.risco : fallback.risco,
      justificativa_risco: String(bruto.justificativa_risco || fallback.justificativa_risco).slice(0, 1200),
      recomendacao: String(bruto.recomendacao || fallback.recomendacao).slice(0, 1600),
    }
  } catch {
    return fallback
  }
}

async function assinarItem(item: any) {
  const copia = { ...item, anexo_url: null, audio_url: null }
  if (item.anexo_storage_path) {
    const { data } = await supabaseAdmin.storage
      .from('atlas-melhorias')
      .createSignedUrl(item.anexo_storage_path, 60 * 60)
    copia.anexo_url = data?.signedUrl || null
  }
  if (item.audio_storage_path) {
    const { data } = await supabaseAdmin.storage
      .from('atlas-ia-audios')
      .createSignedUrl(item.audio_storage_path, 60 * 60)
    copia.audio_url = data?.signedUrl || null
  }
  return copia
}

async function uploadAnexo(usuario: UsuarioTenant, anexo: any) {
  if (!anexo || typeof anexo !== 'object' || !anexo.dados) return null
  const dados = String(anexo.dados || '')
  if (dados.length > MAX_ANEXO_BASE64) {
    throw new Error('Anexo muito grande. Limite aproximado de 12 MB.')
  }
  const mediaType = String(anexo.mediaType || '').toLowerCase().split(';')[0]
  const ext = MIME_EXT[mediaType]
  if (!ext) throw new Error('Formato de anexo não suportado para Melhorias Atlas.')

  const nome = String(anexo.nome || ('anexo.' + ext)).slice(0, 180)
  const path = usuario.empresa_id + '/' + usuario.id + '/' +
    new Date().toISOString().slice(0, 10) + '/' + randomUUID() + '.' + ext

  const { error } = await supabaseAdmin.storage
    .from('atlas-melhorias')
    .upload(path, Buffer.from(dados, 'base64'), {
      contentType: mediaType,
      upsert: false,
    })
  if (error) throw new Error('Não foi possível salvar o anexo: ' + error.message)
  return { path, nome, mediaType }
}

async function registrarEvento(
  itemId: string,
  usuario: UsuarioTenant,
  evento: string,
  detalhe: Record<string, any> = {},
) {
  await supabaseAdmin.from('atlas_melhorias_eventos').insert({
    melhoria_id: itemId,
    empresa_id: usuario.empresa_id,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome || null,
    evento,
    detalhe,
  })
}

export async function GET(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    let query = supabaseAdmin
      .from('atlas_melhorias')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false })
      .limit(250)

    if (usuario.role !== 'master') query = query.eq('criado_por_id', usuario.id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const itens = await Promise.all((data || []).map(assinarItem))
    return NextResponse.json({ itens })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao carregar Melhorias Atlas.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const descricao = String(body?.descricao || '').trim().slice(0, 8000)
    const tela = String(body?.tela || body?.contextoUrl || '').trim().slice(0, 500)
    const audioStoragePath = String(body?.audioStoragePath || '').trim().slice(0, 600) || null

    if (descricao.length < 5) {
      return NextResponse.json(
        { error: 'Descreva o defeito ou melhoria com um pouco mais de detalhe.' },
        { status: 400 },
      )
    }

    const dedupeKey = chaveDedupe(descricao, tela)
    const { data: existente } = await supabaseAdmin
      .from('atlas_melhorias')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .eq('dedupe_key', dedupeKey)
      .not('status', 'in', '(publicado,rejeitado)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      const contexto = existente.contexto_json && typeof existente.contexto_json === 'object'
        ? existente.contexto_json
        : {}
      const relatores = Array.isArray(contexto.relatores)
        ? contexto.relatores.slice(-19)
        : []
      relatores.push({
        id: usuario.id,
        nome: usuario.nome,
        em: new Date().toISOString(),
      })

      const novoTotal = Number(existente.relatos_count || 1) + 1
      const { data: atualizado, error } = await supabaseAdmin
        .from('atlas_melhorias')
        .update({
          relatos_count: novoTotal,
          contexto_json: { ...contexto, relatores },
        })
        .eq('id', existente.id)
        .select('*')
        .single()

      if (error) throw error
      await registrarEvento(existente.id, usuario, 'novo_relato_duplicado', {
        relatos_count: novoTotal,
      })
      return NextResponse.json({
        item: await assinarItem(atualizado),
        duplicado: true,
      })
    }

    const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\\s+/i, '').trim()
    const analise = await analisarComIA(descricao, tela, accessToken)
    const anexo = await uploadAnexo(usuario, body?.anexo)

    const { data, error } = await supabaseAdmin
      .from('atlas_melhorias')
      .insert({
        empresa_id: usuario.empresa_id,
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome || null,
        tipo: analise.tipo,
        titulo: analise.titulo,
        descricao,
        tela: tela || null,
        area: analise.area || null,
        resultado_atual: analise.resultado_atual || null,
        resultado_esperado: analise.resultado_esperado || null,
        impacto: analise.impacto || null,
        urgencia: analise.urgencia,
        status: 'aguardando_aprovacao',
        risco: analise.risco,
        exige_aprovacao: true,
        justificativa_risco: analise.justificativa_risco || null,
        analise_ia: {
          recomendacao: analise.recomendacao,
          classificado_em: new Date().toISOString(),
          motor: 'atlas_ia',
        },
        aprovacao_status: 'pendente',
        origem: String(body?.origem || 'atlas_ia').slice(0, 60),
        dedupe_key: dedupeKey,
        contexto_json: {
          userAgent: String(body?.userAgent || '').slice(0, 500),
          viewport: body?.viewport || null,
          relatores: [{
            id: usuario.id,
            nome: usuario.nome,
            em: new Date().toISOString(),
          }],
        },
        anexo_storage_path: anexo?.path || null,
        anexo_nome: anexo?.nome || null,
        anexo_media_type: anexo?.mediaType || null,
        audio_storage_path: audioStoragePath,
      })
      .select('*')
      .single()

    if (error) throw error

    await registrarEvento(data.id, usuario, 'relato_criado', {
      tipo: data.tipo,
      risco: data.risco,
      urgencia: data.urgencia,
      origem: data.origem,
    })

    return NextResponse.json({
      item: await assinarItem(data),
      duplicado: false,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao registrar melhoria.' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    if (usuario.role !== 'master') {
      return NextResponse.json(
        { error: 'Apenas o Master pode administrar melhorias.' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'ID não informado.' }, { status: 400 })

    const patch: Record<string, any> = {}

    if (body.status != null) {
      const status = String(body.status)
      if (!STATUS_VALIDOS.has(status)) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      }
      patch.status = status

      if (status === 'aprovado' || status === 'rejeitado') {
        patch.aprovacao_status = status
        patch.aprovado_por_id = usuario.id
        patch.aprovado_por_nome = usuario.nome
        patch.aprovado_em = new Date().toISOString()
      }
    }

    if (body.risco != null) {
      const risco = String(body.risco)
      if (!RISCOS.has(risco)) {
        return NextResponse.json({ error: 'Risco inválido.' }, { status: 400 })
      }
      patch.risco = risco
    }

    if (body.urgencia != null) {
      const urgencia = String(body.urgencia)
      if (!URGENCIAS.has(urgencia)) {
        return NextResponse.json({ error: 'Urgência inválida.' }, { status: 400 })
      }
      patch.urgencia = urgencia
    }

    if (body.observacoes_admin != null) {
      patch.observacoes_admin = String(body.observacoes_admin).slice(0, 5000)
    }

    const { data, error } = await supabaseAdmin
      .from('atlas_melhorias')
      .update(patch)
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .select('*')
      .single()

    if (error) throw error

    await registrarEvento(
      data.id,
      usuario,
      body.status === 'aprovado'
        ? 'aprovado'
        : body.status === 'rejeitado'
          ? 'rejeitado'
          : 'atualizado',
      patch,
    )

    return NextResponse.json({ item: await assinarItem(data) })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao atualizar melhoria.' },
      { status: 500 },
    )
  }
}
