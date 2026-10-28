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
    const { data: intakes, error: erroIntake } = await supabaseAdmin.from('atendimento_whatsapp_intakes')
      .select('id,conversa_id,participante_nome,conteudo_bruto,mensagens_ids,anexos,primeira_mensagem_em,ultima_mensagem_em,gatilho_fechamento,ai_resultado,atendimento_whatsapp_grupos(nome)')
      .eq('orcamento_id', id).eq('empresa_id', usuario.empresa_id).order('created_at', { ascending: true }).limit(150)
    if (erroIntake) throw erroIntake
    // Registros anteriores à regra atual podem ter perdido o vínculo de intake,
    // mas preservam uma cópia imutável das mensagens e mídias em ia_fontes.
    // Recuperamos SOMENTE leitura do histórico: isso nunca cria novos cards.
    const fontes = (orcamento.ia_fontes || {}) as {
      conteudo_bruto?: string
      anexos?: Array<Record<string, unknown>>
    }
    const registros = intakes || []
    const dadosIntake = registros[registros.length - 1] || null
    const grupoRegistrado = (dadosIntake?.atendimento_whatsapp_grupos as unknown as { nome?: string } | null)?.nome || ''
    const anexosAgrupados = registros.flatMap(r => Array.isArray(r.anexos) ? r.anexos : [])
    const anexosOriginais = anexosAgrupados.length ? anexosAgrupados :
      Array.isArray(fontes.anexos) ? fontes.anexos : []
    const anexos = anexosOriginais.filter((a: any, index: number) => {
      const chave = String(a?.whatsapp_message_id || a?.mensagem_id || '')
      return !chave || anexosOriginais.findIndex((b: any) =>
        String(b?.whatsapp_message_id || b?.mensagem_id || '') === chave) === index
    })

    // Na importação antiga, o intake pode não existir mais. As mídias mantêm
    // o id da mensagem: ele aponta à conversa e ao JID originais, sem inferir
    // o grupo pelo nome do cliente ou pelo conteúdo das mensagens.
    const conversasVinculadas = [...new Set(registros.map(r => r.conversa_id).filter(Boolean))]
    let conversaId: string | null = conversasVinculadas.length === 1
      ? conversasVinculadas[0]! : (registros.length ? null : dadosIntake?.conversa_id || null)
    let grupo = grupoRegistrado
    if (!dadosIntake && anexos.length) {
      const refs = [...new Set(anexos.map((a: any) => String(a?.mensagem_id || ''))
        .filter((v: string) => /^[a-f0-9-]{36}$/i.test(v)))].slice(0, 200)
      if (refs.length && refs.length === anexos.length) {
        const { data: mensagens, error: erroMensagens } = await supabaseAdmin
          .from('atendimento_mensagens').select('id,conversa_id')
          .eq('empresa_id', usuario.empresa_id).in('id', refs)
        if (erroMensagens) throw erroMensagens
        const origens = [...new Set((mensagens || []).map(m => m.conversa_id).filter(Boolean))]
        if ((mensagens || []).length === refs.length && origens.length === 1) conversaId = origens[0]
      }
    }
    if (conversaId) {
      const { data: conversa, error: erroConversa } = await supabaseAdmin
        .from('atendimento_conversas')
        .select('id,whatsapp_chat_tipo,whatsapp_chat_jid,whatsapp_canal_id,grupo_nome')
        .eq('empresa_id', usuario.empresa_id).eq('id', conversaId).maybeSingle()
      if (erroConversa) throw erroConversa
      if (conversa?.whatsapp_chat_tipo === 'grupo' && conversa.whatsapp_canal_id && conversa.whatsapp_chat_jid) {
        const { data: grupos, error: erroGrupo } = await supabaseAdmin
          .from('atendimento_whatsapp_grupos').select('nome')
          .eq('empresa_id', usuario.empresa_id)
          .eq('whatsapp_canal_id', conversa.whatsapp_canal_id)
          .eq('grupo_jid', conversa.whatsapp_chat_jid)
        if (erroGrupo) throw erroGrupo
        const nomes = [...new Set((grupos || []).map(g => String(g.nome || '').trim()).filter(Boolean))]
        if (nomes.length === 1) {
          grupo = nomes[0]
        } else if (!grupo && conversa.grupo_nome && normalizar(conversa.grupo_nome) !== 'grupo whatsapp') {
          grupo = conversa.grupo_nome
        }
      } else {
        // Não oferecemos um link para uma conversa que não seja de grupo.
        conversaId = null
      }
    }
    const grupoConferido = normalizar(grupo) === 'orcamento / assistencia'
    const origemStatus = !grupo ? 'nao_identificada' : grupoConferido ? 'correta' : 'outro_grupo'
    const historico = !dadosIntake
    if (!grupo) grupo = 'Não foi possível identificar o grupo original'
    const textoOriginal = registros.length
      ? registros.map(r => String(r.conteudo_bruto || '')).filter(Boolean).join('\n\n')
      : String(fontes.conteudo_bruto || orcamento.descricao_livre || '')
    const idsMensagens = [...new Set(registros.flatMap(r =>
      Array.isArray(r.mensagens_ids) ? r.mensagens_ids.map(String) : []))]
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
      origemStatus,
      historico,
      conversaId,
      participanteNome: dadosIntake?.participante_nome || null,
      primeiraMensagemEm: registros[0]?.primeira_mensagem_em || orcamento.created_at,
      ultimaMensagemEm: dadosIntake?.ultima_mensagem_em || orcamento.created_at,
      totalMensagens: registros.length ? idsMensagens.length : null,
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
