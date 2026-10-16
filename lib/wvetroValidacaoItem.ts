import type { ItemEsquadria } from './tipos'

export const CAMPOS_ITEM_WVETRO = ['ambiente','tipo_esquadria','tipo_outro_texto','folhas','largura_mm','altura_mm','quantidade','cor','descricao','observacao_producao','contramarco'] as const
export function snapshotItemWVetro(item: Partial<ItemEsquadria>) {
  return Object.fromEntries(CAMPOS_ITEM_WVETRO.map(c => [c,item[c] ?? null]))
}
export function diferencasItemWVetro(antes: Partial<ItemEsquadria>,depois: Partial<ItemEsquadria>) {
  const a=snapshotItemWVetro(antes), b=snapshotItemWVetro(depois)
  return Object.fromEntries(CAMPOS_ITEM_WVETRO.filter(c=>JSON.stringify(a[c])!==JSON.stringify(b[c])).map(c=>[c,{antes:a[c],depois:b[c]}]))
}
export function statusItemWVetro(item: ItemEsquadria,fluxo: any): 'pendente'|'validado'|'corrigido' {
  const v=fluxo?.validacoes_itens?.[item.id]
  if(!v || JSON.stringify(snapshotItemWVetro(v.snapshot||{}))!==JSON.stringify(snapshotItemWVetro(item)))return 'pendente'
  return v.resultado==='corrigido'?'corrigido':'validado'
}
export function resolverTipologiaDigitada(texto: string, catalogo: Record<string,string>) {
  const normalizar=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ')
  const nome=texto.trim()
  const encontrados=Object.entries(catalogo).filter(([chave,label])=>chave!=='outro'&&(normalizar(label)===normalizar(nome)||normalizar(chave)===normalizar(nome)))
  return encontrados.length===1
    ? {tipo_esquadria:encontrados[0][0],tipo_outro_texto:null}
    : {tipo_esquadria:'outro',tipo_outro_texto:nome}
}
