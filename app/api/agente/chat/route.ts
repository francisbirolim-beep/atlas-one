import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario, rodarLoop, obterOuCriarConversaHoje, salvarMensagem } from '@/lib/agente'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const usuario = await verificarUsuario(authHeader)
    if (!usuario) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Agente IA nao configurado (falta ANTHROPIC_API_KEY no servidor)' }, { status: 500 })
    }

    const body = await req.json()
    const mensagemTexto = (body.mensagem || '').trim()
    const historico = Array.isArray(body.messages) ? body.messages : []
    if (!mensagemTexto) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }

    const conversaId = await obterOuCriarConversaHoje(usuario.id)
    await salvarMensagem(conversaId, 'user', mensagemTexto)

    const messages = [...historico, { role: 'user', content: mensagemTexto }]
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
