/**
 * Recupera a coluna sob o mouse no fim de um drag nativo.
 * Alguns navegadores disparam onDragEnd sem onDrop na coluna, especialmente
 * com quadros de rolagem horizontal e elementos aninhados.
 * Somente client-side; a permissão e persistência seguem na API/RPC.
 */
export type CoordenadaArraste = {x:number;y:number}
export function colunaNoFimDoArraste(
  elemento:HTMLElement|null,evento:CoordenadaArraste,
  ultima:CoordenadaArraste|null=null
):string|null{
 const quadro=elemento?.closest('[data-kanban-board]')
 if(!quadro||typeof document==='undefined')return null
 const tentativas=[evento,ultima].filter((p):p is CoordenadaArraste=>
  !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>0&&p.y>0)
 for(const p of tentativas){
  const elementoSobMouse=document.elementFromPoint(p.x,p.y)
  const coluna=elementoSobMouse?.closest<HTMLElement>('[data-kanban-coluna]')
  if(coluna&&quadro.contains(coluna))return coluna.dataset.kanbanColuna||null
  // Fallback para interseção geométrica (ex.: ghost nativo/camada flutuante).
  for(const c of quadro.querySelectorAll<HTMLElement>('[data-kanban-coluna]')){
   const box=c.getBoundingClientRect()
   if(p.x>=box.left&&p.x<=box.right&&p.y>=box.top&&p.y<=box.bottom)
    return c.dataset.kanbanColuna||null
  }
 }
 return null
}
