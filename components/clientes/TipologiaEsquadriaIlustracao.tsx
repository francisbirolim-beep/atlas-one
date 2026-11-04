'use client'

// Pré-visualização esquemática da esquadria quando o W.Vetro não fornece desenho.
// Não é um desenho executivo e não substitui o projeto técnico nem a lista de corte.
export default function TipologiaEsquadriaIlustracao({descricao='',compacta=false}:{descricao?:string;compacta?:boolean}){
 const match=descricao.match(/(\d+)\s*folhas?/i)
 const qtd=Math.max(1,Math.min(6,Number(match?.[1]||3)))
 const abas=Array.from({length:qtd},(_,i)=>i)
 const x=18,y=20,w=284,h=246,largura=(w-14)/qtd
 return <svg viewBox="0 0 320 292" width="100%" height="100%" role="img" aria-label={`Ilustração esquemática de esquadria com ${qtd} folha(s)`} className={compacta?'h-full w-full':'h-full max-h-[330px] w-full'}>
  <defs>
   <linearGradient id="atlas-porta-vidro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6f2fa"/><stop offset="0.5" stopColor="#d2e5f2"/><stop offset="1" stopColor="#f9fcfe"/></linearGradient>
   <linearGradient id="atlas-porta-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#293744"/><stop offset="0.55" stopColor="#101a24"/><stop offset="1" stopColor="#455463"/></linearGradient>
  </defs>
  <rect x="15" y="17" width="290" height="255" rx="2" fill="#bacbd5" opacity="0.33"/>
  <rect x={x} y={y} width={w} height={h} fill="url(#atlas-porta-metal)" stroke="#101a24" strokeWidth="4"/>
  <rect x={x+8} y={y+8} width={w-16} height={h-16} fill="url(#atlas-porta-vidro)"/>
  {abas.map(i=>{
   const a=x+7+i*largura
   return <g key={i}>
    <rect x={a} y={y+7} width={largura} height={h-14} fill="none" stroke="#16212a" strokeWidth="5"/>
    <path d={`M ${a+8} ${y+15} L ${a+largura-8} ${y+15} L ${a+9} ${y+h-18} Z`} fill="#fff" opacity="0.17"/>
    <line x1={a+largura/2} y1={y+10} x2={a+largura/2} y2={y+h-10} stroke="#f0f6f9" strokeWidth="1" opacity="0.24"/>
    {i===Math.floor(qtd/2)&&<rect x={a+largura-10} y={y+h*0.52} width="3" height="24" rx="1" fill="#7e919d"/>}
   </g>
  })}
  <rect x={x+6} y={y+h-11} width={w-12} height="6" fill="#283541" opacity="0.85"/>
  <line x1={x} y1={y+h+5} x2={x+w} y2={y+h+5} stroke="#9baaba" strokeWidth="2" opacity=".65"/>
 </svg>
}
