'use client'

import Link from 'next/link'
import { Camera, ChevronRight, FileText, Image as ImageIcon, MapPin, Ruler, X } from 'lucide-react'

export type OrcamentoDetalhado360 = {
  id: string
  numero?: number | null
  created_at: string
  status?: string | null
  descricao_livre?: string | null
  obra_nome?: string | null
  obra_endereco?: string | null
  obra_numero?: string | null
  obra_bairro?: string | null
  obra_cidade?: string | null
  obra_uf?: string | null
  observacoes?: string | null
  tipo_medida?: string | null
  contramarco?: string | null
  acabamento?: string | null
  criado_por_nome?: string | null
  fotos_urls?: string[] | null
  medidas_trena?: unknown
  anexo_url?: string | null
  anexo_nome?: string | null
  anexos?: Array<{url?:string|null; nome?:string|null; titulo?:string|null}> | null
  itens?: Array<Record<string, unknown>> | null
}

function urlSegura(valor: unknown) {
  const v = String(valor || '').trim()
  // Nunca passar javascript:, data: etc. para links de arquivos importados.
  return /^https:\/\//i.test(v) ? v : null
}
function numero(v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function texto(valor:unknown) {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : ''
}
function imagensEm(valor: unknown): string[] {
  const encontrados:string[]=[]
  const visitados = new Set<unknown>()
  function visitar(v:unknown, profundidade=0) {
    if (profundidade>5 || v===null || v===undefined || visitados.has(v)) return
    if (typeof v === 'string') {
      const seguro=urlSegura(v)
      if (seguro && /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(seguro)) encontrados.push(seguro)
      return
    }
    if (typeof v !== 'object') return
    visitados.add(v)
    if (Array.isArray(v)) {
      v.slice(0,80).forEach(item=>visitar(item,profundidade+1))
      return
    }
    for (const [chave,conteudo] of Object.entries(v as Record<string,unknown>)) {
      if (/foto|imagem|trena|anexo|url/i.test(chave)) visitar(conteudo,profundidade+1)
    }
  }
  visitar(valor)
  return encontrados
}
const rotulo=(v:unknown)=>texto(v).replace(/_/g,' ') || 'Não informado'
const moeda=(v:unknown)=>{const n=numero(v);return n===null?null:n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
const medida=(v:unknown)=>{const n=numero(v);return n===null||n<=0?'—':n.toLocaleString('pt-BR')+' mm'}

export default function DetalheOrcamento360({orcamento,onFechar}:{orcamento:OrcamentoDetalhado360;onFechar:()=>void}) {
  const itens=Array.isArray(orcamento.itens)?orcamento.itens:[]
  const fotos=[...new Set([...(orcamento.fotos_urls||[]).map(urlSegura).filter((v):v is string=>!!v),
    ...imagensEm(orcamento.medidas_trena),...itens.flatMap(i=>imagensEm(i))])]
  const arquivos=[...new Map([
    ...(Array.isArray(orcamento.anexos)?orcamento.anexos:[]),
    ...(orcamento.anexo_url?[{url:orcamento.anexo_url,nome:orcamento.anexo_nome||'Arquivo do orçamento'}]:[]),
  ].filter(a=>urlSegura(a.url)).map(a=>[a.url!,a])).values()]
  const endereco=[orcamento.obra_endereco,orcamento.obra_numero,orcamento.obra_bairro,orcamento.obra_cidade,orcamento.obra_uf].filter(Boolean).join(', ')
  return <div role="dialog" aria-modal="true" aria-label="Detalhes do orçamento" className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/65 px-3 py-5 sm:p-8" onClick={onFechar}>
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b bg-white p-5">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Cliente 360 · Solicitação original</p>
          <h2 className="text-xl font-black text-slate-900">Orçamento #{orcamento.numero||'—'}</h2>
          <p className="mt-1 text-xs text-slate-500">Solicitado em {new Date(orcamento.created_at).toLocaleDateString('pt-BR')} · {rotulo(orcamento.status)} · {itens.length} tipologia(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/orcamento/${orcamento.id}/composicao`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-blue-700">Abrir composição</Link>
          <button type="button" onClick={onFechar} aria-label="Fechar detalhes" className="rounded-lg border border-slate-200 p-2 text-slate-600"><X size={18}/></button>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Obra',orcamento.obra_nome||'Não identificada'],
            ['Tipo de medida',rotulo(orcamento.tipo_medida)],
            ['Cor / acabamento',rotulo(orcamento.acabamento)],
            ['Contramarco',rotulo(orcamento.contramarco)],
            ['Pedido por',orcamento.criado_por_nome||'Não informado'],
            ['Endereço da obra',endereco||'Não informado'],
          ].map(([nome,valor])=><div key={nome} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{nome}</p><p className="mt-1 text-sm font-bold text-slate-800">{valor}</p></div>)}
        </section>
        {(orcamento.descricao_livre||orcamento.observacoes)&&<section className="rounded-xl border p-4"><h3 className="text-sm font-bold">Descrição e observações originais</h3>
          {orcamento.descricao_livre&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{orcamento.descricao_livre}</p>}
          {orcamento.observacoes&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{orcamento.observacoes}</p>}
        </section>}
        <section className="rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-bold"><Ruler size={16}/> Tipologias solicitadas ({itens.length})</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{itens.map((item,index)=><div key={String(item.id||index)} className="rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] text-slate-400">Item {index+1}</p>
            <p className="mt-1 text-sm font-bold">{texto(item.ambiente)||texto(item.descricao)||texto(item.tipo_outro_texto)||'Sem descrição'}</p>
            {item.descricao&&item.ambiente&&<p className="mt-1 text-xs text-slate-600">{texto(item.descricao)}</p>}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div><b>Tipologia</b><p>{texto(item.tipo_esquadria)||texto(item.configuracao_nome)||'—'}</p></div>
              <div><b>Quantidade</b><p>{texto(item.quantidade)||'1'}</p></div>
              <div><b>Largura</b><p>{medida(item.largura_mm)}</p></div>
              <div><b>Altura</b><p>{medida(item.altura_mm)}</p></div>
              <div><b>Cor</b><p>{texto(item.cor)||'—'}</p></div>
              <div><b>Linha</b><p>{texto(item.linha_origem)||texto(item.linha)||'—'}</p></div>
              <div><b>Vidro</b><p>{texto(item.vidro_origem)||texto(item.vidro)||'—'}</p></div>
              <div><b>Valor do item</b><p>{moeda(item.preco_total)||'Não informado'}</p></div>
            </div>
            {imagensEm(item).length>0&&<p className="mt-2 flex items-center gap-1 text-xs text-blue-600"><Camera size={13}/> Fotos do item disponíveis na galeria</p>}
          </div>)}</div>
          {!itens.length&&<p className="mt-3 text-xs text-amber-700">Este orçamento não tem itens estruturados. Consulte o PDF original, quando anexado.</p>}
        </section>
        {orcamento.medidas_trena!==null&&orcamento.medidas_trena!==undefined&&<section className="rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-bold"><Ruler size={16}/> Medições e registros da trena</h3>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(orcamento.medidas_trena,null,2)}</pre>
        </section>}
        <section className="rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-bold"><ImageIcon size={16}/> Fotos do local e da trena ({fotos.length})</h3>
          {fotos.length?<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">{fotos.map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-xl border">
            <img src={url} alt={`Foto ${i+1} do orçamento`} className="h-40 w-full object-cover transition group-hover:scale-[1.02]"/>
            <p className="px-3 py-2 text-xs text-slate-600">Abrir foto {i+1} em tamanho original <ChevronRight size={13} className="inline"/></p>
          </a>)}</div>:<p className="mt-2 text-xs text-slate-500">Nenhuma foto registrada neste orçamento.</p>}
        </section>
        <section className="rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-bold"><FileText size={16}/> Arquivos anexados ({arquivos.length})</h3>
          {arquivos.length?<div className="mt-3 flex flex-wrap gap-2">{arquivos.map((a,i)=><a key={a.url||i} href={urlSegura(a.url)||'#'} target="_blank" rel="noopener noreferrer" className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-bold text-blue-700">{a.titulo||a.nome||`Arquivo ${i+1}`}</a>)}</div>:<p className="mt-2 text-xs text-slate-500">Nenhum documento anexado.</p>}
        </section>
      </div>
    </div>
  </div>
}
