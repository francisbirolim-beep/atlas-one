import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Acompanhamento exclusivamente de tarefas solicitadas pelo usuário autenticado.
// Nunca retornar registros de outras empresas ou alterar o Kanban do responsável.
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: autenticado, error: authErro } = await supabaseAdmin.auth.getUser(token)
  if (authErro || !autenticado.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const { data: solicitante, error: perfilErro } = await supabaseAdmin
    .from('usuarios')
    .select('id, empresa_id')
    .eq('id', autenticado.user.id)
    .maybeSingle()
  if (perfilErro || !solicitante?.empresa_id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data: tarefas, error } = await supabaseAdmin.from('tarefas')
    .select('id, usuario_id, coluna_id, titulo, descricao, data_hora, concluida_em, solicitante_id, solicitante_nome, atribuida_em, prioridade, created_at')
    .eq('solicitante_id', solicitante.id)
    .eq('empresa_id', solicitante.empresa_id)
    .neq('usuario_id', solicitante.id)
    .order('created_at', { ascending: false })
    .limit(700)
  if (error) return NextResponse.json({ error: 'Falha ao consultar tarefas delegadas' }, { status: 500 })

  const idsUsuarios = [...new Set((tarefas || []).map(t => t.usuario_id).filter(Boolean))]
  const idsColunas = [...new Set((tarefas || []).map(t => t.coluna_id).filter(Boolean))]

  const [nomes, etapas] = await Promise.all([
    idsUsuarios.length
      ? supabaseAdmin.from('usuarios').select('id, nome').eq('empresa_id', solicitante.empresa_id).in('id', idsUsuarios)
      : Promise.resolve({ data: [], error: null }),
    idsColunas.length
      ? supabaseAdmin.from('tarefa_colunas').select('id, nome, usuario_id').eq('empresa_id', solicitante.empresa_id).in('id', idsColunas)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (nomes.error || etapas.error) return NextResponse.json({ error: 'Falha ao consultar responsáveis' }, { status: 500 })
  const porUsuario = new Map((nomes.data || []).map(item => [item.id, item.nome]))
  const porColuna = new Map((etapas.data || []).map(item => [item.id, item]))

  return NextResponse.json({
    tarefas: (tarefas || []).map(t => ({
      ...t,
      responsavel_nome: porUsuario.get(t.usuario_id) || 'Responsável',
      coluna_nome: porColuna.get(t.coluna_id)?.usuario_id === t.usuario_id
        ? porColuna.get(t.coluna_id)?.nome || 'A fazer'
        : 'A fazer',
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
