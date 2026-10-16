import {AI_ESPECIALISTAS} from './ai/specialists'
import {RELATORIOS_PERMISSOES} from './relatoriosPermissoes'
export const ACOES_IA_USUARIO=[['ia.geral','Acesso à IA (geral e especialistas)'],...AI_ESPECIALISTAS.map(e=>['ia.'+e.modulo,e.nome])] as readonly (readonly string[])[]
export const ACOES_RELATORIOS_USUARIO=RELATORIOS_PERMISSOES.map(([id,nome])=>['relatorios.'+id+'.consultar',nome] as const)
export const IDS_IA_RELATORIOS=[...ACOES_IA_USUARIO,...ACOES_RELATORIOS_USUARIO].map(([id])=>id)
