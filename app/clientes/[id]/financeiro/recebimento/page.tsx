'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Printer, Receipt, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { saldoParcela } from '@/lib/cliente360Recebimentos'
import type { ContaReceberCliente360 } from '@/lib/cliente360'

type ClienteResumo = { id:string; nome:string }
type ObraResumo = { id:string;nome:string;numero?:number|null }
type LinhaRecibo = { obra:string;valorOriginal:number;valorRecebido:number;saldoDevedor:number }
type SimulacaoRecibo = {
  clienteNome:string;data:string;forma:string;referencia:string;valor:number;parcelas:number;linhas:LinhaRecibo[]
}
function moeda(valor:number){return Number(valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dataBR(valor?:string|null){if(!valor)return '—';const d=new Date(valor.length===10?`${valor}T12:00:00`:valor);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}
function numero(valor:string){const texto=valor.trim().replace(/\s/g,'');if(!texto)return NaN;const normalizado=texto.includes(',')?texto.replace(/\./g,'').replace(',','.'):texto;return Number(normalizado)}
function centavos(valor:number){return Math.round(valor*100)}

export default function RecebimentoPorParcelasPage() {
  const params=useParams()
  const clienteId=params?.id as string
  const [cliente,setCliente]=useState<ClienteResumo|null>(null)
  const [contas,setContas]=useState<ContaReceberCliente360[]>([])
  const [obras,setObras]=useState<ObraResumo[]>([])
  const [selecionadas,setSelecionadas]=useState<Record<string,string>>({})
  const [forma,setForma]=useState('pix')
  const [data,setData]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})
  const [referencia,setReferencia]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [carregando,setCarregando]=useState(true)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')
  const [sucesso,setSucesso]=useState('')
  const [emPrevia,setEmPrevia]=useState(false)
  const [reciboSimulado,setReciboSimulado]=useState<SimulacaoRecibo|null>(null)
  const [recebimentoId,setRecebimentoId]=useState<string|null>(null)

  async function requisicao(url:string, init?:RequestInit){
    const {data:sessao,error:authError}=await supabase.auth.getSession()
    if(authError||!sessao.session?.access_token)throw new Error('Sua sessão expirou. Entre novamente no Atlas.')
    const resposta=await fetch(url,{...init,headers:{...(init?.headers||{}),Authorization:`Bearer ${sessao.session.access_token}`},cache:'no-store'})
    const corpo=await resposta.json()
    if(!resposta.ok)throw new Error(corpo.error||'Falha ao consultar o Financeiro.')
    return corpo
  }

  async function carregar(){
    if(!clienteId)return
    setCarregando(true);setErro('')
    try{
      const dados=await requisicao(`/api/financeiro/recebimento-cliente?clienteId=${encodeURIComponent(clienteId)}`)
      setCliente(dados.cliente as ClienteResumo)
      setContas((dados.contas||[]) as ContaReceberCliente360[])
      setObras((dados.obras||[]) as ObraResumo[])
      setEmPrevia(Boolean(dados.simulacao))
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar parcelas do cliente.');setCliente(null);setContas([])}
    finally{setCarregando(false)}
  }
  useEffect(()=>{void carregar()},[clienteId])

  const obraPorId=useMemo(()=>Object.fromEntries(obras.map(o=>[o.id,o.nome])),[obras])
  const abertas=useMemo(()=>contas.filter(c=>c.status!=='cancelado'&&saldoParcela(c)>0.009),[contas])
  const hoje=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})()
  const vencidas=abertas.filter(c=>c.vencimento&&c.vencimento<hoje)
  const alocacoes=Object.entries(selecionadas).map(([conta_receber_id,valorTexto])=>({conta_receber_id,valor:numero(valorTexto)}))
  const total=alocacoes.reduce((s,a)=>s+(Number.isFinite(a.valor)?a.valor:0),0)
  const validadas=alocacoes.length>0&&alocacoes.every(item=>{
    const c=abertas.find(x=>x.id===item.conta_receber_id)
    return c&&Number.isFinite(item.valor)&&centavos(item.valor)>0&&centavos(item.valor)<=centavos(saldoParcela(c))
  })
  const saldoTotal=contas.filter(c=>c.status!=='cancelado').reduce((a,c)=>a+saldoParcela(c),0)
  const saldoPrevisto=Math.max(0,saldoTotal-total)

  function alterarValor(conta:ContaReceberCliente360,modo:'total'|'parcial'){
    setReciboSimulado(null);setRecebimentoId(null)
    setSelecionadas(atual=>({...atual,[conta.id]:modo==='total'?saldoParcela(conta).toFixed(2).replace('.',','):''}))
  }
  function alternar(conta:ContaReceberCliente360){
    setReciboSimulado(null);setRecebimentoId(null)
    setSelecionadas(atual=>{
      const proximo={...atual}
      if(conta.id in proximo)delete proximo[conta.id]
      else proximo[conta.id]=saldoParcela(conta).toFixed(2).replace('.',',')
      return proximo
    })
  }
  function selecionar(lista:ContaReceberCliente360[]){
    const valores:Record<string,string>={}
    lista.forEach(c=>{valores[c.id]=saldoParcela(c).toFixed(2).replace('.',',')})
    setSelecionadas(valores);setReciboSimulado(null);setRecebimentoId(null)
  }

  async function salvar(){
    if(!cliente||!validadas||salvando)return
    setErro('');setSucesso('');setSalvando(true);setReciboSimulado(null);setRecebimentoId(null)
    try {
      const resposta=await requisicao('/api/financeiro/recebimento-cliente',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({clienteId:cliente.id,dataRecebimento:data,forma,referencia,observacoes,alocacoes})
      })
      if(resposta.simulado){
        setReciboSimulado({clienteNome:resposta.clienteNome,data:resposta.data,forma:resposta.forma,referencia:resposta.referencia,valor:resposta.valor,parcelas:resposta.parcelas,linhas:resposta.linhas})
        setSucesso(`Simulação concluída: ${moeda(resposta.valor)}. Nenhuma parcela real foi baixada.`)
      }else{
        if(resposta.recebimentoId)setRecebimentoId(resposta.recebimentoId)
        setSucesso(`Recebimento registrado: ${moeda(Number(resposta.valor||total))} em ${resposta.parcelas||alocacoes.length} parcela(s).`)
        setSelecionadas({});setReferencia('');setObservacoes('')
        await carregar()
      }
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar recebimento.')}
    finally{setSalvando(false)}
  }

  return <div className="min-h-screen bg-slate-50">
    <style jsx global>{`@media print{
      body * {visibility:hidden!important}
      #recibo-simulado, #recibo-simulado * {visibility:visible!important}
      #recibo-simulado {position:absolute!important;left:0;top:0;width:100%;border:none!important;box-shadow:none!important}
      .no-print {display:none!important}
      @page{size:A4;margin:18mm}
    }`}</style>
    <header className="border-b bg-white no-print">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <Link href={`/clientes/${clienteId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Voltar ao Cliente 360</Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Wallet size={22}/></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Receber por parcelas</h1><p className="text-sm text-slate-500">{cliente?.nome||'Cliente'}</p></div>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      {erro&&<div className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {carregando&&<p className="no-print p-6 text-slate-500">Carregando parcelas...</p>}
      {emPrevia&&!carregando&&<p className="no-print rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>Modo de prévia:</b> você pode simular valores e imprimir um modelo de recibo, mas nenhum recebimento será gravado.</p>}
      {sucesso&&<div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={17}/>{sucesso}{recebimentoId&&<Link target="_blank" href={`/financeiro/recibo/receber/${recebimentoId}`} className="ml-auto rounded-lg border bg-white px-3 py-1.5 font-semibold text-slate-900">Abrir recibo / imprimir</Link>}</div>}
      {!carregando&&cliente&&<><section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Data<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium text-slate-700">Forma<select value={forma} onChange={e=>setForma(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option><option value="outro">Outro</option></select></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Referência / comprovante<input value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Ex.: PIX 19/10 ou nº do comprovante" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Observações<textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
      </section>
      <section className="no-print rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Parcelas em aberto</h2><p className="mt-1 text-xs text-slate-500">Selecione a parcela, clique em <b>Receber tudo</b> ou <b>Receber parcial</b> e informe o valor que entrou.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={()=>selecionar(vencidas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar vencidas</button><button onClick={()=>selecionar(abertas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar todas</button><button onClick={()=>selecionar([])} className="rounded-lg border px-3 py-2 text-xs font-semibold">Limpar</button></div>
        </div>
        <div className="divide-y divide-slate-100">
          {abertas.length===0&&<p className="p-8 text-center text-sm text-slate-400">Este cliente não possui parcelas em aberto.</p>}
          {abertas.map(conta=>{
            const marcada=conta.id in selecionadas
            const valorSaldo=saldoParcela(conta)
            const digitado=numero(selecionadas[conta.id]||'')
            const invalido=marcada&&(!Number.isFinite(digitado)||centavos(digitado)<=0||centavos(digitado)>centavos(valorSaldo))
            const restante=marcada&&Number.isFinite(digitado)?Math.max(0,centavos(valorSaldo)-centavos(digitado))/100:valorSaldo
            return <div key={conta.id} className={`grid gap-3 p-4 md:grid-cols-[28px_1fr_220px] md:items-center ${marcada?'bg-blue-50/40':''}`}>
              <input type="checkbox" aria-label={`Selecionar ${conta.documento||'parcela'}`} checked={marcada} onChange={()=>alternar(conta)} className="h-4 w-4"/>
              <div><p className="font-semibold text-slate-800">{conta.documento||`Parcela ${conta.parcela}/${conta.total_parcelas}`}</p>
                <p className="mt-1 text-xs text-slate-500">Vence {dataBR(conta.vencimento)} · {conta.obra_id&&obraPorId[conta.obra_id]?obraPorId[conta.obra_id]:'Sem obra'} · saldo {moeda(valorSaldo)}</p>
                <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>alterarValor(conta,'total')} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">Receber tudo</button><button type="button" onClick={()=>alterarValor(conta,'parcial')} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800">Receber parcial</button></div>
              </div>
              <div><label htmlFor={`valor-${conta.id}`} className="text-[11px] font-bold uppercase text-slate-500">Valor recebido (R$)</label>
                <input id={`valor-${conta.id}`} disabled={!marcada} value={selecionadas[conta.id]??''} onChange={e=>{setSelecionadas(s=>({...s,[conta.id]:e.target.value}));setReciboSimulado(null)}} inputMode="decimal" placeholder="Digite o valor" className={`mt-1 w-full rounded-lg border px-3 py-2 text-right font-semibold disabled:bg-slate-100 ${invalido?'border-red-500':'border-slate-300'}`}/>
                {marcada&&<p className={`mt-1 text-xs ${invalido?'text-red-600':'text-slate-600'}`}>{invalido?'Informe um valor válido até '+moeda(valorSaldo):'Saldo após receber: '+moeda(restante)}</p>}
              </div>
            </div>
          })}
        </div>
      </section>
      <section className="no-print sticky bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase text-slate-500">Total deste recebimento</p><p className="text-2xl font-bold text-emerald-700">{moeda(total)}</p><p className="text-xs text-slate-600">{alocacoes.length} parcela(s) selecionada(s) · Saldo previsto do cliente: {validadas?moeda(saldoPrevisto):'—'}</p></div><button disabled={salvando||!validadas} onClick={()=>void salvar()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 font-bold text-white disabled:opacity-40"><Receipt size={18}/>{salvando?'Processando...':emPrevia?'Simular recebimento':'Confirmar recebimento'}</button></div>
      </section></>}
      {reciboSimulado&&<section id="recibo-simulado" className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 shadow-sm">
        <div className="no-print mb-4 flex justify-end"><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"><Printer size={16}/>Imprimir / salvar PDF</button></div>
        <p className="text-sm font-bold uppercase tracking-wider">Esquadrifácio Soluções em Alumínio</p>
        <h2 className="mt-3 text-2xl font-bold">MODELO DE RECIBO — SIMULAÇÃO</h2>
        <p className="mt-2 border-b pb-4 text-sm font-bold text-red-700">SEM VALOR DE QUITAÇÃO — NENHUM PAGAMENTO FOI REGISTRADO</p>
        <div className="mt-5 space-y-2 text-sm"><p><b>Cliente:</b> {reciboSimulado.clienteNome}</p><p><b>Data:</b> {dataBR(reciboSimulado.data)} · <b>Forma:</b> {reciboSimulado.forma.toUpperCase()}</p>{reciboSimulado.referencia&&<p><b>Referência:</b> {reciboSimulado.referencia}</p>}</div>
        <table className="mt-6 w-full text-sm"><thead className="border-b text-left"><tr><th className="py-3">Obra</th><th className="text-right">Valor original</th><th className="text-right">Recebido</th><th className="text-right">Saldo devedor</th></tr></thead><tbody>{reciboSimulado.linhas.map((linha,i)=><tr key={i} className="border-b"><td className="py-3">{linha.obra}</td><td className="text-right">{moeda(linha.valorOriginal)}</td><td className="text-right">{moeda(linha.valorRecebido)}</td><td className="text-right font-bold">{moeda(linha.saldoDevedor)}</td></tr>)}</tbody></table>
        <p className="mt-4 text-right text-lg font-bold">Total simulado recebido: {moeda(reciboSimulado.valor)}</p>
        <p className="mt-4 text-xs text-slate-600">Saldos calculados sobre a posição atual dos títulos. O recibo definitivo será emitido apenas após a baixa real do recebimento.</p>
        <div className="mt-20 grid grid-cols-2 gap-10 text-center text-xs"><div className="border-t pt-2">Esquadrifácio</div><div className="border-t pt-2">Cliente / responsável</div></div>
      </section>}
    </main>
  </div>
}
