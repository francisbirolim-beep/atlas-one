'use client'
import {useCallback,useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import Image from 'next/image'
import {tokenAtual} from '@/lib/auth'
import type {DocumentoCompra} from '@/lib/comprasDocumento'

const dataPt=(s:string)=>new Date(s).toLocaleDateString('pt-BR')
const qtd=(n:number|null)=>n===null?'A definir':n.toLocaleString('pt-BR',{maximumFractionDigits:4})
export default function DocumentoCompraPage(){
 const params=useParams()
 const tipo=String(params.tipo||'')
 const id=String(params.id||'')
 const [doc,setDoc]=useState<DocumentoCompra|null>(null)
 const [erro,setErro]=useState('')
 const [baixando,setBaixando]=useState(false)
 const carregar=useCallback(async()=>{
  try{
   const token=await tokenAtual()
   const q=new URLSearchParams({tipo,id})
   const r=await fetch('/api/compras/documento?'+q,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Documento indisponível')
   setDoc(j.documento)
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível carregar o pedido')}
 },[tipo,id])
 useEffect(()=>{void carregar()},[carregar])
 async function baixar(){
  if(!doc)return
  try{
   setBaixando(true);setErro('')
   const token=await tokenAtual()
   const q=new URLSearchParams({tipo,id,formato:'pdf'})
   const r=await fetch('/api/compras/documento?'+q,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Falha ao gerar o PDF')}
   const blob=await r.blob(),url=URL.createObjectURL(blob)
   const a=document.createElement('a');a.href=url;a.download=doc.numero+'.pdf';document.body.appendChild(a);a.click();a.remove()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao baixar PDF')}
  finally{setBaixando(false)}
 }
 return <main className="mx-auto min-h-screen max-w-5xl bg-slate-100 px-3 py-6 text-slate-900 print:max-w-none print:bg-white print:p-0">
  <style>{'@page{size:A4 portrait;margin:12mm} @media print{body{background:white!important} .nao-imprimir{display:none!important} .folha{border:0!important;box-shadow:none!important;padding:0!important} tr{break-inside:avoid} .linha-conferencia{min-height:55px}}'}</style>
  <div className="nao-imprimir mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
   <div><h1 className="font-bold">Impressão do pedido de compra</h1><p className="text-xs text-slate-500">Via para o Kanban físico e conferência quando o material chegar.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>window.print()} disabled={!doc} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Imprimir lista</button>
    <button type="button" onClick={()=>void baixar()} disabled={!doc||baixando} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{baixando?'Gerando PDF...':'Baixar PDF'}</button></div>
  </div>
  {erro&&<div role="alert" className="nao-imprimir mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
  {!doc&&!erro&&<p className="p-6">Carregando documento de compra...</p>}
  {doc&&<article className="folha rounded-xl border bg-white p-6 shadow-sm sm:p-8">
   <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
    <Image src="/branding/esquadrifacio-logo-r.webp" alt="Esquadrifácio" width={280} height={52} unoptimized className="h-auto w-48 object-contain sm:w-60"/>
    <div className="text-right"><h2 className="text-lg font-bold">PEDIDO DE COMPRA</h2><p className="text-base font-bold">Nº {doc.numero}</p><p className="text-xs">Emissão: {dataPt(doc.data)}</p><p className="text-xs font-semibold">Situação: {doc.status.replaceAll('_',' ')}</p></div>
   </header>
   <section className="mt-5 grid gap-2 border-b pb-5 text-sm sm:grid-cols-2">
    <p><b>Destino:</b> {doc.destino}</p><p><b>Solicitante:</b> {doc.solicitante}</p>
    {doc.fornecedor&&<p><b>Fornecedor:</b> {doc.fornecedor}</p>}
    {doc.cliente&&<p><b>Cliente:</b> {doc.cliente}</p>}
    {doc.obra&&<p><b>Obra:</b> {doc.obra}</p>}
   </section>
   {doc.observacoes&&<section className="mt-4 text-xs"><b>Observações do pedido:</b> {doc.observacoes}</section>}
   <section className="mt-6"><h3 className="mb-2 text-sm font-bold">MATERIAIS — CONFERÊNCIA FÍSICA</h3>
    <div className="overflow-x-auto"><table className="w-full border-collapse text-xs">
     <thead><tr className="bg-slate-100 text-left"><th className="border p-2">Foto / Desenho</th><th className="border p-2">Código e descrição</th><th className="border p-2">Pedido</th><th className="border p-2">Recebido / falta</th></tr></thead>
     <tbody>{doc.itens.map((x,i)=><tr key={x.id+'-'+i} className="linha-conferencia">
      <td className="w-[90px] border p-2 align-top">{x.imagem?<img src={x.imagem} alt={'Imagem '+x.descricao} className="h-16 w-20 object-contain"/>:<span className="block rounded border border-dashed p-2 text-[10px] text-amber-800">Imagem pendente no catálogo</span>}</td>
      <td className="border p-2 align-top"><b>{i+1}. {x.codigo||'Sem código'}</b><p className="mt-1 font-medium">{x.descricao}</p><p className="mt-1 text-[10px] text-slate-600">{x.destino==='estoque'?'Estoque':x.cliente+(x.obra?' / '+x.obra:' / Avulso')}</p>{x.quantidade_recebida>0&&<p className="text-[10px] font-semibold text-blue-800">Já recebido anteriormente: {qtd(x.quantidade_recebida)} {x.unidade}</p>}{x.status==='cancelado'&&<b>CANCELADO</b>}</td>
      <td className="border p-2 align-top font-bold">{qtd(x.quantidade)} {x.unidade}</td>
      <td className="min-w-[125px] border p-2 align-top"><p>Chegou: __________</p><p className="mt-3">Faltou: __________</p><p className="mt-3">☐ Conferido</p></td>
     </tr>)}</tbody>
    </table></div>
   </section>
   <section className="mt-8 grid gap-5 text-xs sm:grid-cols-2">
    <div className="border-t pt-2">Conferente / assinatura</div><div className="border-t pt-2">Data e horário de recebimento</div>
    <div className="sm:col-span-2"><b>Observações / divergências:</b><div className="mt-3 border-b border-dotted"></div><div className="mt-4 border-b border-dotted"></div></div>
   </section>
   <footer className="mt-8 border-t pt-3 text-[10px] text-slate-500">Esquadrifácio · {doc.numero} · Via de conferência para o Kanban físico. A entrada no estoque requer confirmação no sistema.</footer>
  </article>}
 </main>
}
