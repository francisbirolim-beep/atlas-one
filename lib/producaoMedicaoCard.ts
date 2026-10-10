// A medição identificada no card tem prioridade absoluta sobre o orçamento.
// Vários cards da mesma venda podem ter medições diferentes.
export type MedicaoCardRef={
  id:string
  orcamento_id?:string|null
}
export type CardProducaoRef={
  descricao?:string|null
  orcamento_id?:string|null
}
const marcadorMedicao=/\[medicao:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/i
const algumMarcador=/\[medicao:[^\]]*\]/i

export function temMarcadorMedicaoDoCard(card:CardProducaoRef):boolean{
  return algumMarcador.test(String(card.descricao||''))
}

export function idMedicaoDoCard(card:CardProducaoRef):string|null{
  return String(card.descricao||'').match(marcadorMedicao)?.[1]?.toLowerCase()||null
}

export function vincularCardAMedicao<T extends MedicaoCardRef>(
  card:CardProducaoRef|null|undefined,
  medicoes:readonly T[],
):T|null{
  if(!card)return null
  const descricao=String(card.descricao||'')
  const marcador=idMedicaoDoCard(card)
  if(marcador){
    // Marcador explícito sem medição encontrada NUNCA deve apontar a outra medição do orçamento.
    return medicoes.find(m=>m.id.toLowerCase()===marcador)??null
  }
  if(algumMarcador.test(descricao))return null
  if(!card.orcamento_id)return null
  // Compatibilidade apenas para cards antigos sem identificador de medição.
  return medicoes.find(m=>m.orcamento_id===card.orcamento_id)??null
}
