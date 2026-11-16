// Prévia de composição: alumínio Natural + beneficiamento/acabamento por cor.
// Todos os preços vêm do cadastro real; alterações são somente locais ao navegador.
export type CorAluminio={
  id:string;nome:string;ativo:boolean;pintura:boolean;adicionalKg:number|null
}
export type DadosPrecosAluminio={natural:number|null;cores:CorAluminio[]}
export type SimulacaoPrecoAluminio={
  natural?:number|null
  beneficiamentoPorCor?:Record<string,number|null>
  /** Campo legado da primeira prévia: preço final fixo por cor. Apenas migrado na leitura. */
  precoPorCor?:Record<string,number|null>
}
export const chaveSimulacaoPreco=(userId:string)=>'atlasone:previa:preco-aluminio:v1:'+userId
const arredonda=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const valido=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0

export function precoNaturalEfetivo(dados:DadosPrecosAluminio,ajustes:SimulacaoPrecoAluminio){
  const valor=Object.prototype.hasOwnProperty.call(ajustes,'natural')?ajustes.natural:dados.natural
  return valido(valor)&&valor>0?arredonda(valor):null
}

/** Beneficiamento R$/kg (nunca confundir com preço final da cor). */
export function beneficiamentoCorEfetivo(cor:CorAluminio,ajustes:SimulacaoPrecoAluminio):number|null{
  const porCor=ajustes.beneficiamentoPorCor||{}
  if(Object.prototype.hasOwnProperty.call(porCor,cor.id)){
    const valor=porCor[cor.id]
    return valido(valor)?arredonda(valor):null
  }
  return valido(cor.adicionalKg)?arredonda(cor.adicionalKg):null
}

/** Valor final por quilo = Natural + beneficiamento. Nunca aplica margem de tipologia. */
export function precoCorEfetivo(cor:CorAluminio,dados:DadosPrecosAluminio,ajustes:SimulacaoPrecoAluminio):number|null{
  const natural=precoNaturalEfetivo(dados,ajustes)
  const beneficiamento=beneficiamentoCorEfetivo(cor,ajustes)
  if(natural==null||beneficiamento==null)return null
  const total=arredonda(natural+beneficiamento)
  return total>0?total:null
}

/**
 * Compatibilidade com a primeira prévia: uma cor alterada por preço final
 * vira beneficiamento = preço salvo - Natural da mesma simulação.
 * Não perde o preço anterior nem reescreve o cadastro oficial.
 */
export function lerSimulacaoPreco(userId:string,naturalCadastro:number|null=null):SimulacaoPrecoAluminio{
  if(typeof window==='undefined'||!userId)return {}
  try{
    const s=window.localStorage.getItem(chaveSimulacaoPreco(userId))
    if(!s)return {}
    const o=JSON.parse(s) as SimulacaoPrecoAluminio
    if(!o||typeof o!=='object')return {}
    const natural=valido(o.natural)?o.natural:o.natural===null?null:undefined
    const baseMigracao=natural!=null?natural:naturalCadastro
    const porCor:Record<string,number|null>={}
    for(const [id,valor] of Object.entries(o.beneficiamentoPorCor||{})){
      if(valido(valor)||valor===null)porCor[id]=valor
    }
    for(const [id,valorFinal] of Object.entries(o.precoPorCor||{})){
      if(Object.prototype.hasOwnProperty.call(porCor,id))continue
      if(!valido(valorFinal)||!valido(baseMigracao))continue
      // Preço final legado abaixo da base natural não é um beneficiamento válido.
      if(valorFinal<baseMigracao)continue
      porCor[id]=arredonda(valorFinal-baseMigracao)
    }
    return {natural,beneficiamentoPorCor:porCor}
  }catch{return {}}
}
export function guardarSimulacaoPreco(userId:string,valor:SimulacaoPrecoAluminio){
  if(typeof window==='undefined'||!userId)return false
  try{
    const limpo:SimulacaoPrecoAluminio={
      natural:valor.natural,
      beneficiamentoPorCor:valor.beneficiamentoPorCor||{},
    }
    window.localStorage.setItem(chaveSimulacaoPreco(userId),JSON.stringify(limpo))
    return true
  }catch{return false}
}
