import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import type { UsuarioTenant } from '@/lib/tenantServer'

// Mesclar exige autorizacao especifica. Nao herda as permissoes legadas de editar clientes.
export async function podeUnificarClientes(usuario: UsuarioTenant): Promise<boolean> {
  if (usuario.role === 'master') return true
  const [setor, config] = await Promise.all([
    db.from('permissoes').select('nivel').eq('usuario_id', usuario.id)
      .eq('empresa_id', usuario.empresa_id).eq('setor_id', 'cadastro').maybeSingle(),
    db.from('usuario_cadastros_360_permissoes').select('config')
      .eq('usuario_id', usuario.id).eq('empresa_id', usuario.empresa_id).maybeSingle(),
  ])
  if (setor.error || config.error) return false
  const matriz = config.data?.config
  return setor.data?.nivel === 'edicao'
    && Array.isArray(matriz?.visiveis) && matriz.visiveis.includes('clientes')
    && Array.isArray(matriz?.acoes?.clientes) && matriz.acoes.clientes.includes('mesclar')
}
