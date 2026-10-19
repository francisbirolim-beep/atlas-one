'use client'
import { Printer } from 'lucide-react'
import { type ReciboInfo, textoRecibo } from '@/lib/financeiroRecibos'
export default function ReciboImpressao({dados}:{dados:ReciboInfo}){
 const r=textoRecibo(dados)
 return <div className="mx-auto max-w-[820px] bg-white p-6 text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
  <style jsx global>{`@media print{@page{size:A4;margin:18mm} .no-print{display:none!important} body{background:white!important}}`}</style>
  <div className="no-print mb-5 flex justify-end"><button onClick={()=>window.print()} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white"><Printer size={16}/>Imprimir / salvar em PDF</button></div>
  <header className="border-b-2 border-slate-900 pb-5"><p className="text-xs font-bold uppercase tracking-widest">Esquadrifácio Soluções em Alumínio</p><h1 className="mt-3 text-3xl font-black">{dados.tipo==='pagar'?'RECIBO DE PAGAMENTO':'RECIBO DE RECEBIMENTO'}</h1><p className="mt-2 text-sm text-slate-500">Nº de referência: {dados.referencia||dados.id.slice(0,8)}</p></header>
  <section className="mt-6 space-y-3 text-sm"><p><b>{dados.tipo==='pagar'?'Beneficiário / recebedor':'Recebido do cliente'}:</b> {dados.nome}</p>{dados.documento&&<p><b>CPF/CNPJ:</b> {dados.documento}</p>}{dados.obra&&<p><b>Obra:</b> {dados.obra}</p>}{dados.descricao&&<p><b>Descrição:</b> {dados.descricao}</p>}<p><b>Data:</b> {r.data} · <b>Forma:</b> {dados.forma||'Não informada'}</p></section>
  <section className="mt-7 space-y-3 rounded-xl border p-5"><p className="flex justify-between"><span>Valor original do título / obra</span><b>{r.original}</b></p><p className="flex justify-between"><span>{dados.tipo==='pagar'?'Valor pago':'Valor recebido neste pagamento'}</span><b>{r.movimento}</b></p><p className="flex justify-between border-t pt-3 text-lg"><span>Saldo atual em aberto</span><b>{r.saldo}</b></p></section>
  <p className="mt-5 text-xs text-slate-600">{dados.saldo>0?'Recibo de quitação parcial.':'Recibo de pagamento registrado.'} O saldo indicado representa a posição atual do título consultado, podendo diferir do saldo existente na data do pagamento.</p>
  <div className="mt-24 grid grid-cols-2 gap-8 text-center text-xs"><div className="border-t pt-2">Esquadrifácio</div><div className="border-t pt-2">{dados.tipo==='pagar'?dados.nome:'Responsável / cliente'}</div></div>
 </div>
}
