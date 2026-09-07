import { supabaseAdmin } from './supabaseAdmin'

export interface RegistroAuditoria {
    empresaId?: string | null
    usuarioId: string | null
    usuarioNome: string | null
    acao: string
    entidade: string
    entidadeId?: string | null
    detalhes?: Record<string, any> | null
}

async function resolverEmpresaAuditoria(registro: RegistroAuditoria): Promise<string | null> {
    if (registro.empresaId) return registro.empresaId
    if (!registro.usuarioId) return null

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('empresa_id')
      .eq('id', registro.usuarioId)
      .maybeSingle()

    if (error || !data?.empresa_id) return null
    return String(data.empresa_id)
}

export async function registrarAuditoria(registro: RegistroAuditoria) {
    try {
          const empresaId = await resolverEmpresaAuditoria(registro)
          if (!empresaId) {
                console.error('Auditoria ignorada: empresa não pôde ser determinada.', {
                        usuarioId: registro.usuarioId,
                        entidade: registro.entidade,
                        acao: registro.acao,
                })
                return
          }

          const { error } = await supabaseAdmin.from('audit_log').insert({
                  empresa_id: empresaId,
                  usuario_id: registro.usuarioId,
                  usuario_nome: registro.usuarioNome,
                  acao: registro.acao,
                  entidade: registro.entidade,
                  entidade_id: registro.entidadeId ?? null,
                  detalhes: registro.detalhes ?? null,
          })
          if (error) throw error
    } catch (e) {
          console.error('Erro ao registrar auditoria:', e)
    }
}
