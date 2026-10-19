import {codigoColadoDeOutrasColunas} from './catalogoCartoesGeometria'

export type ReferenciaPagina = {codigo:string;pagina_catalogo?:number|null;paginas_referencia?:number[]|null}
export type PaginaPdfOriginal = {pagina:number;items?:Array<{str?:string}>}

// Não escolher silenciosamente a primeira página se o mesmo código aparece em
// duas páginas. É um INDÍCIO de onde está o desenho, não uma foto homologada.
export function indexarPaginasSeguras(paginas:PaginaPdfOriginal[],extraidos:ReferenciaPagina[]){
  const encontrados=new Map<string,Set<number>>()
  const codigo=(v:unknown)=>{
    const x=String(v||'').toUpperCase().replace(/\s+/g,'')
    if(codigoColadoDeOutrasColunas(x))return ''
    return /^(?:[A-Z]{1,6}\d{0,3}(?:[-_/][A-Z0-9]{2,8}){1,2}|[A-Z]{1,6}\d{2,8}[A-Z]{0,3})$/.test(x)?x.replace(/[^A-Z0-9]/g,''):''
  }
  const adicionar=(c:unknown,p:unknown)=>{
    const k=codigo(c),n=Number(p)
    if(!k||!Number.isSafeInteger(n)||n<1||n>10000)return
    const conjunto=encontrados.get(k)||new Set<number>()
    conjunto.add(n);encontrados.set(k,conjunto)
  }
  for(const pg of paginas){
    for(const token of pg.items||[])adicionar(token.str,pg.pagina)
  }
  for(const item of extraidos){
    adicionar(item.codigo,item.pagina_catalogo)
    for(const pagina of item.paginas_referencia||[])adicionar(item.codigo,pagina)
  }
  const unicas=new Map<string,number>(),ambiguas=new Set<string>()
  for(const [c,localizacoes] of encontrados){
    if(localizacoes.size===1)unicas.set(c,[...localizacoes][0])
    else ambiguas.add(c)
  }
  return {unicas,ambiguas,totalCodigos:encontrados.size}
}
