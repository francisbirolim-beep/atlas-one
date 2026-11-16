'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Receipt, Wallet } from 'lucide-react'
import type { ContaReceberCliente360, ObraCliente360 } from '@/lib/cliente360'
import { tokenAtual } from '@/lib/auth'
import { isoLocal } from '@/lib/financeiroPeriodo'
import ReciboImpressao from '@/components/financeiro/ReciboImpressao'
import type { ReciboInfo } from '@/lib/financeiroRecibos'
import { saldoParcela } from '@/lib/cliente360Recebimentos'
import type { Cliente } from '@/lib/tipos'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function valorDigitado(valor?: string): number {
  const texto=String(valor??'').trim()
  if(!texto)return 0
  const normalizado=texto.includes(',')?texto.replace(/\./g,'').replace(',','.'):texto
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalizado))return Number.NaN
  return Number(normalizado)
}

function formatarCampo(valor:number){return Math.max(0,Math.round(valor*100)/100).toFixed(2).replace('.',',')}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

export default function RecebimentoPorParcelasPage() {
  const params = useParams()
  const clienteId = params?.id as string
  const busca=useSearchParams()
  const origemCaixa=busca.get('origem')==='caixa'
  const contaInicial=busca.get('contaId')
  const primeiraSelecao=useRef(false)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [contas, setContas] = useState<ContaReceberCliente360[]>([])
  const [obras, setObras] = useState<ObraCliente360[]>([])
  const [selecionadas, setSelecionadas] = useState<Record<string, string>>({})
  const [descontos, setDescontos] = useState<Record<string, string>>({})
  const [juros, setJuros] = useState<Record<string, string>>({})
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(isoLocal(new Date()))
  const [referencia, setReferencia] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [modoPrevia, setModoPrevia] = useState(false)
  const [caixaAberto, setCaixaAberto] = useState(true)
  const [recibosSimulados, setRecibosSimulados] = useState<ReciboInfo[]>([])
  const [reciboRegistradoId, setReciboRegistradoId] = useState<string | null>(null)
  const [obrasRecebidas, setObrasRecebidas] = useState<string[]>([])
  const [indiceReciboImprimir, setIndiceReciboImprimir] = useState(0)

  async function carregar() {
    if (!clienteId) return
    setCarregando(true)
    setErro('')
    try {
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const resposta=await fetch(`/api/financeiro/cliente-recebimento?clienteId=${encodeURIComponent(clienteId)}${origemCaixa?'&origem=caixa':''}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
      const dados=await resposta.json()
      if(!resposta.ok)throw new Error(dados.error||'Não foi possível carregar as parcelas.')
      setCliente(dados.cliente as Cliente)
      if(origemCaixa && contaInicial && !primeiraSelecao.current){
        const selecionada=(dados.contas||[] as ContaReceberCliente360[]).find((x:ContaReceberCliente360)=>x.id===contaInicial)
        if(selecionada && saldoParcela(selecionada)>0.009){
          setSelecionadas({[contaInicial]:saldoParcela(selecionada).toFixed(2).replace('.',',')})
          primeiraSelecao.current=true
        }
      }
      setContas(((dados.contas||[]) as ContaReceberCliente360[]).filter(item=>item.status!=='cancelado'&&saldoParcela(item)>0.009))
      setObras((dados.obras||[]) as ObraCliente360[])
      setModoPrevia(dados.modoPrevia===true)
      setCaixaAberto(dados.caixaAberto!==false)
    } catch(e){setErro(e instanceof Error?e.message:'Erro ao consultar os títulos.');setContas([])}
    finally{setCarregando(false)}
  }

  useEffect(() => { void carregar() }, [clienteId,origemCaixa,contaInicial])

  const obraPorId = useMemo(() => Object.fromEntries(obras.map(o => [o.id, o.nome])), [obras])
  const total = useMemo(() => Object.values(selecionadas).reduce((s, valor) => s + (valorDigitado(valor) || 0), 0), [selecionadas])
  const totalDesconto = useMemo(() => Object.keys(selecionadas).reduce((s,id)=>s+(valorDigitado(descontos[id])||0),0),[selecionadas,descontos])
  const totalJuros = useMemo(() => Object.keys(selecionadas).reduce((s,id)=>s+(valorDigitado(juros[id])||0),0),[selecionadas,juros])
  const totalBaixado = Math.round((total+totalDesconto-totalJuros)*100)/100
  const vencidas = contas.filter(c => c.vencimento && c.vencimento < isoLocal(new Date()))
  const saldoSelecionado = contas.filter(c=>c.id in selecionadas).reduce((v,c)=>v+saldoParcela(c),0)
  const saldoApos = Math.max(0, Math.round((saldoSelecionado-totalBaixado)*100)/100)

  function alterarAjuste(conta:ContaReceberCliente360,tipo:'desconto'|'juros',texto:string){
    const descontoAnterior=valorDigitado(descontos[conta.id])||0
    const jurosAnterior=valorDigitado(juros[conta.id])||0
    const novo=valorDigitado(texto)
    if(tipo==='desconto')setDescontos(s=>({...s,[conta.id]:texto}))
    else setJuros(s=>({...s,[conta.id]:texto}))
    if(!Number.isFinite(novo))return
    const integralAntes=saldoParcela(conta)-descontoAnterior+jurosAnterior
    const integralDepois=saldoParcela(conta)-
      (tipo==='desconto'?novo:descontoAnterior)+(tipo==='juros'?novo:jurosAnterior)
    setSelecionadas(atual=>{
      if(!(conta.id in atual)||Math.abs(valorDigitado(atual[conta.id])-integralAntes)>0.009||integralDepois<=0)return atual
      return {...atual,[conta.id]:formatarCampo(integralDepois)}
    })
  }

  function alternar(conta: ContaReceberCliente360) {
    if(conta.id in selecionadas){
      setDescontos(a=>{const v={...a};delete v[conta.id];return v})
      setJuros(a=>{const v={...a};delete v[conta.id];return v})
    }
    setSelecionadas(atual => {
      const proximo = { ...atual }
      if (conta.id in proximo) delete proximo[conta.id]
      else proximo[conta.id] = saldoParcela(conta).toFixed(2).replace('.', ',')
      return proximo
    })
  }

  function receberParcial(conta:ContaReceberCliente360) {
    setSelecionadas(a=>({...a,[conta.id]:''}))
    const campo=document.getElementById(`valor-recebido-${conta.id}`) as HTMLInputElement|null
    campo?.focus()
  }

  function selecionar(lista: ContaReceberCliente360[]) {
    const valores: Record<string, string> = {}
    lista.forEach(c => { valores[c.id] = saldoParcela(c).toFixed(2).replace('.', ',') })
    setSelecionadas(valores)
    setDescontos({})
    setJuros({})
  }

  async function salvar() {
    if (!cliente) return
    setErro('')
    setSucesso('')

    const alocacoes = Object.entries(selecionadas).map(([conta_receber_id, valorTexto]) => ({
      conta_receber_id,
      valor: valorDigitado(valorTexto),
      desconto: valorDigitado(descontos[conta_receber_id]),
      juros: valorDigitado(juros[conta_receber_id]),
    }))

    for (const item of alocacoes) {
      const conta = contas.find(c => c.id === item.conta_receber_id)
      if (!conta || ![item.valor,item.desconto,item.juros].every(Number.isFinite)
          || item.valor <= 0 || item.desconto < 0 || item.juros < 0
          || item.valor + item.desconto > saldoParcela(conta) + item.juros + 0.009
) {
        setErro('Revise o valor recebido, desconto e juros de cada parcela. A baixa não pode ultrapassar o saldo.')
        return
      }
    }

    if (!alocacoes.length) {setErro('Selecione ao menos uma parcela.');return}
    setSalvando(true)
    try {
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada.')
      const resposta=await fetch('/api/financeiro/cliente-recebimento',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({clienteId:cliente.id,dataRecebimento:data,forma,referencia,observacoes,alocacoes,origem:origemCaixa?'caixa':'cliente'})
      })
      const resultado=await resposta.json()
      if(!resposta.ok||!resultado.ok)throw new Error(resultado.error||'Não foi possível registrar recebimento.')
      if(resultado.simulado){
        // Dividir por obra: o recibo nunca soma o saldo de outra obra do cliente.
        const grupos=new Map<string,typeof alocacoes>()
        for(const a of alocacoes){const obra=contas.find(c=>c.id===a.conta_receber_id)?.obra_id||'sem-obra';grupos.set(obra,[...(grupos.get(obra)||[]),a])}
        setIndiceReciboImprimir(0)
        setRecibosSimulados([...grupos].map(([obraId,alocacoesObra])=>{
          const contasObra=contas.filter(c=>(c.obra_id||'sem-obra')===obraId)
          const valorMovimento=alocacoesObra.reduce((v,a)=>v+a.valor,0)
          const descontoObra=alocacoesObra.reduce((v,a)=>v+a.desconto,0)
          const jurosObra=alocacoesObra.reduce((v,a)=>v+a.juros,0)
          const original=contasObra.reduce((v,c)=>v+Number(c.valor||0),0)
          const aberto=contasObra.reduce((v,c)=>v+saldoParcela(c),0)
          return {tipo:'receber',nome:cliente.nome,documento:(cliente as Cliente&{cpf_cnpj?:string|null}).cpf_cnpj||null,
            obra:obraId==='sem-obra'?'Não vinculada a obra':obraPorId[obraId]||'Obra cadastrada',
            referencia:referencia||'PRÉVIA (sem movimentação)',descricao:observacoes||'Simulação de recebimento parcial',
            forma,data,valorOriginal:original,valorMovimento,
            itens:[{id:'SIMULACAO',data,valor:valorMovimento,desconto:descontoObra,juros:jurosObra,forma}],
            saldo:Math.max(0,Math.round((aberto-valorMovimento-descontoObra+jurosObra)*100)/100),id:'SIMULACAO'} as ReciboInfo
        }))
        setSucesso(`Simulação: ${moeda(resultado.valor||total)} a receber. Nenhuma baixa foi gravada. Confira os recibos abaixo.`)
        setReciboRegistradoId(null)
        return
      }
      setSucesso(`Recebimento de ${moeda(resultado.valor??total)} confirmado em ${resultado.parcelas||alocacoes.length} parcela(s). Desconto: ${moeda(totalDesconto)} · Juros: ${moeda(totalJuros)}. Saldo atualizado no Atlas.`)
      setReciboRegistradoId(resultado.recebimentoId||null)
      setObrasRecebidas([...new Set(alocacoes.map(a=>contas.find(c=>c.id===a.conta_receber_id)?.obra_id||'sem-obra'))])
      setRecibosSimulados([])
      setSelecionadas({})
      setDescontos({})
      setJuros({})
      setReferencia('')
      setObservacoes('')
      await carregar()
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao registrar o recebimento. Nenhuma nova tentativa automática foi feita.')}
    finally{setSalvando(false)}
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 p-8 text-slate-400">Carregando financeiro do cliente...</div>

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <Link href={origemCaixa?'/balcao/contas-receber':`/clientes/${clienteId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> {origemCaixa?'Voltar ao Caixa / Contas a Receber':'Voltar ao Cliente 360'}</Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Wallet size={22}/></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Receber por parcelas</h1><p className="text-sm text-slate-500">{cliente?.nome}{origemCaixa?' · Caixa':' · Cliente'}</p></div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={17}/><span>{sucesso}</span>{reciboRegistradoId&&obrasRecebidas.map(obraId=><Link key={obraId} target="_blank" href={`/financeiro/recibo/receber/${reciboRegistradoId}?obraId=${encodeURIComponent(obraId)}`} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-bold">Gerar recibo: {obraId==='sem-obra'?'Sem obra':obraPorId[obraId]||'Obra'}</Link>)}{reciboRegistradoId&&obrasRecebidas.length===1&&<><Link target="_blank" rel="noopener noreferrer" href={'/financeiro/recibo/receber/'+reciboRegistradoId+'?obraId='+encodeURIComponent(obrasRecebidas[0])+'&acao=imprimir'} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-bold">Imprimir</Link><Link target="_blank" rel="noopener noreferrer" href={'/financeiro/recibo/receber/'+reciboRegistradoId+'?obraId='+encodeURIComponent(obrasRecebidas[0])+'&acao=pdf'} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Baixar PDF</Link></>}</div>}
      {modoPrevia && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Prévia de teste: confirmar recebimento faz uma simulação, sem alterar títulos, caixa ou saldo real do cliente.</div>}
      {origemCaixa&&!caixaAberto&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Caixa não está aberto neste operador. Abra o Caixa antes de confirmar um recebimento real.{modoPrevia?' Você pode continuar testando a simulação.':''}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Data<input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium text-slate-700">Forma<select value={forma} onChange={e => setForma(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="cartao_debito">Cartão débito</option><option value="cartao_credito">Cartão crédito</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option><option value="outro">Outro</option></select></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Referência / comprovante<input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ex.: PIX 05/09 ou nº do comprovante" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Observações<textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Parcelas em aberto</h2><p className="text-xs text-slate-500">Escolha as parcelas e informe valor recebido, desconto e juros. O valor e o saldo são conferidos antes de confirmar a baixa.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => selecionar(vencidas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar vencidas</button><button onClick={() => selecionar(contas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar todas</button><button onClick={() => {setSelecionadas({});setDescontos({});setJuros({})}} className="rounded-lg border px-3 py-2 text-xs font-semibold">Limpar</button></div>
        </div>

        <div className="divide-y divide-slate-100">
          {contas.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Este cliente não possui parcelas em aberto.</p>}
          {contas.map(conta => {
            const marcada = conta.id in selecionadas
            const valorSaldo = saldoParcela(conta)
            return <div key={conta.id} className={`grid gap-3 p-4 md:grid-cols-[28px_1fr_minmax(420px,1.2fr)] md:items-center ${marcada ? 'bg-blue-50/40' : ''}`}>
              <input type="checkbox" checked={marcada} onChange={() => alternar(conta)} className="h-4 w-4"/>
              <button type="button" onClick={() => alternar(conta)} className="text-left">
                <p className="font-semibold text-slate-800">{conta.documento || `Parcela ${conta.parcela}/${conta.total_parcelas}`}</p>
                <p className="mt-1 text-xs text-slate-500">Vence {dataBR(conta.vencimento)} · {conta.obra_id && obraPorId[conta.obra_id] ? obraPorId[conta.obra_id] : 'Sem obra'} · saldo {moeda(valorSaldo)}</p>
              </button>
              <div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">Valor recebido
                    <input id={`valor-recebido-${conta.id}`} disabled={!marcada} value={selecionadas[conta.id] ?? ''} onChange={e => setSelecionadas(s => ({ ...s, [conta.id]: e.target.value }))} inputMode="decimal" aria-label={`Valor recebido da parcela ${conta.documento||conta.id}`} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold disabled:bg-slate-100"/>
                  </label>
                  <label className="text-[11px] font-bold uppercase text-amber-700">Desconto (R$)
                    <input disabled={!marcada} value={descontos[conta.id]??''} onChange={e=>alterarAjuste(conta,'desconto',e.target.value)} inputMode="decimal" placeholder="0,00" aria-label={`Desconto da parcela ${conta.documento||conta.id}`} className="mt-1 w-full rounded-lg border border-amber-200 px-2 py-2 text-right font-semibold disabled:bg-slate-100"/>
                  </label>
                  <label className="text-[11px] font-bold uppercase text-blue-700">Juros (R$)
                    <input disabled={!marcada} value={juros[conta.id]??''} onChange={e=>alterarAjuste(conta,'juros',e.target.value)} inputMode="decimal" placeholder="0,00" aria-label={`Juros da parcela ${conta.documento||conta.id}`} className="mt-1 w-full rounded-lg border border-blue-200 px-2 py-2 text-right font-semibold disabled:bg-slate-100"/>
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button type="button" disabled={salvando} onClick={()=>setSelecionadas(s=>({...s,[conta.id]:formatarCampo(valorSaldo-(valorDigitado(descontos[conta.id])||0)+(valorDigitado(juros[conta.id])||0))}))} className="rounded-md border bg-white px-2 py-1 text-[11px] font-bold">Receber tudo</button>
                  <button type="button" disabled={salvando} onClick={()=>receberParcial(conta)} className="rounded-md border bg-white px-2 py-1 text-[11px] font-bold">Receber parcial</button>
                </div>
                {marcada && <p className="mt-1 text-[11px] font-semibold text-slate-600">Saldo após: {moeda(Math.max(0,valorSaldo+(valorDigitado(juros[conta.id])||0)-(valorDigitado(descontos[conta.id])||0)-(valorDigitado(selecionadas[conta.id])||0)))}</p>}
              </div>
            </div>
          })}
        </div>
      </section>

      <section className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase text-slate-400">Total deste recebimento</p><p className="text-2xl font-bold text-emerald-700">{moeda(total)}</p>
          <p className="mt-1 text-xs text-slate-600">Desconto: <strong className="text-amber-700">{moeda(totalDesconto)}</strong> · Juros: <strong className="text-blue-700">{moeda(totalJuros)}</strong> · Total abatido do principal: <strong>{moeda(totalBaixado)}</strong></p>
          <p className="text-xs text-slate-500">{Object.keys(selecionadas).length} parcela(s) selecionada(s) · saldo dessas parcelas após recebimento: <strong>{moeda(saldoApos)}</strong></p></div><button disabled={salvando || total <= 0 || !Object.keys(selecionadas).length || (origemCaixa&&!caixaAberto&&!modoPrevia)} onClick={salvar} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 font-bold text-white disabled:opacity-40"><Receipt size={18}/>{salvando ? 'Processando...' : modoPrevia ? 'Simular recebimento (sem gravar)' : 'Confirmar recebimento'}</button></div>
      </section>
      {!!recibosSimulados.length && <section className="space-y-5" aria-label="Recibos simulados por obra">
        <style jsx global>{`@media print { body * {visibility:hidden!important} .recibo-simulado:not(.selecionado-impressao) {display:none!important} .recibo-simulado.selecionado-impressao, .recibo-simulado.selecionado-impressao * {visibility:visible!important} .recibo-simulado.selecionado-impressao {position:absolute;top:0;left:0;width:100%} }`}</style>
        <p className="text-sm font-bold text-amber-800">Recibos de demonstração — os valores reais continuam inalterados</p>
        {recibosSimulados.map((recibo,i)=><div key={i} className={`recibo-simulado rounded-xl border-2 border-amber-300 bg-white p-4 ${indiceReciboImprimir===i?'selecionado-impressao':''}`}>
          {recibosSimulados.length>1&&<button type="button" onClick={()=>setIndiceReciboImprimir(i)} className="no-print mb-3 rounded-lg border px-3 py-2 text-xs font-semibold">{indiceReciboImprimir===i?'Selecionado para impressão':`Selecionar recibo ${recibo.obra}`}</button>}
          <p className="mb-4 text-center text-lg font-black uppercase text-red-700">SIMULAÇÃO — NÃO COMPROVA PAGAMENTO</p>
          <ReciboImpressao dados={recibo}/>
        </div>)}
      </section>}
    </main>
  </div>
}
