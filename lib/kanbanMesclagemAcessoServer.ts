import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import type { UsuarioTenant } from '@/lib/tenantServer'

// A mesclagem exige edição comercial efetiva, e não libera retirada/restauração manual.
// O Master continua autorizado; colaboradores só quando têm acesso de edição.
export async function podeMesclarKanbanComercial(usuario: UsuarioTenant): Promise<boolean> {
  if (usuario.role === 'master') return true
  const comum = { usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id, minimo: 'edicao' as const }
  const [fazerOrcamento, pedidoOrcamento] = await Promise.all([
    usuarioPodeAcaoServer({ ...comum, setorId: 'fazer-orcamento-msanfyvj', acaoId: 'comercial.orcamento.editar' }),
    usuarioPodeAcaoServer({ ...comum, setorId: 'orcamentos', acaoId: 'comercial.pedido_orcamento.editar' }),
  ])
  return fazerOrcamento || pedidoOrcamento
}
