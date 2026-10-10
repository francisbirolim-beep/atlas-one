'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Upload, AlertTriangle, SearchCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Movimento={id:string;status_anterior:string;status_novo:string;motivo:string|null;usuario_nome:string|null;created_at:string}
type Linha={
  material_id:string;codigo:string|null;descricao:string;situacao:string;observacao:string;
  quantidade_solicitada:number;quantidade_proposta:number|null;preco_unitario:number|null;subtotal:number|null
}
type Proposta={
  id:string;arquivo_nome:string;fornecedor_nome:string|null;prazo:string|null;
  moeda:string;valor_total_documento:number|null;
  arquivo_url:string|null;ia_utilizada:boolean;ia_erro:string|null;
  selecionada_em:string|null;created_at:string;
  analise:{
    alertas?:string[]
    linhas:Linha[]
    extras:Array<{codigo:string;descricao:string;quantidade:number|null}>
    resumo:{
      solicitados:number;conformes:number;ausentes:number;
      codigos_divergentes:number;quantidades_divergentes:number;
      sem_preco:number;extras:number;completo:boolean;total_comparavel:number|null
    }
  }
}
const reais=(valor:number|null|undefined)=>valor==null?'Não confirmado':valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const situacoes:Record<string,string>={
  conforme:'Conforme',codigo_divergente:'Código divergente',
  quantidade_divergente:'Quantidade divergente',unidade_divergente:'Unidade divergente',
  ausente:'Faltando',sem_preco:'Sem preço',ambiguo:'Correspondência duvidosa'
}

export default function VendaCotacoesIA({vendaId,loteId}:{vendaId:string;loteId:string}){
  const [propostas,setPropostas]=useState<Proposta[]>([])
  const [movimentos,setMovimentos]=useState<Movimento[]>([])
  const [carregando,setCarregando]=useState(false)
  const [enviando,setEnviando]=useState(false)
  const [escolhendo,setEscolhendo]=useState<string|null>(null)
  const [mensagem,setMensagem]=useState('')
  const [erro,setErro]=useState('')
  const input=useRef<HTMLInputElement>(null)

  const carregar=useCallback(async()=>{
    if(!loteId)return
    setCarregando(true);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Entre novamente no Atlas.')
      const r=await fetch('/api/vendas/cotacoes-lotes/propostas?vendaId='+encodeURIComponent(vendaId)+'&loteId='+encodeURIComponent(loteId),
        {headers:{Authorization:'Bearer '+token},cache:'no-store'})
      const j=await r.json().catch(()=>({}))
      if(!r.ok)throw Error(j.error||'Erro ao consultar propostas.')
      setPropostas(j.propostas||[])
      const h=await fetch('/api/vendas/cotacoes-lotes/mover?vendaId='+encodeURIComponent(vendaId)+'&loteId='+encodeURIComponent(loteId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      if(h.ok){const jh=await h.json();setMovimentos(jh.movimentos||[])}
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar propostas.')}
    finally{setCarregando(false)}
  },[vendaId,loteId])
  useEffect(()=>{setPropostas([]);setMensagem('');void carregar()},[carregar])

  async function enviar(arquivo:File|null){
    if(!arquivo)return
    if(arquivo.size>15*1024*1024||!arquivo.name.toLowerCase().endsWith('.pdf')){
      setErro('Escolha um arquivo PDF de até 15 MB.');return
    }
    setEnviando(true);setMensagem('');setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Entre novamente no Atlas.')
      const form=new FormData()
      form.append('arquivo',arquivo)
      form.append('vendaId',vendaId)
      form.append('loteId',loteId)
      const r=await fetch('/api/vendas/cotacoes-lotes/propostas',{method:'POST',
        headers:{Authorization:'Bearer '+token},body:form})
      const j=await r.json().catch(()=>({}))
      if(!r.ok)throw Error(j.error||'Não foi possível analisar o PDF.')
      setMensagem(j.aviso||'Documento analisado. Confira os resultados.')
      await carregar()
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao analisar documento.')}
    finally{setEnviando(false);if(input.current)input.current.value=''}
  }

  async function escolher(p:Proposta){
    const inc=p.analise?.resumo?.completo
    const mensagem=inc
      ? 'Marcar esta proposta como escolhida? Esta escolha não emite pedido de compra nem registra pagamento.'
      : 'Esta proposta possui itens faltando, divergências ou preços não confirmados. Deseja marcá-la como sua escolha COM PENDÊNCIAS, para revisão manual antes de aprovar a compra?'
    if(!window.confirm(mensagem))return
    setEscolhendo(p.id);setErro('');setMensagem('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada.')
      const r=await fetch('/api/vendas/cotacoes-lotes/propostas',{
        method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId,loteId,propostaId:p.id}),
      })
      const j=await r.json().catch(()=>({}))
      if(!r.ok)throw Error(j.error||'Não foi possível selecionar a proposta.')
      setMensagem(j.aviso||'Proposta escolhida.')
      await carregar()
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar escolha.')}
    finally{setEscolhendo(null)}
  }

  const melhoresPorMaterial=new Map<string,{codigo:string;descricao:string;preco:number;fornecedor:string;quantidade:number}>()
  propostas.forEach(p=>{
    for(const l of (p.analise?.linhas||[])){
      if(l.situacao!=='conforme'||l.preco_unitario==null)continue
      const anterior=melhoresPorMaterial.get(l.material_id)
      if(!anterior || l.preco_unitario<anterior.preco)melhoresPorMaterial.set(l.material_id,{
        codigo:l.codigo||'—',descricao:l.descricao,preco:l.preco_unitario,
        fornecedor:p.fornecedor_nome||p.arquivo_nome,quantidade:l.quantidade_solicitada,
      })
    }
  })
  const completa=propostas.filter(p=>p.analise?.resumo?.completo)
  const minimo=completa.length?Math.min(...completa.map(p=>Number(p.analise.resumo.total_comparavel))):null

  return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><SearchCheck size={18} className="text-blue-700"/>Análise de cotações por IA</h3>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">Anexe os PDFs recebidos dos fornecedores. O Atlas compara códigos, quantidades, preços e prazos com a lista solicitada. Propostas incompletas não entram no ranking de menor preço.</p>
      </div>
      <div>
        <input type="file" ref={input} className="hidden" accept=".pdf,application/pdf"
          onChange={e=>void enviar(e.target.files?.[0]||null)}/>
        <button type="button" onClick={()=>input.current?.click()} disabled={enviando} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {enviando?<Loader2 size={15} className="animate-spin"/>:<Upload size={15}/>}
          {enviando?'Analisando PDF...':'Anexar cotação do fornecedor'}
        </button>
      </div>
    </div>
    {erro&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
    {mensagem&&<p role="status" className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-700">{mensagem}</p>}
    {carregando&&<p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="animate-spin" size={14}/>Conferindo propostas...</p>}
    {!carregando&&!propostas.length&&<p className="mt-3 rounded-xl border border-dashed bg-white p-5 text-center text-xs text-slate-500">Nenhuma proposta de fornecedor analisada para este card de cotação.</p>}
    {propostas.length>0&&<div className="mt-4 grid gap-3 xl:grid-cols-2">
      {propostas.map(p=>{
        const resumo=p.analise?.resumo
        const valido=Boolean(resumo?.completo)
        const maisBarata=valido&&minimo!==null&&Number(resumo?.total_comparavel)===minimo
        const pendentes=p.analise?.linhas?.filter(x=>x.situacao!=='conforme')||[]
        return <article key={p.id} className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{p.fornecedor_nome||'Fornecedor não identificado'}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{p.arquivo_nome}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Prazo: {p.prazo||'Não informado'} · {resumo?.conformes||0}/{resumo?.solicitados||0} itens conferidos</p>
            </div>
            {p.selecionada_em?<span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Escolhida</span>:
              maisBarata?<span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">Menor total comparável</span>:null}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-slate-900">{valido?reais(resumo.total_comparavel):'Preço total não comparável'}</strong>
            <span className={'rounded-full px-2 py-1 text-[10px] font-bold '+(valido?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800')}>
              {valido?'Lista conferida':'Conferência pendente'}
            </span>
          </div>
          {(p.analise?.alertas||[]).map((alerta,i)=><p key={i} className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-800">{alerta}</p>)}
          {!valido&&<div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-[11px] text-amber-900">
            <p><AlertTriangle size={12} className="mr-1 inline"/>Faltam {resumo?.ausentes||0} itens; códigos/ambiguidades: {(resumo?.codigos_divergentes||0)}; quantidades: {resumo?.quantidades_divergentes||0}; sem preço: {resumo?.sem_preco||0}; extras: {resumo?.extras||0}.</p>
            {pendentes.slice(0,12).map((l,i)=><p key={i} className="mt-1">• {l.codigo||'Sem código'} — {situacoes[l.situacao]||l.situacao}: {l.observacao}</p>)}
            {(p.analise?.extras||[]).slice(0,8).map((l,i)=><p key={'e'+i} className="mt-1">• Não solicitado: {l.codigo||l.descricao}</p>)}
          </div>}
          {p.ia_erro&&<p className="mt-2 text-[11px] text-amber-800">IA indisponível nesta leitura: {p.ia_erro}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.arquivo_url&&<a target="_blank" rel="noreferrer" href={p.arquivo_url} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold text-slate-700"><FileText size={13}/>Abrir PDF</a>}
            <button type="button" onClick={()=>void escolher(p)} disabled={escolhendo!==null||Boolean(p.selecionada_em)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-blue-700 disabled:opacity-50">
              <CheckCircle2 size={13}/>{p.selecionada_em?'Proposta escolhida':'Escolher proposta'}
            </button>
          </div>
        </article>
      })}
    </div>}
    {melhoresPorMaterial.size>0&&<details className="mt-4 rounded-xl border border-blue-200 bg-white p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-800">Menor preço unitário por material ({melhoresPorMaterial.size})</summary>
      <p className="mt-2 text-[11px] text-slate-500">Apenas linhas com código, quantidade e preço conferidos. Compare também prazo, frete e impostos antes de dividir pedidos entre fornecedores.</p>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="bg-blue-50"><th className="p-2">Código / material</th><th className="p-2">Fornecedor</th><th className="p-2 text-right">Preço unitário</th></tr></thead>
          <tbody>{Array.from(melhoresPorMaterial.entries()).map(([id,v])=><tr key={id} className="border-t">
            <td className="p-2"><b>{v.codigo}</b><span className="ml-1 text-slate-500">{v.descricao}</span></td>
            <td className="p-2">{v.fornecedor}</td><td className="p-2 text-right font-bold">{reais(v.preco)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>}
    <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-700">Histórico de movimentações do card ({movimentos.length})</summary>
      <div className="mt-2 space-y-2">
        {movimentos.map(m=><div key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <b>{m.status_anterior} → {m.status_novo}</b>
          <span className="ml-2 text-slate-500">{new Date(m.created_at).toLocaleString('pt-BR')} · {m.usuario_nome||'Usuário'}</span>
          {m.motivo&&<p className="mt-1 text-slate-600">Motivo: {m.motivo}</p>}
        </div>)}
        {!movimentos.length&&<p className="text-slate-400">Nenhuma movimentação manual registrada.</p>}
      </div>
    </details>
    {propostas.length>0&&<p className="mt-3 text-[11px] text-slate-500">Valores calculados apenas quando a proposta está completa e corresponde à lista técnica. Verifique frete, impostos, condições comerciais e validade antes de aprovar qualquer pedido. A escolha é registrada, mas não gera compra nem movimenta estoque.</p>}
  </section>
}
