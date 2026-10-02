import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarOpenCode, statusOpenCode } from '@/lib/ai/opencode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TERMOS_VERSAO = 'atlas-pessoas-v1'

function txt(v: unknown, max = 8000) {
  return String(v ?? '').trim().slice(0, max)
}

async function lerPreferencias(usuario: UsuarioTenant) {
  const { data } = await supabaseAdmin
    .from('ia_pessoas_preferencias')
    .select('termos_versao,termos_aceitos_em,termos_revogados_em,diario_habilitado,compartilhar_metricas_agregadas,updated_at')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .maybeSingle()
  return data || null
}

async function termosAtivos(usuario: UsuarioTenant) {
  const p = await lerPreferencias(usuario)
  return Boolean(p?.termos_aceitos_em && !p?.termos_revogados_em && p?.termos_versao === TERMOS_VERSAO)
}

async function validarSessao(usuario: UsuarioTenant, sessionId: string | null) {
  const id = txt(sessionId, 200)
  if (!id) return null
  const { data } = await supabaseAdmin
    .from('ia_diario_privado')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .contains('contexto_json', { opencode_session_id: id })
    .limit(1)
  return data?.length ? id : null
}

async function listarClima(usuario: UsuarioTenant) {
  const agora = new Date().toISOString()
  const { data: campanhas } = await supabaseAdmin
    .from('ia_clima_campanhas')
    .select('id,titulo,descricao,inicia_em,encerra_em,ativo,created_at')
    .eq('empresa_id', usuario.empresa_id)
    .eq('ativo', true)
    .or(`inicia_em.is.null,inicia_em.lte.${agora}`)
    .or(`encerra_em.is.null,encerra_em.gte.${agora}`)
    .order('created_at', { ascending: false })
    .limit(10)

  const ids = (campanhas || []).map(c => c.id)
  if (!ids.length) return []

  const [{ data: perguntas }, { data: respostas }] = await Promise.all([
    supabaseAdmin
      .from('ia_clima_perguntas')
      .select('id,campanha_id,ordem,texto,tipo,opcoes_json,obrigatoria')
      .in('campanha_id', ids)
      .order('ordem', { ascending: true }),
    supabaseAdmin
      .from('ia_clima_respostas')
      .select('campanha_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id)
      .in('campanha_id', ids),
  ])

  const feitas = new Set((respostas || []).map(r => r.campanha_id))
  return (campanhas || []).map(c => ({
    ...c,
    respondida: feitas.has(c.id),
    perguntas: (perguntas || []).filter(p => p.campanha_id === c.id),
  }))
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const [preferencias, diario, clima] = await Promise.all([
    lerPreferencias(usuario),
    supabaseAdmin
      .from('ia_diario_privado')
      .select('id,papel,conteudo,humor_declarado,contexto_json,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false })
      .limit(60),
    listarClima(usuario),
  ])

  return NextResponse.json({
    termosVersao: TERMOS_VERSAO,
    preferencias,
    diario: diario.data || [],
    clima,
  })
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const acao = txt(body?.acao, 50)

    if (acao === 'aceitar_termos') {
      const agora = new Date().toISOString()
      const { error } = await supabaseAdmin.from('ia_pessoas_preferencias').upsert({
        empresa_id: usuario.empresa_id,
        usuario_id: usuario.id,
        termos_versao: TERMOS_VERSAO,
        termos_aceitos_em: agora,
        termos_revogados_em: null,
        diario_habilitado: true,
        compartilhar_metricas_agregadas: body?.compartilharMetricasAgregadas !== false,
        updated_at: agora,
      }, { onConflict: 'empresa_id,usuario_id' })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (acao === 'revogar_termos') {
      const agora = new Date().toISOString()
      const { error } = await supabaseAdmin
        .from('ia_pessoas_preferencias')
        .update({ termos_revogados_em: agora, updated_at: agora })
        .eq('empresa_id', usuario.empresa_id)
        .eq('usuario_id', usuario.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (!(await termosAtivos(usuario))) {
      return NextResponse.json({ error: 'Aceite os termos de privacidade deste módulo antes de continuar.' }, { status: 412 })
    }

    if (acao === 'checkin') {
      const humor = Number(body?.humor)
      if (!Number.isInteger(humor) || humor < 1 || humor > 5) {
        return NextResponse.json({ error: 'Humor inválido.' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.from('ia_diario_privado').insert({
        empresa_id: usuario.empresa_id,
        usuario_id: usuario.id,
        papel: 'usuario',
        conteudo: txt(body?.observacao, 2000) || `Check-in de humor: ${humor}/5`,
        humor_declarado: humor,
        contexto_json: { tipo: 'checkin', privado: true },
      })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (acao === 'compartilhar') {
      const texto = txt(body?.texto, 8000)
      const modo = body?.modoIdentidade === 'identificado' ? 'identificado' : 'anonimo_gestao'
      if (!texto) return NextResponse.json({ error: 'Escreva o que deseja compartilhar.' }, { status: 400 })
      const { error } = await supabaseAdmin.from('ia_feedback_colaborador').insert({
        empresa_id: usuario.empresa_id,
        usuario_id: usuario.id,
        modo_identidade: modo,
        origem: body?.origem === 'diario_compartilhado' ? 'diario_compartilhado' : 'espontaneo',
        categoria: txt(body?.categoria, 80) || null,
        texto,
        deseja_contato: modo === 'identificado' && body?.desejaContato === true,
        contexto_json: { compartilhado_voluntariamente: true },
      })
      if (error) throw error
      return NextResponse.json({ ok: true, modoIdentidade: modo })
    }

    if (acao === 'diario_chat') {
      const mensagem = txt(body?.mensagem, 5000)
      if (!mensagem) return NextResponse.json({ error: 'Digite uma mensagem.' }, { status: 400 })

      const status = await statusOpenCode()
      if (!status.configurado) return NextResponse.json({ error: 'A IA privada está indisponível.' }, { status: 503 })

      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      const sessionId = await validarSessao(usuario, txt(body?.sessionId, 200) || null)

      const system = [
        'Você é o Atlas Pessoas, assistente privado do colaborador.',
        'Esta conversa é privada por padrão e não vira memória corporativa, perfil psicológico, nota de desempenho ou avaliação oculta.',
        'Não diagnostique saúde mental, personalidade, competência ou aptidão profissional.',
        'Não acesse, invente ou revele dados internos da empresa, financeiros, RH, vendas, custos, salários, fornecedores ou dados de outros usuários.',
        'Para dados operacionais do Atlas, oriente o usuário a usar o Atlas IA principal, onde as permissões são verificadas.',
        'Ajude com organização, reflexão, comunicação, dúvidas gerais e bem-estar de forma respeitosa e prática.',
        'Em risco imediato de dano, priorize segurança e incentive ajuda humana urgente e serviços locais de emergência.',
        'Responda em português do Brasil.',
      ].join('\n')

      const resultado = await consultarOpenCode({
        accessToken: token,
        sessionId,
        tituloSessao: `Atlas Pessoas - ${usuario.nome || usuario.id}`,
        system,
        prompt: mensagem,
      })

      const agora = new Date().toISOString()
      const { error } = await supabaseAdmin.from('ia_diario_privado').insert([
        {
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          papel: 'usuario',
          conteudo: mensagem,
          contexto_json: { tipo: 'diario_chat', privado: true, opencode_session_id: resultado.sessionId },
          created_at: agora,
        },
        {
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          papel: 'assistente',
          conteudo: resultado.resposta,
          contexto_json: {
            tipo: 'diario_chat',
            privado: true,
            opencode_session_id: resultado.sessionId,
            provider_id: resultado.providerId,
            model_id: resultado.modelId,
          },
        },
      ])
      if (error) throw error

      return NextResponse.json({ ok: true, resposta: resultado.resposta, sessionId: resultado.sessionId })
    }

    if (acao === 'responder_clima') {
      const campanhaId = txt(body?.campanhaId, 100)
      const respostas = Array.isArray(body?.respostas) ? body.respostas.slice(0, 100) : []
      const modo = body?.modoIdentidade === 'identificado' ? 'identificado' : 'anonimo_gestao'
      if (!campanhaId || !respostas.length) return NextResponse.json({ error: 'Pesquisa incompleta.' }, { status: 400 })

      const { data: campanha } = await supabaseAdmin
        .from('ia_clima_campanhas')
        .select('id')
        .eq('id', campanhaId)
        .eq('empresa_id', usuario.empresa_id)
        .eq('ativo', true)
        .maybeSingle()
      if (!campanha) return NextResponse.json({ error: 'Pesquisa indisponível.' }, { status: 404 })

      const { data: jaRespondida } = await supabaseAdmin
        .from('ia_clima_respostas')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('campanha_id', campanhaId)
        .eq('usuario_id', usuario.id)
        .limit(1)
      if (jaRespondida?.length) {
        return NextResponse.json({ error: 'Esta pesquisa já foi respondida por você.' }, { status: 409 })
      }

      const { data: perguntas } = await supabaseAdmin.from('ia_clima_perguntas').select('id').eq('campanha_id', campanhaId)
      const ids = new Set((perguntas || []).map(p => p.id))
      const linhas = respostas
        .filter((r: any) => ids.has(txt(r?.perguntaId, 100)))
        .map((r: any) => ({
          empresa_id: usuario.empresa_id,
          campanha_id: campanhaId,
          pergunta_id: txt(r?.perguntaId, 100),
          usuario_id: usuario.id,
          modo_identidade: modo,
          resposta_texto: txt(r?.texto, 5000) || null,
          resposta_numero: Number.isFinite(Number(r?.numero)) ? Number(r.numero) : null,
          resposta_json: r?.valor && typeof r.valor === 'object' ? r.valor : {},
        }))

      if (!linhas.length) return NextResponse.json({ error: 'Nenhuma resposta válida.' }, { status: 400 })
      const { error } = await supabaseAdmin.from('ia_clima_respostas').insert(linhas)
      if (error) throw error
      return NextResponse.json({ ok: true, respostas: linhas.length, modoIdentidade: modo })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Atlas Pessoas:', e)
    return NextResponse.json({ error: 'Não foi possível concluir esta ação.' }, { status: 500 })
  }
}