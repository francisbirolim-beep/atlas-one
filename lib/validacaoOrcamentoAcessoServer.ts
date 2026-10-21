import { usuarioPodeAcaoServer } from './acessoUsuarioServer'
import type { UsuarioTenant } from './tenantServer'

/** Autorização específica para conferência humana de orçamento, independentemente de autoria. */
export async function podeValidarOrcamentoEmpresa(usuario: UsuarioTenant): Promise<boolean> {
  return usuarioPodeAcaoServer({
    usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id,
    setorId: 'orcamentos', acaoId: 'comercial.orcamento.aprovar', minimo: 'edicao',
  })
}

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]