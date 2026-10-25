'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, Ruler, Image as ImageIcon, Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Dado = Record<string, any>
const legivel = (x: unknown) => x === null || x === undefined || x === '' ? '—' : String(x)
const moeda = (x: unknown) => Number(x || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const urlValida = (s: unknown) => typeof s === 'string' && /^https?:\/\//i.test(s) ? s : ''
function Campo({ nome, valor }: {nome: string; valor: unknown}) {
  return <div><p className="text-xs font-medium text-slate-500">{nome}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{legivel(valor)}</p></div>
}
function fotos(item: Dado) {
  const lista: {nome: string; url: string}[] = []
  const add = (nome: string, origem: unknown) => {
    const url = urlValida(origem)
    if (url && !lista.some(f => f.url === url)) lista.push({nome, url})
  }
  if (Array.isArray(item.foto_urls)) item.foto_urls.forEach((u: string, i: number) => add(`Foto do local ${i + 1}`, u))
  add('Foto do local', item.foto_url)
  add('Trena da largura', item.foto_larguras_url || item.foto_largura_url)
  add('Trena da altura', item.foto_alturas_url || item.foto_altura_url)
  return lista
}
export default function DetalhesPedido() {
  const params = useParams()
  const id = String(params?.id || '')
  const [orc, setOrc] = useState<Dado | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  useEffect(() => {
    if (!id) return
    let ativo = true
    void supabase.from('orcamentos').select('*').eq('id', id).maybeSingle().then(({data, error}) => {
      if (!ativo) return
      if (error || !data) setErro(error?.message || 'Orçamento não encontrado ou sem permissão de consulta.')
      else setOrc(data as Dado)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [id])
  if (carregando) return <div className="grid min-h-screen place-items-center text-slate-500"><Loader2 className="animate-spin"/></div>
  if (!orc) return <div className="mx-auto max-w-5xl p-8 text-red-700">{erro}<div><Link href="/clientes">Voltar aos clientes</Link></div></div>
  const itens = Array.isArray(orc.itens) ? orc.itens : []
  const anexos: {titulo: string; url: string}[] = (Array.isArray(orc.anexos) ? orc.anexos : [])
    .filter((a: Dado) => !a.excluido_em && urlValida(a.url))
    .map((a: Dado) => ({titulo: legivel(a.titulo || a.nome || 'Anexo'), url: a.url}))
  if (urlValida(orc.anexo_url) && !anexos.some(a => a.url === orc.anexo_url)) anexos.push({titulo: legivel(orc.anexo_nome || 'Anexo original'), url: orc.anexo_url})
  return <main className="min-h-screen bg-slate-50 px-4 py-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href={orc.cliente_id ? `/clientes/${orc.cliente_id}/central` : '/clientes'} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft size={16}/> Cliente 360</Link>
        <h1 className="text-2xl font-bold text-slate-900">Pedido original · Orçamento #{legivel(orc.numero)}</h1>
        <p className="mt-1 text-sm text-slate-500">Informações, medidas e fotos registradas na solicitação. Consulta sem alterações.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {orc.origem_venda_parcial_id && <Link href={`/orcamento/${orc.origem_venda_parcial_id}/detalhes`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">Abrir orçamento completo de origem ↗</Link>}
        <Link href={`/orcamento/${id}/composicao`} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"><FileText size={16}/> Composição / valores</Link>
      </div>
    </header>
    <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Campo nome="Cliente" valor={orc.cliente_nome}/><Campo nome="Data do pedido" valor={orc.created_at ? new Date(orc.created_at).toLocaleDateString('pt-BR') : null}/>
      <Campo nome="Cidade" valor={orc.cidade}/><Campo nome="Situação" valor={orc.status}/>
      <Campo nome="Origem" valor={orc.origem}/><Campo nome="Solicitado por" valor={orc.criado_por_nome}/>
      <Campo nome="Tipo de medição" valor={orc.tipo_medida}/><Campo nome="Valor do orçamento completo" valor={moeda(orc.valor_estimado)}/>
      <div className="sm:col-span-2 lg:col-span-4"><Campo nome="Observações do pedido" valor={orc.observacoes}/></div>
      {orc.descricao_livre && <div className="sm:col-span-2 lg:col-span-4"><Campo nome="Descrição original" valor={orc.descricao_livre}/></div>}
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Ruler size={19}/> Tipologias solicitadas ({itens.length})</h2>
      <div className="space-y-4">{itens.map((item: Dado, i: number) => {
        const w = item.wvetro_item || {}
        const imagens = fotos(item)
        return <article key={item.id || i} className="rounded-xl border p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Item {i + 1} · {legivel(item.ambiente || w.Ambiente || item.descricao)}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo nome="Tipologia" valor={item.tipo_outro_texto || item.configuracao_nome || item.tipo_esquadria || w.Modelo}/>
            <Campo nome="Descrição" valor={item.descricao || w.Nome}/><Campo nome="Quantidade" valor={item.quantidade}/>
            <Campo nome="Medida principal" valor={`${legivel(item.largura_mm || w.Largura)} × ${legivel(item.altura_mm || w.Altura)} mm`}/>
            <Campo nome="Linha" valor={item.linha_nome || item.linha_origem || w.Linha}/><Campo nome="Cor" valor={item.cor || w.Cor}/>
            <Campo nome="Vidro" valor={item.vidro_origem || item.vidro}/><Campo nome="Contramarco" valor={item.contramarco}/>
            <Campo nome="Larguras (baixo / meio / cima)" valor={[item.largura_baixo_mm,item.largura_meio_mm,item.largura_cima_mm].filter(v => v !== null && v !== undefined).map(v => v + ' mm').join(' / ')}/>
            <Campo nome="Alturas (direita / meio / esquerda)" valor={[item.altura_direita_mm,item.altura_meio_mm,item.altura_esquerda_mm].filter(v => v !== null && v !== undefined).map(v => v + ' mm').join(' / ')}/>
            <Campo nome="Observação para produção" valor={item.observacao_producao}/><Campo nome="Observação do vidro" valor={item.observacao_tempera}/>
          </div>
          <h4 className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><ImageIcon size={16}/> Fotos do local e da trena ({imagens.length})</h4>
          {imagens.length ? <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{imagens.map(f =>
            <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border">
              <img src={f.url} alt={f.nome} className="h-36 w-full object-cover"/><p className="p-2 text-xs text-slate-700">{f.nome} ↗</p>
            </a>)}</div> : <p className="mt-2 text-xs text-slate-500">Nenhuma foto vinculada a este item no cadastro salvo.</p>}
        </article>
      })}{!itens.length && <p className="text-sm text-slate-500">Não há tipologias estruturadas neste orçamento.</p>}</div>
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Paperclip size={18}/> Anexos gerais ({anexos.length})</h2>
      {anexos.length ? <div className="flex flex-wrap gap-2">{anexos.map(a => <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm text-blue-700">{a.titulo} ↗</a>)}</div> : <p className="text-sm text-slate-500">Nenhum anexo geral salvo.</p>}
    </section>
  </div></main>
}
