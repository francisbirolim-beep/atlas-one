// Encontra um código no fluxo de texto do PDF sem inferir a partir de outro produto.
// Uma correspondência ambígua nunca autoriza vincular imagem automaticamente.
export type TokenImagemCatalogo = {str:string;x:number;y:number;w?:number;h:number}
export function localizarCodigoCatalogo(
  itens:TokenImagemCatalogo[], codigo:string, escala=1,
): {alvo:TokenImagemCatalogo|null; ocorrencias:number} {
  const compactado=String(codigo||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
  const partes=compactado.match(/^([A-Z]{1,6})(\d{2,8})([A-Z]{0,3})$/)
  if(!partes)return {alvo:null,ocorrencias:0}
  const prefixo=partes[1], numeros=partes[2], sufixo=partes[3]
  // Caracteres em códigos reais podem vir quebrados entre itens do PDF:
  // SU 01 + 1 -> SU011; TUBO D 055 -> D055.
  const padrao=new RegExp('^(?:TUBO\\s+)?'+prefixo+'[\\s_/-]*'+
    [...numeros].join('[\\s_/-]*')+'[\\s_/-]*'+sufixo+'(?![A-Z0-9])','i')
  const encontrados:TokenImagemCatalogo[]=[]
  for(const item of itens){
    const mesmaLinha=itens.filter(t=>Math.abs(t.y-item.y)<2*escala
      &&t.x>=item.x&&t.x<item.x+110*escala).sort((a,b)=>a.x-b.x)
    // Alguns catálogos fragmentam cada caractere como um item diferente.
    // A lacuna visual separa o código da coluna de peso sem quebrar letras do código.
    let trecho='',direita=-Infinity
    for(const token of mesmaLinha.slice(0,24)){
      if(trecho && token.x-direita>3.5*escala)trecho+=' '
      trecho+=token.str
      direita=token.x+(token.w||0)
    }
    if(padrao.test(item.str.trim())||padrao.test(trecho.trim())){
      if(!encontrados.some(t=>Math.abs(t.y-item.y)<2*escala&&Math.abs(t.x-item.x)<2*escala)){
        encontrados.push(item)
      }
    }
  }
  return {alvo:encontrados.length===1?encontrados[0]:null,ocorrencias:encontrados.length}
}
