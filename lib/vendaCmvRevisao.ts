// Revisão humana do custo previsto W.Vetro. Nunca altera o CMV realizado ou o dado de origem.
export const CATEGORIAS_CMV_REVISAO = ['total','perfil','perfil_uso','sobra','acessorio','vidro','perda','mao_obra','instalacao','frete','outros'] as const
export type CategoriaCmvRevisao = (typeof CATEGORIAS_CMV_REVISAO)[number]
export type PrevisaoCmvBase = {categorias:{perfil:number|null;acessorio:number|null;vidro:number|null;sobra:number|null;perda:number|null};total:number|null;perfil_previsao?:number|null;perfil_previsao_fonte?:string|null}
export type RevisaoCmv = {
 versao:1;venda_id:string;orcamento_id:string;numero_wvetro:string;categoria:CategoriaCmvRevisao
 acao:'validado'|'corrigido';valor_origem:number|null;valor_revisado:number
 justificativa:string;usuario_nome:string;registrado_em:string
}
export const centavos=(valor:number)=>Math.round((valor+Number.EPSILON)*100)/100
export function custoPrevistoOriginal(p:PrevisaoCmvBase,c:CategoriaCmvRevisao):number|null{
 if(c==='total')return p.total
 if(c==='perfil_uso')return p.categorias.perfil
 if(c==='sobra')return p.categorias.sobra
 if(c==='perfil')return p.perfil_previsao??(p.categorias.perfil===null||p.categorias.sobra===null?null:centavos(p.categorias.perfil+p.categorias.sobra))
 if(c==='acessorio'||c==='vidro'||c==='perda')return p.categorias[c]
 return null
}
export function revisaoAtual(r:RevisaoCmv|undefined,origem:number|null):boolean{
 return !!r&&r.valor_origem===origem
}
export function custoRevisado(p:PrevisaoCmvBase,revisoes:Partial<Record<CategoriaCmvRevisao,RevisaoCmv>>,categoria:CategoriaCmvRevisao):number|null{
 const origem=custoPrevistoOriginal(p,categoria)
 const revisao=revisoes[categoria]
 if(revisaoAtual(revisao,origem)){
  if(categoria!=='perfil')return revisao!.valor_revisado
  // Uma correção posterior do uso ou da sobra invalida a revisão anterior do subtotal.
  const versaoSubtotal=Date.parse(revisao!.registrado_em)||0
  const partePosterior=p.perfil_previsao_fonte!=='despesas_extras_wvetro'&&(['perfil_uso','sobra'] as const).some(c=>{
   const r=revisoes[c];return r&&revisaoAtual(r,custoPrevistoOriginal(p,c))&&(Date.parse(r.registrado_em)||0)>versaoSubtotal
  })
  if(!partePosterior)return revisao!.valor_revisado
 }
 if(categoria==='perfil'){
  if(p.perfil_previsao_fonte==='despesas_extras_wvetro')return origem
  const uso=custoRevisado(p,revisoes,'perfil_uso')
  const sobra=custoRevisado(p,revisoes,'sobra')
  return uso===null||sobra===null?origem:centavos(uso+sobra)
 }
 if(categoria!=='total')return origem
 if(origem===null)return null
 // Mantém o total histórico W.Vetro, aplicando apenas diferenças revisadas de categorias
 // conhecidas. Correções de categorias sem base não entram aqui: exigem validar o total.
 let delta=0
 for(const c of CATEGORIAS_CMV_REVISAO){
  if(c==='total'||c==='perfil_uso'||c==='sobra')continue
  const original=custoPrevistoOriginal(p,c)
  const ajuste=revisoes[c]
  if(original!==null){
   const novo=custoRevisado(p,revisoes,c)
   if(novo!==null)delta+=novo-original
  }
 }
 return centavos(origem+delta)
}
export function lerRevisaoCmv(texto:unknown):RevisaoCmv|null{
 try{
  const r=JSON.parse(String(texto??'')) as RevisaoCmv
  if(r?.versao!==1||!CATEGORIAS_CMV_REVISAO.includes(r.categoria)||!['validado','corrigido'].includes(r.acao)||!Number.isFinite(r.valor_revisado)||r.valor_revisado<0)return null
  return r
 }catch{return null}
}
