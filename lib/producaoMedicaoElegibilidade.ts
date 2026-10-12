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

/** Extensão conservadora: mantém a regra de medição completa e acrescenta
 * somente medições parciais contendo unidade realmente aprovada.
 * A liberação técnica da obra inteira continua sujeita aos gates anteriores. */
export function medicoesElegiveisComParcial<T extends MedicaoElegivel>(
  medicoes: readonly T[],
  unidades: readonly (UnidadeMedida & { status_medicao?: string | null })[],
): T[] {
  const completas = new Set(medicoesElegiveisParaProducao(medicoes, unidades).map(m => m.id))
  const parciais = new Set(unidades.filter(i =>
    i.medido === true && Number(i.quantidade) === 1 && i.status_medicao === 'aprovada',
  ).map(i => i.medicao_id))
  return medicoes.filter(m => completas.has(m.id) || parciais.has(m.id))
}
