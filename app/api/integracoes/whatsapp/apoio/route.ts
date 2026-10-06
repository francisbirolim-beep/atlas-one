import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'
import { listarMensagensAtendimento } from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

async function conversaPermitida(conversaId: string, usuario: any) {
  if (!conversaId) return false
  const mensagens = await listarMensagensAtendimento(conversaId, usuario)
  return mensagens !== null
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  const conversaId = req.nextUrl.searchParams.get('conversaId') || ''
  if (!await conversaPermitida(conversaId, usuario)) {
    return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })
  }

  try {
    const [etiquetasResp, vinculosResp, notasResp, rapidasResp, historicoResp] = await Promise.all([
      supabaseAdmin.from('atendimento_etiquetas')
        .select('id,nome,cor').eq('empresa_id', usuario.empresa_id)
        .eq('ativo', true).order('nome'),
      supabaseAdmin.from('atendimento_conversa_etiquetas')
        .select('etiqueta_id').eq('empresa_id', usuario.empresa_id)
        .eq('conversa_id', conversaId),
      supabaseAdmin.from('atendimento_notas')
        .select('id,usuario_id,usuario_nome,texto,created_at')
        .eq('empresa_id', usuario.empresa_id).eq('conversa_id', conversaId)
        .order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('atendimento_mensagens_rapidas')
        .select('id,titulo,mensagem,atalho,categoria')
        .eq('empresa_id', usuario.empresa_id).eq('ativo', true)
        .order('titulo'),
      supabaseAdmin.from('atendimento_eventos')
        .select('id,tipo,usuario_id,usuario_nome,dados,created_at')
        .eq('empresa_id', usuario.empresa_id).eq('conversa_id', conversaId)
        .order('created_at', { ascending: false }).limit(300),
    ])

    const erro = etiquetasResp.error || vinculosResp.error || notasResp.error || rapidasResp.error || historicoResp.error
    if (erro) throw erro

    return NextResponse.json({
      ok: true,
      etiquetas: etiquetasResp.data || [],
      etiquetasAtivas: (vinculosResp.data || []).map(x => x.etiqueta_id),
      notas: notasResp.data || [],
      mensagensRapidas: rapidasResp.data || [],
      historico: historicoResp.data || [],
    })
  } catch (error) {
    console.error('Erro ao carregar apoio WhatsApp:', error)
    return NextResponse.json({ error: 'Nao foi possivel carregar os recursos do atendimento.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const conversaId = String(body?.conversaId || '')
    const acao = String(body?.acao || '')

    if (!await conversaPermitida(conversaId, usuario)) {
      return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })
    }

    if (acao === 'nota_criar') {
      const texto = String(body?.texto || '').trim()
      if (!texto) return NextResponse.json({ error: 'Digite a nota.' }, { status: 400 })
      const { error } = await supabaseAdmin.from('atendimento_notas').insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversaId,
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        texto,
      })
      if (error) throw error
    } else if (acao === 'etiqueta_alternar') {
      const etiquetaId = String(body?.etiquetaId || '')
      if (!etiquetaId) return NextResponse.json({ error: 'Etiqueta invalida.' }, { status: 400 })

      const { data: etiqueta } = await supabaseAdmin.from('atendimento_etiquetas')
        .select('id').eq('id', etiquetaId).eq('empresa_id', usuario.empresa_id).maybeSingle()
      if (!etiqueta) return NextResponse.json({ error: 'Etiqueta nao encontrada.' }, { status: 404 })

      const { data: existe } = await supabaseAdmin.from('atendimento_conversa_etiquetas')
        .select('etiqueta_id').eq('empresa_id', usuario.empresa_id)
        .eq('conversa_id', conversaId).eq('etiqueta_id', etiquetaId).maybeSingle()

      if (existe) {
        const { error } = await supabaseAdmin.from('atendimento_conversa_etiquetas')
          .delete().eq('empresa_id', usuario.empresa_id)
          .eq('conversa_id', conversaId).eq('etiqueta_id', etiquetaId)
        if (error) throw error
      } else {
        const { error } = await supabaseAdmin.from('atendimento_conversa_etiquetas').insert({
          empresa_id: usuario.empresa_id,
          conversa_id: conversaId,
          etiqueta_id: etiquetaId,
          created_by: usuario.id,
        })
        if (error) throw error
      }
    } else if (acao === 'etiqueta_criar') {
      if (usuario.role !== 'master') {
        return NextResponse.json({ error: 'Somente Master pode criar etiquetas globais.' }, { status: 403 })
      }
      const nome = String(body?.nome || '').trim()
      const cor = String(body?.cor || '#64748b')
      if (!nome) return NextResponse.json({ error: 'Informe o nome da etiqueta.' }, { status: 400 })

      const { data: etiqueta, error } = await supabaseAdmin.from('atendimento_etiquetas')
        .insert({ empresa_id: usuario.empresa_id, nome, cor, created_by: usuario.id })
        .select('id').single()
      if (error) throw error

      const { error: vinculoError } = await supabaseAdmin.from('atendimento_conversa_etiquetas').insert({
        empresa_id: usuario.empresa_id,
        conversa_id: conversaId,
        etiqueta_id: etiqueta.id,
        created_by: usuario.id,
      })
      if (vinculoError) throw vinculoError
    } else if (acao === 'rapida_criar') {
      if (usuario.role !== 'master') {
        return NextResponse.json({ error: 'Somente Master pode criar respostas rapidas globais.' }, { status: 403 })
      }
      const titulo = String(body?.titulo || '').trim()
      const mensagem = String(body?.mensagem || '').trim()
      const atalho = String(body?.atalho || '').trim() || null
      const categoria = String(body?.categoria || '').trim() || null
      if (!titulo || !mensagem) {
        return NextResponse.json({ error: 'Titulo e mensagem sao obrigatorios.' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.from('atendimento_mensagens_rapidas').insert({
        empresa_id: usuario.empresa_id,
        titulo,
        mensagem,
        atalho,
        categoria,
        created_by: usuario.id,
      })
      if (error) throw error
    } else {
      return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao atualizar recursos do atendimento.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
