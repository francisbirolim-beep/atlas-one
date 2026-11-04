// Extracao conservadora: nunca confirmar automaticamente um item ou preco de PDF.
export type LinhaPdfCompra = {
  codigo: string; descricao: string; quantidade: number | null; unidade: string;
  preco_unitario: number | null; preco_total: number | null; linha_original: string;
}
export const normalizarCodigoCompra = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'')
const codigoRx = /(?:^|[^A-Z0-9])([A-Z]{1,5}[\s._-]?\d{2,7}(?:[-./][A-Z0-9]{1,6})?)(?=$|[^A-Z0-9])/i
const moeda = (raw:string):number|null => {
 const s=raw.replace(/R\$\s*/gi,'').replace(/\s/g,'')
 if(!s)return null
 const numero=s.includes(',')?Number(s.replace(/\./g,'').replace(',','.')):Number(s)
 return Number.isFinite(numero)&&numero>=0?numero:null
}
const quantRx = /(\d{1,6}(?:[.,]\d{1,4})?)\s*(UN|UND|PC|PÇ|PCS|MT|M|ML|KG|CX|BR|BARRA|BARRAS)\b/gi
const precoRx = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/gi
function linhaLimpa(s:string){return s.trim().replace(/\s{2,}/g,' ')}
export function extrairLinhasCompra(texto:string,tipo:'lista'|'cotacao'):LinhaPdfCompra[]{
 const linhas=texto.replace(/\r/g,'\n').split('\n').map(linhaLimpa).filter(Boolean)
 const resultado:LinhaPdfCompra[]=[]
 for(const linha of linhas){
  const codigoBruto=linha.match(codigoRx)?.[1]
  if(!codigoBruto)continue
  const codigo=codigoBruto.trim().replace(/\s+/g,'')
  const quantidades=[...linha.matchAll(quantRx)]
  const precos=[...linha.matchAll(precoRx)]
  const quantidadeMatch=quantidades.at(-1)
  const q=quantidadeMatch?moeda(quantidadeMatch[1]):null
  const unidade=quantidadeMatch?.[2]?.toUpperCase()||'UN'
  const valores=precos.map(x=>moeda(x[1])).filter((x):x is number=>x!==null)
  const desc=linha.replace(codigoBruto,'').replace(quantRx,' ').replace(precoRx,' ').replace(/\s+/g,' ').replace(/^[\s|:;\-–]+|[\s|:;\-–]+$/g,'').slice(0,250)
  resultado.push({
   codigo,descricao:desc||codigo,quantidade:q,unidade,
   preco_unitario:tipo==='cotacao'&&valores.length?valores[0]:null,
   preco_total:tipo==='cotacao'&&valores.length>1?valores.at(-1)!:null,
   linha_original:linha.slice(0,450),
  })
  if(resultado.length>=200)break
 }
 return resultado
}
export function extrairCondicoesCotacao(texto:string){
 const linhas=texto.split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean)
 const encontrar=(re:RegExp)=>linhas.find(x=>re.test(x))?.slice(0,220)||''
 const freteTxt=encontrar(/\bfrete\b/i)
 const freteValor=freteTxt.match(precoRx)?.[0]
 return {
  frete:freteValor?moeda(freteValor):null,
  prazo:encontrar(/\bprazo\b|entrega\s*em/i),
  pagamento:encontrar(/pagamento|faturamento|condi[cç][oõ]es/i),
  validade:encontrar(/validade|proposta\s+v[aá]lida/i),
 }
}
