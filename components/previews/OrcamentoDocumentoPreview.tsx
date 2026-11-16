'use client'

import { Printer, X } from 'lucide-react'
import { LOGOTIPO_PDF_FUNDO_CLARO } from '@/lib/brandingRelatorios'
import type { EmpresaRecibo } from '@/components/previews/ReciboVendaPreview'

export type ProdutoDocumento={id:string;codigo:string;nome:string;descricao:string;unidade:string;quantidade:number;preco:number|null;imagem:string|null}
export type TipologiaDocumento={
  id:string;nome:string;linha:string;largura:string;altura:string;quantidade:number;cor:string;vidro:string;
  contramarco:string;variaveis:{nome:string;valor:string}[];imagem?:string|null
}
export type CondicaoDocumento={forma:string;valor:string}
export type OrcamentoDocumento={
  cliente:string;empresa:EmpresaRecibo|null;tipologias:TipologiaDocumento[];produtos:ProdutoDocumento[];
  subtotal:number;desconto:number;totalProdutos:number;temPendencias:boolean;
  condicoes:CondicaoDocumento[];validadeDias:string;data:string
}
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function OrcamentoDocumentoPreview({dados,fechar}:{dados:OrcamentoDocumento;fechar:()=>void}){
  const logo=dados.empresa?.logoUrl?.startsWith('https://')?dados.empresa.logoUrl:LOGOTIPO_PDF_FUNDO_CLARO
  const nomeEmpresa=dados.empresa?.nome||'Esquadrifácio Soluções em Alumínio'
  const linhas=[
    ...dados.tipologias.map(t=>({tipo:'tipologia' as const,id:t.id,t})),
    ...dados.produtos.map(p=>({tipo:'produto' as const,id:p.id,p}))
  ]
  const paginas:(typeof linhas)[]=[]
  for(let i=0;i<linhas.length;i+=4)paginas.push(linhas.slice(i,i+4))
  if(!paginas.length)paginas.push([])
  return <div role="dialog" aria-modal="true" aria-label="Prévia do orçamento para impressão" className="fixed inset-0 z-[160] overflow-y-auto bg-slate-950/70 p-3 sm:p-5">
    <style jsx global>{'@media print { @page { size:A4 portrait; margin:0; } html,body{margin:0!important;padding:0!important;background:white!important;} body * { visibility:hidden!important; } .orcamento-meia-folha,.orcamento-meia-folha * { visibility:visible!important; } .orcamento-meia-folha {position:relative!important; width:210mm!important;min-height:148.5mm!important;box-sizing:border-box!important;margin:0!important;padding:7mm 11mm!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;break-after:page!important;page-break-after:always!important;} .orcamento-controles {display:none!important;} .orcamento-meia-folha tr {break-inside:avoid!important;} .orcamento-meia-folha img {max-width:55mm!important;} }'}</style>
    <div className="mx-auto max-w-[930px]">
      <div className="orcamento-controles mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
        <div><h2 className="text-sm font-black">Orçamento · Prévia de impressão</h2><p className="mt-1 text-xs text-slate-500">Formato compacto de meia folha A4 por via; páginas adicionais se necessário.</p></div>
        <div className="flex gap-2"><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white"><Printer size={16}/> Imprimir / Salvar PDF</button><button type="button" aria-label="Fechar" onClick={fechar} className="rounded-lg border p-2"><X size={17}/></button></div>
      </div>
      {paginas.map((pagina,idx)=><article key={idx} className="orcamento-meia-folha mb-4 min-h-[520px] rounded-xl bg-white p-6 text-slate-900 shadow-xl sm:p-8">
        <header className="flex justify-between gap-4 border-b-2 border-slate-700 pb-2">
          <div className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Logotipo original da Esquadrifácio" className="max-h-[43px] max-w-[240px] object-contain object-left"/>
            <h3 className="mt-1 text-[11px] font-black">{nomeEmpresa}</h3>
            <p className="text-[10px] text-slate-600">{[dados.empresa?.endereco,dados.empresa?.cidadeUf].filter(Boolean).join(' · ')}</p>
            <p className="text-[10px] text-slate-600">{[dados.empresa?.cnpj?'CNPJ '+dados.empresa.cnpj:null,dados.empresa?.tel?'Tel. '+dados.empresa.tel:null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="shrink-0 text-right"><h1 className="text-base font-black uppercase">Orçamento</h1><p className="text-[10px]">{dados.data}</p><p className="mt-1 text-[10px] font-bold text-amber-700">SIMULAÇÃO · NÃO ENVIADO</p>{paginas.length>1&&<p className="text-[10px]">Via {idx+1}/{paginas.length}</p>}</div>
        </header>
        <section className="mt-3 flex justify-between border-b pb-2 text-xs"><p><span className="text-slate-500">Cliente: </span><b>{dados.cliente||'Cliente a identificar'}</b></p><p><span className="text-slate-500">Validade: </span><b>{dados.validadeDias||'A definir'} dias</b></p></section>
        <table className="mt-3 w-full table-fixed border-collapse text-left text-[10px]">
          <thead className="border-b bg-slate-50"><tr><th className="w-[64%] py-2">Item / descrição / referência</th><th className="w-[8%] text-right">Qtd.</th><th className="w-[14%] text-right">Unitário</th><th className="w-[14%] text-right">Valor</th></tr></thead>
          <tbody>{pagina.map(item=><tr key={item.id} className="border-b align-top">
            {item.tipo==='tipologia'?<>
              <td className="py-2 pr-3"><div className="flex items-start gap-2">
                {item.t.imagem&&<img src={item.t.imagem} alt={'Foto cadastrada da tipologia '+item.t.nome} className="h-12 w-12 shrink-0 object-contain" loading="lazy"/>}
                <div className="min-w-0"><b>{item.t.nome}</b><p className="mt-1 text-slate-600">{item.t.largura} × {item.t.altura} mm · {item.t.linha||'Linha a definir'} · {item.t.cor||'Cor a definir'}</p><p className="text-slate-600">Vidro: {item.t.vidro||'A definir'} · Contramarco: {item.t.contramarco}</p>
                {item.t.variaveis.length>0&&<p className="mt-1 text-slate-500">{item.t.variaveis.map(v=>v.nome+': '+v.valor).join(' · ')}</p>}
                <p className="mt-1 text-[10px] font-semibold text-amber-700">{item.t.imagem?'Foto original da tipologia · custo a calcular':'Sem croqui cadastrado · custo a calcular'}</p></div></div>
              </td><td className="py-2 text-right">{item.t.quantidade}</td><td className="py-2 text-right text-amber-700">A calcular</td><td className="py-2 text-right font-semibold text-amber-700">Pendente</td>
            </>:<>
              <td className="py-2 pr-3">
                <div className="flex gap-2">
                  {item.p.imagem&&<img src={item.p.imagem} alt={'Imagem cadastrada de '+item.p.nome} className="h-12 w-12 shrink-0 object-contain" loading="lazy"/>}
                  <div><b>{item.p.nome}</b><p className="text-slate-500">{item.p.codigo||'Sem código'} · {item.p.unidade}</p>{item.p.descricao&&<p className="text-slate-600">{item.p.descricao}</p>}</div>
                </div>
              </td><td className="py-2 text-right">{item.p.quantidade}</td><td className="py-2 text-right">{item.p.preco!=null?moeda(item.p.preco):'A precificar'}</td><td className="py-2 text-right font-semibold">{item.p.preco!=null?moeda(item.p.preco*item.p.quantidade):'Pendente'}</td>
            </>}
          </tr>)}</tbody>
        </table>
        {idx===paginas.length-1&&<div className="mt-4 grid grid-cols-2 gap-4 text-[10px]">
          <section className="rounded-md border p-3"><b>Condições de pagamento propostas</b>{dados.condicoes.filter(c=>c.forma).map((c,i)=><p key={i} className="mt-1">{c.forma}{c.valor?' · '+c.valor:''}</p>)}<p className="mt-2 text-slate-500">Orçamento sem recebimento registrado.</p></section>
          <section className="rounded-md border p-3"><div className="flex justify-between"><span>Produtos com valor</span><b>{moeda(dados.subtotal)}</b></div><div className="mt-1 flex justify-between"><span>Desconto nos produtos</span><b>- {moeda(dados.desconto)}</b></div><div className="mt-2 flex justify-between border-t pt-1 font-black"><span>Subtotal ajustado</span><b>{moeda(dados.totalProdutos)}</b></div>{dados.temPendencias&&<p className="mt-2 font-semibold text-amber-700">TOTAL GERAL PENDENTE DE PRECIFICAÇÃO</p>}</section>
        </div>}
        {idx===paginas.length-1&&<div className="mt-8 grid grid-cols-2 gap-8 text-center text-[10px]"><div className="border-t pt-1">Aceite / assinatura do cliente</div><div className="border-t pt-1">Esquadrifácio</div></div>}
        <footer className="mt-4 border-t pt-2 text-center text-[9px] font-bold uppercase text-amber-800">Prévia não fiscal e sem validade comercial. Fórmulas, custos e valores pendentes exigem validação.</footer>
      </article>)}
    </div>
  </div>
}
