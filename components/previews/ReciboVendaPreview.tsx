'use client'

import { Printer, X } from 'lucide-react'
import { LOGOTIPO_PDF_FUNDO_CLARO } from '@/lib/brandingRelatorios'

export type FormaPagamento='pix'|'dinheiro'|'debito'|'credito'|'transferencia'
export type LinhaPagamento={id:number;forma:FormaPagamento;valor:string}
export type StatusPagamento='quitada'|'parcial'|'marcada'
export type ItemVendaRecibo={
  quantidade:number;
  precoUnitario?:number|null;
  produto:{nome:string;codigo:string;descricao:string;unidade:string;preco:number|null;precoPromocional:number|null}
}
export type EmpresaRecibo={nome?:string;nomeFantasia?:string;logoUrl?:string;cnpj?:string;ie?:string;endereco?:string;cidadeUf?:string;cep?:string;tel?:string;tel2?:string;email?:string}
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
  status:StatusPagamento;formas:{forma:FormaPagamento;valor:number}[];
  empresa?:EmpresaRecibo|null
}
export default function ReciboVendaPreview(props:ReciboProps){
  const {aberto,fechar,nomeCliente,nomeAssinatura,documento,cidade,obra,tipoDestino,dataHora,itens,subtotal,desconto,total,recebido,saldo,status,formas,empresa}=props
  if(!aberto)return null
  const situacao=status==='quitada'?'Quitada (simulação)':status==='parcial'?'Recebimento parcial · saldo marcado':'Marcada · sem recebimento'
  const data=dataHora?new Date(dataHora).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
  const logo=empresa?.logoUrl?.startsWith('https://')?empresa.logoUrl:LOGOTIPO_PDF_FUNDO_CLARO
  const empresaNome=empresa?.nome||'Esquadrifácio Soluções em Alumínio'
  const vinculo=tipoDestino==='obra'?'Obra '+(obra||'—'):tipoDestino==='cliente'?'Cliente cadastrado':'Venda ao consumidor'
  // Dividir em vias para não omitir itens. Cada via ocupa no máximo meia folha A4.
  const paginas:ItemVendaRecibo[][]=[]
  for(let i=0;i<itens.length;i+=4)paginas.push(itens.slice(i,i+4))
  if(paginas.length===0)paginas.push([])
  return <div role="dialog" aria-modal="true" aria-label="Recibo de meia folha A4" className="fixed inset-0 z-[150] overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
    <style jsx global>{'@media print { @page { size:A4 portrait; margin:0; } html,body { margin:0!important;padding:0!important;background:white!important; } body * { visibility:hidden!important; } .recibo-meia-folha,.recibo-meia-folha * {visibility:visible!important;} .recibo-meia-folha { position:relative!important; width:210mm!important; height:148.5mm!important; box-sizing:border-box!important; margin:0!important; padding:7mm 11mm!important; background:white!important; border:none!important; border-radius:0!important; box-shadow:none!important; break-after:page!important; page-break-after:always!important; font-size:9px!important; } .recibo-botoes { display:none!important; } .recibo-imagem-logo {max-height:14mm!important;max-width:57mm!important;} .recibo-meia-folha tr { break-inside:avoid!important;page-break-inside:avoid!important; } }'}</style>
    <div className="mx-auto max-w-[900px]">
      <div className="recibo-botoes mb-3 flex flex-wrap justify-between gap-2 rounded-xl bg-white p-3 shadow-lg">
        <div><b className="text-sm">Recibo da venda — meia folha A4</b><p className="mt-1 text-xs text-amber-700">Prévia de impressão, sem gerar cobrança ou venda real.</p></div>
        <div className="flex gap-2"><button type="button" onClick={()=>window.print()} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white"><Printer size={16}/> Imprimir / Salvar PDF</button><button type="button" aria-label="Fechar recibo" onClick={fechar} className="rounded-lg border p-2.5"><X size={17}/></button></div>
      </div>
      {paginas.map((pagina,indice)=>{
        const ultima=indice===paginas.length-1
        return <div key={indice} className="recibo-meia-folha mb-3 min-h-[500px] w-full rounded-xl bg-white px-5 py-5 text-slate-900 shadow-lg sm:px-9 sm:py-7">
          <header className="flex justify-between gap-5 border-b-2 border-slate-700 pb-2">
            <div className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="Logotipo oficial da Esquadrifácio" className="recibo-imagem-logo max-h-[44px] max-w-[235px] object-contain object-left"/>
              <h2 className="mt-1 text-[11px] font-black uppercase">{empresaNome}</h2>
              <p className="text-[10px] text-slate-600">{[empresa?.endereco,empresa?.cidadeUf,empresa?.cep?'CEP '+empresa.cep:null].filter(Boolean).join(' · ')}</p>
              <p className="text-[10px] text-slate-600">{[empresa?.cnpj?'CNPJ '+empresa.cnpj:null,empresa?.tel?'Telefone '+empresa.tel:null,empresa?.email].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="shrink-0 text-right"><h1 className="text-sm font-black">COMPROVANTE DE VENDA</h1><p className="mt-1 text-[10px]">Data e hora: {data}</p><p className="mt-1 text-[10px] font-bold text-amber-700">SIMULAÇÃO · NÃO FISCAL</p>{paginas.length>1&&<p className="text-[10px]">Parte {indice+1}/{paginas.length}</p>}</div>
          </header>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-b pb-2 text-[10px]">
            <p><span className="text-slate-500">Cliente: </span><b>{nomeCliente}</b></p>
            <p><span className="text-slate-500">Situação: </span><b>{situacao}</b></p>
            <p><span className="text-slate-500">Documento: </span>{documento||'Não informado'}{cidade?' · '+cidade:''}</p>
            <p><span className="text-slate-500">Vínculo: </span><b>{vinculo}</b></p>
          </div>
          <table className="mt-2 w-full table-fixed border-collapse text-left text-[10px]">
            <thead className="border-y bg-slate-50"><tr><th className="w-[59%] px-1 py-1.5">Produto e descrição</th><th className="w-[9%] py-1.5 text-right">Qtd.</th><th className="w-[15%] py-1.5 text-right">Unitário</th><th className="w-[17%] py-1.5 text-right">Total</th></tr></thead>
            <tbody>{pagina.map(({produto,quantidade,precoUnitario},i)=><tr key={produto.codigo+'-'+i} className="border-b align-top">
              <td className="break-words px-1 py-1.5"><b>{produto.nome}</b><span className="ml-1 text-slate-500">({produto.codigo||'Sem código'} · {produto.unidade})</span>{produto.descricao&&<div className="text-slate-600">{produto.descricao}</div>}</td>
              <td className="py-1.5 text-right">{quantidade}</td><td className="py-1.5 text-right">{moeda((precoUnitario??precoItem(produto))||0)}</td><td className="py-1.5 text-right font-bold">{moeda(((precoUnitario??precoItem(produto))||0)*quantidade)}</td>
            </tr>)}</tbody>
          </table>
          {ultima&&<div className="mt-2 grid grid-cols-2 gap-3">
            <section className="rounded-md border px-3 py-2 text-[10px]">
              <b>Formas de pagamento</b>
              {formas.length?formas.map((f,i)=><div key={i} className="mt-1 flex justify-between"><span>{rotuloPagamento[f.forma]}</span><b>{moeda(f.valor)}</b></div>):<p className="mt-1 text-slate-500">Sem recebimento: venda marcada</p>}
              <div className="mt-1 flex justify-between border-t pt-1 font-bold"><span>Recebido</span><span>{moeda(recebido)}</span></div>
              <div className="flex justify-between font-bold"><span>Saldo a receber</span><span>{moeda(saldo)}</span></div>
            </section>
            <section className="rounded-md border px-3 py-2 text-[10px]">
              <div className="flex justify-between"><span>Subtotal</span><b>{moeda(subtotal)}</b></div>
              <div className="mt-1 flex justify-between"><span>Desconto</span><b>- {moeda(desconto)}</b></div>
              <div className="mt-2 flex justify-between border-t pt-1 text-[12px] font-black"><span>Valor final</span><span>{moeda(total)}</span></div>
            </section>
          </div>}
          {ultima&&<div className="mt-7 text-center text-[10px]">
            <div className="mx-auto w-1/2 border-t border-slate-600 pt-1">Assinatura do cliente</div>
            <p className="mt-1">{nomeAssinatura||nomeCliente}</p>
          </div>}
          <footer className="mt-3 border-t pt-1 text-center text-[9px] font-semibold uppercase text-amber-700">Prévia sem validade fiscal ou comprobatória. Nenhuma venda, quitação ou dívida registrada.</footer>
        </div>
      })}
    </div>
  </div>
}
