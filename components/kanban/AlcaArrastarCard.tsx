'use client'
import {useRef,useState,type PointerEvent} from 'react'

type Arraste={pointerId:number;x:number;y:number;movendo:boolean}
type Props={onSoltar:(colunaId:string)=>void;desabilitado?:boolean;label?:string}

/**
 * Alternativa a HTML5 drag/drop: utiliza Pointer Events e captura o ponteiro.
 * Funciona com mouse, touch e trackpad mesmo quando há cards e selects aninhados.
 * O destino é encontrado sob o cursor; somente a API decide se o usuário pode salvar.
 */
export default function AlcaArrastarCard({onSoltar,desabilitado=false,label='Segure aqui e arraste o card'}:Props){
 const inicio=useRef<Arraste|null>(null)
 const alvo=useRef<HTMLElement|null>(null)
 const [arrastando,setArrastando]=useState(false)
 function limpar(){
  alvo.current?.classList.remove('ring-2','ring-cyan-400')
  alvo.current=null
  inicio.current=null
  setArrastando(false)
 }
 function comecar(e:PointerEvent<HTMLButtonElement>){
  if(desabilitado||e.button!==0)return
  e.preventDefault()
  e.stopPropagation()
  inicio.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,movendo:false}
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch{limpar()}
 }
 function mover(e:PointerEvent<HTMLButtonElement>){
  const a=inicio.current
  if(!a||a.pointerId!==e.pointerId)return
  if(!a.movendo){
   if(Math.hypot(e.clientX-a.x,e.clientY-a.y)<7)return
   a.movendo=true;setArrastando(true)
  }
  const board=e.currentTarget.closest('[data-kanban-board]')
  const scroll=board?.querySelector<HTMLElement>('[data-kanban-scroll]')
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
  const board=e.currentTarget.closest('[data-kanban-board]')
  const coluna=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-kanban-coluna]')
  const destino=a.movendo&&coluna&&board?.contains(coluna)?coluna.dataset.kanbanColuna:null
  limpar()
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
  if(destino)onSoltar(destino)
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
