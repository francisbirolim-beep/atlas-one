'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, FileDown, ImageOff, Loader2, PackageSearch } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { ETAPAS_COTACAO, itensDoCardCotacao, type EtapaCotacao } from '@/lib/cotacaoEtapas'

type Item = {
  material_id:string;status_etapa?:string|null;grupo_card_id?:string|null;
  codigo:string|null;descricao:string;cor:string|null;unidade:string;
  quantidade_tecnica:number;sobra_utilizada:number;quantidade_cotar:number;
  comprimento_corte_mm:number|null;comprimento_barra_mm:number|null;
  imagem_url?:string|null
}
type Lote = {
  id:string;status:string;categoria:string;versao:number;quantidade_itens:number;created_at:string;
  gerado_por_nome:string|null;updated_at:string;itens:Item[]
}
type Contexto = {
  cliente:string|null;obra:string|null;cidade:string|null;
  numero_obra:number|null;numero_orcamento:number|null;responsavel:string|null
}
const nomes:Record<string,string>={perfil:'Perfis',acessorios:'Acessórios',vidro:'Vidros',outros:'Outros'}
const n=(v:number)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const dataBR=(iso:string)=>iso?new Date(iso).toLocaleString('pt-BR'):'—'
const fallback=(v:string|number|null|undefined)=>v===null||v===undefined||String(v).trim()===''?'Não informado':String(v)

export default function ListaCotacaoPage({params}:{params:{id:string}}){
  const [lote,setLote]=useState<Lote|null>(null)
  const [contexto,setContexto]=useState<Contexto|null>(null)
  const [carregando,setCarregando]=useState(true)
  const [imprimindo,setImprimindo]=useState(false)
  const [erro,setErro]=useState('')
  const [erroImpressao,setErroImpressao]=useState('')
  const [vendaId,setVendaId]=useState('')
  const [escopoCard,setEscopoCard]=useState<{etapa:EtapaCotacao;grupoId:string}|null>(null)
  useEffect(()=>{
    const parametros=new URLSearchParams(window.location.search)
    const id=parametros.get('vendaId')||''
    const grupoId=parametros.get('grupoCardId')
    const etapaTexto=parametros.get('etapaCard')
    setVendaId(id)
    let ativo=true
    void (async()=>{
      try{
        const token=await tokenAtual()
        if(!token)throw new Error('Faça login para abrir esta cotação.')
        const r=await fetch('/api/vendas/cotacoes-lotes?vendaId='+encodeURIComponent(id)+'&loteId='+encodeURIComponent(params.id),
          {headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const json=await r.json().catch(()=>({}))
        if(!r.ok)throw new Error(json?.error||'Não foi possível consultar esta cotação.')
        if(!json.lotes?.length)throw new Error('Cotação não encontrada nesta venda.')
        const completo=json.lotes[0] as Lote
        let exibido=completo
        let escopo:null|{etapa:EtapaCotacao;grupoId:string}=null
        if(grupoId!==null||etapaTexto!==null){
          if(!grupoId||!etapaTexto||!ETAPAS_COTACAO.includes(etapaTexto as EtapaCotacao)){
            throw new Error('Link do card inválido. Abra o PDF novamente pelo Kanban de Compras.')
          }
          const etapa=etapaTexto as EtapaCotacao
          const itens=itensDoCardCotacao(completo,etapa,grupoId)
          if(!itens.length){
            throw new Error('Os materiais deste card mudaram de etapa. Volte ao Kanban e abra o PDF novamente.')
          }
          exibido={...completo,itens,quantidade_itens:itens.length}
          escopo={etapa,grupoId}
        }
        if(ativo){setLote(exibido);setEscopoCard(escopo);setContexto((json.contexto||null) as Contexto|null)}
      }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Falha ao abrir cotação.')}
      finally{if(ativo)setCarregando(false)}
    })()
    return ()=>{ativo=false}
  },[params.id])

  async function imprimir(){
    if(!lote)return
    const semDesenho=lote.itens.filter(i=>i.codigo&&!i.imagem_url)
    if(semDesenho.length){
      setErroImpressao('Existem códigos sem desenho no cadastro. Atualize os produtos e abra a cotação novamente antes de imprimir.')
      return
    }
    setImprimindo(true)
    setErroImpressao('')
    try{
      if(document.fonts?.ready)await document.fonts.ready
      const imgs=Array.from(document.querySelectorAll<HTMLImageElement>('img[data-desenho-cotacao]'))
      await Promise.all(imgs.map(img=>img.decode().catch(()=>{})))
      const falhas=imgs.filter(img=>!img.complete||img.naturalWidth===0)
      if(falhas.length){
        setErroImpressao('Há '+falhas.length+' desenho(s) que não carregaram. Confira o acesso às imagens e tente novamente.')
        return
      }
      window.print()
    }finally{setImprimindo(false)}
  }

  if(carregando)return <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin"/>Carregando cotação...</div>
  if(erro||!lote)return <main className="mx-auto max-w-3xl p-8 text-red-700">{erro||'Cotação indisponível.'}</main>

  const pendentes=lote.itens.filter(i=>i.codigo&&!i.imagem_url)
  const codigoPendentes=Array.from(new Set(pendentes.map(i=>i.codigo).filter(Boolean)))

  return <main className="mx-auto min-h-screen max-w-6xl bg-white p-5 text-slate-900 md:p-8 print:max-w-none print:p-0">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <a href="/clientes?origem=cotacao" onClick={e=>{if(vendaId){e.preventDefault();window.history.back()}}}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><ArrowLeft size={15}/>Voltar</a>
      <button type="button" onClick={()=>void imprimir()} disabled={imprimindo||pendentes.length>0}
        title={pendentes.length?'Cadastre os desenhos dos códigos pendentes antes de imprimir.':undefined}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {imprimindo?<Loader2 size={16} className="animate-spin"/>:<FileDown size={16}/>}
        {imprimindo?'Preparando imagens...':'Imprimir / Salvar em PDF'}
      </button>
    </div>

    {pendentes.length>0&&<div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 print:hidden">
      <AlertTriangle size={17} className="shrink-0"/><div>
        <b>Desenho obrigatório para cada código.</b> {pendentes.length} item(ns) estão sem imagem vinculada.
        <p className="mt-1">Códigos: {codigoPendentes.join(', ')}. Atualize as imagens no <a href="/cadastro/produtos" className="font-bold underline">cadastro de produtos</a> antes de gerar o PDF.</p>
      </div>
    </div>}
    {erroImpressao&&<div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 print:hidden">{erroImpressao}</div>}

    <header className="mb-5 border-b-2 border-slate-900 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Esquadrifácio" className="h-12 max-w-28 object-contain print:h-10"/>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">Esquadrifácio</p>
            <p className="text-[10px] text-slate-500">Soluções em Alumínio · Atlas One</p>
          </div>
        </div>
        <span className="rounded border border-slate-300 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{escopoCard?'Lista dos materiais do card':'Solicitação de cotação'}</span>
      </div>
      <h1 className="mt-4 text-xl font-black md:text-2xl print:mt-2 print:text-lg">{escopoCard?'Materiais do card':'Cotação'} de {nomes[lote.categoria]||lote.categoria}</h1>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3 print:grid-cols-3 print:gap-y-1 print:p-2">
        <div><span className="font-semibold text-slate-500">Cliente:</span><p className="font-bold">{fallback(contexto?.cliente)}</p></div>
        <div><span className="font-semibold text-slate-500">Obra:</span><p className="font-bold">{fallback(contexto?.obra)}{contexto?.numero_obra?' · Nº '+contexto.numero_obra:''}</p></div>
        <div><span className="font-semibold text-slate-500">Cidade:</span><p className="font-bold">{fallback(contexto?.cidade)}</p></div>
        <div><span className="font-semibold text-slate-500">Data da emissão:</span><p className="font-bold">{dataBR(lote.updated_at||lote.created_at)}</p></div>
        <div><span className="font-semibold text-slate-500">Lista / versão:</span><p className="font-bold">#{lote.id.slice(0,8).toUpperCase()} · v{lote.versao}</p></div>
        <div><span className="font-semibold text-slate-500">Orçamento / itens:</span><p className="font-bold">{contexto?.numero_orcamento?'#'+contexto.numero_orcamento+' · ':''}{lote.quantidade_itens} itens</p></div>
      </div>
      {escopoCard&&<p className="mt-2 text-[11px] font-semibold text-blue-800">Documento parcial: somente os {lote.itens.length} materiais deste card. Outros cards da mesma obra não estão incluídos.</p>}
      {contexto?.responsavel&&<p className="mt-2 text-[11px] text-slate-500">Responsável pela emissão: {contexto.responsavel}</p>}
    </header>

    <p className="mb-4 text-xs text-slate-600 print:mb-2 print:text-[10px]">
      Solicitamos cotação dos materiais conforme códigos, desenhos e quantidades abaixo.
      Informar fabricante/marca, preço unitário, disponibilidade, prazo de entrega, frete, condição de pagamento e validade da proposta.
      <b> Este documento não é pedido de compra nem comprova recebimento.</b>
    </p>

    <table className="w-full table-fixed border-collapse text-left text-[11px] print:text-[9px]">
      <thead><tr className="bg-slate-100 text-slate-700">
        <th className="w-[4%] border px-2 py-2">#</th>
        <th className="w-[11%] border px-2 py-2">Código</th>
        <th className="w-[17%] border px-2 py-2 text-center">Desenho técnico</th>
        <th className="w-[31%] border px-2 py-2">Material / Especificação</th>
        <th className="w-[19%] border px-2 py-2">Cor / Corte</th>
        <th className="w-[10%] border px-2 py-2 text-right">Qtd.</th>
        <th className="w-[8%] border px-2 py-2">Un.</th>
      </tr></thead>
      <tbody>{lote.itens.map((item,i)=><tr key={i} className="break-inside-avoid align-middle even:bg-slate-50/50">
        <td className="border px-2 py-2">{i+1}</td>
        <td className="break-words border px-2 py-2 font-bold">{item.codigo||'—'}</td>
        <td className="border p-1 text-center">
          {item.imagem_url?<img data-desenho-cotacao src={item.imagem_url} loading="eager" alt={`Desenho técnico do perfil ${item.codigo||item.descricao}`} className="mx-auto h-[70px] w-full max-w-[105px] object-contain print:h-[56px]"/>:
          <span className="inline-flex flex-col items-center text-[9px] text-amber-800"><ImageOff size={15}/>{item.codigo?'Imagem pendente':'Sem código'}</span>}
        </td>
        <td className="break-words border px-2 py-2">{item.descricao}</td>
        <td className="break-words border px-2 py-2">{item.cor||'—'}{item.comprimento_corte_mm?<div className="mt-1 font-semibold">{n(item.comprimento_corte_mm)} mm</div>:item.comprimento_barra_mm?<div className="mt-1">Barra {n(item.comprimento_barra_mm)} mm</div>:null}</td>
        <td className="border px-2 py-2 text-right font-bold">{n(item.quantidade_cotar)}</td>
        <td className="border px-2 py-2">{item.unidade}</td>
      </tr>)}</tbody>
    </table>
    <footer className="mt-5 border-t border-slate-300 pt-3 text-[10px] text-slate-600 print:mt-3">
      <p>Quantidades para cotação descontam as sobras de estoque já separadas no Atlas. Documento destinado exclusivamente a solicitar preços ao fornecedor; não contém preço de venda nem margens da obra.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        <span>Fornecedor: ____________________</span>
        <span>Prazo de entrega: ____________</span>
        <span>Condição de pagamento: ____________</span>
        <span>Validade da cotação: ____________</span>
      </div>
      <p className="mt-3 text-[9px] text-slate-500">Esquadrifácio · Solicitação de cotação gerada pelo Atlas One · Lista {lote.id.slice(0,8).toUpperCase()} · Versão {lote.versao}</p>
    </footer>
    <style jsx global>{`@media print {
      @page { size: A4 landscape; margin: 10mm }
      html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
      table { font-size: 8pt }
      th, td { vertical-align: middle }
      thead { display: table-header-group }
      tr { break-inside: avoid; page-break-inside: avoid }
      img[data-desenho-cotacao] { object-fit: contain }
    }`}</style>
  </main>
}
