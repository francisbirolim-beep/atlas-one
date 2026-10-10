'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, Printer, Upload } from 'lucide-react'
import { adicionarDocumentoCliente } from '@/lib/cliente360'
import { supabase } from '@/lib/supabase'

type Recebimento={
  id:string
  data_recebimento?:string|null
  valor?:number|null
  desconto?:number|null
  forma?:string|null
  referencia?:string|null
  observacoes?:string|null
  status?:string|null
  criado_por_nome?:string|null
  created_at?:string|null
}
type Documento={id:string;titulo:string;nome_arquivo?:string|null;url:string;created_at:string;tipo?:string|null;observacoes?:string|null}
function moeda(v?:number|null){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dataBR(v?:string|null){if(!v)return '—';const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}
function dataHoraBR(v?:string|null){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}

export default function VendaNotasRecibos({
  clienteId,vendaId,obraId,recebimentos,
}:{
  clienteId:string
  vendaId:string
  obraId?:string|null
  recebimentos:Recebimento[]
}){
  const [docs,setDocs]=useState<Documento[]>([])
  const [enviando,setEnviando]=useState(false)
  const [erro,setErro]=useState('')
  const [msg,setMsg]=useState('')
  const inputRef=useRef<HTMLInputElement>(null)

  async function carregarDocs(){
    if(!obraId){setDocs([]);return}
    const r=await supabase.from('cliente_documentos').select('id,titulo,nome_arquivo,url,created_at,tipo,observacoes').eq('cliente_id',clienteId).eq('obra_id',obraId).order('created_at',{ascending:false})
    if(r.error){setErro(r.error.message);return}
    setDocs((r.data||[]) as Documento[])
  }
  useEffect(()=>{void carregarDocs()},[clienteId,obraId])

  async function anexar(file:File|null){
    if(!file||!obraId)return
    setEnviando(true);setErro('');setMsg('')
    const titulo=window.prompt('Título do documento:','Nota fiscal / documento da venda')?.trim()
    if(!titulo){setEnviando(false);return}
    const r=await adicionarDocumentoCliente({
      clienteId,obraId,titulo,arquivo:file,tipo:'nota_fiscal_venda',
      observacoes:`venda_obra_id=${vendaId}`,
    })
    setEnviando(false)
    if(inputRef.current)inputRef.current.value=''
    if(!r.ok){setErro(r.error||'Não foi possível anexar o documento.');return}
    setMsg('Documento anexado à obra/venda.')
    await carregarDocs()
  }

  const docsVenda=docs.filter(d=>d.tipo==='nota_fiscal_venda'||String(d.observacoes||'').includes(`venda_obra_id=${vendaId}`))

  return <div className="space-y-5">
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {msg&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}

    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-slate-900">Recebimentos desta venda</h3><p className="text-xs text-slate-500">Cada baixa mantém data, forma, desconto e histórico de lançamento.</p></div>
      </div>
      <div className="space-y-3">{recebimentos.map(r=>{
        const desconto=Number(r.desconto||0)
        return <div key={r.id} className="rounded-xl border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{moeda(r.valor)} recebido</b>{desconto>0&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{moeda(desconto)} desconto</span>}<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-700">{r.forma||'Forma não informada'}</span></div>
              <p className="mt-1 text-xs text-slate-500">Recebido em {dataBR(r.data_recebimento)}{desconto>0?` · Total baixado ${moeda(Number(r.valor||0)+desconto)}`:''}</p>
              <p className="mt-1 text-xs text-slate-400">Lançado no Atlas em {dataHoraBR(r.created_at)}{r.criado_por_nome?` por ${r.criado_por_nome}`:''}</p>
              {r.referencia&&<p className="mt-2 text-xs text-slate-500">Referência/comprovante: {r.referencia}</p>}
              {r.observacoes&&<p className="mt-1 text-xs text-slate-500">Observações: {r.observacoes}</p>}
            </div>
            <Link target="_blank" href={`/clientes/${clienteId}/vendas/${vendaId}/recibo/${r.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><Printer size={13}/>Gerar / imprimir recibo</Link>
          </div>
        </div>
      })}{!recebimentos.length&&<p className="rounded-xl border border-dashed py-8 text-center text-sm text-slate-400">Nenhum recebimento alocado a esta venda ainda.</p>}</div>
    </section>

    <section className="border-t pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-slate-900">Notas fiscais e documentos da venda</h3><p className="text-xs text-slate-500">Arquivos ficam vinculados à obra e identificados com esta venda.</p></div>
        <div>
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,image/*,.xml" onChange={e=>void anexar(e.target.files?.[0]||null)}/>
          <button disabled={!obraId||enviando} onClick={()=>inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{enviando?<Loader2 size={13} className="animate-spin"/>:<Upload size={13}/>}Anexar nota/documento</button>
        </div>
      </div>
      <div className="space-y-2">{docsVenda.map(d=><a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-brand-navy"><div className="flex min-w-0 items-center gap-3"><FileText size={17} className="shrink-0 text-brand-navy"/><div className="min-w-0"><b className="block truncate text-sm text-slate-800">{d.titulo}</b><p className="truncate text-xs text-slate-500">{d.nome_arquivo||'Arquivo'} · {dataBR(d.created_at)}</p></div></div><span className="text-xs font-bold text-blue-700">Abrir</span></a>)}{!docsVenda.length&&<p className="rounded-xl border border-dashed py-6 text-center text-sm text-slate-400">Nenhuma nota/documento específico desta venda anexado.</p>}</div>
    </section>
  </div>
}