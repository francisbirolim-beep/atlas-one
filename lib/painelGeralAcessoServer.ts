import { lerAcessoConfigServer } from '@/lib/acessoUsuarioServer'
import { permissaoExplicitaPainelGeral, permissaoMoverKanbanGeral, type PainelConsolidado } from '@/lib/painelGeralAcesso'

/** Autoriza somente a movimentação visual explicitamente liberada no Kanban Geral. */
export async function podeMoverKanbanGeral(usuario:{id:string;role:string;empresa_id:string}):Promise<boolean>{
 if(usuario.role==='master')return true
 const config=await lerAcessoConfigServer(usuario.id,usuario.empresa_id)
 return permissaoMoverKanbanGeral(usuario.role,config)
}

// Sem herança de permissões de outros módulos: é uma autorização explícita do Master.
// Falhas ao ler ACL nunca liberam dados; são propagadas aos handlers.
export async function podeConsultarPainelGeral(
  usuario: { id:string; role:string; empresa_id:string },
  painel: PainelConsolidado,
): Promise<boolean> {
  if (usuario.role === 'master') return true
  const config = await lerAcessoConfigServer(usuario.id,usuario.empresa_id)
  return permissaoExplicitaPainelGeral(usuario.role, config, painel)
}
