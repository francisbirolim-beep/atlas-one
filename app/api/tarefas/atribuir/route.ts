import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const COLUNAS_PADRAO = ['A fazer', 'Em andamento', 'Concluido']
const PRIORIDADES = new Set(['baixa', 'normal', 'alta', 'urgente'])

type UsuarioTarefa = { id: string; nome: string; role: string; empresa_id: string }

async function autenticar(req: NextRequest): Promise<UsuarioTarefa | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!perfil?.empresa_id) return null
  return perfil as UsuarioTarefa
}

async function primeiraColunaDoUsuario(usuarioId: string, empresaId: string) {
  const { data: existente, error } = await supabaseAdmin
    .from('tarefa_colunas')
    .select('id,ordem')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .order('ordem', { ascending: true })
    .limit(1)
  if (error) throw error
  if (existente?.[0]?.id) return existente[0].id as string

  const { data: criadas, error: criarErro } = await supabaseAdmin
    .from('tarefa_colunas')
    .insert(COLUNAS_PADRAO.map((nome, ordem) => ({ empresa_id: empresaId, usuario_id: usuarioId, nome, ordem })))
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
      .eq('empresa_id', solicitante.empresa_id)
      .maybeSingle()
    if (responsavelErro) throw responsavelErro
    if (!responsavel) return NextResponse.json({ error: 'Responsável não encontrado nesta empresa' }, { status: 404 })

    const colunaId = await primeiraColunaDoUsuario(responsavelId, solicitante.empresa_id)
    const atribuidaParaOutro = responsavelId !== solicitante.id

    const { data: tarefa, error: tarefaErro } = await supabaseAdmin
      .from('tarefas')
      .insert({
        empresa_id: solicitante.empresa_id,
        usuario_id: responsavelId,
        coluna_id: colunaId,
        titulo,
        descricao: descricao || null,
        data_hora: dataHora,
        prioridade,
        solicitante_id: solicitante.id,
        solicitante_nome: solicitante.nome,
        atribuida_em: atribuidaParaOutro ? new Date().toISOString() : null,
      })
      .select('*')
      .single()

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
