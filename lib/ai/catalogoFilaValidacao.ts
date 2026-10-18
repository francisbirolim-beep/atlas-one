// A validação do produto continua sendo decidida no servidor.
// Na prévia em modo somente leitura, só permite tirar da fila visual local
// itens cujo desenho E dados técnicos já tenham sido conferidos na mesma tela.
export function conferidoSomenteNaPrevia(c:{tipo?:string;status?:string;dados?:Record<string,any>;deduplicacao?:Record<string,any>}):boolean{
  const d=c.dados||{}
  if(c.tipo!=='produto'||c.status!=='pendente'||d.imagem_preview_local!==true||
    d.conferencia_tabela_visualizada!==true||d.revisado_manualmente===true||
    !d.imagem_item_url||!d.codigo||!d.descricao)return false
  // Não esconder uma pendência cuja informação é insuficiente ou conflitante.
  if((Array.isArray(d.divergencias_tabela)&&d.divergencias_tabela.length>0)||
    (Array.isArray(d.conflito_peso_catalogo)&&d.conflito_peso_catalogo.length>1)||
    (Array.isArray(c.deduplicacao?.conflitos)&&c.deduplicacao.conflitos.length>0)||
    (Array.isArray(c.deduplicacao?.ambiguos)&&c.deduplicacao.ambiguos.length>0))return false
  if(d.categoria!=='perfil'||String(d.unidade||'').toUpperCase()!=='KG'||
     !(Number(String(d.peso_kg_m??'').replace(',','.'))>0))return false
  const medidas=d.medidas_mm||{}
  if(Object.values(medidas).filter(v=>Number(String(v).replace(',','.'))>0).length===0)return false
  return true
}
