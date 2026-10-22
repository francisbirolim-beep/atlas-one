import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AtendimentoConversa } from '@/lib/whatsappServer'

// Envia um aviso só quando o grupo passa de lido para pendente.
export async function notificarGrupoWhatsAppPendente(
  conversa: AtendimentoConversa,
  mensagemId: string,
) {
  if (conversa.whatsapp_chat_tipo !== 'grupo' || !mensagemId || Number(conversa.nao_lidas || 0) > 0) return
  try {
    let responsavelId = conversa.status === 'finalizado' ? null : (conversa.responsavel_id || null)
    if (!responsavelId && conversa.whatsapp_canal_id && conversa.whatsapp_chat_jid) {
      const { data: grupo } = await supabaseAdmin.from('atendimento_whatsapp_grupos')
        .select('id')
        .eq('empresa_id', conversa.empresa_id)
        .eq('whatsapp_canal_id', conversa.whatsapp_canal_id)
        .eq('grupo_jid', conversa.whatsapp_chat_jid)
        .eq('ativo', true)
        .maybeSingle()
      if (grupo?.id) {
        const agora = new Date().toISOString()
        const { data: delegacao } = await supabaseAdmin.from('atendimento_whatsapp_grupo_delegacoes')
          .select('destino_usuario_id')
          .eq('empresa_id', conversa.empresa_id)
          .eq('grupo_id', grupo.id)
          .eq('ativo', true)
          .lte('inicio_em', agora)
          .gt('fim_em', agora)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        responsavelId = delegacao?.destino_usuario_id || null
        if (!responsavelId) {
          const { data: principal } = await supabaseAdmin.from('atendimento_whatsapp_grupo_permissoes')
            .select('usuario_id')
            .eq('empresa_id', conversa.empresa_id)
            .eq('grupo_id', grupo.id)
            .eq('responsavel_principal', true)
            .neq('nivel', 'sem_acesso')
            .limit(1)
            .maybeSingle()
          responsavelId = principal?.usuario_id || null
        }
      }
    }
    if (!responsavelId) return
    const { data: usuario } = await supabaseAdmin.from('usuarios')
      .select('id').eq('empresa_id', conversa.empresa_id).eq('id', responsavelId).maybeSingle()
    if (!usuario) return
    const nomeGrupo = conversa.grupo_nome || conversa.contato_nome || 'Grupo WhatsApp'
    const { error } = await supabaseAdmin.from('notificacoes').insert({
      empresa_id: conversa.empresa_id,
      usuario_id: responsavelId,
      categoria: 'chat',
      tipo: 'whatsapp_grupo_mensagem',
      titulo: 'Nova mensagem em grupo WhatsApp',
      mensagem: `${nomeGrupo} tem mensagem aguardando sua atenção.`,
      href: `/whatsapp?conversaId=${encodeURIComponent(conversa.id)}`,
      origem_tipo: 'whatsapp_grupo_mensagem',
      origem_id: mensagemId,
      push_status: 'pendente',
    })
    if (error) console.error('Falha ao notificar responsável do grupo:', error.message)
  } catch (error) {
    // A falha em alerta nunca deve interromper o recebimento de mensagens.
    console.error('Falha ao preparar alerta de grupo WhatsApp:', error)
  }
}
