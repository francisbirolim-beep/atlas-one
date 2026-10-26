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
      .select('id,modo_entrada,ia_fontes,ia_resultado_original,descricao_livre,created_at').eq('id', id).eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (erroOrcamento) throw erroOrcamento
    if (!orcamento || orcamento.modo_entrada !== 'whatsapp') return NextResponse.json({ error: 'Notas não encontradas.' }, { status: 404 })
    const { data: intake, error: erroIntake } = await supabaseAdmin.from('atendimento_whatsapp_intakes')
      .select('id,conversa_id,participante_nome,conteudo_bruto,mensagens_ids,anexos,primeira_mensagem_em,ultima_mensagem_em,gatilho_fechamento,ai_resultado,atendimento_whatsapp_grupos(nome)')
      .eq('orcamento_id', id).eq('empresa_id', usuario.empresa_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (erroIntake) throw erroIntake
    // Registros anteriores à regra atual podem ter perdido o vínculo de intake,
    // mas preservam uma cópia imutável das mensagens e mídias em ia_fontes.
    // Recuperamos SOMENTE leitura do histórico: isso nunca cria novos cards.
    const fontes = (orcamento.ia_fontes || {}) as {
      conteudo_bruto?: string
      anexos?: Array<Record<string, unknown>>
    }
    const dadosIntake = intake || null
    const grupoRegistrado = (dadosIntake?.atendimento_whatsapp_grupos as unknown as { nome?: string } | null)?.nome || ''
    const grupoConferido = normalizar(grupoRegistrado) === 'orcamento / assistencia'
    const historico = !dadosIntake || !grupoConferido
    const grupo = grupoRegistrado || 'Grupo não registrado no histórico'
    const anexos = Array.isArray(dadosIntake?.anexos) ? dadosIntake.anexos
      : Array.isArray(fontes.anexos) ? fontes.anexos : []
    const textoOriginal = String(dadosIntake?.conteudo_bruto || fontes.conteudo_bruto || orcamento.descricao_livre || '')
    if (!dadosIntake && !textoOriginal && !anexos.length)
      return NextResponse.json({ error: 'Este card antigo não possui conteúdo recuperável do WhatsApp.' }, { status: 404 })
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
      grupoConferido,
      historico,
      conversaId: dadosIntake?.conversa_id || null,
      participanteNome: dadosIntake?.participante_nome || null,
      primeiraMensagemEm: dadosIntake?.primeira_mensagem_em || orcamento.created_at,
      ultimaMensagemEm: dadosIntake?.ultima_mensagem_em || orcamento.created_at,
      totalMensagens: Array.isArray(dadosIntake?.mensagens_ids) ? dadosIntake.mensagens_ids.length : null,
      gatilho: dadosIntake?.gatilho_fechamento || null,
      textoOriginal,
      resumoIA: dadosIntake?.ai_resultado?.resumo || (orcamento.ia_resultado_original as any)?.resumo || null,
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
