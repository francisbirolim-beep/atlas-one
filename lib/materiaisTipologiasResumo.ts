/** Totais da composição técnica por peça e por obra.
 * NÃO converter peças cortadas em barras comerciais: Barras Utilizadas tem fonte própria.
 */
export type MaterialResumoTipologia = {
  id:string; item_ref?:string|null; produto_id?:string|null; categoria:string;
  codigo?:string|null; descricao:string; unidade:string; cor_ref?:string|null;
  quantidade_ajustada?:number|null; quantidade_tecnica?:number|null;
  comprimento_corte_mm?:number|null; comprimento_barra_mm?:number|null;
}
export type LinhaTotalMaterial = {
  chave:string; categoria:string; produto_id:string|null; codigo:string|null;
  descricao:string; cor:string|null; unidade:string; corteMm:number|null;
  barraMm:number|null; quantidade:number; materialIds:string[]; tipologias:string[];
}
const texto=(s:unknown)=>String(s??'').trim()
const numero=(s:unknown)=>{const n=Number(s);return Number.isFinite(n)?Math.max(0,n):0}
const medida=(s:unknown)=>{const n=Number(s);return s==null||!Number.isFinite(n)||n<=0?null:n}
/** Une apenas produtos realmente equivalentes, preservando categoria, acabamento e cortes. */
export function consolidarMateriaisTipologias(materiais:MaterialResumoTipologia[]):LinhaTotalMaterial[]{
  const mapa=new Map<string,LinhaTotalMaterial>()
  for(const m of materiais){
    const categoria=texto(m.categoria).toLowerCase()
    const codigo=texto(m.codigo).toUpperCase()||null
    const produtoId=texto(m.produto_id)||null
    const descricao=texto(m.descricao)
    const cor=texto(m.cor_ref).toUpperCase()||null
    const unidade=texto(m.unidade).toUpperCase()||'UN'
    const corteMm=medida(m.comprimento_corte_mm)
    const barraMm=medida(m.comprimento_barra_mm)
    // Não somar descrições sem cadastro se não houver identidade segura.
    const identificador=produtoId||codigo||('descricao:'+descricao.toUpperCase())
    const chave=JSON.stringify([categoria,identificador,cor,unidade,corteMm,barraMm])
    let linha=mapa.get(chave)
    if(!linha){
      linha={chave,categoria,produto_id:produtoId,codigo,descricao,cor,unidade,
        corteMm,barraMm,quantidade:0,materialIds:[],tipologias:[]}
      mapa.set(chave,linha)
    }
    linha.quantidade+=numero(m.quantidade_ajustada??m.quantidade_tecnica)
    linha.materialIds.push(m.id)
    if(m.item_ref&&!linha.tipologias.includes(m.item_ref))linha.tipologias.push(m.item_ref)
  }
  return [...mapa.values()].sort((a,b)=>
    (a.categoria+' '+(a.codigo||a.descricao)+' '+(a.cor||'')).localeCompare(
      b.categoria+' '+(b.codigo||b.descricao)+' '+(b.cor||''),'pt-BR'))
}
