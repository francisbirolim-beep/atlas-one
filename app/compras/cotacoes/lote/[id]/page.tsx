'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Item = {
  codigo:string|null;descricao:string;cor:string|null;unidade:string;
  quantidade_tecnica:number;sobra_utilizada:number;quantidade_cotar:number;
  comprimento_corte_mm:number|null;comprimento_barra_mm:number|null
}
type Lote = {
  id:string;categoria:string;versao:number;quantidade_itens:number;created_at:string;
  gerado_por_nome:string|null;itens:Item[]
}
const nomes:Record<string,string>={perfil:'Perfis',acessorios:'Acessórios',vidro:'Vidros',outros:'Outros'}
const n=(v:number)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const dataBR=(iso:string)=>iso?new Date(iso).toLocaleString('pt-BR'):'—'

export default function ListaCotacaoPage({params}:{params:{id:string}}){
  const [lote,setLote]=useState<Lote|null>(null)
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [vendaId,setVendaId]=useState('')
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('vendaId')||''
    setVendaId(id)
    let ativo=true
    void (async()=>{
      try{
        const token=await tokenAtual()
        if(!token)throw new Error('Faça login para abrir esta cotação.')
        const r=await fetch('/api/vendas/cotacoes-lotes?vendaId='+encodeURIComponent(id)+'&loteId='+encodeURIComponent(params.id),
          {headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const json=await r.json().catch(()=>({}))
        if(!r.ok)throw new Error(json?.error||'Não foi possível consultar esta cotação.')
        if(!json.lotes?.length)throw new Error('Cotação não encontrada nesta venda.')
        if(ativo)setLote(json.lotes[0] as Lote)
      }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Falha ao abrir cotação.')}
      finally{if(ativo)setCarregando(false)}
    })()
    return ()=>{ativo=false}
  },[params.id])

  if(carregando)return <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin"/>Carregando cotação...</div>
  if(erro||!lote)return <main className="mx-auto max-w-3xl p-8 text-red-700">{erro||'Cotação indisponível.'}</main>

  return <main className="mx-auto min-h-screen max-w-5xl bg-white p-6 text-slate-900 print:max-w-none print:p-0">
    <div className="mb-6 flex flex-wrap justify-between gap-3 print:hidden">
      <a href={`/clientes?origem=cotacao`} onClick={e=>{if(vendaId){e.preventDefault();window.history.back()}}}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><ArrowLeft size={15}/>Voltar</a>
      <button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><FileDown size={16}/>Imprimir / Salvar em PDF</button>
    </div>
    <header className="mb-5 border-b-2 border-slate-900 pb-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Esquadrifácio · Atlas One</p>
      <h1 className="mt-2 text-2xl font-black">Solicitação de cotação — {nomes[lote.categoria]||lote.categoria}</h1>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>Lista #{lote.id.slice(0,8).toUpperCase()}</span>
        <span>Versão {lote.versao}</span>
        <span>Gerada em {dataBR(lote.created_at)}</span>
        <span>{lote.quantidade_itens} itens</span>
      </div>
    </header>
    <p className="mb-4 text-xs text-slate-600">Solicitamos cotação conforme quantidades abaixo. Informar marca, valor unitário, prazo de entrega, frete, condição de pagamento e validade da proposta. Este documento não é pedido de compra nem comprova recebimento.</p>
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead><tr className="bg-slate-100 text-slate-700">
        <th className="w-10 border px-2 py-2">#</th>
        <th className="w-[13%] border px-2 py-2">Código</th>
        <th className="border px-2 py-2">Material / Especificação</th>
        <th className="w-[13%] border px-2 py-2">Cor / Corte</th>
        <th className="w-[12%] border px-2 py-2 text-right">Quantidade</th>
        <th className="w-[9%] border px-2 py-2">Unidade</th>
      </tr></thead>
      <tbody>{lote.itens.map((item,i)=><tr key={i} className="break-inside-avoid">
        <td className="border px-2 py-2">{i+1}</td>
        <td className="break-words border px-2 py-2 font-semibold">{item.codigo||'—'}</td>
        <td className="break-words border px-2 py-2">{item.descricao}</td>
        <td className="break-words border px-2 py-2">{item.cor||'—'}{item.comprimento_corte_mm?<div>{n(item.comprimento_corte_mm)} mm</div>:item.comprimento_barra_mm?<div>Barra {n(item.comprimento_barra_mm)} mm</div>:null}</td>
        <td className="border px-2 py-2 text-right font-bold">{n(item.quantidade_cotar)}</td>
        <td className="border px-2 py-2">{item.unidade}</td>
      </tr>)}</tbody>
    </table>
    <footer className="mt-5 border-t pt-3 text-[11px] text-slate-600">
      Quantidades para cotação descontam as sobras de estoque já separadas no Atlas. Sem preço de venda, margem ou informações financeiras do cliente.
      <div className="mt-3 flex gap-8"><span>Fornecedor: __________________________</span><span>Validade / prazo: _________________________</span></div>
    </footer>
    <style jsx global>{`@media print {
      @page { size: A4 portrait; margin: 12mm }
      body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
      table { font-size: 9pt }
      th, td { vertical-align: top }
      thead { display: table-header-group }
      tr { break-inside: avoid }
    }`}</style>
  </main>
}
