import type { ItemEsquadria } from './tipos'

// Campos antigos permanecem na mesma ordem; novos campos não anulam
// snapshots legados de esquadrias já validadas.
export const CAMPOS_ITEM_WVETRO = [
  'ambiente','tipo_esquadria','tipo_outro_texto','folhas','largura_mm','altura_mm',
  'quantidade','cor','descricao','observacao_producao','contramarco',
  'linha_nome','configuracao_nome','variaveis','observacao_tempera',
  'largura_baixo_mm','largura_meio_mm','largura_cima_mm',
  'altura_direita_mm','altura_meio_mm','altura_esquerda_mm',
] as const
function canonico(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k)+':'+canonico(o[k])).join(',') + '}'
  }
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']'
  return JSON.stringify(v ?? null)
}
export function snapshotItemWVetro(item: Partial<ItemEsquadria>) {
  return Object.fromEntries(CAMPOS_ITEM_WVETRO.map(c => [c,item[c] ?? null]))
}
export function diferencasItemWVetro(antes: Partial<ItemEsquadria>,depois: Partial<ItemEsquadria>) {
  const a=snapshotItemWVetro(antes), b=snapshotItemWVetro(depois)
  return Object.fromEntries(CAMPOS_ITEM_WVETRO.filter(c=>canonico(a[c])!==canonico(b[c])).map(c=>[c,{antes:a[c],depois:b[c]}]))
}
export function statusItemWVetro(item: ItemEsquadria,fluxo: any): 'pendente'|'validado'|'corrigido' {
  const v=fluxo?.validacoes_itens?.[item.id]
  if(!v?.snapshot||typeof v.snapshot!=='object'||Array.isArray(v.snapshot))return 'pendente'
  const atual=snapshotItemWVetro(item)
  // Comparar somente o que foi efetivamente conferido: não exigir campos
  // criados posteriormente e não gravados nos snapshots antigos.
  if(!Object.keys(v.snapshot).length||!Object.keys(v.snapshot).every(c=>c in atual && canonico(v.snapshot[c])===canonico(atual[c])))return 'pendente'
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
