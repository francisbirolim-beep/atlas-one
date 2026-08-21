import { NextRequest, NextResponse } from 'next/server'
import { carregarDadosExternosAssistencia, buscarAcessoValidoAssistencia } from '@/lib/assistenciaAcessoExternoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function texto(valor: unknown, limite = 10000) {
  return String(valor || '').trim().slice(0, limite)
}

function assinatura(valor: unknown) {
  const conteudo = String(valor || '')
  if (!conteudo.startsWith('data:image/png;base64,')) return ''
  // Assinaturas desenhadas costumam ficar muito abaixo deste limite.
  return conteudo.slice(0, 500000)
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const dados = await carregarDadosExternosAssistencia(params.token)
  if (!dados) {
    return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })
  }
  return NextResponse.json(dados)
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoAssistencia(params.token)
  if (!acesso) {
    return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const tecnicoNome = texto(body?.tecnicoNome, 180) || acesso.nome_tecnico || ''
  const dataAtendimento = texto(body?.dataAtendimento, 10)
  const servicoRealizado = texto(body?.servicoRealizado)
  const materiaisUtilizados = texto(body?.materiaisUtilizados)
  const observacoesAtendimento = texto(body?.observacoesAtendimento)
  const assinaturaTecnico = assinatura(body?.assinaturaTecnico)
  const assinaturaCliente = assinatura(body?.assinaturaCliente)

  if (!tecnicoNome) {
    return NextResponse.json({ error: 'Informe o nome do tecnico.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento)) {
    return NextResponse.json({ error: 'Informe a data do atendimento.' }, { status: 400 })
  }
  if (!assinaturaTecnico || !assinaturaCliente) {
    return NextResponse.json({ error: 'As assinaturas do tecnico e do cliente sao obrigatorias para concluir.' }, { status: 400 })
  }

  const agora = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('assistencias')
    .update({
      tecnico_nome: tecnicoNome,
      data_atendimento: dataAtendimento,
      servico_realizado: servicoRealizado || null,
      materiais_utilizados: materiaisUtilizados || null,
      observacoes_atendimento: observacoesAtendimento || null,
      assinatura_tecnico: assinaturaTecnico,
      assinatura_cliente: assinaturaCliente,
      atendimento_concluido_em: agora,
      atualizado_em: agora,
    })
    .eq('id', acesso.assistencia_id)

  if (error) {
    return NextResponse.json({ error: 'Nao foi possivel salvar o atendimento.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('assistencia_acessos_externos')
    .update({ ultimo_acesso_em: agora })
    .eq('id', acesso.id)

  return NextResponse.json({ ok: true, concluidoEm: agora })
}
