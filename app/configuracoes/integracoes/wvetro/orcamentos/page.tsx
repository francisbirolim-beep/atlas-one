'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

function dataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
async function api(method:'GET'|'POST', body?:any) {
  const token=await tokenAtual()
  if(!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const r=await fetch('/api/integracoes/wvetro/orcamentos/sincronizar',{method,cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(j?.error||`Falha (${r.status}).`)
  return j
}

export default function OrcamentosWVetroPage(){
  const [master,setMaster]=useState<boolean|null>(null)
  const [inicio,setInicio]=useState(()=>dataLocal(new Date(Date.now()-6*86400000)))
  const [fim,setFim]=useState(()=>dataLocal(new Date()))
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [resumo,setResumo]=useState<any>(null)
  const [base,setBase]=useState<any>(null)
  const [orcamentos,setOrcamentos]=useState<any[]>([])

  async function carregar(){
    const j=await api('GET'); setOrcamentos(j.orcamentos||[])
  }
  useEffect(()=>{usuarioAtual().then(async u=>{const m=u?.role==='master';setMaster(m);if(m)try{await carregar()}catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar.')}})},[])

  async function sincronizar(){
    setOcupado(true);setErro('');setBase(null)
    try{
      const j=await api('POST',{inicio,fim});setResumo(j)
      const token=await tokenAtual()
      if(!token) throw new Error('Sessão expirada.')
      const r=await fetch('/api/integracoes/wvetro/sincronizar-tudo',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({inicio,fim})})
      const b=await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(b?.error||`Falha ao sincronizar base técnica (${r.status}).`)
      setBase(b);await carregar()
    } catch(e){setErro(e instanceof Error?e.message:'Falha ao sincronizar.')}
    finally{setOcupado(false)}
  }

  if(master===false)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6">Área restrita ao Master.</div></main>

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
    <div><Link href="/configuracoes/integracoes/wvetro" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Integração W.Vetro</Link><h1 className="mt-2 text-2xl font-bold text-slate-900">Orçamentos W.Vetro → Atlas</h1><p className="mt-1 text-sm text-slate-600">Puxa pela API, evita duplicidade pelo número W.Vetro e transforma o orçamento em um orçamento normal do Atlas.</p></div>
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm text-slate-600">Início<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="text-sm text-slate-600">Fim<input type="date" value={fim} onChange={e=>setFim(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <div className="flex items-end"><button onClick={sincronizar} disabled={ocupado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{ocupado?<Loader2 size={16} className="animate-spin"/>:<RefreshCw size={16}/>} Sincronizar tudo</button></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">A API W.Vetro aceita lotes de até 7 dias. O botão sincroniza orçamentos, linhas, tipologias, perfis, acessórios, composição e custos/preços observados. Repetir o período atualiza sem duplicar.</p>
    </section>

    {resumo&&<section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[
      ['Lidos',resumo.lidos],['Criados',resumo.criados],['Atualizados',resumo.atualizados],['Sem alteração',resumo.semAlteracao],['Itens mapeados',resumo.itensMapeados],['Itens pendentes',resumo.itensPendentes],
    ].map(([l,v])=><div key={String(l)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-2xl font-bold">{v||0}</p></div>)}</section>}

    {base&&<section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div><h2 className="font-bold text-slate-900">Base W.Vetro sincronizada</h2><p className="mt-1 text-xs text-slate-500">Dados copiados do W.Vetro permanecem como evidência até homologação técnica no Atlas.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Linhas',base.linhas?.encontradas],['Perfis catálogo',base.catalogos?.perfis?.quantidadeApi],
          ['Acessórios catálogo',base.catalogos?.acessorios?.quantidadeApi],['Tipologias referência',base.resumo?.tipologiasReferencia],
          ['Componentes por tipologia',base.resumo?.componentesPorTipologia],['Componentes mapeados',base.resumo?.componentesMapeados],
          ['Produtos com custo',base.resumo?.produtosComCustoWvetro],['Perfis importados',base.catalogos?.perfis?.importados],
          ['Acessórios importados',base.catalogos?.acessorios?.importados],['Esquadrias catálogo',base.catalogos?.esquadrias?.encontrados],
        ].map(([l,v])=><div key={String(l)} className="rounded-xl border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{l}</p><p className="mt-1 text-xl font-bold text-slate-900">{Number(v||0)}</p></div>)}
      </div>
      <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><b>Aprendizado Atlas:</b> cada sincronização registra evidência observada. Repetições ajudam a IA a reconhecer padrões; regra técnica oficial continua exigindo homologação.</div>
    </section>}

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Últimos sincronizados</h2><p className="text-xs text-slate-500">Até 50 orçamentos importados da API.</p></div><button onClick={()=>carregar()} className="rounded-lg border p-2"><RefreshCw size={15}/></button></div>
      <div className="mt-4 overflow-x-auto rounded-xl border"><table className="min-w-[850px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-400"><tr><th className="px-3 py-2">W.Vetro</th><th className="px-3 py-2">Atlas</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Itens</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2"></th></tr></thead><tbody>{orcamentos.map(o=><tr key={o.id} className="border-t"><td className="px-3 py-2 font-bold">#{o.numeroWvetro||'—'}</td><td className="px-3 py-2">#{o.numeroAtlas}</td><td className="px-3 py-2">{o.cliente}</td><td className="px-3 py-2">{o.itens}</td><td className="px-3 py-2">{Number(o.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-3 py-2">{o.situacaoWvetro||'—'}</td><td className="px-3 py-2"><Link href={`/orcamento/${o.id}/composicao`} className="inline-flex items-center gap-1 font-semibold text-blue-700">Abrir <ExternalLink size={13}/></Link></td></tr>)}{orcamentos.length===0&&<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum orçamento W.Vetro sincronizado ainda.</td></tr>}</tbody></table></div>
    </section>
  </div></main>
}