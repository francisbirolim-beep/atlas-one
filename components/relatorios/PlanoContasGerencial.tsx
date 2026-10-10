'use client'
import { useEffect,useMemo,useState } from 'react'
import { ChevronDown,ChevronRight,RefreshCw,ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { TITULOS_GRUPOS, GrupoConta } from '@/lib/financeiroPlanoContas'

type Conta = {id:string;codigo:string;nome:string;grupo:GrupoConta;ativo:boolean}
type Titulo = {id:string;descricao:string|null;fornecedor_nome:string|null;documento:string|null;valor:number|null;valor_pago:number|null;status:string|null;vencimento:string|null;data_pagamento:string|null}
type Classificacao = {conta_pagar_id:string;plano_conta_id:string;classificado_em:string;classificado_por_nome:string}
const moeda=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const grupoOrdem:GrupoConta[]=['receita','cmv','tributo','despesa_operacional','despesa_financeira','estoque','investimento','transferencia']

export default function PlanoContasGerencial({inicio,fim,onClassificado}:{inicio:string;fim:string;onClassificado?:()=>void}){
 const [contas,setContas]=useState<Conta[]>([])
 const [titulos,setTitulos]=useState<Titulo[]>([])
 const [classificacoes,setClassificacoes]=useState<Classificacao[]>([])
 const [draft,setDraft]=useState<Record<string,string>>({})
 const [carregando,setCarregando]=useState(false)
 const [salvando,setSalvando]=useState<string|null>(null)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const [mostrarContas,setMostrarContas]=useState(false)
 const [somentePendentes,setSomentePendentes]=useState(false)
 const [periodoAtivo,setPeriodoAtivo]=useState('')
 const atual=inicio+'|'+fim
 const indice=useMemo(()=>new Map(classificacoes.map(c=>[c.conta_pagar_id,c.plano_conta_id])),[classificacoes])
 const classificadas=titulos.filter(t=>indice.has(t.id)).length
 const linhas=somentePendentes?titulos.filter(t=>!indice.has(t.id)):titulos
 async function carregar(){
  if(inicio>fim){setErro('Selecione um período válido.');return}
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/relatorios/plano-contas?inicio='+encodeURIComponent(inicio)+'&fim='+encodeURIComponent(fim),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Falha ao carregar plano de contas.')
   setContas(json.contas||[]);setTitulos(json.titulos||[]);setClassificacoes(json.classificacoes||[])
   setDraft({});setPeriodoAtivo(atual)
  }catch(e){setErro(e instanceof Error?e.message:'Falha na consulta.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 async function salvar(titulo:Titulo){
  const valor=draft[titulo.id]??indice.get(titulo.id)??''
  setSalvando(titulo.id);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/relatorios/plano-contas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({contaPagarId:titulo.id,planoContaId:valor||null})})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Não foi possível gravar.')
   setClassificacoes(prev=>[...prev.filter(c=>c.conta_pagar_id!==titulo.id),...(valor?[{conta_pagar_id:titulo.id,plano_conta_id:valor,classificado_em:new Date().toISOString(),classificado_por_nome:''}]:[])])
   setDraft(prev=>{const copy={...prev};delete copy[titulo.id];return copy})
   setMensagem('Classificação salva. O relatório financeiro será atualizado.')
   onClassificado?.()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao classificar título.')}
  finally{setSalvando(null)}
 }
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="font-bold text-slate-900">Plano de contas e classificação financeira</h3><p className="mt-1 text-xs text-slate-500">Organize os títulos por natureza para formar a base da DRE. Não altera valores nem pagamentos.</p></div>
   <button type="button" onClick={()=>void carregar()} disabled={carregando||salvando!==null} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw size={14}/>{carregando?'Carregando...':'Atualizar títulos'}</button>
  </div>
  <div className="flex flex-wrap items-center gap-3 text-xs">
   <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Títulos classificados: {classificadas} / {titulos.length}</span>
   <label className="flex items-center gap-2"><input type="checkbox" checked={somentePendentes} onChange={e=>setSomentePendentes(e.target.checked)}/> Mostrar só pendentes</label>
   <button type="button" onClick={()=>setMostrarContas(x=>!x)} className="flex items-center gap-1 font-bold text-blue-700">{mostrarContas?<ChevronDown size={15}/>:<ChevronRight size={15}/>} Ver plano de contas ({contas.length})</button>
   <span className="flex items-center gap-1 text-slate-500"><ShieldCheck size={14}/> Uso gerencial · Master</span>
  </div>
  {periodoAtivo!==atual&&<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">O período foi alterado. Clique em “Atualizar títulos” para consultar as novas datas.</p>}
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
  {mensagem&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{mensagem}</p>}
  {mostrarContas&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{grupoOrdem.map(g=><div key={g} className="rounded-lg border p-3"><h4 className="mb-2 text-xs font-bold text-slate-700">{TITULOS_GRUPOS[g]}</h4>{contas.filter(x=>x.grupo===g).map(x=><p key={x.id} className="py-0.5 text-xs text-slate-600">{x.codigo} · {x.nome}</p>)}</div>)}</div>}
  <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[780px] text-xs"><thead className="bg-slate-50 text-left uppercase text-slate-500"><tr><th className="p-3">Título / fornecedor</th><th className="p-3">Vencimento</th><th className="p-3 text-right">Valor / pago</th><th className="p-3">Classificar como</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{linhas.map(t=>{
   const original=indice.get(t.id)||''
   const valor=draft[t.id]??original
   return <tr key={t.id} className="border-t"><td className="p-3"><b className="text-slate-800">{t.descricao||t.documento||'Conta a pagar'}</b><p className="mt-1 text-slate-500">{t.fornecedor_nome||'Fornecedor não informado'} · {t.status||'sem status'}</p></td><td className="p-3">{t.vencimento||'—'}</td><td className="p-3 text-right tabular-nums"><b>{moeda(Number(t.valor||0))}</b><p className="text-slate-500">Pago {moeda(Number(t.valor_pago||0))}</p></td><td className="p-3"><select value={valor} onChange={e=>setDraft(prev=>({...prev,[t.id]:e.target.value}))} className="w-full max-w-[280px] rounded-lg border bg-white p-2"><option value="">Não classificado</option>{grupoOrdem.map(g=><optgroup key={g} label={TITULOS_GRUPOS[g]}>{contas.filter(c=>c.grupo===g&&c.ativo).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</optgroup>)}</select></td><td className="p-3 text-right"><button type="button" disabled={salvando!==null||valor===original} onClick={()=>void salvar(t)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:cursor-default disabled:opacity-40">{salvando===t.id?'Salvando...':'Salvar'}</button></td></tr>
  })}{!linhas.length&&<tr><td colSpan={5} className="p-5 text-center text-slate-500">{carregando?'Carregando títulos...':'Nenhum título encontrado neste período.'}</td></tr>}</tbody></table></div>
  <p className="text-xs text-slate-500">Compras de estoque, máquinas, transferências e adiantamentos não entram como despesa operacional da DRE. Uma conta pode ser desclassificada selecionando “Não classificado” e salvando. O resultado líquido depende da conciliação contábil por competência.</p>
 </section>
}
