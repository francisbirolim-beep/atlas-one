/** Simulador de capacidade financeira mensal; não substitui agenda física da equipe. */
export type ProgramacaoInstalacao = {
 vendaId:string;cliente:string;numeroOrcamento:string;
 mes:string;valor:number;estado:'previsto'|'confirmado'|'concluido'|'cancelado'
}
export type CapacidadeMes={
 mes:string;meta:number|null;programado:number;confirmado:number;concluido:number;
 quantidade:number;utilizacao:number|null;saldo:number|null;
 situacao:'sem_meta'|'disponivel'|'atencao'|'excedido';
}
export const mesValido=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v)
export function capacidadeMensal(mes:string, meta:number|null, reservas:ProgramacaoInstalacao[]):CapacidadeMes{
 if(!mesValido(mes))throw new Error('Mês inválido')
 if(meta!==null&&(!Number.isFinite(meta)||meta<=0))throw new Error('Meta mensal precisa ser maior que zero')
 const ativas=reservas.filter(r=>r.mes===mes&&r.estado!=='cancelado'&&Number.isFinite(r.valor)&&r.valor>=0)
 const soma=(estado:ProgramacaoInstalacao['estado'])=>ativas.filter(r=>r.estado===estado).reduce((a,r)=>a+r.valor,0)
 const programado=ativas.reduce((a,r)=>a+r.valor,0)
 const utilizacao=meta===null?null:Math.round(programado/meta*100)
 return {mes,meta,programado,confirmado:soma('confirmado'),concluido:soma('concluido'),quantidade:ativas.length,
  utilizacao,saldo:meta===null?null:Math.round((meta-programado)*100)/100,
  situacao:meta===null?'sem_meta':programado>meta?'excedido':programado>=meta*.85?'atencao':'disponivel'}
}
export function avaliarReserva(mes:string,meta:number|null,reservas:ProgramacaoInstalacao[],nova:{vendaId:string;valor:number}){
 if(!Number.isFinite(nova.valor)||nova.valor<=0)throw new Error('Valor previsto inválido')
 const restantes=reservas.filter(r=>r.vendaId!==nova.vendaId)
 const antes=capacidadeMensal(mes,meta,restantes)
 const depois=capacidadeMensal(mes,meta,[...restantes,{vendaId:nova.vendaId,cliente:'',numeroOrcamento:'',mes,valor:nova.valor,estado:'previsto'}])
 return {antes,depois,ultrapassa:meta!==null&&depois.programado>meta,
  aviso:meta===null?'Configure a meta mensal para avaliar capacidade.':
   depois.programado>meta?'Limite mensal excedido; avalie outra data antes de confirmar.':
    depois.utilizacao!==null&&depois.utilizacao>=85?'Capacidade perto do limite.':'Há margem financeira no mês.'}
}
