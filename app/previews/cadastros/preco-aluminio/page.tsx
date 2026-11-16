'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, CheckCircle2, CircleDollarSign, Info, Pencil, RotateCcw, Save, Search, ShieldCheck, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { type CorAluminio, type DadosPrecosAluminio, type SimulacaoPrecoAluminio, guardarSimulacaoPreco, lerSimulacaoPreco, beneficiamentoCorEfetivo, precoCorEfetivo, precoNaturalEfetivo } from '@/lib/previews/precificacaoAluminio'

const moeda=(n:number|null)=>n==null?'Preço pendente':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const decimal=(v:string)=>{
  const normal=String(v).trim().replace(/\s/g,'').replace(/^R\$/i,'')
  if(!normal)return null
  const n=Number(normal.includes(',')?normal.replace(/\./g,'').replace(',','.'):normal)
  return Number.isFinite(n)&&n>=0?n:null
}
const campo='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500'

export default function PrecoAluminioPreview(){
  const [dados,setDados]=useState<DadosPrecosAluminio|null>(null)
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [masterId,setMasterId]=useState('')
  const [ajustes,setAjustes]=useState<SimulacaoPrecoAluminio>({})
  const [naturalTexto,setNaturalTexto]=useState('')
  const [busca,setBusca]=useState('')
  const [situacao,setSituacao]=useState<'todos'|'com'|'sem'>('todos')
  const [editarId,setEditarId]=useState<string|null>(null)
  const [beneficiamentoTexto,setBeneficiamentoTexto]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [erroEdicao,setErroEdicao]=useState('')
  useEffect(()=>{
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const usuario=await usuarioAtual()
        if(!usuario||usuario.role!=='master')throw Error('Esta prévia de precificação é restrita ao Master.')
        const token=await tokenAtual()
        if(!token)throw Error('Sessão não encontrada.')
        const resp=await fetch('/api/previews/preco-aluminio',{signal:ctrl.signal,cache:'no-store',headers:{Authorization:'Bearer '+token}})
        const json=await resp.json()
        if(!resp.ok)throw Error(json.error||'Não foi possível carregar os preços.')
        if(ctrl.signal.aborted)return
        const real:DadosPrecosAluminio={natural:json.natural??null,cores:json.cores||[]}
        const sim=lerSimulacaoPreco(usuario.id,real.natural)
        setMasterId(usuario.id)
        setDados(real);setAjustes(sim)
        const natural=precoNaturalEfetivo(real,sim)
        setNaturalTexto(natural!=null?String(natural).replace('.',','):'')
      }catch(e){if(!ctrl.signal.aborted)setErro(e instanceof Error?e.message:'Erro ao carregar a tabela.')}
      finally{if(!ctrl.signal.aborted)setCarregando(false)}
    })()
    return()=>ctrl.abort()
  },[])
  const naturalEditado=decimal(naturalTexto)
  const ajustesPreview:SimulacaoPrecoAluminio={...ajustes,natural:naturalEditado}
  const naturalReal=dados?.natural??null
  const cores=useMemo(()=>dados?.cores||[],[dados])
  const filtradas=cores.filter(c=>{
    if(busca&& !c.nome.toLowerCase().includes(busca.trim().toLowerCase()))return false
    const preco=dados?precoCorEfetivo(c,dados,ajustesPreview):null
    return situacao==='todos'||situacao==='com'&&preco!=null||situacao==='sem'&&preco==null
  })
  const semPreco=cores.filter(c=>dados&&precoCorEfetivo(c,dados,ajustesPreview)==null).length
  function editar(c:CorAluminio){
    if(!dados)return
    const valor=beneficiamentoCorEfetivo(c,ajustesPreview)
    setEditarId(c.id);setBeneficiamentoTexto(valor==null?'':String(valor).replace('.',','));setErroEdicao('');setMensagem('')
  }
  function aplicarCor(c:CorAluminio){
    const valor=decimal(beneficiamentoTexto)
    if(valor===null){setErroEdicao('Informe um valor válido de beneficiamento, igual ou maior que zero.');return}
    if(naturalEditado===null||naturalEditado<=0){setErroEdicao('Defina primeiro um preço válido para o alumínio Natural.');return}
    setAjustes(a=>({...a,beneficiamentoPorCor:{...(a.beneficiamentoPorCor||{}),[c.id]:valor}}))
    setEditarId(null);setBeneficiamentoTexto('');setErroEdicao('')
    setMensagem('Beneficiamento ajustado nesta prévia. Total por quilo = Natural + beneficiamento. Use Salvar simulação para guardar neste navegador.')
  }
  function desfazerCor(id:string){
    setAjustes(a=>{
      const mapa={...(a.beneficiamentoPorCor||{})};delete mapa[id]
      return {...a,beneficiamentoPorCor:mapa}
    })
    setMensagem('Beneficiamento desta cor restaurado para o valor cadastrado. O total por kg é recalculado automaticamente.')
  }
  function salvar(){
    if(!dados||!masterId)return
    if(naturalEditado===null||naturalEditado<=0){setErroEdicao('O alumínio natural precisa de um preço maior que zero para simular a precificação.');return}
    const atualizado:SimulacaoPrecoAluminio={...ajustes,natural:naturalEditado}
    if(!guardarSimulacaoPreco(masterId,atualizado)){setErroEdicao('Não foi possível salvar localmente neste navegador.');return}
    setAjustes(atualizado)
    setErroEdicao('')
    setMensagem('Simulação salva apenas neste navegador. Nenhum preço do Atlas One oficial foi alterado.')
  }
  function restaurar(){
    if(!dados)return
    const atual:SimulacaoPrecoAluminio={natural:dados.natural,beneficiamentoPorCor:{}}
    setAjustes(atual)
    setNaturalTexto(dados.natural!=null?String(dados.natural).replace('.',','):'')
    setEditarId(null)
    setMensagem('Valores originais recolocados na tela. Salve a simulação para aplicá-los neste navegador.')
  }
  if(carregando)return <main className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Carregando cores e preços do Atlas One...</main>
  if(erro||!dados)return <main className="mx-auto max-w-3xl p-8"><p role="alert" className="rounded-xl bg-red-50 p-5 text-sm font-bold text-red-700">{erro||'Preços indisponíveis.'}</p><Link href="/cadastros" className="mt-4 inline-block text-sm text-blue-700">Voltar aos cadastros</Link></main>
  return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-14 pt-6 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><Link href="/cadastros" aria-label="Voltar para cadastros" className="rounded-xl border bg-white p-2.5"><ArrowLeft size={18}/></Link>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Cadastros · Precificação · Prévia Master</p>
            <h1 className="text-2xl font-black">Preço do Alumínio</h1>
            <p className="text-sm text-slate-500">Confira o valor do Natural, o beneficiamento de cada cor e o total final por quilo.</p></div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800"><ShieldCheck size={15}/> Master · Simulação isolada</span>
      </header>
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(210px,1fr)]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black"><CircleDollarSign size={19} className="text-indigo-700"/> Preço do alumínio Natural (R$/kg)</h2>
          <p className="mt-2 text-xs text-slate-600">Preço real do cadastro: <b>{moeda(naturalReal)}</b>. A simulação abaixo altera apenas a base de cálculo desta prévia.</p>
          <label className="mt-3 block max-w-xs text-xs font-bold">Valor Natural para simulação<input inputMode="decimal" className={campo+' mt-1'} value={naturalTexto} onChange={e=>{setNaturalTexto(e.target.value);setMensagem('')}} placeholder="Informe preço por kg"/></label>
          <p className="mt-3 text-xs text-slate-600">Preço final por kg = <b>alumínio Natural + beneficiamento da cor</b>. Ao editar o beneficiamento, o valor final muda automaticamente.</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black"><Calculator size={17} className="text-indigo-700"/> Situação dos cadastros</h2>
          <p className="mt-3 text-2xl font-black">{cores.length} <span className="text-xs font-semibold text-slate-500">cores ativas</span></p>
          <p className="mt-2 text-sm"><b>{semPreco}</b> cor(es) sem preço válido nesta simulação</p>
          <p className="mt-2 text-[11px] text-slate-500">Nenhuma cor, peso, fórmula ou cadastro oficial será modificado.</p>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black">Tabela por cor</h2>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={restaurar} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><RotateCcw size={15}/> Restaurar valores originais</button>
            <button type="button" onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white"><Save size={15}/> Salvar simulação</button></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="relative min-w-[210px] flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cor..." className={campo+' pl-9'}/></label>
          <select className={campo+' max-w-[210px]'} value={situacao} onChange={e=>setSituacao(e.target.value as 'todos'|'com'|'sem')} aria-label="Filtrar preços"><option value="todos">Todas as cores</option><option value="com">Com preço</option><option value="sem">Sem preço</option></select>
        </div>
        {erroEdicao&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{erroEdicao}</p>}
        {mensagem&&<p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs font-semibold text-blue-800"><CheckCircle2 size={15}/>{mensagem}</p>}
        <div className="mt-3 space-y-2">
          {filtradas.map(c=>{
            const natural=precoNaturalEfetivo(dados,ajustesPreview)
            const beneficiamento=beneficiamentoCorEfetivo(c,ajustesPreview)
            const efetivo=precoCorEfetivo(c,dados,ajustesPreview)
            const manual=Object.prototype.hasOwnProperty.call(ajustes.beneficiamentoPorCor||{},c.id)
            const valorEditado=decimal(beneficiamentoTexto)
            const totalEditado=natural!=null&&valorEditado!=null
              ?Math.round((natural+valorEditado+Number.EPSILON)*100)/100
              :null
            return <article key={c.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] flex-1">
                  <b className="text-sm">{c.nome}</b>
                  <p className="mt-1 text-[11px] text-slate-500">Beneficiamento cadastrado: {c.adicionalKg==null?'Não informado':moeda(c.adicionalKg)+'/kg'} · {c.pintura?'Com acabamento':'Sem pintura'}</p>
                </div>
                <div className="min-w-[115px] text-right">
                  <span className="block text-[10px] font-semibold text-slate-500">Alumínio Natural</span>
                  <b className="text-xs">{natural==null?'Pendente':moeda(natural)+'/kg'}</b>
                </div>
                <span className="text-lg font-bold text-slate-400" aria-hidden="true">+</span>
                <div className="min-w-[115px] text-right">
                  <span className="block text-[10px] font-semibold text-slate-500">Beneficiamento</span>
                  <b className="text-xs">{beneficiamento==null?'Pendente':moeda(beneficiamento)+'/kg'}</b>
                  {manual&&<span className="block text-[10px] font-bold text-indigo-700">Valor ajustado na prévia</span>}
                </div>
                <span className="text-lg font-bold text-slate-400" aria-hidden="true">=</span>
                <div className="min-w-[125px] text-right">
                  <span className="block text-[10px] font-semibold text-slate-500">Valor final por kg</span>
                  <b className={efetivo==null?'text-xs text-amber-700':'text-sm text-indigo-700'}>{moeda(efetivo)}{efetivo==null?'':'/kg'}</b>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>editar(c)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={13}/> Editar beneficiamento</button>
                  {manual&&<button type="button" onClick={()=>desfazerCor(c.id)} className="rounded-lg border px-2 py-2 text-xs">Desfazer</button>}
                </div>
              </div>
              {editarId===c.id&&<div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-[minmax(125px,1fr)_minmax(155px,1fr)_minmax(150px,1fr)]">
                <label className="min-w-0 text-xs font-bold">Alumínio Natural (R$/kg)
                  <input className={campo+' mt-1 bg-slate-100'} value={natural==null?'Pendente':moeda(natural)} readOnly aria-label="Preço do alumínio Natural em uso"/>
                </label>
                <label className="min-w-0 text-xs font-bold">Beneficiamento (R$/kg) · Editável
                  <input className={campo+' mt-1'} value={beneficiamentoTexto} onChange={e=>{setBeneficiamentoTexto(e.target.value);setErroEdicao('')}} inputMode="decimal" placeholder="Ex.: 3,00" autoFocus/>
                </label>
                <label className="min-w-0 text-xs font-bold">Valor final por kg = soma
                  <input className={campo+' mt-1 bg-indigo-50 font-bold text-indigo-900'} value={totalEditado==null?'Pendente':moeda(totalEditado)} readOnly aria-live="polite" aria-label="Valor total calculado para a cor"/>
                </label>
                <p className="text-[11px] text-slate-600 md:col-span-3">Ao informar o beneficiamento, somamos ao preço do Natural. Exemplo: R$ 36,00 + R$ 4,00 = R$ 40,00/kg.</p>
                <div className="flex flex-wrap gap-2 md:col-span-3">
                  <button type="button" onClick={()=>aplicarCor(c)} className="rounded-xl bg-indigo-700 px-3 py-2.5 text-xs font-bold text-white">Aplicar beneficiamento na prévia</button>
                  <button type="button" onClick={()=>setEditarId(null)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-bold"><X size={14}/> Cancelar</button>
                </div>
              </div>}
            </article>
          })}
        </div>
        {!filtradas.length&&<p className="mt-4 rounded-lg bg-slate-50 p-5 text-xs text-slate-500">Nenhuma cor corresponde aos filtros.</p>}
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-[11px] text-amber-900"><Info size={17} className="shrink-0"/> Somente prévia: valores modificados são guardados no navegador do Master. Para virarem preços oficiais, será necessária uma etapa posterior de gravação autorizada e validação. Nenhuma alteração financeira está sendo realizada no banco.</p>
      </section>
    </div>
  </main>
}
