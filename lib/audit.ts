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
          let empresaId: string | null = null
          if (registro.usuarioId) {
                  const { data: usuario } = await supabaseAdmin
                    .from('usuarios')
                    .select('empresa_id')
                    .eq('id', registro.usuarioId)
                    .maybeSingle()
                  empresaId = usuario?.empresa_id || null
          }

          await supabaseAdmin.from('audit_log').insert({
                  empresa_id: empresaId,
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