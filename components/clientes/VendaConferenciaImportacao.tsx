'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Pencil, RefreshCw } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Registro={
 id:string;tipo:string;wvetro_financeiro_id:string|null;acao:string;
 valor_origem:number;valor_anterior:number;valor_conferido:number;
 justificativa:string;criado_por_nome:string;created_at:string
}
type PagamentoFonte={
 id:string;titulo:string;documento:string|null;vencimento:string|null;baixa:string|null;
 valorTitulo:number;valorOriginal:number;valorConferido:number;saldoOriginal:number;
 estado:string;fonteAlterada:boolean
}
type Conferencia={
 numeroWvetro:string;valorWvetroOriginal:number|null;valorWvetroConferido:number|null;
 estadoWvetro:string;fonteWvetroAlterada:boolean;
 valorAtlas:number;estadoAtlas:string;pagamentos:PagamentoFonte[];
 pagamentosTotal:number;historico:Registro[]
}
type ReciboAtlas={id:string;valor?:number|null;data_recebimento?:string|null;forma?:string|null;status?:string|null}
type TipoEdicao='wvetro_venda'|'atlas_venda'|'wvetro_pagamento'|'atlas_pagamento'
const moeda=(n:number|null|undefined)=>n==null?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const data=(d?:string|null)=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—'
const entrada=(v:number)=>v.toFixed(2).replace('.',',')
function normalizarValor(valor:string){
 const s=valor.trim().replace(/\s/g,'')
 const n=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s
 if(!/^\d+(?:\.\d{1,2})?$/.test(n))return null
 const v=Number(n)
 return Number.isFinite(v)?v:null
}

export default function VendaConferenciaImportacao({
 vendaId,valorWvetroInicial,valorAtlasInicial,podeEditar,
 numeroTitulos,valorTitulos,totalPago,recebimentosAtlas,
 abrirEdicaoVenda,onEdicaoVendaAberta,onVendaAtualizada,
}:{
 vendaId:string;valorWvetroInicial:number|null;valorAtlasInicial:number|null;
 podeEditar:boolean;numeroTitulos:number;valorTitulos:number;totalPago:number;
 recebimentosAtlas:ReciboAtlas[];abrirEdicaoVenda?:boolean;
 onEdicaoVendaAberta?:()=>void;onVendaAtualizada?:()=>void
}){
 const [conferencia,setConferencia]=useState<Conferencia|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [sucesso,setSucesso]=useState('')
 const [edicao,setEdicao]=useState<{tipo:TipoEdicao;id?:string}|null>(null)
 const [valorDigitado,setValorDigitado]=useState('')
 const [motivo,setMotivo]=useState('')
 const [ajustarParcela,setAjustarParcela]=useState(true)

 async function carregar(){
  if(!podeEditar)return
  setCarregando(true)
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/conferencia-importacao?vendaId='+encodeURIComponent(vendaId),{
    headers:{Authorization:'Bearer '+token},cache:'no-store',
   })
   const j=await resposta.json()
   if(!resposta.ok)throw new Error(j.error||'Falha ao consultar pagamentos do W.Vetro.')
   setConferencia(j as Conferencia)
  }catch(e){setErro(e instanceof Error?e.message:'Falha na conferência financeira.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[vendaId,podeEditar])
 useEffect(()=>{
  if(!abrirEdicaoVenda)return
  setEdicao({tipo:'atlas_venda'})
  setValorDigitado(entrada(conferencia?.valorAtlas??valorAtlasInicial??0))
  setMotivo('')
  requestAnimationFrame(()=>document.getElementById('conferencia-valor-venda')?.scrollIntoView({block:'start',behavior:'smooth'}))
  onEdicaoVendaAberta?.()
 },[abrirEdicaoVenda])

 const origem=conferencia?.valorWvetroOriginal??valorWvetroInicial
 const wvetro=conferencia?.valorWvetroConferido??valorWvetroInicial
 const atlas=conferencia?.valorAtlas??valorAtlasInicial
 const pagamentos=conferencia?.pagamentos||[]
 const totalImportado=conferencia?.pagamentosTotal??0

 function editar(tipo:TipoEdicao,valor:number|null,id?:string){
  setEdicao({tipo,id});setValorDigitado(valor==null?'':entrada(valor));setMotivo('')
  setErro('');setSucesso('')
 }
 async function enviarConferencia(tipo:'wvetro_venda'|'atlas_venda'|'wvetro_pagamento',acao:'validado'|'corrigido',atual:number|null,id?:string){
  if(!podeEditar||!conferencia||salvando||atual==null)return
  const novo=acao==='corrigido'?normalizarValor(valorDigitado):null
  if(acao==='corrigido'&&(novo==null||novo<0||(tipo!=='wvetro_pagamento'&&novo<=0))){setErro('Informe um valor monetário válido.');return}
  if(acao==='corrigido'&&motivo.trim().length<8){setErro('Informe uma justificativa de pelo menos 8 caracteres.');return}
  setSalvando(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/conferencia-importacao',{method:'POST',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,tipo,financeiroId:id||null,acao,valorAnterior:atual,valorNovo:novo,justificativa:motivo})
   })
   const j=await resposta.json()
   if(!resposta.ok)throw new Error(j.error||'Falha na conferência.')
   setEdicao(null);setMotivo('')
   await carregar()
   setSucesso(acao==='validado'?'Valor validado com histórico.':'Correção do valor importado registrada. O registro original foi preservado.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar conferência.')}
  finally{setSalvando(false)}
 }
 async function corrigirAtlas(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  const novo=normalizarValor(valorDigitado)
  if(novo==null||novo<=0||atlas==null){setErro('Informe o valor correto da venda Atlas.');return}
  if(motivo.trim().length<8){setErro('Informe uma justificativa de pelo menos 8 caracteres.');return}
  setSalvando(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/cmv/revisao-venda',{method:'POST',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao:'corrigido',valor:novo,valorAnterior:atlas,justificativa:motivo,
     ajustarParcela:ajustarParcela&&numeroTitulos>0})
   })
   const j=await resposta.json()
   if(!resposta.ok)throw new Error(j.error||'Falha ao corrigir a venda Atlas.')
   setEdicao(null);setMotivo('')
   await carregar()
   onVendaAtualizada?.()
   setSucesso('Valor da venda Atlas corrigido. Confira a parcela e o Financeiro.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar valor da venda.')}
  finally{setSalvando(false)}
 }
 async function corrigirPagamentoAtlas(e:FormEvent<HTMLFormElement>,recibo:ReciboAtlas){
  e.preventDefault()
  const novo=normalizarValor(valorDigitado)
  if(novo==null||novo<=0||motivo.trim().length<8){setErro('Informe o valor e uma justificativa (mínimo 8 caracteres).');return}
  setSalvando(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/financeiro/corrigir-recebimento',{method:'POST',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,recebimentoId:recibo.id,valorAnterior:recibo.valor,valorNovo:novo,justificativa:motivo})
   })
   const j=await resposta.json()
   if(!resposta.ok)throw new Error(j.error||'Falha ao corrigir pagamento Atlas.')
   setEdicao(null);setMotivo('')
   await carregar();onVendaAtualizada?.()
   setSucesso('Pagamento Atlas corrigido com auditoria. Confira o saldo financeiro.')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível corrigir este pagamento.')}
  finally{setSalvando(false)}
 }
 function formulario(tipo:TipoEdicao,acao:(e:FormEvent<HTMLFormElement>)=>void){
  if(!edicao||edicao.tipo!==tipo)return null
  return <form onSubmit={acao} className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
   <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
    <label className="text-xs font-semibold">Valor correto (R$)<input inputMode="decimal" required value={valorDigitado}
      onChange={e=>setValorDigitado(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" placeholder="Ex.: 101200,00"/></label>
    <label className="text-xs font-semibold">Justificativa obrigatória<input required minLength={8} maxLength={500} value={motivo}
      onChange={e=>setMotivo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" placeholder="Explique a divergência encontrada"/></label>
   </div>
   {tipo==='atlas_venda'&&numeroTitulos>0&&<label className="flex gap-2 text-xs text-slate-700">
    <input type="checkbox" checked={ajustarParcela} onChange={e=>setAjustarParcela(e.target.checked)}/>
    Atualizar também a parcela em aberto, sem alterar pagamentos existentes
   </label>}
   <div className="flex flex-wrap gap-2">
    <button disabled={salvando} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Salvar correção</button>
    <button type="button" onClick={()=>setEdicao(null)} className="rounded-lg border bg-white px-3 py-2 text-xs">Cancelar</button>
   </div>
  </form>
 }
 function botoes(tipo:'wvetro_venda'|'atlas_venda'|'wvetro_pagamento',atual:number|null,id?:string){
  return <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={!podeEditar||!conferencia||atual==null||salvando} onClick={()=>void enviarConferencia(tipo,'validado',atual,id)}
    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">
    <CheckCircle2 size={14}/>Validar
   </button>
   {tipo!=='atlas_venda'&&<button type="button" disabled={!podeEditar||!conferencia||atual==null||salvando}
     onClick={()=>editar(tipo,atual,id)} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">
     <Pencil size={14}/>Corrigir
   </button>}
   {tipo==='atlas_venda'&&<button type="button" disabled={!podeEditar||!conferencia||salvando}
     onClick={()=>editar('atlas_venda',atual)} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">
     <Pencil size={14}/>Corrigir
   </button>}
  </div>
 }
 return <div className="space-y-4">
  <section id="conferencia-valor-venda" aria-label="Conferência independente de valores W.Vetro e Atlas"
   className="scroll-mt-20 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><h4 className="text-sm font-bold">Conferência dos valores de venda</h4>
      <p className="mt-1 text-xs text-slate-600">Valide ou corrija cada origem independentemente. A informação original do W.Vetro permanece guardada.</p></div>
    {podeEditar&&<button type="button" onClick={()=>void carregar()} disabled={carregando} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><RefreshCw size={13}/>Atualizar conferência</button>}
   </div>
   <div className="mt-3 grid gap-3 md:grid-cols-2">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Valor importado do W.Vetro · #{conferencia?.numeroWvetro||'—'}</p>
     <p className="mt-1 text-xl font-bold">{moeda(wvetro)}</p>
     <p className="mt-1 text-xs text-slate-500">Original recebido: {moeda(origem)}</p>
     <p className="mt-1 text-xs font-semibold text-slate-600">Situação: {conferencia?.estadoWvetro==='validado'?'Validado':conferencia?.estadoWvetro==='corrigido'?'Corrigido manualmente':'Pendente de conferência'}</p>
     {conferencia?.fonteWvetroAlterada&&<p className="mt-2 text-xs font-semibold text-amber-700">A origem W.Vetro mudou desde a conferência. Revisar novamente.</p>}
     {botoes('wvetro_venda',wvetro)}
     {edicao?.tipo==='wvetro_venda'&&formulario('wvetro_venda',e=>{e.preventDefault();void enviarConferencia('wvetro_venda','corrigido',wvetro)})}
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Valor da venda no Atlas</p>
     <p className="mt-1 text-xl font-bold">{moeda(atlas)}</p>
     <p className="mt-1 text-xs text-slate-500">Usado na margem e no controle financeiro da venda.</p>
     <p className="mt-1 text-xs font-semibold text-slate-600">Situação: {conferencia?.estadoAtlas==='validado'?'Validado':'Pendente de conferência'}</p>
     {botoes('atlas_venda',atlas)}
     {formulario('atlas_venda',e=>void corrigirAtlas(e))}
    </div>
   </div>
   <p className="mt-3 text-xs text-slate-700">Diferença entre valor conferido W.Vetro e venda Atlas: <b>{wvetro==null||atlas==null?'A conferir':moeda(wvetro-atlas)}</b>. Validar o W.Vetro não muda o Atlas; corrigir o Atlas não reescreve o histórico bruto do W.Vetro.</p>
   {conferencia?.historico?.length? <details className="mt-3 text-xs">
     <summary className="cursor-pointer font-semibold text-slate-700">Histórico de validações e correções ({conferencia.historico.length})</summary>
     <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
      {conferencia.historico.map(r=><div key={r.id} className="rounded-lg border bg-white p-2">
       {r.tipo==='wvetro_venda'?'Venda W.Vetro':r.tipo==='atlas_venda'?'Venda Atlas':'Pagamento W.Vetro'} · {r.acao} · {moeda(Number(r.valor_anterior))} → {moeda(Number(r.valor_conferido))} · {r.criado_por_nome} · {new Date(r.created_at).toLocaleString('pt-BR')} · {r.justificativa}
      </div>)}
     </div>
    </details>:null}
  </section>
  <section aria-label="Conferência de pagamentos importados do W.Vetro" className="rounded-xl border bg-white p-4">
   <h4 className="text-sm font-bold">Conferência de pagamentos · W.Vetro x Atlas</h4>
   <p className="mt-1 text-xs text-slate-600">Os valores recebidos do W.Vetro são exibidos para validar ou corrigir a importação. Conferir <b>não cria recebimentos nem baixa parcelas</b> no Atlas.</p>
   <div className="mt-3 grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Pagamentos informados no W.Vetro</p><b>{moeda(totalImportado)}</b></div>
    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Pagamentos efetivos no Atlas</p><b>{moeda(totalPago)}</b></div>
    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Saldo de títulos no Atlas</p><b>{moeda(Math.max(0,valorTitulos-totalPago))}</b></div>
   </div>
   {pagamentos.length?pagamentos.map(p=><div key={p.id} className="mt-3 rounded-lg border p-3">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold">{p.titulo} · Vencimento {data(p.vencimento)}</p>
       <p className="mt-1 text-xs text-slate-600">Recebido no W.Vetro: <b>{moeda(p.valorOriginal)}</b> · Valor conferido: <b>{moeda(p.valorConferido)}</b></p>
       <p className="mt-1 text-xs text-slate-500">Valor do título: {moeda(p.valorTitulo)} · Saldo de origem: {moeda(p.saldoOriginal)} · {p.estado==='validado'?'Validado':p.estado==='corrigido'?'Corrigido':'Pendente de conferência'}</p>
       {p.fonteAlterada&&<p className="mt-1 text-xs text-amber-700">Pagamento de origem atualizado. Conferir novamente.</p>}
      </div>
      {botoes('wvetro_pagamento',p.valorConferido,p.id)}
     </div>
     {edicao?.tipo==='wvetro_pagamento'&&edicao.id===p.id&&formulario('wvetro_pagamento',e=>{e.preventDefault();void enviarConferencia('wvetro_pagamento','corrigido',p.valorConferido,p.id)})}
    </div>):<p className="mt-3 text-xs text-slate-500">{carregando?'Consultando registros importados...':'Nenhum pagamento W.Vetro seguramente vinculado a esta venda.'}</p>}
   <div className="mt-4 border-t pt-3">
    <p className="text-xs font-bold text-slate-700">Recebimentos já registrados no Atlas ({recebimentosAtlas.length})</p>
    {recebimentosAtlas.length?recebimentosAtlas.map(r=><div key={r.id} className="mt-2 rounded-lg border p-3">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs">{moeda(r.valor)} · {data(r.data_recebimento)} · {r.forma||'Forma não informada'}</p>
      {podeEditar&&<button type="button" onClick={()=>editar('atlas_pagamento',Number(r.valor||0),r.id)}
        className="inline-flex items-center gap-1 rounded-lg border border-blue-300 p-2 text-xs font-semibold text-blue-700"><Pencil size={13}/>Editar pagamento Atlas</button>}
     </div>
     {edicao?.tipo==='atlas_pagamento'&&edicao.id===r.id&&formulario('atlas_pagamento',e=>void corrigirPagamentoAtlas(e,r))}
    </div>):<p className="mt-2 text-xs text-slate-500">Nenhum pagamento efetivado no Atlas para esta venda.</p>}
   </div>
   <p className="mt-3 text-[11px] text-amber-800">Pagamento W.Vetro corrigido permanece como conferência de importação. Para refletir uma baixa ainda ausente no Atlas, é necessária conciliação financeira sem duplicar pagamentos.</p>
  </section>
  {erro&&<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
  {sucesso&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{sucesso}</p>}
 </div>
}
