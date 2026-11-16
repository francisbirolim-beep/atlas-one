// Cálculo da prévia com valores verdadeiros do cadastro e possíveis ajustes locais.
// Não faz requisições nem grava no banco de precificação oficial do Atlas.
export type CorAluminio={
  id:string;nome:string;ativo:boolean;pintura:boolean;adicionalKg:number|null
}
export type DadosPrecosAluminio={natural:number|null;cores:CorAluminio[]}
export type SimulacaoPrecoAluminio={
  natural?:number|null
  precoPorCor?:Record<string,number|null>
}
export const chaveSimulacaoPreco=(userId:string)=>'atlasone:previa:preco-aluminio:v1:'+userId

export function precoNaturalEfetivo(dados:DadosPrecosAluminio,ajustes:SimulacaoPrecoAluminio){
  const valor=Object.prototype.hasOwnProperty.call(ajustes,'natural')?ajustes.natural:dados.natural
  return typeof valor==='number'&&Number.isFinite(valor)&&valor>0?valor:null
}
export function precoCorEfetivo(cor:CorAluminio,dados:DadosPrecosAluminio,ajustes:SimulacaoPrecoAluminio):number|null{
  const proprio=ajustes.precoPorCor||{}
  if(Object.prototype.hasOwnProperty.call(proprio,cor.id)){
    const valor=proprio[cor.id]
    return typeof valor==='number'&&Number.isFinite(valor)&&valor>0?valor:null
  }
  const natural=precoNaturalEfetivo(dados,ajustes)
  if(natural==null||cor.adicionalKg==null||!Number.isFinite(cor.adicionalKg))return null
  const total=Math.round((natural+cor.adicionalKg)*100)/100
  return total>0?total:null
}
export function lerSimulacaoPreco(userId:string):SimulacaoPrecoAluminio{
  if(typeof window==='undefined'||!userId)return {}
  try{
    const s=window.localStorage.getItem(chaveSimulacaoPreco(userId))
    if(!s)return {}
    const o=JSON.parse(s) as SimulacaoPrecoAluminio
    if(!o||typeof o!=='object')return {}
    const porCor:Record<string,number|null>={}
    for(const [id,valor] of Object.entries(o.precoPorCor||{})){
      if(typeof valor==='number'&&Number.isFinite(valor)&&valor>=0||valor===null)porCor[id]=valor
    }
    const natural=typeof o.natural==='number'&&Number.isFinite(o.natural)&&o.natural>=0||o.natural===null?o.natural:undefined
    return {natural,precoPorCor:porCor}
  }catch{return {}}
}
export function guardarSimulacaoPreco(userId:string,valor:SimulacaoPrecoAluminio){
  if(typeof window==='undefined'||!userId)return false
  try{window.localStorage.setItem(chaveSimulacaoPreco(userId),JSON.stringify(valor));return true}
  catch{return false}
}
