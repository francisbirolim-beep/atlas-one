// Enquadramento específico para catálogos diagramados em cartões
// verticais: descrição em cima, código abaixo e peso kg/m na mesma coluna.
// Não interfere no recorte de famílias (cantoneiras, tubos, barras).
export type TextoCartao = {str:string;x:number;y:number;w?:number;h?:number}
export type LimitesCartao = {sx:number;sy:number;sw:number;sh:number}
export function limitesRecorteCartao(
  itens:TextoCartao[],alvo:TextoCartao,escala:number,
  larguraPagina:number,alturaPagina:number,
):LimitesCartao|null {
  const temPeso=itens.some(t=>
    /^\d+(?:[.,]\d{1,4})?\s*KG\s*\/?\s*M$/i.test(t.str.trim())
    && Math.abs(t.x-alvo.x)<=22*escala
    && t.y-alvo.y>=4*escala&&t.y-alvo.y<=26*escala)
  if(!temPeso)return null
  const mesmaColuna=(t:TextoCartao)=>Math.abs(t.x-alvo.x)<38*escala
  const proximoAbaixo=itens.filter(t=>mesmaColuna(t)
    && /^[A-Z]{1,6}\d{0,3}[-_/]\d{2,8}[A-Z]{0,3}$/i.test(t.str.trim())
    && t.y>alvo.y+33*escala).sort((a,b)=>a.y-b.y)[0]
  const proximaColuna=itens.filter(t=>
    /^[A-Z]{1,6}\d{0,3}[-_/]\d{2,8}[A-Z]{0,3}$/i.test(t.str.trim())
    && t.x>alvo.x+75*escala
    && Math.abs(t.y-alvo.y)<40*escala
  ).sort((a,b)=>a.x-b.x)[0]
  // O topo começa acima da descrição, que precede o código.
  const sy=Math.max(0,Math.floor(alvo.y-34*escala))
  const sx=Math.max(0,Math.floor(alvo.x-18*escala))
  const direita=proximaColuna?proximaColuna.x-18*escala:larguraPagina-23*escala
  const baixo=proximoAbaixo
    ?Math.min(alvo.y+250*escala,proximoAbaixo.y-16*escala)
    :Math.min(alvo.y+250*escala,alturaPagina-26*escala)
  const sw=Math.min(larguraPagina-sx,Math.floor(direita-sx))
  const sh=Math.min(alturaPagina-sy,Math.floor(baixo-sy))
  if(sw<95*escala||sh<95*escala)return null
  return {sx,sy,sw,sh}
}
