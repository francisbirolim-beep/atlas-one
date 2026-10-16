import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Salva apenas o roteamento do grupo solicitado. Não toca automações, permissões
// nem a configuração da fila de contatos do número principal.
export async function PUT(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (usuario.role !== 'master') {
    return NextResponse.json({ error: 'Somente o Master pode alterar a triagem de grupos.' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const grupoId = String(body?.grupoId || '')
    const ativa = body?.ativa === true
    const tempo = Number(body?.tempoMinutos ?? 10)
    const destinos: string[] = [...new Set<string>((Array.isArray(body?.destinos) ? body.destinos : []).map(String))]
    if (!grupoId || !Number.isInteger(tempo) || tempo < 1 || tempo > 1440) {
      return NextResponse.json({ error: 'Grupo e prazo de 1 a 1440 minutos sao obrigatorios.' }, { status: 400 })
    }
    const { data: grupo, error: erroGrupo } = await supabaseAdmin.from('atendimento_whatsapp_grupos')
      .select('id,nome').eq('id', grupoId).eq('empresa_id', usuario.empresa_id).eq('ativo', true).maybeSingle()
    if (erroGrupo) throw erroGrupo
    if (!grupo) return NextResponse.json({ error: 'Grupo nao encontrado nesta empresa.' }, { status: 404 })

    const { data: permissoes, error: erroPermissoes } = await supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id).eq('grupo_id', grupoId)
    if (erroPermissoes) throw erroPermissoes
    const principal = (permissoes || []).find(p =>
      p.responsavel_principal && (p.nivel === 'atender' || p.nivel === 'gerenciar'))?.usuario_id
    if (ativa && (!principal || destinos.length === 0)) {
      return NextResponse.json({
        error: 'Defina o responsavel principal do grupo e ao menos um substituto.',
      }, { status: 400 })
    }
    if (principal && destinos.includes(principal)) {
      return NextResponse.json({ error: 'O principal nao pode substituir a si mesmo.' }, { status: 400 })
    }
    if (destinos.length > 30) return NextResponse.json({ error: 'Limite de 30 substitutos por grupo.' }, { status: 400 })

    if (destinos.length) {
      const { data: usuarios, error: erroUsuarios } = await supabaseAdmin.from('usuarios')
        .select('id,role').eq('empresa_id', usuario.empresa_id).in('id', destinos)
      if (erroUsuarios) throw erroUsuarios
      const validos = new Map((usuarios || []).map(u => [u.id, u.role]))
      const autorizados = new Set((permissoes || [])
        .filter(p => p.nivel === 'atender' || p.nivel === 'gerenciar')
        .map(p => p.usuario_id))
      if (destinos.some(id =>
        !validos.has(id) || (validos.get(id) !== 'master' && !autorizados.has(id)))) {
        return NextResponse.json({
          error: 'Substitutos precisam ter permissao de atender neste grupo (ou ser Master).',
        }, { status: 400 })
      }
    }
    const { data, error } = await supabaseAdmin.from('atendimento_whatsapp_grupos')
      .update({
        triagem_privada_ativa: ativa,
        triagem_tempo_minutos: tempo,
        triagem_destinos: destinos,
      })
      .eq('id', grupoId).eq('empresa_id', usuario.empresa_id)
      .select('id,triagem_privada_ativa,triagem_tempo_minutos,triagem_destinos').single()
    if (error) {
      if (/triagem_(privada_ativa|tempo_minutos|destinos)/.test(String(error.message || ''))) {
        return NextResponse.json({ error: 'Triagem pendente de homologacao da migracao do banco; demais configuracoes preservadas.' }, { status: 409 })
      }
      throw error
    }
    return NextResponse.json({ ok: true, grupo: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar a triagem do grupo.' }, { status: 400 })
  }
}
