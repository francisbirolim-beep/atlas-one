import { supabaseAdmin } from './supabaseAdmin'

export interface RegistroAuditoria {
    usuarioId: string | null
    usuarioNome: string | null
    acao: string
    entidade: string
    entidadeId?: string | null
    detalhes?: Record<string, any> | null
}

export async function registrarAuditoria(registro: RegistroAuditoria) {
    try {
          await supabaseAdmin.from('audit_log').insert({
                  usuario_id: registro.usuarioId,
                  usuario_nome: registro.usuarioNome,
                  acao: registro.acao,
                  entidade: registro.entidade,
                  entidade_id: registro.entidadeId ?? null,
                  detalhes: registro.detalhes ?? null,
          })
    } catch (e) {
          console.error('Erro ao registrar auditoria:', e)
    }
}
