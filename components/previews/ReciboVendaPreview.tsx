'use client'

import { Printer, X } from 'lucide-react'

export type FormaPagamento='pix'|'dinheiro'|'debito'|'credito'|'transferencia'
export type LinhaPagamento={id:number;forma:FormaPagamento;valor:string}
export type StatusPagamento='quitada'|'parcial'|'marcada'
export type ItemVendaRecibo={
  quantidade:number;
  produto:{nome:string;codigo:string;descricao:string;unidade:string;preco:number|null;precoPromocional:number|null}
}
export const rotuloPagamento:Record<FormaPagamento,string>={
  pix:'PIX',dinheiro:'Dinheiro',debito:'Cartão de débito',credito:'Cartão de crédito',transferencia:'Transferência'
}
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const cents=(n:number)=>Math.round((Number.isFinite(n)?n:0)*100)
export const valorEntrada=(s:string)=>{
  const v=String(s||'').replace(/[^\d,.-]/g,'').trim()
  if(!v)return 0
  const normalized=v.includes(',')?v.replace(/\./g,'').replace(',','.'):v
  const n=Number(normalized)
  return Number.isFinite(n)&&n>0?n:0
}
export const precoItem=(p:ItemVendaRecibo['produto'])=>p.precoPromocional!=null&&p.precoPromocional>0?p.precoPromocional:p.preco
export interface ReciboProps {
  aberto:boolean;fechar:()=>void;nomeCliente:string;nomeAssinatura:string;
  documento?:string|null;cidade?:string|null;obra?:string|null;
  tipoDestino:'consumidor'|'cliente'|'obra';dataHora:string;itens:ItemVendaRecibo[];
  subtotal:number;desconto:number;total:number;recebido:number;saldo:number;
  status:StatusPagamento;formas:{forma:FormaPagamento;valor:number}[]
}
export default function ReciboVendaPreview(props:ReciboProps){
  const {aberto,fechar,nomeCliente,nomeAssinatura,documento,cidade,obra,tipoDestino,dataHora,itens,subtotal,desconto,total,recebido,saldo,status,formas}=props
  if(!aberto)return null
  const situacao=status==='quitada'?'Quitada (simulação)':status==='parcial'?'Recebimento parcial · saldo marcado':'Marcada · sem recebimento'
  const data=dataHora?new Date(dataHora).toLocaleString('pt-BR'):'—'
  return <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Prévia do recibo">
    <style jsx global>{'@media print { @page { size:A4; margin:13mm; } body * { visibility:hidden!important; } #recibo-venda-previa, #recibo-venda-previa * { visibility:visible!important; } #recibo-venda-previa { position:absolute!important; left:0!important; top:0!important; width:100%!important; max-width:none!important; margin:0!important; border:0!important; border-radius:0!important; box-shadow:none!important; padding:0!important; background:white!important; } .esconder-na-impressao { display:none!important; } }'}</style>
    <div id="recibo-venda-previa" className="my-2 w-full max-w-[820px] rounded-2xl bg-white p-5 text-slate-900 shadow-xl sm:p-9">
      <div className="esconder-na-impressao mb-5 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-black">Comprovante da venda — Prévia</h2><p className="text-xs text-amber-700">Sem gerar venda ou recebimento real.</p></div>
        <div className="flex gap-2"><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white"><Printer size={16}/> Imprimir / Salvar PDF</button><button type="button" onClick={fechar} className="rounded-lg border p-2.5" aria-label="Fechar recibo"><X size={17}/></button></div>
      </div>
      <header className="border-b-2 border-slate-800 pb-4 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em]">Atlas One · Esquadrifácio</p>
        <h1 className="mt-2 text-xl font-black">COMPROVANTE DE VENDA</h1>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-amber-700">Simulação — documento não fiscal / sem recebimento efetivado</p>
      </header>
      <section className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <p><span className="block text-slate-500">Data/hora da simulação</span><b>{data}</b></p>
        <p><span className="block text-slate-500">Situação simulada</span><b>{situacao}</b></p>
        <p><span className="block text-slate-500">Cliente</span><b>{nomeCliente}</b></p>
        <p><span className="block text-slate-500">Documento / cidade</span><b>{[documento,cidade].filter(Boolean).join(' · ')||'Não informado'}</b></p>
        <p className="sm:col-span-2"><span className="block text-slate-500">Vinculação</span><b>{tipoDestino==='obra'?'Obra: '+(obra||'—'):tipoDestino==='cliente'?'Cadastro do cliente · sem obra':'Venda comum · consumidor final'}</b></p>
      </section>
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-black">Descrição completa dos itens</h2>
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="border-y border-slate-300 bg-slate-50"><tr><th className="py-2 pr-2">Produto / descrição</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Unit.</th><th className="py-2 text-right">Total</th></tr></thead>
          <tbody>{itens.map(({produto,quantidade},i)=><tr key={produto.codigo+'-'+i} className="border-b border-slate-200 align-top"><td className="py-3 pr-2"><b>{produto.nome}</b><div className="text-slate-500">{produto.codigo||'Sem código'} · {produto.unidade}</div>{produto.descricao&&<div className="mt-1 text-slate-600">{produto.descricao}</div>}</td><td className="py-3 text-right">{quantidade}</td><td className="py-3 text-right">{moeda(precoItem(produto)||0)}</td><td className="py-3 text-right font-bold">{moeda((precoItem(produto)||0)*quantidade)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="mt-5 ml-auto max-w-sm space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><b>{moeda(subtotal)}</b></div>
        <div className="flex justify-between"><span>Desconto</span><b>- {moeda(desconto)}</b></div>
        <div className="flex justify-between border-t pt-2 text-base"><b>Total da venda</b><b>{moeda(total)}</b></div>
      </section>
      <section className="mt-6 rounded-xl border border-slate-300 p-4 text-xs">
        <h2 className="text-sm font-black">Detalhamento do recebimento</h2>
        {formas.length?formas.map((f,i)=><div key={i} className="mt-2 flex justify-between"><span>{rotuloPagamento[f.forma]}</span><b>{moeda(f.valor)}</b></div>):<p className="mt-2 text-slate-500">Sem recebimento: total marcado para pagamento posterior.</p>}
        <div className="mt-3 flex justify-between border-t pt-2 font-bold"><span>Recebido na simulação</span><span>{moeda(recebido)}</span></div>
        <div className="mt-1 flex justify-between font-bold"><span>Saldo a receber {saldo>0?'(marcado)':''}</span><span>{moeda(saldo)}</span></div>
        {saldo>0&&<p className="mt-2 text-amber-800">Saldo previsto para o {tipoDestino==='obra'?'histórico financeiro da obra':tipoDestino==='cliente'?'cadastro do cliente':'cadastro identificado do cliente'} — nenhuma conta foi criada nesta prévia.</p>}
      </section>
      <section className="mt-16 grid grid-cols-1 gap-10 text-center sm:grid-cols-2">
        <div><div className="border-t border-slate-600 pt-2 text-xs font-semibold">Assinatura do cliente / consumidor</div><p className="mt-1 text-xs">{nomeAssinatura||nomeCliente}</p></div>
        <div><div className="border-t border-slate-600 pt-2 text-xs font-semibold">Responsável pelo atendimento</div><p className="mt-1 text-xs">Esquadrifácio</p></div>
      </section>
      <footer className="mt-8 border-t pt-3 text-center text-[10px] font-semibold text-amber-800">
        PRÉVIA SEM VALIDADE FISCAL OU COMPROBATÓRIA. NENHUM PAGAMENTO, PEDIDO OU DÉBITO FOI REGISTRADO NO ATLAS ONE.
      </footer>
    </div>
  </div>
}
