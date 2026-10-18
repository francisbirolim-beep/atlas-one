import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { nivelAcaoUsuarioServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ehUUID, revisaoValida, validarEditorial } from '@/lib/marketing/editorialRegras'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Desligado até migration, RLS, storage e testes autenticados em homologação.
function desligado() {
  return process.env.MARKETING_BACKEND_ENABLED !== 'true'
}
function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status, headers: { 'Cache-Control': 'no-store' } })
}
async function usuarioAutorizado(req: NextRequest, nivelMinimo: 'consulta'|'edicao'): Promise<{ usuario: UsuarioTenant } | { resposta: NextResponse }> {
  const usuario = await autenticarTenant(req)
  if (!usuario) return { resposta: erro('Sessão inválida.', 401) }
  try {
    const nivel = await nivelAcaoUsuarioServer({
      usuarioId: usuario.id, role: usuario.role, setorId: 'marketing',
      acaoId: 'marketing.editorial', empresaId: usuario.empresa_id,
    })
    if (nivel === 'oculto' || (nivelMinimo === 'edicao' && nivel !== 'edicao')) {
      return { resposta: erro('Sem permissão para este recurso.', 403) }
    }
    return { usuario }
  } catch {
    return { resposta: erro('Não foi possível confirmar a permissão.', 503) }
  }
}
export async function GET(req: NextRequest) {
  if (desligado()) return erro('Backend do Marketing em homologação, ainda desligado.', 503)
  const acesso = await usuarioAutorizado(req, 'consulta')
  if ('resposta' in acesso) return acesso.resposta
  const empresaId = acesso.usuario.empresa_id
  const [midias, posts] = await Promise.all([
    supabaseAdmin.from('marketing_midias')
      .select('id,obra_id,nome,tipo_mime,tamanho_bytes,direitos_confirmados,criado_em')
      .eq('empresa_id', empresaId).order('criado_em', { ascending: false }).limit(100),
    supabaseAdmin.from('marketing_publicacoes')
      .select('id,midia_id,titulo,legenda,canal,data_planejada,status,revisao,aprovado_em')
      .eq('empresa_id', empresaId).order('data_planejada', { ascending: false }).limit(100),
  ])
  if (midias.error || posts.error) return erro('Não foi possível consultar os rascunhos.', 503)
  return NextResponse.json({ midias: midias.data || [], publicacoes: posts.data || [], postagemAutomatica: false }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  if (desligado()) return erro('Backend do Marketing em homologação, ainda desligado.', 503)
  const acesso = await usuarioAutorizado(req, 'edicao')
  if ('resposta' in acesso) return acesso.resposta
  const u = acesso.usuario
  let body: Record<string, unknown>
  try {
    const recebido: unknown = await req.json()
    if (!recebido || typeof recebido !== 'object' || Array.isArray(recebido)) return erro('Dados inválidos.', 400)
    body = recebido as Record<string, unknown>
  } catch { return erro('JSON inválido.', 400) }

  if (body.acao === 'criar_rascunho') {
    if (!ehUUID(body.midia_id)) return erro('Mídia inválida.', 400)
    const dados = validarEditorial(body)
    if (!dados) return erro('Confira o título, legenda, canal e data.', 422)
    const midia = await supabaseAdmin.from('marketing_midias').select('id')
      .eq('id', body.midia_id).eq('empresa_id', u.empresa_id).maybeSingle()
    if (midia.error) return erro('Falha ao consultar a mídia.', 503)
    if (!midia.data) return erro('Mídia não encontrada nesta empresa.', 404)
    const gravado = await supabaseAdmin.from('marketing_publicacoes')
      .insert({ ...dados, empresa_id: u.empresa_id, midia_id: body.midia_id,
        criado_por_id: u.id, alterado_por_id: u.id, status: 'rascunho' })
      .select('id,status,revisao').single()
    if (gravado.error) return erro('Não foi possível criar o rascunho.', 503)
    return NextResponse.json({ publicacao: gravado.data, postagemAutomatica: false }, { status: 201 })
  }

  if (body.acao === 'editar_rascunho' || body.acao === 'aprovar' || body.acao === 'reabrir') {
    if (!ehUUID(body.id) || !revisaoValida(body.revisao)) return erro('ID ou versão inválidos.', 400)
    const patch: Record<string, unknown> = { revisao: body.revisao + 1, alterado_por_id: u.id }
    if (body.acao === 'editar_rascunho') {
      const dados = validarEditorial(body)
      if (!dados) return erro('Confira o título, legenda, canal e data.', 422)
      Object.assign(patch, dados, { status: 'rascunho', aprovado_por_id: null, aprovado_em: null })
    } else if (body.acao === 'reabrir') {
      Object.assign(patch, { status: 'rascunho', aprovado_por_id: null, aprovado_em: null })
    } else {
      const registro = await supabaseAdmin.from('marketing_publicacoes')
        .select('midia_id').eq('empresa_id', u.empresa_id).eq('id', body.id)
        .eq('revisao', body.revisao).maybeSingle()
      if (registro.error) return erro('Falha ao conferir a publicação.', 503)
      if (!registro.data) return erro('A publicação mudou. Atualize a tela.', 409)
      const midia = await supabaseAdmin.from('marketing_midias')
        .select('direitos_confirmados').eq('empresa_id', u.empresa_id)
        .eq('id', registro.data.midia_id).maybeSingle()
      if (midia.error) return erro('Falha ao conferir a autorização.', 503)
      if (!midia.data?.direitos_confirmados) return erro('Mídia sem autorização documentada.', 422)
      Object.assign(patch, { status: 'aprovado', aprovado_por_id: u.id, aprovado_em: new Date().toISOString() })
    }
    const gravado = await supabaseAdmin.from('marketing_publicacoes')
      .update(patch).eq('empresa_id', u.empresa_id).eq('id', body.id)
      .eq('revisao', body.revisao).select('id,status,revisao').maybeSingle()
    if (gravado.error) return erro('Não foi possível salvar. Verifique autorização e integridade.', 503)
    if (!gravado.data) return erro('A publicação mudou. Atualize a tela.', 409)
    return NextResponse.json({ publicacao: gravado.data, postagemAutomatica: false })
  }
  return erro('Ação desconhecida.', 400)
}
