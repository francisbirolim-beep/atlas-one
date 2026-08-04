import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario, rodarLoop, executarPropostaTarefa, executarPropostaEvento, obterOuCriarConversaHoje, salvarMensagem, ACTION_TOOLS, commitArquivoCodigo } from '@/lib/agente'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const usuario = await verificarUsuario(authHeader)
    if (!usuario) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || ''

    const body = await req.json()
    const historico = Array.isArray(body.messages) ? body.messages : []
    const toolUseId = body.toolUseId
    const decisao = body.decisao
    const proposta = body.proposta

    if (!toolUseId || !proposta || (decisao !== 'confirmar' && decisao !== 'cancelar')) {
      return NextResponse.json({ error: 'Requisicao invalida' }, { status: 400 })
    }
    if (ACTION_TOOLS.indexOf(proposta.name) === -1) {
      return NextResponse.json({ error: 'Acao desconhecida' }, { status: 400 })
    }

    let resultadoExecucao
    if (decisao === 'cancelar') {
      resultadoExecucao = { ok: false, cancelado: true, mensagem: 'O usuario cancelou esta acao.' }
    } else if (proposta.name === 'propor_criar_tarefa') {
      resultadoExecucao = await executarPropostaTarefa(usuario.id, proposta.input || {})
    } else if (proposta.name === 'propor_criar_evento') {
      resultadoExecucao = await executarPropostaEvento(usuario.id, proposta.input || {})
    } else if (proposta.name === 'propor_editar_arquivo_codigo') {
      if (usuario.role !== 'master') {
        resultadoExecucao = { ok: false, erro: 'Apenas o usuario master pode confirmar alteracoes de codigo.' }
      } else {
        const input = proposta.input || {}
        resultadoExecucao = await commitArquivoCodigo(input.caminho, input.novo_conteudo, input.mensagem_commit)
      }
    } else {
      resultadoExecucao = { ok: false, erro: 'Acao nao implementada.' }
    }

    const conversaId = await obterOuCriarConversaHoje(usuario.id)

    const messages = [
      ...historico,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(resultadoExecucao) }] },
    ]
    const resultado = await rodarLoop(messages, usuario.id, usuario.nome, usuario.role, apiKey)

    if (resultado.done && resultado.text) {
      await salvarMensagem(conversaId, 'assistant', resultado.text)
    }

    return NextResponse.json({
      text: resultado.text || '',
      done: resultado.done,
      pendingAction: resultado.pendingAction || null,
      messages: resultado.messages,
      execucao: resultadoExecucao,
      conversaId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro inesperado no agente: ' + String(e && e.message ? e.message : e) }, { status: 500 })
  }
}
