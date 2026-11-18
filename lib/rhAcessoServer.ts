import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import type { UsuarioCompras } from '@/lib/comprasServer'

type ModuloRH='pessoas'|'holerites'|'adiantamentos'
const ACOES:Record<ModuloRH,{consultar:string;editar:string}>={
 pessoas:{consultar:'rh.colaboradores.consultar',editar:'rh.colaboradores.editar'},
 holerites:{consultar:'rh.holerites.consultar',editar:'rh.holerites.gerenciar'},
 adiantamentos:{consultar:'rh.adiantamentos.consultar',editar:'rh.adiantamentos.gerenciar'},
}

// Nao aceita permissao herdada do setor RH: as seis acoes exigem concessao
// explicita do Master (regra em permissoesBlocos.ts).
export async function acessoRHServer(usuario:UsuarioCompras, modulo:ModuloRH){
 if(usuario.role==='master')return {consultar:true,editar:true}
 const base={usuarioId:usuario.id,empresaId:usuario.empresa_id,role:usuario.role,setorId:'rh'}
 const [ler,escrever]=await Promise.all([
  usuarioPodeAcaoServer({...base,acaoId:ACOES[modulo].consultar,minimo:'consulta'}),
  usuarioPodeAcaoServer({...base,acaoId:ACOES[modulo].editar,minimo:'edicao'}),
 ])
 return {consultar:ler||escrever,editar:escrever}
}
