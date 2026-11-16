'use client'

import { useMemo } from 'react'
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
  condicoes:CondicaoDocumento[];validadeDias:string;data:string;
  referencia:string;observacoes:string
}
type LinhaDocumento=
  |{tipo:'tipologia';id:string;t:TipologiaDocumento}
  |{tipo:'produto';id:string;p:ProdutoDocumento}
type PaginaDocumento={itens:LinhaDocumento[]}

const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const estimarLinha=(item:LinhaDocumento)=>{
  if(item.tipo==='tipologia')return 94+Math.min(45,item.t.variaveis.map(x=>x.nome.length+x.valor.length).reduce((s,v)=>s+v,0)/3)
  return Math.max(61,41+Math.ceil(item.p.nome.length/65)*11+Math.ceil((item.p.descricao||'').length/110)*10)
}

/** Paginação por orçamento no tamanho A5 paisagem, metade de A4.
 * Reserva espaço para o cabeçalho somente na primeira página e para o
 * encerramento somente na última. Não corta linhas de produtos de propósito.
 */
function paginar(dados:OrcamentoDocumento):PaginaDocumento[]{
  const todos:LinhaDocumento[]=[
    ...dados.tipologias.map(t=>({tipo:'tipologia' as const,id:'t:'+t.id,t})),
    ...dados.produtos.map(p=>({tipo:'produto' as const,id:'p:'+p.id,p}))
  ]
  const paginas:PaginaDocumento[]=[]
  let indice=0
  do{
    const limite=paginas.length===0?276:405
    let alturaUsada=0
    const itens:LinhaDocumento[]=[]
    while(indice<todos.length){
      const item=todos[indice]
      const altura=estimarLinha(item)
      if(itens.length&&alturaUsada+altura>limite)break
      itens.push(item);alturaUsada+=altura;indice++
    }
    paginas.push({itens})
  }while(indice<todos.length)
  const observacaoLinhas=dados.observacoes.trim()
    ?Math.ceil(dados.observacoes.trim().length/105)
    :0
  const fechamento=171+Math.max(0,dados.condicoes.filter(c=>c.forma).length-1)*13+
    (observacaoLinhas?32+Math.min(observacaoLinhas,7)*12:0)+
    (dados.temPendencias?22:0)
  const ultima=paginas[paginas.length-1]
  const limiteUltima=paginas.length===1?276:405
  const pesoUltima=ultima.itens.reduce((s,item)=>s+estimarLinha(item),0)
  if(pesoUltima+fechamento>limiteUltima){
    // Se couber, a última linha acompanha o encerramento na próxima página.
    // Caso contrário, o encerramento ocupa uma folha de continuação só sua.
    const ultimoItem=ultima.itens[ultima.itens.length-1]
    if(ultima.itens.length>1&&ultimoItem&&estimarLinha(ultimoItem)+fechamento<=405){
      ultima.itens.pop()
      paginas.push({itens:[ultimoItem]})
    }else{
      paginas.push({itens:[]})
    }
  }
  return paginas
}

export default function OrcamentoDocumentoPreview({dados,fechar}:{dados:OrcamentoDocumento;fechar:()=>void}){
  const paginas=useMemo(()=>paginar(dados),[dados])
  const logo=dados.empresa?.logoUrl?.startsWith('https://')?dados.empresa.logoUrl:LOGOTIPO_PDF_FUNDO_CLARO
  const nomeEmpresa=dados.empresa?.nome||'Esquadrifácio Soluções em Alumínio'
  const numero=dados.referencia||'SIMULAÇÃO'
  const obs=dados.observacoes.trim()
  return <div role="dialog" aria-modal="true" aria-label="Prévia do orçamento para impressão" className="fixed inset-0 z-[160] overflow-y-auto bg-slate-950/70 p-3 sm:p-5">
    <style jsx global>{'@media print { @page {size:A5 landscape; margin:0;} html,body{margin:0!important;padding:0!important;background:white!important;} body *{visibility:hidden!important;} .orcamento-pagina,.orcamento-pagina *{visibility:visible!important;} .orcamento-pagina{position:relative!important;box-sizing:border-box!important;width:210mm!important;min-width:210mm!important;height:148.5mm!important;min-height:148.5mm!important;max-height:148.5mm!important;overflow:hidden!important;margin:0!important;padding:6mm 9mm!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:white!important;break-after:page!important;page-break-after:always!important;} .orcamento-pagina:last-of-type{break-after:auto!important;page-break-after:auto!important;} .orcamento-controles{display:none!important;} .orcamento-pagina tr,.orcamento-pagina section{break-inside:avoid!important;} .orcamento-pagina img{max-width:50mm!important;} .orcamento-final{break-inside:avoid!important;} }'}</style>
    <div className="mx-auto max-w-[850px]">
      <div className="orcamento-controles mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
        <div><h2 className="text-sm font-black">Orçamento — Prévia de impressão</h2><p className="mt-1 text-xs text-slate-500">Meia folha A4 (A5 paisagem), com continuação automática e fechamento apenas na última página.</p></div>
        <div className="flex gap-2"><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white"><Printer size={16}/> Imprimir / Salvar PDF</button><button type="button" aria-label="Fechar" onClick={fechar} className="rounded-lg border p-2"><X size={17}/></button></div>
      </div>
      {paginas.map((pagina,idx)=>{
        const primeira=idx===0
        const ultima=idx===paginas.length-1
        return <article key={idx} className="orcamento-pagina mb-4 flex min-h-[561px] flex-col overflow-hidden rounded-xl bg-white p-6 text-slate-900 shadow-xl sm:p-7">
          {primeira?
            <header className="flex justify-between gap-4 border-b-2 border-slate-700 pb-2">
              <div className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Logotipo original da Esquadrifácio" className="max-h-[38px] max-w-[210px] object-contain object-left"/>
                <h3 className="mt-1 text-[11px] font-black">{nomeEmpresa}</h3>
                <p className="text-[10px] text-slate-600">{[dados.empresa?.endereco,dados.empresa?.cidadeUf,dados.empresa?.cep?'CEP '+dados.empresa.cep:null].filter(Boolean).join(' · ')}</p>
                <p className="text-[10px] text-slate-600">{[dados.empresa?.cnpj?'CNPJ '+dados.empresa.cnpj:null,dados.empresa?.tel?'Tel. '+dados.empresa.tel:null,dados.empresa?.email].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="shrink-0 text-right">
                <h1 className="text-base font-black uppercase">Orçamento</h1>
                <p className="text-[10px] font-black">Nº {numero}</p>
                <p className="text-[10px]">{dados.data} · Página {idx+1} de {paginas.length}</p>
                <p className="mt-1 text-[9px] font-bold text-amber-700">PRÉVIA · NÃO EMITIDO</p>
              </div>
            </header>:
            <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-2 text-[10px]">
              <b>Continuação do orçamento nº {numero}</b>
              <span className="font-bold">Página {idx+1} de {paginas.length}</span>
            </div>}
          {primeira&&<section className="mt-2 flex justify-between border-b pb-2 text-[11px]">
            <p><span className="text-slate-500">Cliente: </span><b>{dados.cliente||'Cliente a identificar'}</b></p>
            <p><span className="text-slate-500">Validade: </span><b>{dados.validadeDias?dados.validadeDias+' dias':'A definir'}</b></p>
          </section>}
          {pagina.itens.length>0&&<table className="mt-3 w-full table-fixed border-collapse text-left text-[10px]">
            <thead className="border-b bg-slate-50">
              <tr><th className="w-[61%] py-1.5">Produto / descrição / referência</th><th className="w-[9%] text-right">Qtd.</th><th className="w-[15%] text-right">Unit.</th><th className="w-[15%] text-right">Total</th></tr>
            </thead>
            <tbody>{pagina.itens.map(item=><tr key={item.id} className="border-b align-top">
              {item.tipo==='tipologia'?<>
                <td className="py-2 pr-3"><div className="flex gap-2">
                  {item.t.imagem&&<img src={item.t.imagem} alt={'Foto cadastrada da tipologia '+item.t.nome} className="h-11 w-11 shrink-0 object-contain" loading="lazy"/>}
                  <div className="min-w-0"><b>{item.t.nome}</b><p className="text-slate-600">{item.t.largura} × {item.t.altura} mm · {item.t.linha||'Linha a definir'} · {item.t.cor||'Cor a definir'}</p>
                    <p className="text-slate-600">Vidro: {item.t.vidro||'A definir'} · Contramarco: {item.t.contramarco}</p>
                    {item.t.variaveis.length>0&&<p className="text-slate-500">{item.t.variaveis.map(v=>v.nome+': '+v.valor).join(' · ')}</p>}
                  </div>
                </div></td><td className="py-2 text-right">{item.t.quantidade}</td><td className="py-2 text-right text-amber-700">Pendente</td><td className="py-2 text-right font-semibold text-amber-700">A calcular</td>
              </>:<>
                <td className="py-2 pr-3"><div className="flex gap-2">
                  {item.p.imagem&&<img src={item.p.imagem} alt={'Foto cadastrada de '+item.p.nome} className="h-11 w-11 shrink-0 object-contain" loading="lazy"/>}
                  <div className="min-w-0"><b>{item.p.nome}</b><p className="text-slate-500">{item.p.codigo||'Sem código'} · {item.p.unidade}</p>{item.p.descricao&&<p className="text-slate-600">{item.p.descricao}</p>}</div>
                </div></td>
                <td className="py-2 text-right">{item.p.quantidade}</td>
                <td className="py-2 text-right">{item.p.preco!=null?moeda(item.p.preco):'A precificar'}</td>
                <td className="py-2 text-right font-semibold">{item.p.preco!=null?moeda(item.p.preco*item.p.quantidade):'Pendente'}</td>
              </>}
            </tr>)}</tbody>
          </table>}
          {ultima&&<div className="orcamento-final mt-3 space-y-2 text-[10px]">
            <div className="grid grid-cols-2 gap-3">
              <section className="rounded-md border p-2">
                <b>Condições de pagamento</b>
                {dados.condicoes.filter(c=>c.forma).map((c,i)=><p key={i} className="mt-1">{c.forma}{c.valor?' · '+c.valor:''}</p>)}
                <p className="mt-1 text-slate-500">Sem recebimento registrado.</p>
              </section>
              <section className="rounded-md border p-2">
                <div className="flex justify-between gap-2"><span>Subtotal dos produtos</span><b>{moeda(dados.subtotal)}</b></div>
                <div className="mt-1 flex justify-between gap-2"><span>Desconto</span><b>- {moeda(dados.desconto)}</b></div>
                <div className="mt-1 flex justify-between gap-2 border-t pt-1 font-black"><span>{dados.temPendencias?'Subtotal conhecido':'Total do orçamento'}</span><b>{moeda(dados.totalProdutos)}</b></div>
                {dados.temPendencias&&<p className="mt-1 font-semibold text-amber-700">TOTAL GERAL PENDENTE</p>}
              </section>
            </div>
            {obs&&<section className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
              <b className="block">Observações</b><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{obs}</p>
            </section>}
            <div className="grid grid-cols-2 gap-8 pt-5 text-center">
              <div className="border-t border-slate-400 pt-1">Assinatura do cliente</div>
              <div className="border-t border-slate-400 pt-1">Esquadrifácio</div>
            </div>
          </div>}
          <footer className="mt-auto border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold text-amber-800">
            Prévia nº {numero} · Página {idx+1} de {paginas.length}
            {ultima?' · Documento não fiscal e não enviado': ' · Continuação na página seguinte'}
            {ultima&&dados.temPendencias?' · Valores sujeitos à precificação':''}
          </footer>
        </article>
      })}
    </div>
  </div>
}
