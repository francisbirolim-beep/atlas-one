'use client'

import {useMemo,useState} from 'react'
import Link from 'next/link'
import {FileDown,Scissors} from 'lucide-react'

export type CorteWVetro={
 id:string;categoria:string;codigo?:string|null;descricao:string;unidade:string;
 quantidade_ajustada?:number|null;quantidade_tecnica?:number|null;
 comprimento_corte_mm?:number|null;comprimento_barra_mm?:number|null;
 cor_ref?:string|null;item_ref?:string|null;justificativa_ajuste?:string|null;origem_calculo?:string|null
}
const filtros=[
 {id:'perfil',titulo:'Perfis'},
 {id:'acessorio',titulo:'Acessórios'},
 {id:'vidro',titulo:'Vidros'},
 {id:'outros',titulo:'Outros'},
] as const
export default function VendaListaCorteWVetro({materiais,obraId,pacoteId,orcamentoId,onEditar}:{
 materiais:CorteWVetro[];obraId?:string|null;pacoteId?:string|null;orcamentoId:string;onEditar:()=>void
}){
 const [categoria,setCategoria]=useState<(typeof filtros)[number]['id']>('perfil')
 const dados=useMemo(()=>materiais.filter(m=>{
  if(categoria==='perfil')return m.categoria==='perfil'||m.categoria==='contramarco'
  if(categoria==='outros')return !['perfil','contramarco','acessorio','vidro'].includes(m.categoria)
  return m.categoria===categoria
 }),[materiais,categoria])
 const comCorte=dados.filter(m=>Number(m.comprimento_corte_mm||0)>0).length
 const nome=filtros.find(f=>f.id===categoria)?.titulo||'Materiais'
 const grupo=categoria==='perfil'?'perfis':categoria==='acessorio'?'acessorios':categoria==='vidro'?'vidros':null
 const params=pacoteId?'pacote='+encodeURIComponent(pacoteId):'orcamento='+encodeURIComponent(orcamentoId)
 return <section className="mb-5 rounded-2xl border border-blue-200 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Scissors size={19} className="text-blue-700"/>Lista de corte para Produção · WVetro</h3>
    <p className="mt-1 text-xs text-slate-600">Peças cortadas por medida e tipologia. Quantidade aqui significa corte, não barras inteiras a comprar.</p>
    <p className="mt-1 text-[11px] text-blue-700">{dados.length} linha(s) de {nome.toLowerCase()} · {comCorte} com comprimento de corte</p>
   </div>
   <div className="flex flex-wrap gap-2">
    {obraId&&grupo&&<Link target="_blank" href={'/obras/'+obraId+'/materiais/pdf?'+params+'&grupo='+grupo} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"><FileDown size={13}/>PDF da lista de corte</Link>}
    <button type="button" onClick={onEditar} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700">Editar / substituir cortes</button>
   </div>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">{filtros.map(f=><button key={f.id} onClick={()=>setCategoria(f.id)} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(categoria===f.id?'border-blue-600 bg-blue-600 text-white':'bg-slate-50 text-slate-700')}>{f.titulo}</button>)}</div>
  <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border">
   <table className="w-full min-w-[950px] text-left text-xs">
    <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Código</th><th>Descrição</th><th>Ambiente / tipologia</th><th>Qtde de peças</th><th>Medida do corte</th><th>Cor</th><th>Barra de origem</th></tr></thead>
    <tbody>{dados.map(m=><tr key={m.id} className="border-t">
     <td className="p-2 font-mono font-bold">{m.codigo||'—'}</td>
     <td className="p-2">{m.descricao}</td>
     <td className="p-2 text-slate-500">{m.item_ref||'Geral da obra'}</td>
     <td className="p-2 font-bold">{Number(m.quantidade_ajustada??m.quantidade_tecnica??0).toLocaleString('pt-BR')} {m.unidade||'UN'}</td>
     <td className="p-2 font-bold">{m.comprimento_corte_mm?Number(m.comprimento_corte_mm).toLocaleString('pt-BR')+' mm':'—'}</td>
     <td className="p-2">{m.cor_ref||'—'}</td>
     <td className="p-2">{m.comprimento_barra_mm?Number(m.comprimento_barra_mm).toLocaleString('pt-BR')+' mm':'—'}</td>
    </tr>)}{!dados.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">Nenhum corte desta categoria no pacote técnico.</td></tr>}</tbody>
   </table>
  </div>
  <p className="mt-2 text-[11px] text-slate-500">Esta lista técnica não libera pedidos de barras. A compra das barras do WVetro ocorre exclusivamente em Compras → Barras comerciais, após validação.</p>
 </section>
}
