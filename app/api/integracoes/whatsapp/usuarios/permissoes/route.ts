import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (usuario.role !== 'master') {
    return NextResponse.json({ error: 'Somente o Master pode configurar permissoes do WhatsApp.' }, { status: 403 })
  }

  const usuarioId = String(req.nextUrl.searchParams.get('usuarioId') || '')
  if (!usuarioId) {
    return NextResponse.json({ error: 'Usuario nao informado.' }, { status: 400 })
  }

  const { data: alvo, error: alvoError } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', usuarioId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()

  if (alvoError) return NextResponse.json({ error: alvoError.message }, { status: 500 })
  if (!alvo) return NextResponse.json({ error: 'Usuario invalido.' }, { status: 404 })

  const [
    canaisResp,
    permissoesResp,
    gruposResp,
    grupoUsuarioResp,
    responsaveisResp,
    usuariosResp,
    contatosResp,
    conversasGrupoResp,
  ] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,nome,numero_declarado,numero_conectado,principal,gateway_status,usuario_id,usuario_nome')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('nivel_hierarquia', { ascending: true })
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_permissoes')
      .select('id,canal_id,usuario_id,pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id,whatsapp_canal_id,grupo_jid,nome,participantes,membros,ativo,sincronizado_em')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('id,grupo_id,usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('grupo_id,usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('responsavel_principal', true),
    supabaseAdmin
      .from('usuarios')
      .select('id,nome,whatsapp,role')
      .eq('empresa_id', usuario.empresa_id)
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_contatos')
      .select('whatsapp_canal_id,contato_jid,telefone,nome,nome_verificado')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .limit(10000),
    supabaseAdmin
      .from('atendimento_conversas')
      .select('id,whatsapp_canal_id,whatsapp_chat_jid')
      .eq('empresa_id', usuario.empresa_id)
      .eq('canal', 'whatsapp')
      .eq('whatsapp_chat_tipo', 'grupo')
      .limit(5000),
  ])

  const erro =
    canaisResp.error ||
    permissoesResp.error ||
    gruposResp.error ||
    grupoUsuarioResp.error ||
    responsaveisResp.error ||
    usuariosResp.error ||
    contatosResp.error ||
    conversasGrupoResp.error

  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  const conversaGrupoIds = (conversasGrupoResp.data || []).map((item: any) => item.id).filter(Boolean)
  let mensagensGrupo: any[] = []
  if (conversaGrupoIds.length) {
    const { data: mensagens, error: mensagensError } = await supabaseAdmin
      .from('atendimento_mensagens')
      .select('conversa_id,payload,usuario_id,usuario_nome,direcao,created_at')
      .in('conversa_id', conversaGrupoIds)
      .order('created_at', { ascending: false })
      .limit(10000)
    if (mensagensError) return NextResponse.json({ error: mensagensError.message }, { status: 500 })
    mensagensGrupo = mensagens || []
  }

  const normalizarTelefone = (valor: unknown) => {
    let numero = String(valor || '').replace(/\D/g, '')
    if (!numero) return ''
    if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
    return numero
  }
  const chaveNome = (valor: unknown) => String(valor || '').trim().toLocaleLowerCase('pt-BR')

  const usuarios = (usuariosResp.data || []).map((item: any) => ({
    ...item,
    telefone_normalizado: normalizarTelefone(item.whatsapp),
  }))
  const usuarioPorTelefone = new Map(
    usuarios.filter((item: any) => item.telefone_normalizado).map((item: any) => [item.telefone_normalizado, item]),
  )
  const usuarioPorNome = new Map(
    usuarios.filter((item: any) => item.nome).map((item: any) => [chaveNome(item.nome), item]),
  )

  const contatoPorChave = new Map<string, any>()
  for (const contato of contatosResp.data || []) {
    const telefone = normalizarTelefone((contato as any).telefone)
    const jid = String((contato as any).contato_jid || '').trim()
    const nomeContato = String((contato as any).nome || (contato as any).nome_verificado || '').trim()
    if (telefone) contatoPorChave.set(`${(contato as any).whatsapp_canal_id}:tel:${telefone}`, { ...contato, nome_resolvido: nomeContato })
    if (jid) contatoPorChave.set(`${(contato as any).whatsapp_canal_id}:jid:${jid}`, { ...contato, nome_resolvido: nomeContato })
  }

  const conversaPorId = new Map(
    (conversasGrupoResp.data || []).map((item: any) => [item.id, item]),
  )
  const mensagensPorGrupo = new Map<string, any[]>()
  for (const mensagem of mensagensGrupo) {
    const conversa = conversaPorId.get((mensagem as any).conversa_id)
    if (!conversa?.whatsapp_canal_id || !conversa?.whatsapp_chat_jid) continue
    const chaveGrupo = `${conversa.whatsapp_canal_id}:${conversa.whatsapp_chat_jid}`
    const lista = mensagensPorGrupo.get(chaveGrupo) || []
    lista.push(mensagem)
    mensagensPorGrupo.set(chaveGrupo, lista)
  }

  const gruposEnriquecidos = (gruposResp.data || []).map((grupo: any) => {
    const membros = new Map<string, any>()
    const adicionar = (entrada: any) => {
      const jid = String(entrada?.jid || '').trim()
      const telefone = normalizarTelefone(entrada?.telefone || jid.split('@')[0])
      const nomeEntrada = String(entrada?.nome || '').trim()
      const chave = telefone ? `tel:${telefone}` : (jid ? `jid:${jid}` : '')
      if (!chave) return
      const anterior = membros.get(chave) || {}
      membros.set(chave, {
        ...anterior,
        ...entrada,
        jid: jid || anterior.jid || null,
        telefone: telefone || anterior.telefone || null,
        nome: nomeEntrada || anterior.nome || null,
        admin: entrada?.admin || anterior.admin || null,
      })
    }

    for (const membro of Array.isArray(grupo.membros) ? grupo.membros : []) adicionar(membro)

    const chaveGrupo = `${grupo.whatsapp_canal_id}:${grupo.grupo_jid}`
    for (const mensagem of mensagensPorGrupo.get(chaveGrupo) || []) {
      const payload = (mensagem as any).payload && typeof (mensagem as any).payload === 'object'
        ? (mensagem as any).payload
        : {}
      const participanteTelefone = normalizarTelefone(payload.participanteTelefone || payload.participante_telefone)
      const participanteJid = String(payload.participanteJid || payload.participante_jid || '').trim()
      const participanteNome = String(payload.participanteNome || payload.participante_nome || '').trim()
      if (participanteTelefone || participanteJid) {
        adicionar({ telefone: participanteTelefone, jid: participanteJid, nome: participanteNome })
      }
      if ((mensagem as any).direcao === 'saida' && (mensagem as any).usuario_id) {
        const usuarioMensagem = usuarios.find((item: any) => item.id === (mensagem as any).usuario_id)
        if (usuarioMensagem) {
          adicionar({
            telefone: usuarioMensagem.telefone_normalizado,
            nome: usuarioMensagem.nome,
            usuario_id: usuarioMensagem.id,
            usuario_nome: usuarioMensagem.nome,
            fonte_usuario_atlas: true,
          })
        }
      }
    }

    const membrosResolvidos = [...membros.values()].map((membro: any) => {
      const telefone = normalizarTelefone(membro.telefone)
      const contato =
        (telefone ? contatoPorChave.get(`${grupo.whatsapp_canal_id}:tel:${telefone}`) : null) ||
        (membro.jid ? contatoPorChave.get(`${grupo.whatsapp_canal_id}:jid:${membro.jid}`) : null)
      const nome = String(membro.nome || contato?.nome_resolvido || '').trim()
      const usuarioTelefone = telefone ? usuarioPorTelefone.get(telefone) : null
      const usuarioNome = nome ? usuarioPorNome.get(chaveNome(nome)) : null
      const usuarioVinculado =
        usuarios.find((item: any) => item.id === membro.usuario_id) ||
        usuarioTelefone ||
        usuarioNome ||
        null

      return {
        jid: membro.jid || null,
        telefone: telefone || null,
        nome: nome || (telefone || 'Participante'),
        admin: membro.admin || null,
        usuario_id: usuarioVinculado?.id || null,
        usuario_nome: usuarioVinculado?.nome || null,
      }
    }).sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))

    const opcoesResponsavel = membrosResolvidos
      .filter((membro: any) => membro.usuario_id && membro.usuario_nome)
      .filter((membro: any, indice: number, lista: any[]) => lista.findIndex((x: any) => x.usuario_id === membro.usuario_id) === indice)
      .map((membro: any) => ({
        usuario_id: membro.usuario_id,
        usuario_nome: membro.usuario_nome,
        telefone: membro.telefone,
      }))

    return {
      ...grupo,
      membros: membrosResolvidos,
      opcoes_responsavel: opcoesResponsavel,
    }
  })

  const responsavelIds = [...new Set((responsaveisResp.data || []).map((item: any) => item.usuario_id).filter(Boolean))]
  const nomes = new Map<string,string>()
  if (responsavelIds.length) {
    const { data: usuariosResponsaveis, error: nomesError } = await supabaseAdmin
      .from('usuarios')
      .select('id,nome')
      .eq('empresa_id', usuario.empresa_id)
      .in('id', responsavelIds)
    if (nomesError) return NextResponse.json({ error: nomesError.message }, { status: 500 })
    for (const item of usuariosResponsaveis || []) nomes.set(item.id, item.nome)
  }

  return NextResponse.json({
    ok: true,
    usuario: { id: alvo.id, nome: alvo.nome, role: alvo.role },
    canais: canaisResp.data || [],
    permissoes: permissoesResp.data || [],
    grupos: gruposEnriquecidos,
    gruposPermissoes: grupoUsuarioResp.data || [],
    responsaveis: (responsaveisResp.data || []).map((item: any) => ({
      ...item,
      usuario_nome: nomes.get(item.usuario_id) || null,
    })),
  })
}
