import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario, rodarLoop, obterOuCriarConversaHoje, salvarMensagem } from '@/lib/agente'

const TAMANHO_MAX_BASE64 = 12_000_000

export async function POST(req: NextRequest) {
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

    if (!mensagemTexto && !anexo) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }
    if (anexo && typeof anexo.dados === 'string' && anexo.dados.length > TAMANHO_MAX_BASE64) {
      return NextResponse.json({ error: 'Arquivo anexado muito grande' }, { status: 400 })
    }

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

    const conversaId = await obterOuCriarConversaHoje(usuario.id)
    await salvarMensagem(conversaId, 'user', textoParaSalvar)

    const messages = [...historico, { role: 'user', content }]
    const resultado = await rodarLoop(messages, usuario.id, usuario.nome, usuario.role, apiKey)

    if (resultado.done && resultado.text) {
      await salvarMensagem(conversaId, 'assistant', resultado.text)
    }

    return NextResponse.json({
      text: resultado.text || '',
      done: resultado.done,
      pendingAction: resultado.pendingAction || null,
      messages: resultado.messages,
      conversaId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro inesperado no agente: ' + String(e && e.message ? e.message : e) }, { status: 500 })
  }
}
