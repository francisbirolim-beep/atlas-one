import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const COLUNAS_PADRAO = ['A fazer', 'Em andamento', 'Concluido']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ID estável evita duplicação mesmo em requisições simultâneas ou reenvios.
function idDaTarefa(medicaoId: string, usuarioId: string) {
  const bytes = createHash('sha256').update(`atlas:medicao:revisao:${medicaoId}:${usuarioId}`).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x80 // UUID custom version 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

async function autenticar(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios')
    .select('id,nome,role,empresa_id').eq('id', data.user.id).maybeSingle()
  return usuario || null
}

async function colunaInicial(usuarioId: string, empresaId: string) {
  const { data: existentes, error: erroColunas } = await supabaseAdmin.from('tarefa_colunas')
    .select('id').eq('usuario_id', usuarioId).eq('empresa_id', empresaId)
    .order('ordem', { ascending: true }).limit(1)
  if (erroColunas) throw erroColunas
  if (existentes?.[0]?.id) return existentes[0].id
  const { data: criadas, error } = await supabaseAdmin.from('tarefa_colunas')
    .insert(COLUNAS_PADRAO.map((nome, ordem) => ({
      usuario_id: usuarioId, empresa_id: empresaId, nome, ordem,
    }))).select('id,ordem').order('ordem', { ascending: true })
  if (error) {
    // Outro pedido pode ter criado as colunas no mesmo instante.
    const { data: recuperadas } = await supabaseAdmin.from('tarefa_colunas')
      .select('id').eq('usuario_id', usuarioId).eq('empresa_id', empresaId)
      .order('ordem', { ascending: true }).limit(1)
    if (recuperadas?.[0]?.id) return recuperadas[0].id
    throw error
  }
  if (!criadas?.[0]?.id) throw new Error('Não foi possível preparar a coluna de tarefas')
  return criadas[0].id
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID.test(params.id)) return NextResponse.json({ error: 'Medição inválida' }, { status: 400 })
    const solicitante = await autenticar(req)
    if (!solicitante) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    if (solicitante.role !== 'master') return NextResponse.json({
      error: 'Somente usuários Master podem atribuir responsáveis pela conferência.',
    }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const responsaveis = [...new Set(Array.isArray(body?.responsaveis) ? body.responsaveis : [])]
    if (responsaveis.length < 1 || responsaveis.length > 15 || responsaveis.some(
      id => typeof id !== 'string' || !UUID.test(id)
    )) return NextResponse.json({ error: 'Selecione de 1 a 15 responsáveis válidos.' }, { status: 400 })

    const { data: medicao, error: erroMedicao } = await supabaseAdmin.from('medicoes_finais')
      .select('id,empresa_id,cliente_id,cliente_nome,obra_id,orcamento_id,status_operacional')
      .eq('id', params.id).eq('empresa_id', solicitante.empresa_id).maybeSingle()
    if (erroMedicao) throw erroMedicao
    if (!medicao) return NextResponse.json({ error: 'Medição não encontrada para esta empresa.' }, { status: 404 })
    if (!['concluido','aprovado'].includes(medicao.status_operacional || '')) return NextResponse.json({
      error: 'Conclua e envie a Medida Final antes de criar tarefas para conferência.',
    }, { status: 409 })

    const { data: usuarios, error: erroUsuarios } = await supabaseAdmin.from('usuarios')
      .select('id,nome').eq('empresa_id', solicitante.empresa_id).in('id', responsaveis)
    if (erroUsuarios) throw erroUsuarios
    if ((usuarios || []).length !== responsaveis.length) return NextResponse.json({
      error: 'Um dos responsáveis não pertence à empresa.',
    }, { status: 400 })

    const { data: obra } = medicao.obra_id
      ? await supabaseAdmin.from('obras').select('nome').eq('id', medicao.obra_id)
          .eq('empresa_id', solicitante.empresa_id).maybeSingle()
      : { data: null }
    const nomeObra = obra?.nome || medicao.cliente_nome || 'Obra'
    const marcador = `[atlas-medicao-final:${medicao.id}]`
    const href = `/producao/medicao-final/${medicao.id}`
    let criadas = 0
    let existentes = 0
    for (const usuario of usuarios || []) {
      const tarefaId = idDaTarefa(medicao.id, usuario.id)
      const { data: jaExiste, error: erroConsulta } = await supabaseAdmin.from('tarefas')
        .select('id').eq('id', tarefaId).eq('empresa_id', solicitante.empresa_id).maybeSingle()
      if (erroConsulta) throw erroConsulta
      if (!jaExiste) {
        const colunaId = await colunaInicial(usuario.id, solicitante.empresa_id)
        const { error: erroTarefa } = await supabaseAdmin.from('tarefas').insert({
          id: tarefaId,
          empresa_id: solicitante.empresa_id,
          usuario_id: usuario.id,
          coluna_id: colunaId,
          titulo: `Conferir Medida Final · ${nomeObra}`,
          descricao: `${marcador}\nCliente: ${medicao.cliente_nome || '—'}\nObra: ${nomeObra}\nAbrir medição: ${href}\nConferir fotos, medidas e dar seguimento à produção.`,
          prioridade: 'alta',
          solicitante_id: solicitante.id,
          solicitante_nome: solicitante.nome,
          atribuida_em: new Date().toISOString(),
          orcamento_id: medicao.orcamento_id,
          cliente_id: medicao.cliente_id,
          obra_id: medicao.obra_id,
        })
        if (erroTarefa && erroTarefa.code !== '23505') throw erroTarefa
        if (!erroTarefa) criadas++
        else existentes++
      } else existentes++

      const { error: erroNotificacao } = await supabaseAdmin.from('notificacoes').insert({
        empresa_id: solicitante.empresa_id,
        usuario_id: usuario.id,
        categoria: 'operacao',
        tipo: 'tarefa',
        titulo: 'Medida Final pronta para conferência',
        mensagem: `Você recebeu uma tarefa para conferir a Medida Final da obra ${nomeObra}.`,
        href,
        origem_tipo: 'medicao_final_conferencia',
        origem_id: medicao.id,
        criado_por_id: solicitante.id,
        criado_por_nome: solicitante.nome,
      })
      if (erroNotificacao && erroNotificacao.code !== '23505') throw erroNotificacao
    }
    return NextResponse.json({ ok: true, criadas, existentes, total: responsaveis.length })
  } catch (erro) {
    console.error('Falha ao atribuir conferência de Medida Final:', erro)
    return NextResponse.json({ error: 'Não foi possível criar todas as tarefas. Tente novamente, sem reenviar a medição.' }, { status: 500 })
  }
}
