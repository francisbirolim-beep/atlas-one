import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario, rodarLoop, obterOuCriarConversaHoje, criarConversaAgente, validarConversaAgente, salvarMensagem } from '@/lib/agente'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const TAMANHO_MAX_BASE64 = 12_000_000

function tarefaResumida(texto: string) {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/orcamento|orcamentos|venda|vendas/.test(t)) return 'Consultando dados de orçamento e vendas'
  if (/cliente|clientes/.test(t)) return 'Consultando dados de clientes'
  if (/financeir|caixa|receber|pagar|custo/.test(t)) return 'Consultando dados financeiros'
  if (/estoque|produto|catalogo|perfil|acessorio/.test(t)) return 'Consultando produtos, catálogo e estoque'
  if (/producao|instalacao|obra|medicao/.test(t)) return 'Consultando operação e andamento das obras'
  return 'Analisando uma pergunta na IA geral'
}

export async function POST(req: NextRequest) {
  let atividadeId: string | null = null
  try {
    const authHeader = req.headers.get('authorization') || ''
    const usuario = await verificarUsuario(authHeader)
    if (!usuario) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || ''

    const body = await req.json()
    const mensagemTexto = (body.mensagem || '').trim()
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
      detalhe: { possui_anexo: Boolean(anexo) },
    }).select('id').single()
    atividadeId = atividade?.id || null

    let content: any = mensagemTexto
    let textoParaSalvar = mensagemTexto

    if (anexo) {
      const blocos: any[] = []
      if (anexo.tipo === 'imagem') {
        blocos.push({ type: 'image', source: { type: 'base64', media_type: anexo.mediaType || 'image/png', data: anexo.dados } })
      } else if (anexo.tipo === 'pdf') {
        blocos.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: anexo.dados } })
      } else if (anexo.tipo === 'texto') {
        blocos.push({ type: 'text', text: 'Conteudo do arquivo anexado "' + (anexo.nome || 'arquivo') + '":\n\n' + String(anexo.dados || '').slice(0, 30000) })
      }
      blocos.push({ type: 'text', text: mensagemTexto || 'Analise o conteudo anexado e me diga o que encontrou.' })
      content = blocos
      textoParaSalvar = (mensagemTexto ? mensagemTexto + '\n\n' : '') + '[Anexo: ' + (anexo.nome || 'arquivo') + ']'
    }

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
    await salvarMensagem(conversaId, 'user', textoParaSalvar)

    const messages = [...historico, { role: 'user', content }]
    const resultado = await rodarLoop(messages, usuario.id, usuario.nome, usuario.role, apiKey, usuario.empresa_id)

    if (resultado.done && resultado.text) {
      await salvarMensagem(conversaId, 'assistant', resultado.text)
    }

    if (atividadeId) {
      await supabaseAdmin.from('ia_agente_atividade').update({
        status: 'concluido',
        atualizou_em: new Date().toISOString(),
        finalizou_em: new Date().toISOString(),
      }).eq('id', atividadeId)
    }

    return NextResponse.json({
      text: resultado.text || '',
      done: resultado.done,
      pendingAction: resultado.pendingAction || null,
      messages: resultado.messages,
      conversaId,
    })
  } catch (e: any) {
    if (atividadeId) {
      await supabaseAdmin.from('ia_agente_atividade').update({
        status: 'erro',
        atualizou_em: new Date().toISOString(),
        finalizou_em: new Date().toISOString(),
        detalhe: { erro: String(e && e.message ? e.message : e).slice(0, 500) },
      }).eq('id', atividadeId)
    }
    return NextResponse.json({ error: 'Erro inesperado no agente: ' + String(e && e.message ? e.message : e) }, { status: 500 })
  }
}