'use client'

import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import {FileDown,ImageOff,Loader2} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Barra={
 id:string;codigo:string;descricao:string;tipo:string;tratamento:string;
 quantidade_barras:number;tamanho_barra_mm:number;imagem_url?:string|null;
 numero_wvetro:string;status_validacao:string;status_compra:string
}
const q=(v:number)=>Number(v||0).toLocaleString('pt-BR')
export default function ListaCompraBarrasPage(){
 const params=useParams<{vendaId:string}>()
 const vendaId=String(params.vendaId||'')
 const [barras,setBarras]=useState<Barra[]>([])
 const [numero,setNumero]=useState('')
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [barraId,setBarraId]=useState('')
 useEffect(()=>{
  let mounted=true
  const qs=new URLSearchParams(window.location.search)
  const filtro=qs.get('barraId')||''
  setBarraId(filtro)
  void (async()=>{
   try{
    const token=await tokenAtual()
    if(!token)throw Error('É necessário entrar no Atlas.')
    const r=await fetch('/api/vendas/wvetro/barras?vendaId='+encodeURIComponent(vendaId),{
     headers:{Authorization:'Bearer '+token},cache:'no-store',
    })
    const json=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(json.error||'Lista indisponível.')
    const dados=(json.barras||[]) as Barra[]
    const selecionadas=filtro?dados.filter(row=>row.id===filtro):dados
    if(filtro&&!selecionadas.length)throw Error('Esta barra não pertence à venda ou não foi encontrada.')
    if(selecionadas.some(row=>row.status_validacao==='pendente'))throw Error('Há barras pendentes de validação. Confirme as linhas antes de gerar um pedido ou PDF de compra.')
    if(mounted){setBarras(selecionadas);setNumero(json.numeroWvetro||'')}
   }catch(e){if(mounted)setErro(e instanceof Error?e.message:'Falha ao carregar barras.')}
   finally{if(mounted)setCarregando(false)}
  })()
  return()=>{mounted=false}
 },[vendaId])
 if(carregando)return <main className="p-8 text-slate-500"><Loader2 className="inline animate-spin"/> Carregando barras comerciais...</main>
 if(erro)return <main className="p-8 text-red-700">{erro}</main>
 return <main className="mx-auto max-w-6xl bg-white p-8 text-slate-900 print:max-w-none print:p-0">
  <div className="mb-4 flex justify-between gap-4 print:hidden">
   <button onClick={()=>window.history.back()} className="rounded-lg border px-4 py-2 text-sm">Voltar</button>
   <button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"><FileDown size={15}/>Imprimir / Salvar em PDF</button>
  </div>
  <header className="border-b-2 border-slate-900 pb-4">
   <div className="flex flex-wrap items-center justify-between gap-4">
    <div><p className="text-xs font-black uppercase tracking-widest">Esquadrifácio · Atlas One</p>
     <h1 className="mt-2 text-2xl font-black">{barraId?'Cotação de uma barra':'Lista de compra de barras comerciais'}</h1>
    </div>
    <p className="text-sm font-bold">WVetro # {numero}</p>
   </div>
   <p className="mt-2 text-sm text-slate-600">Fonte: Barras Utilizadas · documento validado no Atlas. Não é lista de cortes nem confirmação de compra.</p>
   <p className="mt-2 text-xs text-slate-600">Data da emissão: {new Date().toLocaleDateString('pt-BR')} · Itens: {barras.length} · Barras: {q(barras.reduce((s,x)=>s+x.quantidade_barras,0))}</p>
  </header>
  <table className="mt-5 w-full border-collapse text-left text-xs">
   <thead><tr className="bg-slate-100"><th className="border p-2">Imagem</th><th className="border p-2">Código</th><th className="border p-2">Descrição</th><th className="border p-2">Acabamento</th><th className="border p-2">Tipo</th><th className="border p-2">Comprimento</th><th className="border p-2 text-right">Qtd. BR</th></tr></thead>
   <tbody>{barras.map(row=><tr key={row.id} className="break-inside-avoid">
    <td className="border p-2">{row.imagem_url?<img src={row.imagem_url} alt={'Perfil '+row.codigo} className="h-12 w-12 object-contain"/>:<span className="text-[10px] font-semibold text-amber-700"><ImageOff size={12} className="inline"/> Imagem pendente</span>}</td>
    <td className="border p-2 font-bold">{row.codigo}</td>
    <td className="border p-2">{row.descricao}</td>
    <td className="border p-2">{row.tratamento}</td>
    <td className="border p-2">{row.tipo}</td>
    <td className="border p-2">{q(row.tamanho_barra_mm)} mm</td>
    <td className="border p-2 text-right font-bold">{q(row.quantidade_barras)}</td>
   </tr>)}</tbody>
  </table>
  <footer className="mt-5 border-t pt-4 text-xs text-slate-600">
   <p>Solicitar confirmação de preço, prazo, frete, condição de pagamento e disponibilidade antes de efetuar compra.</p>
   <div className="mt-4 grid grid-cols-2 gap-4"><p>Fornecedor: ______________________________</p><p>Prazo: ______________________________</p></div>
  </footer>
  <style jsx global>{`@media print{@page{size:A4 landscape;margin:10mm}body{background:#fff!important}thead{display:table-header-group}tr{break-inside:avoid}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`}</style>
 </main>
}
