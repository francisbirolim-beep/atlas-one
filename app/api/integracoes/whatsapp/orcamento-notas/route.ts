import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const normalizar = (v: unknown) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    if (usuario.role !== 'master') {
      const params = { usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id, acaoId: 'comercial.orcamento.consultar', minimo: 'consulta' as const }
      const acessos = await Promise.all([
        usuarioPodeAcaoServer({ ...params, setorId: 'fazer-orcamento-msanfyvj' }),
        usuarioPodeAcaoServer({ ...params, setorId: 'orcamentos' }),
      ])
      if (!acessos.some(Boolean)) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
    }
    const id = req.nextUrl.searchParams.get('orcamentoId') || ''
    if (!/^[a-f\d-]{36}$/i.test(id)) return NextResponse.json({ error: 'Orçamento inválido.' }, { status: 400 })
    const { data: orcamento, error: erroOrcamento } = await supabaseAdmin.from('orcamentos')
      .select('id,modo_entrada,ia_fontes').eq('id', id).eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (erroOrcamento) throw erroOrcamento
    if (!orcamento || orcamento.modo_entrada !== 'whatsapp') return NextResponse.json({ error: 'Notas não encontradas.' }, { status: 404 })
    const { data: intake, error: erroIntake } = await supabaseAdmin.from('atendimento_whatsapp_intakes')
      .select('id,conversa_id,participante_nome,conteudo_bruto,mensagens_ids,anexos,primeira_mensagem_em,ultima_mensagem_em,gatilho_fechamento,ai_resultado,atendimento_whatsapp_grupos(nome)')
      .eq('orcamento_id', id).eq('empresa_id', usuario.empresa_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (erroIntake) throw erroIntake
    const grupo = (intake?.atendimento_whatsapp_grupos as unknown as { nome?: string } | null)?.nome || ''
    if (!intake || normalizar(grupo) !== 'orcamento / assistencia') {
      return NextResponse.json({ error: 'O card não possui pacote do grupo de orçamentos.' }, { status: 404 })
    }
    const anexos = Array.isArray(intake.anexos) ? intake.anexos : []
    const paths = [...new Set(anexos.map((a: any) => String(a?.media_path || ''))
      .filter((v: string) => v.startsWith(usuario.empresa_id + '/') && !v.includes('..')))]
    const urlsAssinadas = new Map<string, string>()
    if (paths.length) {
      const { data: urls, error } = await supabaseAdmin.storage.from('whatsapp-midia').createSignedUrls(paths, 1200)
      if (error) console.error('[orcamento-notas] Falha ao assinar mídias:', error.message)
      for (const item of urls || []) if (item.path && item.signedUrl) urlsAssinadas.set(item.path, item.signedUrl)
    }
    return NextResponse.json({
      grupo,
      conversaId: intake.conversa_id,
      participanteNome: intake.participante_nome,
      primeiraMensagemEm: intake.primeira_mensagem_em,
      ultimaMensagemEm: intake.ultima_mensagem_em,
      totalMensagens: Array.isArray(intake.mensagens_ids) ? intake.mensagens_ids.length : 0,
      gatilho: intake.gatilho_fechamento,
      textoOriginal: intake.conteudo_bruto || (orcamento.ia_fontes as any)?.conteudo_bruto || '',
      resumoIA: intake.ai_resultado?.resumo || null,
      anexos: anexos.map((a: any) => ({
        id: String(a.mensagem_id || a.whatsapp_message_id || ''),
        tipo: String(a.tipo || ''),
        nome: String(a.nome || 'Anexo do WhatsApp').slice(0, 180),
        mimeType: String(a.mime_type || ''),
        tamanho: Number(a.tamanho || 0),
        url: urlsAssinadas.get(String(a.media_path || '')) || null,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[orcamento-notas]', e)
    return NextResponse.json({ error: 'Falha ao consultar notas e anexos.' }, { status: 500 })
  }
}
