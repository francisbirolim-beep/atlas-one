import { supabaseAdmin } from './supabaseAdmin'
import { lerAcessoConfigServer } from './acessoUsuarioServer'
import { normalizarMatrizCliente360, type ContextoCliente360 } from './cliente360Permissoes'
import type { UsuarioTenant } from './tenantServer'
export async function contextoCliente360Server(usuario: UsuarioTenant): Promise<ContextoCliente360> {
  if(usuario.role==='master')return {role:'master',setores:{},acoes:{}}
  const [config,resposta]=await Promise.all([
    lerAcessoConfigServer(usuario.id,usuario.empresa_id),
    supabaseAdmin.from('permissoes').select('setor_id,nivel').eq('usuario_id',usuario.id).eq('empresa_id',usuario.empresa_id),
  ])
  if(resposta.error)throw new Error('Não foi possível conferir os acessos.')
  return {role:usuario.role,setores:Object.fromEntries((resposta.data||[]).map(p=>[p.setor_id,p.nivel])),acoes:config?.acoes||{},cliente360:normalizarMatrizCliente360(config?.cliente360)}
}
