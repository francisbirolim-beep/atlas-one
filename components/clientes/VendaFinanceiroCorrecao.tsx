'use client'
import {useEffect,useState} from 'react'
import {tokenAtual} from '@/lib/auth'
type Rec={id:string;valor:number;data_recebimento:string;status:string;forma:string|null}
type Audit={id:string;valor_original:number;justificativa:string;autorizado_por_nome:string;cancelado_em:string}
type Financeiro={valorVenda:number;totalTitulos:number;recebido:number;descontos:number;diferenca:number;qtdTitulos:number;podeConciliar:boolean}
const moeda=(v:unknown)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function VendaFinanceiroCorrecao({vendaId}:{vendaId:string}){
 const [aberto,setAberto]=useState(false)
 const [master,setMaster]=useState(false)
 const [disponivel,setDisponivel]=useState(false)
 const [recebimentos,setRecebimentos]=useState<Rec[]>([])
 const [historico,setHistorico]=useState<Audit[]>([])
 const [financeiro,setFinanceiro]=useState<Financeiro|null>(null)
 const [modoPrevia,setModoPrevia]=useState(false)
 const [conciliando,setConciliando]=useState(false)
 const [selecionado,setSelecionado]=useState<Rec|null>(null)
 const [motivo,setMotivo]=useState('')
 const [ocupado,setOcupado]=useState(false)
 const [mensagem,setMensagem]=useState('')
 const [corrigir,setCorrigir]=useState(false)
 const [versao,setVersao]=useState(0)
 useEffect(()=>{
  let ativo=true
  void (async()=>{
   try{
    const token=await tokenAtual()
    if(!token)return
    const r=await fetch('/api/financeiro/recebimentos-cancelar?vendaId='+encodeURIComponent(vendaId),{
      cache:'no-store',headers:{Authorization:'Bearer '+token}
    })
    const d=await r.json().catch(()=>({}))
    if(!ativo||!r.ok)return
    setMaster(Boolean(d.podeCancelar))
    setDisponivel(Boolean(d.disponivel))
    setRecebimentos(d.recebimentos||[])
    setHistorico(d.cancelamentos||[])
    setFinanceiro(d.financeiro||null)
    setModoPrevia(Boolean(d.modoPrevia))
   }catch{if(ativo)setDisponivel(false)}
  })()
  return()=>{ativo=false}
 },[vendaId,versao])
 async function conciliar(){
   if(!financeiro||conciliando||!financeiro.podeConciliar)return
   if(!window.confirm('Conferir títulos financeiros desta venda?\n\nValor da venda: '+moeda(financeiro.valorVenda)+'\nTítulos atuais: '+moeda(financeiro.totalTitulos)+'\nDiferença: '+moeda(financeiro.diferenca)+'\n\nNão será registrado nenhum recebimento.'))return
   setConciliando(true);setMensagem('')
   try{
     const token=await tokenAtual()
     if(!token)throw Error('Sessão expirada.')
     const resp=await fetch('/api/financeiro/conciliar-valor-venda',{
       method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
       body:JSON.stringify({vendaId,valorConfirmado:financeiro.valorVenda})
     })
     const d=await resp.json().catch(()=>({}))
     if(!resp.ok)throw Error(d.error||'A conciliação não pôde ser concluída.')
     if(d.simulado){setMensagem('SIMULAÇÃO: o valor a receber seria '+moeda(financeiro.valorVenda-financeiro.recebido-financeiro.descontos)+'. Nenhum título foi alterado nesta prévia.')}
     else{setMensagem('Títulos conciliados com o valor da venda. Atualize a página para conferir o resultado.');setVersao(v=>v+1);window.dispatchEvent(new Event('atlas-financeiro-recebimento-cancelado'))}
   }catch(e){setMensagem(e instanceof Error?e.message:'Falha ao conciliar o valor da venda.')}
   finally{setConciliando(false)}
 }
 async function confirmar(){
  if(!selecionado||motivo.trim().length<10||ocupado)return
  setOcupado(true);setMensagem('')
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sessão expirada.')
   const r=await fetch('/api/financeiro/recebimentos-cancelar',{
     method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({vendaId,recebimentoId:selecionado.id,justificativa:motivo.trim()})
   })
   const d=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(d.error||'Falha ao cancelar recebimento.')
   setMensagem(d.simulado?'Prévia: cancelamento simulado. Nenhum lançamento foi alterado.':'Recebimento cancelado. Atualize a venda para conferir o saldo e registre o valor correto.')
   if(!d.simulado){setVersao(v=>v+1);window.dispatchEvent(new Event('atlas-financeiro-recebimento-cancelado'))}
   setSelecionado(null);setMotivo('');setCorrigir(false)
  }catch(e){setMensagem(e instanceof Error?e.message:'Falha no cancelamento.')}
  finally{setOcupado(false)}
 }
 if(!master)return null
 return <>
  <button type="button" onClick={()=>setAberto(true)}
    className="fixed bottom-24 right-24 z-[70] rounded-xl border border-blue-400 bg-white px-3 py-2 text-xs font-bold text-blue-800 shadow-lg">
   Ajustes do Financeiro
  </button>
  {aberto&&<div role="dialog" aria-modal="true" aria-label="Ajustes do Financeiro" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
   <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
    <div className="flex items-center justify-between gap-3">
     <h3 className="text-base font-bold">Ajustes do Financeiro desta venda</h3>
     <button onClick={()=>{setAberto(false);setSelecionado(null)}} className="rounded border px-3 py-1.5 text-xs">Fechar</button>
    </div>
    <p className="mt-2 text-xs text-slate-700">Somente o Master pode cancelar um recebimento. Para corrigir o valor, cancele o lançamento incorreto com justificativa e registre um novo pelo botão “Registrar recebimento” da venda. O recibo original fica no histórico.</p>
    {financeiro&&<div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <h4 className="text-sm font-bold text-slate-900">Valor da venda e títulos a receber</h4>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>Valor da venda <b className="block text-base">{moeda(financeiro.valorVenda)}</b></div>
        <div>Títulos atuais <b className="block text-base">{moeda(financeiro.totalTitulos)}</b></div>
        <div>Diferença <b className="block text-base">{moeda(financeiro.diferenca)}</b></div>
      </div>
      {Math.abs(financeiro.diferenca)>=0.01&&<p className="mt-2 text-xs text-amber-800">O valor da venda e os títulos financeiros não conferem. Isso não representa recebimento do cliente.</p>}
      {financeiro.podeConciliar?<button type="button" disabled={conciliando} onClick={()=>void conciliar()} className="mt-3 rounded-lg border border-blue-500 bg-white px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">{conciliando?'Conferindo...':modoPrevia?'Simular atualização do A Receber':'Atualizar títulos para '+moeda(financeiro.valorVenda)}</button>
       :Math.abs(financeiro.diferenca)>=0.01?<p className="mt-2 text-xs text-amber-800">Ajuste automático indisponível: títulos inexistentes ou pagamentos/descontos registrados. É necessária conferência dos lançamentos.</p>
       :<p className="mt-2 text-xs text-emerald-700">Títulos financeiros conciliados com o valor da venda.</p>}
      {modoPrevia&&<p className="mt-2 text-xs font-semibold text-blue-800">Prévia de homologação: nenhum valor será gravado no banco.</p>}
    </div>}
    {!disponivel&&<p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs">Cancelamento ainda não disponível. Falta instalar e validar a migração no banco.</p>}
    {mensagem&&<p role="status" className="mt-2 rounded border border-sky-300 bg-sky-50 p-2 text-xs">{mensagem}</p>}
    {disponivel&&recebimentos.map(r=><div key={r.id} className="mt-2 flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-xs">
     <div><b>{moeda(r.valor)}</b><p>{r.data_recebimento} · {r.forma||'Forma não informada'}</p></div>
     <div className="flex gap-2">
      <button onClick={()=>{setSelecionado(r);setCorrigir(true);setMotivo('')}} className="rounded border border-blue-300 px-2 py-1.5 text-blue-700">Corrigir valor</button>
      <button onClick={()=>{setSelecionado(r);setCorrigir(false);setMotivo('')}} className="rounded border border-red-300 px-2 py-1.5 text-red-700">Cancelar</button>
     </div>
    </div>)}
    {!recebimentos.length&&<p className="mt-3 text-sm text-slate-500">Nenhum recebimento ativo vinculado a esta venda.</p>}
    {historico.length>0&&<div className="mt-4 rounded border bg-slate-50 p-3">
     <b className="text-xs">Histórico de recebimentos cancelados</b>
     {historico.map(h=><p key={h.id} className="mt-2 border-t pt-2 text-xs">{moeda(h.valor_original)} — {new Date(h.cancelado_em).toLocaleString('pt-BR')} — {h.autorizado_por_nome}. Motivo: {h.justificativa}</p>)}
    </div>}
    {selecionado&&<div className="mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-4">
     <h4 className="text-sm font-bold">{corrigir?'Corrigir valor':'Cancelar recebimento'} de {moeda(selecionado.valor)}</h4>
     <p className="mt-1 text-xs">Essa ação desfaz a baixa, preserva o recibo cancelado e registra quem autorizou. Recebimentos vinculados a Caixa fechado ou a várias obras precisam de conferência específica.</p>
     <label className="mt-3 block text-xs font-bold">Justificativa (mínimo 10 caracteres)
      <textarea rows={3} maxLength={1000} value={motivo} onChange={e=>setMotivo(e.target.value)} className="mt-1 w-full rounded border bg-white p-2 text-sm"/>
     </label>
     <div className="mt-3 flex gap-2">
      <button disabled={ocupado||motivo.trim().length<10} onClick={()=>void confirmar()} className="rounded bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ocupado?'Salvando...':'Confirmar cancelamento'}</button>
      <button disabled={ocupado} onClick={()=>setSelecionado(null)} className="rounded border bg-white px-3 py-2 text-xs">Voltar</button>
     </div>
    </div>}
   </div>
  </div>}
 </>
}