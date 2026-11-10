'use client'
import {useEffect,useRef,useState,type PointerEvent} from 'react'
import {colunaNoFimDoArraste} from '@/lib/kanbanArrastarDestino'

type Arraste={pointerId:number;x:number;y:number;ultimoX:number;ultimoY:number;movendo:boolean}
type Props={onSoltar:(colunaId:string)=>void;onSolturaInvalida?:()=>void;desabilitado?:boolean;label?:string}

/**
 * Alternativa a HTML5 drag/drop: utiliza Pointer Events e captura o ponteiro.
 * Funciona com mouse, touch e trackpad mesmo quando há cards e selects aninhados.
 * O destino é encontrado sob o cursor; somente a API decide se o usuário pode salvar.
 */
export default function AlcaArrastarCard({onSoltar,onSolturaInvalida,desabilitado=false,label='Segure aqui e arraste o card'}:Props){
 const inicio=useRef<Arraste|null>(null)
 const alvo=useRef<HTMLElement|null>(null)
 const fantasma=useRef<HTMLElement|null>(null)
 useEffect(()=>()=>{fantasma.current?.remove();alvo.current?.classList.remove('ring-2','ring-cyan-400')},[])
 const [arrastando,setArrastando]=useState(false)
 function limpar(){
  fantasma.current?.remove();fantasma.current=null
  alvo.current?.classList.remove('ring-2','ring-cyan-400')
  alvo.current=null
  inicio.current=null
  setArrastando(false)
 }
 function comecar(e:PointerEvent<HTMLButtonElement>){
  if(desabilitado||e.button!==0)return
  e.preventDefault()
  e.stopPropagation()
  inicio.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,ultimoX:e.clientX,ultimoY:e.clientY,movendo:false}
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch{limpar()}
 }
 function mover(e:PointerEvent<HTMLButtonElement>){
  const a=inicio.current
  if(!a||a.pointerId!==e.pointerId)return
  if(e.clientX>0&&e.clientY>0){a.ultimoX=e.clientX;a.ultimoY=e.clientY}
  if(!a.movendo){
   if(Math.hypot(e.clientX-a.x,e.clientY-a.y)<7)return
   a.movendo=true;setArrastando(true)
   // O card deve ACOMPANHAR o mouse, não apenas destacar o destino.
   // O clone é só visual e jamais é enviado ao backend.
   const fonte=e.currentTarget.closest<HTMLElement>('[data-kanban-card]')||e.currentTarget
   const copia=fonte.cloneNode(true) as HTMLElement
   copia.removeAttribute('id')
   const largura=Math.max(145,Math.min(fonte.getBoundingClientRect().width,300))
   Object.assign(copia.style,{
    position:'fixed',left:'0',top:'0',width:largura+'px',minWidth:'0',
    maxHeight:'75vh',overflow:'hidden',pointerEvents:'none',
    zIndex:'2147483000',opacity:'0.94',transform:'translate(-9999px,-9999px)',
    boxShadow:'0 16px 35px rgba(0,0,0,.35)',
    border:'2px solid #0891b2',borderRadius:'10px',
   })
   copia.setAttribute('aria-hidden','true')
   document.body.appendChild(copia)
   fantasma.current=copia
  }
  if(fantasma.current)fantasma.current.style.transform='translate('+(e.clientX+14)+'px,'+(e.clientY+14)+'px)'
  const board=e.currentTarget.closest('[data-kanban-board]')
  const scroll=board?.matches('[data-kanban-scroll]')?board as HTMLElement:board?.querySelector<HTMLElement>('[data-kanban-scroll]')
  if(scroll){
   const area=scroll.getBoundingClientRect()
   if(e.clientX<area.left+70)scroll.scrollLeft-=32
   else if(e.clientX>area.right-70)scroll.scrollLeft+=32
  }
  const node=document.elementFromPoint(e.clientX,e.clientY)
  const coluna=node?.closest<HTMLElement>('[data-kanban-coluna]')||null
  const novo=coluna&&board?.contains(coluna)?coluna:null
  if(novo!==alvo.current){
   alvo.current?.classList.remove('ring-2','ring-cyan-400')
   novo?.classList.add('ring-2','ring-cyan-400')
   alvo.current=novo
  }
 }
 function terminar(e:PointerEvent<HTMLButtonElement>){
  const a=inicio.current
  if(!a||a.pointerId!==e.pointerId)return
  const destino=a.movendo?colunaNoFimDoArraste(e.currentTarget,{x:e.clientX,y:e.clientY},{x:a.ultimoX,y:a.ultimoY}):null
  limpar()
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
  if(destino)onSoltar(destino)
  else if(a.movendo)onSolturaInvalida?.()
 }
 return <button type="button" draggable={false} disabled={desabilitado}
  aria-label={label} title="Clique, segure, leve até outra coluna e solte"
  onClick={e=>{e.preventDefault();e.stopPropagation()}}
  onDragStart={e=>e.preventDefault()}
  onPointerDown={comecar} onPointerMove={mover} onPointerUp={terminar}
  onPointerCancel={limpar} onLostPointerCapture={()=>{if(inicio.current)limpar()}}
  style={{touchAction:'none',userSelect:'none'}}
  className={'mb-2 w-full select-none rounded border px-2 py-2 text-center text-[11px] font-extrabold transition-colors '+(arrastando?'cursor-grabbing border-cyan-400 bg-cyan-300 text-blue-950 shadow-lg':'cursor-grab border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200')+' disabled:cursor-not-allowed disabled:opacity-50'}>
  {arrastando?'Solte na coluna desejada':'⠿ '+label}
 </button>
}
