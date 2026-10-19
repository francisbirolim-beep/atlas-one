// Unidades operacionais de compras/recebimentos. Não converter unidades diferentes.
export const UNIDADES_CMV=['KG','UN','PC','PCT'] as const
export type UnidadeCmv=(typeof UNIDADES_CMV)[number]
export const unidadePadraoCmv=(categoria:string):UnidadeCmv=>categoria==='perfil'?'KG':'UN'
export const rotuloUnidadeCmv=(unidade:string)=>unidade==='KG'?'kg':unidade==='UN'?'un.':unidade==='PC'?'peças':unidade==='PCT'?'pacotes':unidade
export const unidadeCmvValida=(u:string):u is UnidadeCmv=>UNIDADES_CMV.includes(u as UnidadeCmv)
export const quantidadeCmvValida=(q:number|null,u:string)=>q!==null&&Number.isFinite(q)&&q>0&&q<=999999999&&(u==='KG'||Number.isInteger(q))
export const mostrarQuantidadeCmv=(q:number,u:string)=>q.toLocaleString('pt-BR',{maximumFractionDigits:u==='KG'?3:0})+' '+rotuloUnidadeCmv(u)
