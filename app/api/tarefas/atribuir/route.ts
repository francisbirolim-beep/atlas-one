import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const COLUNAS_PADRAO = ['A fazer', 'Em andamento', 'Aguardando', 'Concluído']
const PRIORIDADES = new Set(['baixa', 'normal', 'alta', 'urgente'])

async function autenticar(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: perfil } = await supabaseAdmin.from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id).maybeSingle()
  if (!perfil?.empresa_id) return null
  return perfil as { id: string; nome: string; role: string; empresa_id: string }
}

async function primeiraColuna(usuarioId: string, empresaId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('tarefa_colunas')
    .select('id').eq('empresa_id', empresaId).eq('usuario_id', usuarioId)
    .order('ordem', { ascending: true }).limit(1)
  if (error) throw error
  if (data?.[0]?.id) return data[0].id
  const { data: criadas, error: erro } = await supabaseAdmin.from('tarefa_colunas')
    .insert(COLUNAS_PADRAO.map((nome, ordem) => ({
      empresa_id: empresaId, usuario_id: usuarioId, nome, ordem,
    })))
    .select('id,ordem').order('ordem', { ascending: true })
  if (erro) throw erro
  if (!criadas?.[0]?.id) throw new Error('Não foi possível preparar o Kanban do usuário')
  return criadas[0].id
}

/** Criação única para o próprio usuário ou cópias ligadas de uma tarefa compartilhada.
 *  O solicitante também enxerga a tarefa que delegou; cada usuário mantém sua coluna.
 *  A propagação de etapa é transacional pelo trigger da migration.
 */
export async function POST(req: NextRequest) {
  try {
    const solicitante = await autenticar(req)
    if (!solicitante) return NextResponse.json({ error: 'Sessão expirada ou usuário sem empresa' }, { status: 401 })

    const body = await req.json()
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''
    const dataHora = typeof body.dataHora === 'string' && body.dataHora.trim() ? body.dataHora.trim() : null
    const prioridade = PRIORIDADES.has(body.prioridade) ? body.prioridade : 'normal'
    const idsRecebidos: unknown[] = Array.isArray(body.responsaveisIds)
      ? body.responsaveisIds : [body.responsavelId || solicitante.id]
    const responsaveisIds = [...new Set(idsRecebidos.filter((id): id is string =>
      typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))]

    if (!titulo || titulo.length > 300 || descricao.length > 3000) {
      return NextResponse.json({ error: 'Informe título válido (até 300 caracteres) e descrição de até 3000 caracteres' }, { status: 400 })
    }
    if (responsaveisIds.length < 1 || responsaveisIds.length > 20 || responsaveisIds.length !== idsRecebidos.length) {
      return NextResponse.json({ error: 'Selecione entre 1 e 20 responsáveis válidos' }, { status: 400 })
    }
    if (dataHora && Number.isNaN(new Date(dataHora).getTime())) {
      return NextResponse.json({ error: 'Data ou horário inválido' }, { status: 400 })
    }

    // Impede atribuição cruzada entre empresas. Nunca confiar no ID enviado pelo navegador.
    const { data: pessoas, error: pessoasErro } = await supabaseAdmin.from('usuarios')
      .select('id,nome').eq('empresa_id', solicitante.empresa_id).in('id', responsaveisIds)
    if (pessoasErro) throw pessoasErro
    if (!pessoas || pessoas.length !== responsaveisIds.length) {
      return NextResponse.json({ error: 'Um ou mais responsáveis não pertencem à sua empresa' }, { status: 403 })
    }

    const participantes = [...new Set([solicitante.id, ...responsaveisIds])]
    const colunas = await Promise.all(participantes.map(async id => ({
      id, colunaId: await primeiraColuna(id, solicitante.empresa_id),
    })))
    const compartilhada = participantes.length > 1
    const grupoId = compartilhada ? randomUUID() : null
    const nomes = pessoas.map(p => p.nome)
    const agora = new Date().toISOString()
    const linhas = colunas.map(c => ({
      empresa_id: solicitante.empresa_id,
      usuario_id: c.id,
      coluna_id: c.colunaId,
      titulo, descricao: descricao || null, data_hora: dataHora,
      prioridade, solicitante_id: solicitante.id, solicitante_nome: solicitante.nome,
      atribuida_em: c.id !== solicitante.id ? agora : null,
      tarefa_grupo_id: grupoId,
      responsaveis_nomes: nomes,
    }))
    const { data: tarefas, error: erro } = await supabaseAdmin.from('tarefas')
      .insert(linhas).select('*')
    if (erro) {
      const msg = erro.message || ''
      if (/tarefa_grupo_id|responsaveis_nomes|solicitante_id|prioridade|column.*not found/i.test(msg)) {
        return NextResponse.json({
          code: 'COLABORACAO_INATIVA',
          error: 'A atualização de tarefas compartilhadas ainda não foi aplicada ao banco de dados.',
        }, { status: 503 })
      }
      throw erro
    }

    return NextResponse.json({
      ok: true, tarefa: (tarefas || []).find(t => t.usuario_id === solicitante.id) || tarefas?.[0],
      grupoId, quantidadeDestinatarios: responsaveisIds.length,
      atribuidaParaOutro: responsaveisIds.some(id => id !== solicitante.id),
    })
  } catch (e: any) {
    console.error('Falha ao criar tarefa:', e)
    return NextResponse.json({ error: e?.message || 'Erro inesperado ao criar tarefa' }, { status: 500 })
  }
}
