'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, ExternalLink, FileText, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Registro = Record<string, unknown>

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor)
}

function numeroMm(valor: unknown): string {
  if (valor == null || valor === '') return '—'
  const numero = Number(valor)
  return Number.isFinite(numero) ? `${numero.toLocaleString('pt-BR')} mm` : '—'
}

function fotosDoRegistro(registro: Registro): string[] {
  const lista = Array.isArray(registro.foto_urls) ? registro.foto_urls : []
  return Array.from(new Set([
    ...lista,
    registro.foto_url,
    registro.foto_larguras_url,
    registro.foto_alturas_url,
  ].map(texto).filter(url => /^https?:\/\//i.test(url))))
}

function descricaoItem(item: Registro, indice: number): string {
  const nome = texto(item.produto_nome) || texto(item.tipo_outro_texto) || texto(item.tipo_esquadria).replace(/_/g, ' ')
  return `${indice + 1}. ${texto(item.ambiente) || 'Ambiente não informado'} — ${nome || 'Esquadria'}`
}

function FotoOrcamento({ url, legenda, ampliar }: { url: string; legenda: string; ampliar: (url: string) => void }) {
  const [indisponivel, setIndisponivel] = useState(false)
  return <div className="w-28 min-w-0 shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 sm:w-36">
    {indisponivel
      ? <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 px-1 text-center text-[11px] text-slate-600"><Camera size={20}/>Prévia indisponível</div>
      : <button type="button" className="block w-full" onClick={() => ampliar(url)} title="Ampliar foto">
          <img src={url} alt={legenda} className="h-24 w-full rounded-lg bg-slate-100 object-cover" onError={() => setIndisponivel(true)}/>
        </button>}
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-700"><ExternalLink size={12}/> Abrir original</a>
  </div>
}

export default function DetalheOrcamentoCliente({ clienteId, orcamentoId, onFechar }: {
  clienteId: string
  orcamentoId: string
  onFechar: () => void
}) {
  const [orcamento, setOrcamento] = useState<Registro | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    setOrcamento(null)
    void supabase.from('orcamentos').select('*')
      .eq('id', orcamentoId).eq('cliente_id', clienteId).maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        if (error || !data) setErro('Não foi possível abrir o orçamento deste cliente.')
        else setOrcamento(data as Registro)
        setCarregando(false)
      })
      .catch(() => {
        if (!ativo) return
        setErro('Falha ao carregar o orçamento. Tente novamente.')
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [clienteId, orcamentoId])

  const itens = orcamento && Array.isArray(orcamento.itens) ? orcamento.itens.filter((it): it is Registro => !!it && typeof it === 'object' && !Array.isArray(it)) : []
  const fotosGerais = orcamento ? fotosDoRegistro(orcamento) : []
  const anexos = orcamento && Array.isArray(orcamento.anexos)
    ? orcamento.anexos.filter((it): it is Registro => !!it && typeof it === 'object' && !Array.isArray(it))
    : []

  return <div role="dialog" aria-modal="true" aria-label="Detalhes do orçamento" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-0 sm:p-5" onClick={onFechar}>
    <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-2xl" onClick={e => e.stopPropagation()}>
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Orçamento {orcamento?.numero ? `#${texto(orcamento.numero)}` : ''}</h2>
          <p className="text-xs text-slate-500">Levantamento original • fotos, medidas e tipologias</p>
        </div>
        <button type="button" onClick={onFechar} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Fechar detalhes"><X size={18}/></button>
      </header>

      <main className="flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        {carregando && <div className="flex items-center justify-center gap-2 py-12 text-slate-600"><Loader2 size={18} className="animate-spin"/> Carregando levantamento...</div>}
        {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</p>}
        {orcamento && <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-slate-500">Cliente</p><p className="font-semibold">{texto(orcamento.cliente_nome) || '—'}</p></div>
              <div><p className="text-xs text-slate-500">Data do pedido</p><p className="font-semibold">{orcamento.created_at ? new Date(texto(orcamento.created_at)).toLocaleDateString('pt-BR') : '—'}</p></div>
              <div><p className="text-xs text-slate-500">Situação</p><p className="font-semibold">{texto(orcamento.status) || '—'}</p></div>
              <div><p className="text-xs text-slate-500">Itens</p><p className="font-semibold">{itens.length}</p></div>
            </div>
          </section>

          {itens.map((item, indice) => {
            const fotos = fotosDoRegistro(item)
            const observacoes = [
              ['Descrição / observação', texto(item.descricao)],
              ['Observações para produção', texto(item.observacao_producao)],
              ['Observação de têmpera', texto(item.observacao_tempera)],
            ].filter(([, valor]) => Boolean(valor))
            return <section key={texto(item.id) || indice} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800 sm:text-base">{descricaoItem(item, indice)}</h3>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Largura</p><strong>{numeroMm(item.largura_mm)}</strong></div>
                <div><p className="text-xs text-slate-500">Altura</p><strong>{numeroMm(item.altura_mm)}</strong></div>
                <div><p className="text-xs text-slate-500">Quantidade</p><strong>{texto(item.quantidade) || '1'}</strong></div>
                <div><p className="text-xs text-slate-500">Contramarco</p><strong>{texto(item.contramarco) === 'com' ? 'Com' : texto(item.contramarco) === 'sem' ? 'Sem' : '—'}</strong></div>
                {(item.largura_batente_mm != null || item.largura_guarnicao_mm != null) && <>
                  <div><p className="text-xs text-slate-500">Batente</p><strong>{numeroMm(item.largura_batente_mm)}</strong></div>
                  <div><p className="text-xs text-slate-500">Guarnição</p><strong>{numeroMm(item.largura_guarnicao_mm)}</strong></div>
                </>}
                {texto(item.cor) && <div><p className="text-xs text-slate-500">Cor</p><strong>{texto(item.cor)}</strong></div>}
              </div>
              {(item.largura_baixo_mm != null || item.largura_cima_mm != null || item.altura_direita_mm != null) && <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                Medidas finais — larguras: {numeroMm(item.largura_baixo_mm)} / {numeroMm(item.largura_meio_mm)} / {numeroMm(item.largura_cima_mm)} • alturas: {numeroMm(item.altura_direita_mm)} / {numeroMm(item.altura_meio_mm)} / {numeroMm(item.altura_esquerda_mm)}
              </div>}
              {observacoes.map(([titulo, valor]) => <p key={titulo} className="mt-2 whitespace-pre-line text-sm text-slate-700"><strong>{titulo}: </strong>{valor}</p>)}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Camera size={14}/> Fotos coletadas na obra ({fotos.length})</p>
                {fotos.length ? <div className="flex flex-wrap gap-2">{fotos.map(url => <FotoOrcamento key={url} url={url} legenda={descricaoItem(item, indice)} ampliar={setFotoAmpliada}/>)}</div> : <p className="text-xs text-amber-700">Nenhuma foto foi vinculada a este item no envio.</p>}
              </div>
            </section>
          })}
          {fotosGerais.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-bold text-slate-800">Fotos gerais da obra</h3><div className="flex flex-wrap gap-2">{fotosGerais.map(url => <FotoOrcamento key={url} url={url} legenda="Foto geral da obra" ampliar={setFotoAmpliada}/>)}</div></section>}
          {anexos.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-bold text-slate-800">Arquivos anexados</h3><div className="space-y-2">{anexos.map((a, indice) => /^https?:\/\//i.test(texto(a.url)) ? <a key={indice} href={texto(a.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-700"><FileText size={15}/>{texto(a.titulo) || texto(a.nome) || `Arquivo ${indice + 1}`} <ExternalLink size={12}/></a> : null)}</div></section>}
        </>}
      </main>
      {orcamento && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-slate-500">Para editar itens já registrados, abra o pedido no Kanban.</p>
        <div className="flex gap-2">
          <Link href={`/orcamento-rapido?cliente=${encodeURIComponent(clienteId)}&adicionarAo=${encodeURIComponent(orcamentoId)}`} className="rounded-lg border border-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy">Adicionar nova medição</Link>
          <Link href="/kanban" className="flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">Ir ao Kanban <ArrowLeft size={13} className="rotate-180"/></Link>
        </div>
      </footer>}
    </div>
    {fotoAmpliada && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onClick={e => { e.stopPropagation(); setFotoAmpliada(null) }}>
      <button type="button" aria-label="Fechar foto" className="absolute right-4 top-4 text-white" onClick={() => setFotoAmpliada(null)}><X size={22}/></button>
      <img src={fotoAmpliada} alt="Foto ampliada do levantamento" className="max-h-[85vh] max-w-full object-contain"/>
      <a href={fotoAmpliada} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800">Abrir foto original</a>
    </div>}
  </div>
}
