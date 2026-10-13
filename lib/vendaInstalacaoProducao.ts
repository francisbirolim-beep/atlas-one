// Fonte comum para itens do orçamento sem ID: mesma referência usada na geração das OPs.
export function refItemProducaoInstalacao(item:Record<string,unknown>|null|undefined,indice:number){
  return String(item?.id||'item-'+(indice+1))
}

export type OrdemParaInstalacao={
  id?:string;item_ref?:string|null;tipo_producao?:string|null;
  status?:string|null;bloqueada?:boolean|null;quantidade?:number|null;quantidade_produzida?:number|null
}
export type DisponibilidadePeca={
  planejadas:number;produzidas:number;ordens:number;
  prontas:number;faltantes:number;estado:'sem_ordem'|'aguardando'|'parcial'|'pronta'
}
const n=(v:unknown)=>Number(v)
export function disponibilidadePeca(ordens:readonly OrdemParaInstalacao[],itemRef:string,quantidadePlanejada:number):DisponibilidadePeca{
  const planejadas=Math.max(0,n(quantidadePlanejada)||0)
  const elegiveis=ordens.filter(o=>o.item_ref===itemRef&&o.tipo_producao==='esquadria'&&o.status!=='cancelada')
  // Unidades individualizadas conferidas na Produção podem avançar separadas;
  // OPs legadas sem valor parcial continuam dependendo do status concluída.
  const produzidas=elegiveis.filter(o=>!o.bloqueada).reduce((sum,o)=>{
    const qtd=Math.max(0,n(o.quantidade)||0)
    if(o.quantidade_produzida!==null&&o.quantidade_produzida!==undefined)
      return sum+(['conferencia','concluida'].includes(String(o.status||''))?
        Math.min(qtd,Math.max(0,n(o.quantidade_produzida)||0)):0)
    return sum+(o.status==='concluida'?qtd:0)
  },0)
  const prontas=Math.min(planejadas,produzidas)
  const faltantes=Math.max(0,planejadas-prontas)
  const estado=!elegiveis.length?'sem_ordem':prontas<=0?'aguardando':faltantes>0?'parcial':'pronta'
  return {planejadas,produzidas,ordens:elegiveis.length,prontas,faltantes,estado}
}
export function validarRegistroInstalacao(args:{
  existente:number;novo:number;status:'pendente'|'em_instalacao'|'instalado'|'pendencia';
  quantidadePlanejada:number;disponibilidade:DisponibilidadePeca
}):string|null{
  const {existente,novo,status,quantidadePlanejada,disponibilidade}=args
  if(!Number.isInteger(novo)||novo<0||novo>quantidadePlanejada)return 'Quantidade instalada inválida para a peça.'
  if(novo>disponibilidade.prontas)return 'Produção insuficiente: apenas '+disponibilidade.prontas+' de '+quantidadePlanejada+' peça(s) concluída(s) e liberada(s).'
  if(status==='instalado'&&(novo!==quantidadePlanejada||quantidadePlanejada<=0))return 'Para marcar como instalado, a quantidade total da peça deve estar instalada.'
  if(status==='pendente'&&novo!==0)return 'Peça pendente não pode possuir quantidade instalada.'
  if(status==='em_instalacao'&&(novo<=0||novo>=quantidadePlanejada))return 'Em instalação exige quantidade parcial maior que zero.'
  if(novo>existente&&!disponibilidade.ordens)return 'Nenhuma ordem de esquadria vinculada à peça.'
  return null
}
