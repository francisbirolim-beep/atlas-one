// Revisão humana do custo previsto W.Vetro. Nunca altera o CMV realizado ou o dado de origem.
export const CATEGORIAS_CMV_REVISAO = ['total','perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros'] as const
export type CategoriaCmvRevisao = (typeof CATEGORIAS_CMV_REVISAO)[number]
export type PrevisaoCmvBase = {categorias:{perfil:number|null;acessorio:number|null;vidro:number|null;sobra:number|null;perda:number|null};total:number|null}
export type RevisaoCmv = {
 versao:1;venda_id:string;orcamento_id:string;numero_wvetro:string;categoria:CategoriaCmvRevisao
 acao:'validado'|'corrigido';valor_origem:number|null;valor_revisado:number
 justificativa:string;usuario_nome:string;registrado_em:string
}
export const centavos=(valor:number)=>Math.round((valor+Number.EPSILON)*100)/100
export function custoPrevistoOriginal(p:PrevisaoCmvBase,c:CategoriaCmvRevisao):number|null{
 if(c==='total')return p.total
 if(c==='perfil')return p.categorias.perfil===null||p.categorias.sobra===null?null:centavos(p.categorias.perfil+p.categorias.sobra)
 if(c==='acessorio'||c==='vidro'||c==='perda')return p.categorias[c]
 return null
}
export function revisaoAtual(r:RevisaoCmv|undefined,origem:number|null):boolean{
 return !!r&&r.valor_origem===origem
}
export function custoRevisado(p:PrevisaoCmvBase,revisoes:Partial<Record<CategoriaCmvRevisao,RevisaoCmv>>,categoria:CategoriaCmvRevisao):number|null{
 const origem=custoPrevistoOriginal(p,categoria)
 const revisao=revisoes[categoria]
 if(revisaoAtual(revisao,origem))return revisao!.valor_revisado
 if(categoria!=='total')return origem
 if(origem===null)return null
 // Mantém o total histórico W.Vetro, aplicando apenas diferenças revisadas de categorias
 // conhecidas. Correções de categorias sem base não entram aqui: exigem validar o total.
 let delta=0
 for(const c of CATEGORIAS_CMV_REVISAO){
  if(c==='total')continue
  const original=custoPrevistoOriginal(p,c)
  const ajuste=revisoes[c]
  if(original!==null&&revisaoAtual(ajuste,original))delta+=ajuste!.valor_revisado-original
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
