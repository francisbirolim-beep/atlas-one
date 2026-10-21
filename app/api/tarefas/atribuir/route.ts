import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const COLUNAS_PADRAO = ['A fazer', 'Em andamento', 'Concluido']
const PRIORIDADES = new Set(['baixa', 'normal', 'alta', 'urgente'])

async function autenticar(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!perfil) return null
  return perfil as { id: string; nome: string; role: string; empresa_id: string }
}

async function primeiraColunaDoUsuario(usuarioId: string) {
  const { data: existente, error } = await supabaseAdmin
    .from('tarefa_colunas')
    .select('id,ordem')
    .eq('usuario_id', usuarioId)
    .order('ordem', { ascending: true })
    .limit(1)
  if (error) throw error
  if (existente?.[0]?.id) return existente[0].id as string

  const { data: criadas, error: criarErro } = await supabaseAdmin
    .from('tarefa_colunas')
    .insert(COLUNAS_PADRAO.map((nome, ordem) => ({ usuario_id: usuarioId, nome, ordem })))
    .select('id,ordem')
    .order('ordem', { ascending: true })
  if (criarErro) throw criarErro
  if (!criadas?.[0]?.id) throw new Error('Não foi possível preparar as colunas de tarefas do responsável')
  return criadas[0].id as string
}

export async function POST(req: NextRequest) {
  try {
    const solicitante = await autenticar(req)
    if (!solicitante) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const responsavelId = typeof body.responsavelId === 'string' ? body.responsavelId.trim() : ''
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''
    const dataHora = typeof body.dataHora === 'string' && body.dataHora.trim() ? body.dataHora.trim() : null
    const prioridade = PRIORIDADES.has(body.prioridade) ? body.prioridade : 'normal'
    const origemOrcamentoId = typeof body.origemOrcamentoId === 'string'
      ? body.origemOrcamentoId.trim() : ''
    let clienteOrcamento = ''

    if (!responsavelId || !titulo) {
      return NextResponse.json({ error: 'Responsável e título são obrigatórios' }, { status: 400 })
    }
    if (titulo.length > 300) {
      return NextResponse.json({ error: 'Título muito longo' }, { status: 400 })
    }
    if (dataHora && Number.isNaN(new Date(dataHora).getTime())) {
      return NextResponse.json({ error: 'Data/hora inválida' }, { status: 400 })
    }

    const { data: responsavel, error: responsavelErro } = await supabaseAdmin
      .from('usuarios')
      .select('id,nome')
      .eq('id', responsavelId)
      .maybeSingle()
    if (responsavelErro) throw responsavelErro
    if (!responsavel) return NextResponse.json({ error: 'Responsável não encontrado' }, { status: 404 })

    if (origemOrcamentoId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(origemOrcamentoId)) {
        return NextResponse.json({ error: 'Identificador de orçamento inválido' }, { status: 400 })
      }
      const { data: orcamento, error: erroOrcamento } = await supabaseAdmin
        .from('orcamentos')
        .select('id,empresa_id,criado_por_id,coluna_id,cliente_nome')
        .eq('id', origemOrcamentoId)
        .eq('empresa_id', solicitante.empresa_id)
        .maybeSingle()
      if (erroOrcamento) throw erroOrcamento
      if (!orcamento || orcamento.criado_por_id !== responsavelId || !orcamento.coluna_id) {
        return NextResponse.json({ error: 'Orçamento não pertence ao vendedor solicitado' }, { status: 403 })
      }
      const { data: colunaOrcamento } = await supabaseAdmin
        .from('kanban_colunas').select('nome')
        .eq('id', orcamento.coluna_id)
        .eq('empresa_id', solicitante.empresa_id)
        .maybeSingle()
      const etapa = String(colunaOrcamento?.nome || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      if (etapa !== 'orcamento feito') {
        return NextResponse.json({ error: 'Orçamento ainda não está na etapa de envio' }, { status: 409 })
      }
      clienteOrcamento = String(orcamento.cliente_nome || 'cliente')

      // O mesmo orçamento que volta para a coluna não deve gerar uma segunda
      // cobrança para o vendedor (nem duplicar após retries ou duas abas).
      const { data: existente, error: erroExistente } = await supabaseAdmin
        .from('tarefas')
        .select('*')
        .eq('usuario_id', responsavelId)
        .eq('origem_orcamento_id', origemOrcamentoId)
        .maybeSingle()
      if (!erroExistente && existente) {
        return NextResponse.json({
          ok: true, tarefa: existente, responsavel: { id: responsavelId },
          atribuidaParaOutro: responsavelId !== solicitante.id, jaExistia: true,
        })
      }
    }

    const colunaId = await primeiraColunaDoUsuario(responsavelId)
    const atribuidaParaOutro = responsavelId !== solicitante.id

    const payload = {
        usuario_id: responsavelId,
        coluna_id: colunaId,
        titulo,
        descricao: descricao || null,
        data_hora: dataHora,
        prioridade,
        solicitante_id: solicitante.id,
        solicitante_nome: solicitante.nome,
        atribuida_em: atribuidaParaOutro ? new Date().toISOString() : null,
        ...(origemOrcamentoId ? { origem_orcamento_id: origemOrcamentoId } : {}),
      }
    let { data: tarefa, error: tarefaErro } = await supabaseAdmin
      .from('tarefas').insert(payload).select('*').single()

    // Implantação sem parada: enquanto a migração do vínculo não existir,
    // manter a criação de tarefas que já funcionava.
    if (tarefaErro && origemOrcamentoId &&
        /origem_orcamento_id|schema cache/i.test(tarefaErro.message || '')) {
      const { origem_orcamento_id: _ignorado, ...legado } = payload
      const resultadoLegado = await supabaseAdmin.from('tarefas')
        .insert(legado).select('*').single()
      tarefa = resultadoLegado.data
      tarefaErro = resultadoLegado.error
    }

    if (tarefaErro?.code === '23505' && origemOrcamentoId) {
      const { data: existente } = await supabaseAdmin.from('tarefas').select('*')
        .eq('usuario_id', responsavelId)
        .eq('origem_orcamento_id', origemOrcamentoId).maybeSingle()
      if (existente) {
        return NextResponse.json({
          ok: true, tarefa: existente, responsavel: { id: responsavelId },
          atribuidaParaOutro, jaExistia: true,
        })
      }
    }

    if (tarefaErro) {
      const msg = tarefaErro.message || ''
      if (msg.includes('solicitante_id') || msg.includes('prioridade')) {
        return NextResponse.json({
          code: 'COLABORACAO_INATIVA',
          error: 'A colaboração ainda não foi ativada no banco de produção.',
        }, { status: 503 })
      }
      throw tarefaErro
    }

    if (origemOrcamentoId && tarefa?.origem_orcamento_id) {
      // Além da notificação de tarefa atribuída (quando outro usuário move o
      // card), registrar também o aviso quando o vendedor move o próprio card.
      const { error: avisoErro } = await supabaseAdmin.from('notificacoes').insert({
        empresa_id: solicitante.empresa_id,
        usuario_id: responsavelId,
        categoria: 'tarefas',
        tipo: 'orcamento_pronto_envio',
        titulo: 'Orçamento pronto: ' + clienteOrcamento,
        mensagem: 'Falta enviar ao cliente. Conclua ou reagende a tarefa.',
        href: '/tarefas',
        origem_tipo: 'orcamento_pronto_envio',
        origem_id: origemOrcamentoId,
      })
      if (avisoErro && avisoErro.code !== '23505') {
        console.error('Aviso de orçamento pronto não registrado:', avisoErro.message)
      }
    }

    return NextResponse.json({
      ok: true,
      tarefa,
      responsavel: { id: responsavel.id, nome: responsavel.nome },
      atribuidaParaOutro,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado ao atribuir tarefa' }, { status: 500 })
  }
}
