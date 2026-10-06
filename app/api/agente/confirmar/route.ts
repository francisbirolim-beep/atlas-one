import { NextRequest, NextResponse } from 'next/server'
import {
  verificarUsuario,
  executarPropostaTarefa,
  executarPropostaEvento,
  obterOuCriarConversaHoje,
  salvarMensagem,
  ACTION_TOOLS,
} from '@/lib/agente'

function textoResultado(decisao: string, proposta: any, resultado: any) {
  if (decisao === 'cancelar') return 'Ação cancelada.'
  if (resultado?.ok) {
    if (proposta?.name === 'propor_criar_tarefa') {
      return 'Tarefa criada com sucesso' + (resultado?.titulo ? ': ' + resultado.titulo : '.') 
    }
    if (proposta?.name === 'propor_criar_evento') {
      return 'Evento criado com sucesso' + (resultado?.titulo ? ': ' + resultado.titulo : '.')
    }
    return 'Ação concluída com sucesso.'
  }
  return resultado?.erro || resultado?.mensagem || 'Não foi possível concluir a ação.'
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const usuario = await verificarUsuario(authHeader)
    if (!usuario) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

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
      resultadoExecucao = {
        ok: false,
        bloqueado: true,
        erro: 'Execucao de alteracao de codigo pela IA esta bloqueada por seguranca. O Atlas exige branch, PR, CI e aprovacao antes de qualquer merge.',
      }
    } else {
      resultadoExecucao = { ok: false, erro: 'Acao nao implementada.' }
    }

    const conversaId = await obterOuCriarConversaHoje(usuario.id, usuario.empresa_id)
    const texto = textoResultado(decisao, proposta, resultadoExecucao)
    await salvarMensagem(conversaId, 'assistant', texto)

    const messages = [
      ...historico,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(resultadoExecucao) }] },
      { role: 'assistant', content: [{ type: 'text', text: texto }] },
    ]

    return NextResponse.json({
      text: texto,
      done: true,
      pendingAction: null,
      messages,
      execucao: resultadoExecucao,
      conversaId,
      provider: 'atlas-interno',
      modelo: 'acao-direta',
      custoEstimado: 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro inesperado no agente: ' + String(e && e.message ? e.message : e) }, { status: 500 })
  }
}
