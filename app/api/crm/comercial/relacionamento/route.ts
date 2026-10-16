import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { lerAcessoConfigServer, usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const texto = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null
const vazio = () => ({ data: [], error: null })

export async function GET(req: NextRequest) {
  try {
    const u = await autenticarTenant(req)
    if (!u) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    const permitido = await usuarioPodeAcaoServer({
      usuarioId: u.id, role: u.role, empresaId: u.empresa_id,
      setorId: 'crm', acaoId: 'comercial.crm.consultar', minimo: 'consulta',
    })
    if (!permitido) return NextResponse.json({ error: 'Sem acesso ao CRM.' }, { status: 403 })

    const fonte = req.nextUrl.searchParams.get('fonte')
    const id = req.nextUrl.searchParams.get('id') || ''
    if ((fonte !== 'orc' && fonte !== 'pro') || !uuid.test(id)) {
      return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })
    }
    const config = u.role === 'master' ? null : await lerAcessoConfigServer(u.id, u.empresa_id)
    const propria = u.role !== 'master' && config?.crmEscopo !== 'todos'

    // Verificação do registro antes de qualquer busca de histórico ou tarefa.
    // Uma URL construída manualmente nunca amplia a carteira.
    let origem
    if (fonte === 'orc') {
      let q = supabaseAdmin.from('orcamentos')
        .select('id,cliente_id,cliente_nome,criado_por_id')
        .eq('empresa_id', u.empresa_id).eq('id', id)
      if (propria) q = q.eq('criado_por_id', u.id)
      origem = await q.maybeSingle()
    } else {
      let q = supabaseAdmin.from('prospeccoes')
        .select('id,cliente_id,nome_cliente,responsavel_id')
        .eq('empresa_id', u.empresa_id).eq('id', id)
      if (propria) q = q.eq('responsavel_id', u.id)
      origem = await q.maybeSingle()
    }
    if (origem.error) return NextResponse.json({ error: 'Falha ao conferir o registro comercial.' }, { status: 503 })
    if (!origem.data) return NextResponse.json({ error: 'Oportunidade não encontrada na carteira autorizada.' }, { status: 404 })

    const podeHistorico = await usuarioPodeAcaoServer({
      usuarioId: u.id, role: u.role, empresaId: u.empresa_id,
      setorId: 'crm', acaoId: 'comercial.crm.interacoes', minimo: 'consulta',
    })
    const podeTarefas = await usuarioPodeAcaoServer({
      usuarioId: u.id, role: u.role, empresaId: u.empresa_id,
      setorId: 'crm', acaoId: 'comercial.crm.tarefas', minimo: 'consulta',
    })

    const clienteId = texto(origem.data.cliente_id)
    let historicoQ: PromiseLike<any> = Promise.resolve(vazio())
    if (podeHistorico) {
      if (fonte === 'pro') {
        historicoQ = supabaseAdmin.from('prospeccao_interacoes')
          .select('id,tipo,descricao,usuario_nome,created_at')
          .eq('empresa_id', u.empresa_id).eq('prospeccao_id', id)
          .order('created_at', { ascending: false }).limit(60)
      } else {
        let q = supabaseAdmin.from('crm_interacoes')
          .select('id,tipo,descricao,usuario_nome,created_at')
          .eq('empresa_id', u.empresa_id)
        // Na carteira individual, não abrir contatos gerais do cliente feitos
        // por terceiros. Somente os eventos vinculados ao orçamento do vendedor.
        if (!propria && clienteId) {
          q = q.or('orcamento_id.eq.' + id + ',cliente_id.eq.' + clienteId)
        } else {
          q = q.eq('orcamento_id', id)
        }
        historicoQ = q.order('created_at', { ascending: false }).limit(60)
      }
    }
    let tarefaQ: PromiseLike<any> = Promise.resolve(vazio())
    if (podeTarefas) {
      let q = supabaseAdmin.from('crm_tarefas')
        .select('id,titulo,descricao,data_vencimento,concluida,responsavel_nome,created_at')
        .eq('empresa_id', u.empresa_id)
      if (propria) q = q.eq('responsavel_id', u.id)
      if (fonte === 'orc') {
        q = !propria && clienteId
          ? q.or('orcamento_id.eq.' + id + ',cliente_id.eq.' + clienteId)
          : q.eq('orcamento_id', id)
      } else if (clienteId) {
        q = q.eq('cliente_id', clienteId)
      } else {
        // Prospecção ainda sem cliente formal não tem vínculo com crm_tarefas.
        q = q.eq('cliente_id', '00000000-0000-0000-0000-000000000000')
      }
      tarefaQ = q.order('created_at', { ascending: false }).limit(60)
    }
    const [historico, tarefas] = await Promise.all([historicoQ, tarefaQ])
    if (historico.error || tarefas.error) return NextResponse.json({ error: 'Falha ao carregar o acompanhamento autorizado.' }, { status: 503 })
    return NextResponse.json({
      ok: true, somenteLeitura: true, fonte,
      historicoVisivel: podeHistorico, tarefasVisiveis: podeTarefas,
      historico: (historico.data || []).map((h: any) => ({
        id: h.id, tipo: h.tipo, descricao: h.descricao,
        autor: h.usuario_nome, data: h.created_at,
      })),
      tarefas: (tarefas.data || []).map((t: any) => ({
        id: t.id, titulo: t.titulo, descricao: t.descricao,
        vencimento: t.data_vencimento, concluida: t.concluida,
        responsavel: t.responsavel_nome,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível conferir as permissões da carteira.' }, { status: 503 })
  }
}