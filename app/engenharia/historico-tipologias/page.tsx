'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, History, Loader2, RotateCcw, ShieldCheck, Wrench } from 'lucide-react'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { listarTipologias, type TipologiaTecnica } from '@/lib/tipologias'
import {
  duplicarTipologia,
  listarFormulasHistoricoTipologia,
  listarHistoricoFormula,
  restaurarFormulaTipologia,
  type FormulaHistoricoResumo,
  type HistoricoFormulaTipologia,
} from '@/lib/historicoTipologias'

function dataHora(v: string) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

function eventoLabel(v: HistoricoFormulaTipologia['evento']) {
  if (v === 'restauracao') return 'Restauração'
  if (v === 'substituicao_componente') return 'Troca de componente'
  if (v === 'duplicacao') return 'Duplicação'
  if (v === 'criacao') return 'Criação'
  return 'Alteração'
}

function resumoSnapshot(s: Record<string, any>) {
  const pecas = Array.isArray(s?.pecas) ? s.pecas.length : 0
  const acessorios = Array.isArray(s?.acessorios) ? s.acessorios.length : 0
  const vidro = s?.vidro && Object.keys(s.vidro).length > 0 ? 'com vidro' : 'sem vidro'
  return `${pecas} perfil/componente(s) · ${acessorios} acessório(s) · ${vidro}`
}

export default function HistoricoTipologiasPage() {
  const [linhas,setLinhas]=useState<LinhaTecnica[]>([])
  const [tipologias,setTipologias]=useState<TipologiaTecnica[]>([])
  const [linhaId,setLinhaId]=useState('')
  const [tipologiaId,setTipologiaId]=useState('')
  const [formulas,setFormulas]=useState<FormulaHistoricoResumo[]>([])
  const [formulaId,setFormulaId]=useState('')
  const [historico,setHistorico]=useState<HistoricoFormulaTipologia[]>([])
  const [carregando,setCarregando]=useState(true)
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [novoNome,setNovoNome]=useState('')
  const [motivoDuplicacao,setMotivoDuplicacao]=useState('Criar variação sem alterar a tipologia original')

  useEffect(()=>{void carregarBase()},[])
  useEffect(()=>{if(tipologiaId)void carregarFormulas(tipologiaId);else{setFormulas([]);setFormulaId('');setHistorico([])}},[tipologiaId])
  useEffect(()=>{if(formulaId)void carregarHistorico(formulaId);else setHistorico([])},[formulaId])

  async function carregarBase(){
    setCarregando(true)
    const [ls,ts]=await Promise.all([listarLinhasTecnicas(),listarTipologias(true)])
    setLinhas(ls);setTipologias(ts)
    if(ls[0]){
      setLinhaId(ls[0].id)
      const ids=new Set(ls[0].tipologia_ids||[])
      const primeira=ts.find(t=>ids.has(t.id))
      if(primeira)setTipologiaId(primeira.id)
    }
    setCarregando(false)
  }

  async function carregarFormulas(id:string){
    const fs=await listarFormulasHistoricoTipologia(id)
    setFormulas(fs)
    setFormulaId(prev=>fs.some(f=>f.id===prev)?prev:(fs[0]?.id||''))
  }
  async function carregarHistorico(id:string){setHistorico(await listarHistoricoFormula(id))}

  const linha=linhas.find(l=>l.id===linhaId)||null
  const tipologiasLinha=useMemo(()=>{const ids=new Set(linha?.tipologia_ids||[]);return tipologias.filter(t=>ids.has(t.id))},[linha,tipologias])
  const tipologia=tipologias.find(t=>t.id===tipologiaId)||null
  const formula=formulas.find(f=>f.id===formulaId)||null

  function trocarLinha(id:string){
    setLinhaId(id);setErro('');setMensagem('')
    const l=linhas.find(x=>x.id===id);const ids=new Set(l?.tipologia_ids||[])
    const primeira=tipologias.find(t=>ids.has(t.id));setTipologiaId(primeira?.id||'')
  }

  async function restaurar(v:HistoricoFormulaTipologia){
    if(!formula)return
    if(v.versao===formula.versao){setMensagem('Esta já é a versão atual.');return}
    const motivo=window.prompt(`Restaurar a versão ${v.versao}?\n\nA versão atual NÃO será apagada. O Atlas criará uma nova versão baseada nesta.\n\nInforme o motivo:`, '')||''
    if(motivo.trim().length<3)return
    if(!window.confirm(`Confirmar restauração da versão ${v.versao}? A ação criará uma nova versão e manterá todo o histórico.`))return
    setOcupado(true);setErro('');setMensagem('')
    const r=await restaurarFormulaTipologia(formula.id,v.versao,motivo)
    setOcupado(false)
    if(!r.ok){setErro(r.error);return}
    await carregarFormulas(tipologiaId);await carregarHistorico(formula.id)
    setMensagem(`Versão ${v.versao} restaurada como nova versão ${r.versao}. A versão anterior continua no histórico.`)
  }

  async function duplicar(){
    if(!tipologia)return
    if(novoNome.trim().length<2){setErro('Informe o nome da nova tipologia.');return}
    if(motivoDuplicacao.trim().length<3){setErro('Informe o motivo da duplicação.');return}
    setOcupado(true);setErro('');setMensagem('')
    const r=await duplicarTipologia({tipologiaId:tipologia.id,novoLabel:novoNome.trim(),justificativa:motivoDuplicacao.trim()})
    setOcupado(false)
    if(!r.ok){setErro(r.error);return}
    const ts=await listarTipologias(true);setTipologias(ts);setTipologiaId(r.tipologiaId);setNovoNome('')
    setMensagem('Tipologia duplicada em modo de desenvolvimento. A original não foi alterada.')
  }

  if(carregando)return <div className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin"/></div>

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><History className="text-violet-600"/><div><h1 className="text-2xl font-bold text-slate-900">Histórico de Tipologias</h1><p className="text-sm text-slate-500">Compare versões, restaure com segurança ou duplique uma tipologia para testar uma nova solução.</p></div></div></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><ShieldCheck size={14} className="mr-1 inline"/>Nenhuma restauração apaga versões antigas</div></header>

    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    {mensagem&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>}

    <section className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3"><label className="text-xs font-semibold text-slate-600">Linha<select value={linhaId} onChange={e=>trocarLinha(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}{l.ativo?'':' · inativa'}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Tipologia<select value={tipologiaId} onChange={e=>{setTipologiaId(e.target.value);setErro('');setMensagem('')}} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{tipologiasLinha.map(t=><option key={t.id} value={t.id}>{t.label}{t.ativo?'':' · inativa'}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Configuração técnica<select value={formulaId} onChange={e=>setFormulaId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{formulas.map(f=><option key={f.id} value={f.id}>{f.configuracao_label} · v{f.versao} · {f.status}</option>)}</select></label></section>

    {tipologia&&<section className="grid gap-4 lg:grid-cols-[1fr_380px]"><div className="rounded-2xl border bg-white overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-bold text-slate-900">Linha do tempo · {formula?.configuracao_label||'Configuração'}</h2><p className="text-xs text-slate-500">Cada alteração técnica relevante vira uma versão. A mais recente fica no topo.</p></div><div className="divide-y">{historico.map(h=><div key={h.id} className="px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${h.versao===formula?.versao?'bg-slate-900 text-white':'bg-slate-100 text-slate-700'}`}>v{h.versao}</span><span className="text-sm font-semibold text-slate-800">{eventoLabel(h.evento)}</span>{h.restaurada_de_versao&&<span className="text-xs text-violet-600">baseada na v{h.restaurada_de_versao}</span>}</div><p className="mt-1 text-xs text-slate-500">{dataHora(h.created_at)} · {h.criado_por_nome||'alteração do sistema'}</p><p className="mt-2 text-sm text-slate-700">{resumoSnapshot(h.snapshot)}</p>{h.justificativa&&<p className="mt-1 text-xs text-amber-700">Motivo: {h.justificativa}</p>}</div><button disabled={ocupado||h.versao===formula?.versao} onClick={()=>void restaurar(h)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-30"><RotateCcw size={13}/> Restaurar esta versão</button></div></div>)}{historico.length===0&&<p className="p-5 text-sm text-slate-500">Nenhuma versão registrada.</p>}</div></div>

      <aside className="h-fit rounded-2xl border bg-white p-5"><div className="flex items-center gap-2"><Copy size={18} className="text-violet-600"/><h2 className="font-bold text-slate-900">Duplicar tipologia</h2></div><p className="mt-2 text-sm text-slate-500">Cria uma cópia independente em <b>Em desenvolvimento</b>. A tipologia original e seu histórico permanecem intactos.</p><label className="mt-4 block text-xs font-semibold text-slate-600">Novo nome<input value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder={`${tipologia.label} · Variação`} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/></label><label className="mt-3 block text-xs font-semibold text-slate-600">Motivo<textarea value={motivoDuplicacao} onChange={e=>setMotivoDuplicacao(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/></label><button disabled={ocupado} onClick={()=>void duplicar()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{ocupado?<Loader2 size={15} className="animate-spin"/>:<Copy size={15}/>} Duplicar sem alterar original</button><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><Wrench size={14} className="mr-1 inline"/>Perfis, fórmulas, acessórios, vidro, presets, vínculos de linha e receitas técnicas são copiados. A nova receita nasce para revisão/validação.</div></aside></section>}
  </div></main>
}
