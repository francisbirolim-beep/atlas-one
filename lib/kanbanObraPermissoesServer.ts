import { nivelAcaoUsuarioServer, lerAcessoConfigServer } from '@/lib/acessoUsuarioServer'

export type AcaoKanbanObra = 'consultar' | 'criar' | 'mover' | 'retirar' | 'restaurar'
export const ACOES_KANBAN_OBRA: readonly AcaoKanbanObra[] = ['consultar','criar','mover','retirar','restaurar']
export type PermissoesKanbanObra = Record<AcaoKanbanObra, boolean>

/** Delegações nominais feitas pelo Master, nunca herdadas de um módulo vizinho. */
export async function permissoesKanbanObra(usuario: {id:string;role:string;empresa_id:string}):Promise<PermissoesKanbanObra> {
  if(usuario.role==='master')return {consultar:true,criar:true,mover:true,retirar:true,restaurar:true}
  const config=await lerAcessoConfigServer(usuario.id,usuario.empresa_id)
  const resultado={} as PermissoesKanbanObra
  for(const acao of ACOES_KANBAN_OBRA){
    const acaoId='clientes.kanban_obra.'+acao
    const minimo=acao==='consultar'?'consulta':'edicao'
    const nivelAcao=config?.acoes?.[acaoId]
    const nivelModulo=config?.modulos?.['kanban-obra']
    // Ação e módulo devem ser explicitamente liberados pelo Master.
    const permitidoAcao=acao==='consultar'?(nivelAcao==='consulta'||nivelAcao==='edicao'):nivelAcao==='edicao'
    const permitidoModulo=acao==='consultar'?(nivelModulo==='consulta'||nivelModulo==='edicao'):nivelModulo==='edicao'
    const efetivo=await nivelAcaoUsuarioServer({
      usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
      setorId:'portal-cliente',acaoId
    })
    resultado[acao]=permitidoAcao&&permitidoModulo&&(minimo==='consulta'?efetivo!=='oculto':efetivo==='edicao')
  }
  return resultado
}
