// A fila de Produção recebe apenas medições finais concluídas com unidades medidas.
// O filtro é conservador: nenhuma ausência de leitura pode ser tratada como liberação.
export type MedicaoElegivel = {id:string;status_operacional?:string|null}
export type UnidadeMedida = {medicao_id:string;medido?:boolean|null;quantidade?:number|null}
const estados=new Set(['concluido','aguardando_conferencia','aprovado'])

export function medicoesElegiveisParaProducao<T extends MedicaoElegivel>(
 medicoes:readonly T[],unidades:readonly UnidadeMedida[],
):T[]{
 const porMedicao=new Map<string,UnidadeMedida[]>()
 for(const unidade of unidades){
  const lista=porMedicao.get(unidade.medicao_id)||[]
  lista.push(unidade)
  porMedicao.set(unidade.medicao_id,lista)
 }
 return medicoes.filter(m=>{
  if(!estados.has(String(m.status_operacional||'')))return false
  const lista=porMedicao.get(m.id)||[]
  return lista.length>0&&lista.every(i=>i.medido===true&&Number(i.quantidade)===1)
 })
}
