'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { LOGOTIPO_PDF_FUNDO_CLARO } from '@/lib/brandingRelatorios'
import type { EmpresaRecibo } from '@/components/previews/ReciboVendaPreview'
import { resumoPagamentoOrcamento, valorEmCentavos, reais, type DestinoSaldoOrcamento } from '@/lib/previews/pagamentoOrcamento'

export type ProdutoDocumento={id:string;codigo:string;nome:string;descricao:string;unidade:string;quantidade:number;preco:number|null;imagem:string|null}
export type TipologiaDocumento={
  id:string;nome:string;linha:string;largura:string;altura:string;quantidade:number;cor:string;vidro:string;
  contramarco:string;variaveis:{nome:string;valor:string}[];imagem?:string|null
}
export type CondicaoDocumento={forma:string;valor:string}
export type OrcamentoDocumento={
  cliente:string;empresa:EmpresaRecibo|null;tipologias:TipologiaDocumento[];produtos:ProdutoDocumento[];
  subtotal:number;desconto:number;totalProdutos:number;temPendencias:boolean;
  condicoes:CondicaoDocumento[];validadeDias:string;data:string;referencia:string;observacoes:string;
  clienteDocumento?:string;clienteTelefone?:string;enderecoCliente?:string;
  obraNome?:string;enderecoEntrega?:string;vendedorNome?:string;
  destinoSaldo?:DestinoSaldoOrcamento
}
type ItemDocumento={tipo:'tipologia';id:string;t:TipologiaDocumento}|{tipo:'produto';id:string;p:ProdutoDocumento}
type Pagina={itens:ItemDocumento[]}
type Precos='com_unitario'|'so_total'

const moeda=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const urlValida=(v?:string|null)=>!!v&&(/^https:\/\//i.test(v.trim())||v.startsWith('/')&&!v.startsWith('//'))
function Foto({url,nome,logo=false}:{url?:string|null;nome:string;logo?:boolean}){
  const [falhou,setFalhou]=useState(false)
  useEffect(()=>setFalhou(false),[url])
  if(!urlValida(url)||falhou)return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url!} alt={nome} loading="eager" onError={()=>setFalhou(true)}
    className={logo?'oc-logo':'oc-foto'}/>
}
/** Estimativas em mm alinhadas às fotos e linhas compactas do CSS.
 * Os textos continuam completos: somente espaçamento e tipografia são reduzidos.
 */
function itemAltura(item:ItemDocumento,precos:Precos){
  const caracteres=precos==='so_total'?115:100
  if(item.tipo==='tipologia'){
    const vars=item.t.variaveis.map(x=>x.nome+': '+x.valor).join(' · ')
    return Math.max(item.t.imagem?10.6:8,6.4+
      Math.max(1,Math.ceil(item.t.nome.length/caracteres))*2.15+
      Math.max(1,Math.ceil(vars.length/135))*2)
  }
  return Math.max(item.p.imagem?10.6:7.5,6.3+
    Math.max(1,Math.ceil(item.p.nome.length/caracteres))*2.1+
    (item.p.descricao?Math.ceil(item.p.descricao.length/140)*1.85:0))
}
function fechamentoAltura(d:OrcamentoDocumento){
  const cond=d.condicoes.filter(c=>c.forma)
  const observacao=d.observacoes.trim()
  const linhas=observacao.split('\n').reduce((sum,x)=>sum+Math.max(1,Math.ceil(x.length/125)),0)
  return Math.max(19,14+cond.length*2.6)+12+
    (observacao?3.5+linhas*2.5:0)+(d.temPendencias?3:0)
}
/** Prioriza mais produtos em cada metade A4, guardando o fechamento só para o final. */
function paginar(d:OrcamentoDocumento,precos:Precos):Pagina[]{
  const itens:ItemDocumento[]=[
    ...d.tipologias.map(t=>({tipo:'tipologia' as const,id:'t:'+t.id,t})),
    ...d.produtos.map(p=>({tipo:'produto' as const,id:'p:'+p.id,p}))
  ]
  if(!itens.length)return [{itens:[]}]
  const fim=fechamentoAltura(d),paginas:Pagina[]=[]
  let index=0
  while(index<itens.length){
    const detalhes=(d.enderecoCliente?3:0)+(d.enderecoEntrega?3:0)+(d.vendedorNome?2:0)
    const capacidade=paginas.length?128:Math.max(90,104-detalhes)
    const sobrando=itens.slice(index).reduce((a,item)=>a+itemAltura(item,precos),0)
    if(sobrando+fim<=capacidade){paginas.push({itens:itens.slice(index)});break}
    const inicio=index
    let ocupacao=0
    while(index<itens.length){
      const h=itemAltura(itens[index],precos)
      if(index>inicio&&ocupacao+h>capacidade)break
      ocupacao+=h;index++
    }
    if(index===itens.length&&ocupacao+fim>capacidade&&index-inicio>1)index--
    paginas.push({itens:itens.slice(inicio,index)})
  }
  const ultima=paginas[paginas.length-1]
  const detalhes=(d.enderecoCliente?3:0)+(d.enderecoEntrega?3:0)+(d.vendedorNome?2:0)
  const capacidade=paginas.length===1?Math.max(90,104-detalhes):128
  const usado=ultima.itens.reduce((v,item)=>v+itemAltura(item,precos),0)
  if(usado+fim>capacidade){
    if(ultima.itens.length>1){
      const removido=ultima.itens.pop()!
      paginas.push({itens:[removido]})
      // Encerramento em continuação só quando realmente não cabe junto a um item.
      if(itemAltura(removido,precos)+fim>128)paginas.push({itens:[]})
    }else paginas.push({itens:[]})
  }
  return paginas
}

/** A4 vertical: 2 blocos. Folga de 1 mm evita página extra em Safari/WebKit. */
const css='\
.oc-folha{box-sizing:border-box;width:210mm;height:auto;margin:0 auto 15px;background:white;display:flex;flex-direction:column;box-shadow:0 12px 30px #0003;overflow:hidden}\
.oc-metade{box-sizing:border-box;width:210mm;height:148mm;flex:0 0 148mm;overflow:hidden;padding:4mm 9mm;display:flex;flex-direction:column;background:white;color:#182334;font:7.4pt/1.15 Arial,Helvetica,sans-serif}\
.oc-metade+.oc-metade{border-top:1px dashed #cbd5e1}\
.oc-header{display:flex;justify-content:space-between;gap:4mm;border-bottom:1px solid #334155;padding-bottom:1mm}\
.oc-header h3{font-size:7.5pt;font-weight:800;margin:.3mm 0 .2mm}.oc-header p{font-size:6.8pt;line-height:1.1;margin:0;color:#475569}\
.oc-logo{display:block;max-width:42mm;height:8mm;width:auto;object-fit:contain;object-position:left center}\
.oc-titulo{text-align:right;flex-shrink:0}.oc-titulo h1{font-size:12pt;font-weight:800;margin:0 0 .5mm}.oc-titulo b{font-size:8pt}.oc-titulo p{font-size:6.9pt;margin:.4mm 0}\
.oc-continua{display:flex;justify-content:space-between;gap:3mm;font-size:7.5pt;font-weight:700;border-bottom:1px solid #cbd5e1;padding-bottom:1.5mm}\
.oc-cliente{display:block;border-bottom:1px solid #e2e8f0;padding:1mm 0;font-size:7.1pt;line-height:1.12}\
.oc-cliente p{margin:.35mm 0;overflow-wrap:anywhere}\
.oc-cliente-linha{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:5mm}\
.oc-cliente-direita{text-align:right;min-width:30mm}\
.oc-cliente-direita p{margin:.5mm 0;white-space:nowrap}\
.oc-tabela{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left;margin-top:1mm;font-size:7.3pt}\
.oc-tabela th{font-size:6.8pt;background:#f3f5f7;padding:.8mm .7mm;border-bottom:1px solid #cbd5e1}\
.oc-tabela td{padding:.6mm .7mm;vertical-align:middle;border-bottom:1px solid #e2e8f0}\
.oc-direita{text-align:right;white-space:nowrap}.oc-item{display:flex;gap:1.5mm;min-width:0;align-items:flex-start}\
.oc-foto{display:block;flex:0 0 9.5mm;width:9.5mm;height:9.5mm;object-fit:contain}\
.oc-item-texto{min-width:0;overflow-wrap:anywhere}.oc-item-texto b{font-size:7.1pt;line-height:1.1}.oc-item-texto p{font-size:6.7pt;color:#64748b;margin:.3mm 0 0;line-height:1.1}\
.oc-final{margin-top:1.6mm;font-size:7pt;break-inside:avoid}.oc-final-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm}\
.oc-quadro{border:1px solid #cbd5e1;border-radius:1.5mm;padding:1.3mm;min-width:0}.oc-quadro p{margin:.5mm 0 0;overflow-wrap:anywhere}\
.oc-total-linha{display:flex;justify-content:space-between;gap:2mm;margin-bottom:.8mm}.oc-total{border-top:1px solid #94a3b8;margin-top:1mm;padding-top:1mm;font-weight:800;font-size:8pt}\
.oc-observacoes{border:1px solid #cbd5e1;border-radius:1mm;padding:1.8mm 2mm;margin-top:2mm;overflow-wrap:anywhere}\
.oc-observacoes p{margin:.6mm 0 0;white-space:pre-wrap}\
.oc-assinaturas{display:flex;justify-content:center;text-align:center;font-size:6.9pt;margin-top:4mm}\
.oc-assinaturas span{display:block;width:53%;border-top:1px solid #94a3b8;padding-top:.8mm}\
\
@media screen and (max-width:840px){.oc-visual{overflow-x:auto}.oc-folha{margin-left:0;margin-right:0}}\
@media print{\
@page{size:A4 portrait;margin:7mm 7mm}\
html,body{width:auto!important;height:auto!important;margin:0!important;padding:0!important;background:white!important}\
body > :not(#orcamento-portal){display:none!important}\
#orcamento-portal{display:block!important;position:static!important;width:196mm!important;height:auto!important;margin:0!important;padding:0!important}\
.oc-dialog{position:static!important;inset:auto!important;display:block!important;overflow:visible!important;background:white!important;padding:0!important}\
.oc-visual{width:196mm!important;max-width:none!important;overflow:visible!important;margin:0!important;padding:0!important}\
.oc-controles{display:none!important}\
.oc-folha{width:196mm!important;min-width:196mm!important;max-width:196mm!important;height:auto!important;min-height:0!important;max-height:none!important;box-shadow:none!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;display:block!important;break-after:page!important;page-break-after:always!important}\
.oc-folha:last-child{break-after:auto!important;page-break-after:auto!important}\
.oc-metade{box-sizing:border-box!important;width:196mm!important;height:auto!important;min-height:0!important;max-height:none!important;flex:none!important;padding:3mm 5mm!important;overflow:visible!important;break-inside:avoid!important;page-break-inside:avoid!important}\
.oc-folha-dupla .oc-metade{height:137mm!important;min-height:137mm!important;max-height:137mm!important;overflow:hidden!important}\
.oc-folha-unica .oc-metade{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}\
.oc-metade+.oc-metade{border-top:none!important}\
.oc-tabela tr,.oc-final{break-inside:avoid!important;page-break-inside:avoid!important}\
.oc-foto,.oc-logo{-webkit-print-color-adjust:exact;print-color-adjust:exact}\
}';

export default function OrcamentoDocumentoPreview({dados,fechar}:{dados:OrcamentoDocumento;fechar:()=>void}){
  const [precos,setPrecos]=useState<Precos>('com_unitario')
  const [portal,setPortal]=useState<HTMLElement|null>(null)
  useEffect(()=>{
    const host=document.createElement('div')
    host.id='orcamento-portal'
    document.body.appendChild(host)
    setPortal(host)
    return()=>{document.body.removeChild(host)}
  },[])
  const paginas=useMemo(()=>paginar(dados,precos),[dados,precos])
  const folhas=useMemo(()=>{
    const resultado:Pagina[][]=[]
    for(let i=0;i<paginas.length;i+=2)resultado.push(paginas.slice(i,i+2))
    return resultado
  },[paginas])
  const logo=urlValida(dados.empresa?.logoUrl)?dados.empresa!.logoUrl:LOGOTIPO_PDF_FUNDO_CLARO
  const nome=dados.empresa?.nome||'Esquadrifácio Soluções em Alumínio'
  const numero=dados.referencia||'SIMULAÇÃO'
  const obs=dados.observacoes.trim()
  const distribuicao=resumoPagamentoOrcamento(dados.totalProdutos,dados.condicoes)
  const saldoCliente=dados.destinoSaldo==='cliente'&&distribuicao.saldoCentavos>0
  if(!portal)return null
  return createPortal(<div role="dialog" aria-modal="true" aria-label="Prévia de impressão do orçamento"
    className="oc-dialog fixed inset-0 z-[160] overflow-y-auto bg-slate-950/70 p-3 sm:p-5">
    <style jsx global>{css}</style>
    <div className="oc-visual mx-auto max-w-[850px]">
      <section className="oc-controles mb-4 space-y-3 rounded-xl bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-black">Orçamento · Preparar impressão</h2>
            <p className="mt-1 text-xs text-slate-500">Papel A4 vertical, duas meias folhas por A4. {paginas.length} metade(s) em {folhas.length} folha(s) A4.</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white"><Printer size={16}/> Imprimir / Salvar PDF</button>
            <button type="button" aria-label="Fechar" onClick={fechar} className="rounded-lg border p-2"><X size={17}/></button>
          </div>
        </div>
        <fieldset className="flex flex-wrap items-center gap-2 border-t pt-3">
          <legend className="mb-1 text-xs font-bold">Preços que devem aparecer na impressão</legend>
          <button type="button" aria-pressed={precos==='com_unitario'} onClick={()=>setPrecos('com_unitario')}
            className={'rounded-lg border px-4 py-2 text-xs font-bold '+(precos==='com_unitario'?'border-indigo-700 bg-indigo-700 text-white':'bg-white')}>Unitário e total</button>
          <button type="button" aria-pressed={precos==='so_total'} onClick={()=>setPrecos('so_total')}
            className={'rounded-lg border px-4 py-2 text-xs font-bold '+(precos==='so_total'?'border-indigo-700 bg-indigo-700 text-white':'bg-white')}>Sem preços nos itens</button>
          <p className="w-full text-[11px] text-slate-500">Na opção sem preços nos itens, cada linha mostra R$ 0,00; o valor total do orçamento permanece correto. Na impressão, mantenha A4, vertical e escala de 100%.</p>
        </fieldset>
      </section>
      {folhas.map((metades,folhaIndex)=><section key={folhaIndex} className={'oc-folha '+(metades.length===2?'oc-folha-dupla':'oc-folha-unica')} aria-label={'Folha A4 '+(folhaIndex+1)}>
        {metades.map((pagina,metadeIndex)=>{
          const index=folhaIndex*2+metadeIndex,primeira=index===0,ultima=index===paginas.length-1
          const unit=precos==='com_unitario'
          return <article key={index} className="oc-metade" aria-label={'Metade '+(index+1)+' de '+paginas.length}>
            {primeira?<header className="oc-header">
              <div className="min-w-0 flex-1">
                <Foto url={logo} nome="Logotipo original da Esquadrifácio" logo/>
                <h3>{nome}</h3>
                <p>{[dados.empresa?.endereco,dados.empresa?.cidadeUf,dados.empresa?.cep?'CEP '+dados.empresa.cep:null].filter(Boolean).join(' · ')}</p>
                <p>{[dados.empresa?.cnpj?'CNPJ '+dados.empresa.cnpj:null,dados.empresa?.tel?'Tel. '+dados.empresa.tel:null,dados.empresa?.email].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="oc-titulo">
                <h1>ORÇAMENTO</h1><b>Nº {numero}</b>
                <p>Data e hora: {dados.data}</p><p>Página {index+1} de {paginas.length}</p>
                <p className="font-bold text-amber-700">SIMULAÇÃO · NÃO EMITIDO</p>
              </div>
            </header>:<header className="oc-continua">
              <b>Continuação do orçamento nº {numero}</b><span>Página {index+1} de {paginas.length}</span>
            </header>}
            {primeira&&<section className="oc-cliente">
              <div className="oc-cliente-linha">
                <div>
                  <p><b>Cliente:</b> {dados.cliente||'Cliente a identificar'}</p>
                  {dados.clienteDocumento&&<p><b>CPF/CNPJ:</b> {dados.clienteDocumento}</p>}
                  {dados.clienteTelefone&&<p><b>Contato:</b> {dados.clienteTelefone}</p>}
                </div>
                <div className="oc-cliente-direita">
                  <p><b>Validade:</b> {dados.validadeDias?dados.validadeDias+' dias':'A definir'}</p>
                  <p><b>Vendedor:</b> {dados.vendedorNome||'Não informado'}</p>
                </div>
              </div>
              {dados.enderecoCliente&&<p><b>Endereço do cliente:</b> {dados.enderecoCliente}</p>}
              {(dados.enderecoEntrega||dados.obraNome)&&<p>
                <b>{dados.obraNome?'Obra / entrega:':'Local da entrega:'}</b> {dados.obraNome&&dados.obraNome+' · '}{dados.enderecoEntrega||'A definir'}
              </p>}
            </section>}
            {pagina.itens.length>0&&<table className="oc-tabela">
              <thead><tr>
                <th style={{width:unit?'60%':'74%'}}>Produto / descrição / referência</th>
                <th className="oc-direita" style={{width:unit?'8%':'9%'}}>Qtd.</th>
                {unit&&<th className="oc-direita" style={{width:'16%'}}>Unitário</th>}
                <th className="oc-direita" style={{width:unit?'16%':'17%'}}>Preço total</th>
              </tr></thead>
              <tbody>{pagina.itens.map(item=><tr key={item.id}>
                {item.tipo==='tipologia'?<>
                  <td><div className="oc-item"><Foto url={item.t.imagem} nome={'Imagem cadastrada de '+item.t.nome}/><div className="oc-item-texto">
                    <b>{item.t.nome}</b>
                    <p>{item.t.largura} × {item.t.altura} mm · {item.t.linha||'Linha a definir'} · {item.t.cor||'Cor a definir'}</p>
                    <p>Vidro: {item.t.vidro||'A definir'} · Contramarco: {item.t.contramarco}</p>
                    {item.t.variaveis.length>0&&<p>{item.t.variaveis.map(v=>v.nome+': '+v.valor).join(' · ')}</p>}
                  </div></div></td>
                  <td className="oc-direita">{item.t.quantidade}</td>
                  {unit&&<td className="oc-direita font-bold text-amber-700">Pendente</td>}
                  <td className="oc-direita font-bold text-amber-700">{unit?'A calcular':moeda(0)}</td>
                </>:<>
                  <td><div className="oc-item"><Foto url={item.p.imagem} nome={'Imagem cadastrada de '+item.p.nome}/><div className="oc-item-texto">
                    <b>{item.p.nome}</b><p>{item.p.codigo||'Sem código'} · {item.p.unidade}</p>
                    {item.p.descricao&&<p>{item.p.descricao}</p>}
                  </div></div></td>
                  <td className="oc-direita">{item.p.quantidade}</td>
                  {unit&&<td className="oc-direita">{item.p.preco!=null?moeda(item.p.preco):'A precificar'}</td>}
                  <td className="oc-direita font-bold">{!unit?moeda(0):item.p.preco!=null?moeda(item.p.preco*item.p.quantidade):'Pendente'}</td>
                </>}
              </tr>)}</tbody>
            </table>}
            {ultima&&<div className="oc-final">
              <div className="oc-final-grid">
                <section className="oc-quadro">
                  <b>Condições de pagamento · {moeda(dados.totalProdutos)}</b>
                  {dados.condicoes.filter(c=>c.forma&&c.valor.trim()).map((c,i)=>{
                    const centavos=valorEmCentavos(c.valor)
                    return <div key={i} className="oc-total-linha">
                      <span>{c.forma}</span>
                      <b>{centavos!=null&&Number.isFinite(centavos)?moeda(reais(centavos)):'A definir'}</b>
                    </div>
                  })}
                  {!distribuicao.temValorInformado&&<p>Pagamento a combinar</p>}
                  <div className="oc-total-linha" style={{borderTop:'1px solid #e2e8f0',paddingTop:'.8mm',marginTop:'.8mm'}}>
                    <span>Pagamentos previstos</span><b>{moeda(reais(distribuicao.valorPrevistoCentavos))}</b>
                  </div>
                  {distribuicao.saldoCentavos>0&&<div className="oc-total-linha">
                    <span>{saldoCliente?'Saldo previsto no cliente':'Saldo a definir'}</span>
                    <b>{moeda(reais(distribuicao.saldoCentavos))}</b>
                  </div>}
                  <p>Condições propostas · sem recebimento nesta simulação.</p>
                </section>
                <section className="oc-quadro">
                  <div className="oc-total-linha"><span>Subtotal</span><b>{moeda(dados.subtotal)}</b></div>
                  <div className="oc-total-linha"><span>Desconto</span><b>- {moeda(dados.desconto)}</b></div>
                  <div className="oc-total-linha oc-total"><span>{dados.temPendencias?'Subtotal conhecido':'Total do orçamento'}</span><b>{moeda(dados.totalProdutos)}</b></div>
                  {dados.temPendencias&&<p className="font-bold text-amber-700">TOTAL GERAL PENDENTE</p>}
                </section>
              </div>
              {obs&&<section className="oc-observacoes"><b>Observações</b><p>{obs}</p></section>}
              <div className="oc-assinaturas"><span>Assinatura do cliente</span></div>
            </div>}
          </article>
        })}
        {/* Não inserir uma meia folha vazia: Safari a transformava em página 2. */}
      </section>)}
    </div>
  </div>,portal)
}
