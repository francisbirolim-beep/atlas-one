'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Modo = 'xml' | 'pdf' | 'manual'
type StatusVinculo = 'vinculado' | 'pendente' | 'ambiguo'

type Item = {
  codigoFornecedor: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  produtoId?: string | null
  produtoCodigo?: string | null
  produtoNome?: string | null
  vinculoStatus?: StatusVinculo
  candidatos?: Array<{ id: string; codigo: string; nome: string }>
  dadosOrigem?: Record<string, unknown>
}

type Nota = {
  origem: Modo
  chaveAcesso: string
  numero: string
  serie: string
  dataEmissao: string
  fornecedorId?: string | null
  fornecedorNome: string
  fornecedorCnpj: string
  valorProdutos: number | null
  valorTotal: number | null
  itens: Item[]
  avisos: string[]
}

type ProdutoCatalogo = { id: string; codigo: string; nome: string; custo: number | null }

const itemVazio = (): Item => ({
  codigoFornecedor: '',
  descricao: '',
  ncm: '',
  cfop: '',
  unidade: 'UN',
  quantidade: 1,
  valorUnitario: null,
  valorTotal: null,
  produtoId: null,
  produtoCodigo: null,
  produtoNome: null,
  vinculoStatus: 'pendente',
})

const notaManual = (): Nota => ({
  origem: 'manual',
  chaveAcesso: '',
  numero: '',
  serie: '',
  dataEmissao: new Date().toISOString(),
  fornecedorId: null,
  fornecedorNome: '',
  fornecedorCnpj: '',
  valorProdutos: null,
  valorTotal: null,
  itens: [itemVazio()],
  avisos: [],
})

function normalizarCodigo(valor: string) {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '')
}

function numeroInput(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function moeda(valor: number | null | undefined) {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataInput(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export default function EntradaComprasPage() {
  const [modo, setModo] = useState<Modo>('xml')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [nota, setNota] = useState<Nota | null>(null)
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([])
  const [buscas, setBuscas] = useState<Record<number, string>>({})
  const [lendo, setLendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [aplicarCustos, setAplicarCustos] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ nfId: string; numero?: string; itensRegistrados: number; itensPendentes: number; custosAtualizados: number; arquivoGuardado: boolean; avisos?: string[] } | null>(null)

  useEffect(() => {
    carregarCatalogo()
  }, [])

  async function carregarCatalogo() {
    try {
      const token = await tokenAtual()
      if (!token) return
      const resp = await fetch('/api/compras/nf-entrada/catalogo', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await resp.json()
      if (resp.ok) setCatalogo(json.produtos || [])
    } catch {}
  }

  function trocarModo(novo: Modo) {
    setModo(novo)
    setArquivo(null)
    setNota(novo === 'manual' ? notaManual() : null)
    setBuscas({})
    setErro('')
    setSucesso(null)
    setAplicarCustos(false)
  }

  async function lerArquivo() {
    if (!arquivo) return setErro('Selecione um arquivo primeiro.')
    setLendo(true)
    setErro('')
    setSucesso(null)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const form = new FormData()
      form.append('modo', modo)
      form.append('arquivo', arquivo)
      const resp = await fetch('/api/compras/nf-entrada/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível ler a nota.')
      setNota(json.nf)
      const novasBuscas: Record<number, string> = {}
      ;(json.nf?.itens || []).forEach((item: Item, i: number) => {
        if (item.produtoId) novasBuscas[i] = `${item.produtoCodigo || ''} — ${item.produtoNome || ''}`
      })
      setBuscas(novasBuscas)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao ler a nota.')
    } finally {
      setLendo(false)
    }
  }

  function atualizarNota<K extends keyof Nota>(campo: K, valor: Nota[K]) {
    setNota(n => n ? { ...n, [campo]: valor } : n)
  }

  function atualizarItem(index: number, campo: keyof Item, valor: string | number | null) {
    setNota(n => {
      if (!n) return n
      const itens = [...n.itens]
      const atual = { ...itens[index], [campo]: valor }
      if (campo === 'quantidade' || campo === 'valorUnitario') {
        const qtd = campo === 'quantidade' ? Number(valor) : Number(atual.quantidade)
        const unit = campo === 'valorUnitario' ? Number(valor) : Number(atual.valorUnitario)
        if (Number.isFinite(qtd) && Number.isFinite(unit)) atual.valorTotal = qtd * unit
      }
      if (campo === 'codigoFornecedor') {
        const codigo = normalizarCodigo(String(valor || ''))
        const encontrados = catalogo.filter(p => normalizarCodigo(p.codigo) === codigo)
        if (encontrados.length === 1) {
          atual.produtoId = encontrados[0].id
          atual.produtoCodigo = encontrados[0].codigo
          atual.produtoNome = encontrados[0].nome
          atual.vinculoStatus = 'vinculado'
          setBuscas(prev => ({ ...prev, [index]: `${encontrados[0].codigo} — ${encontrados[0].nome}` }))
        } else if (!codigo) {
          atual.produtoId = null
          atual.produtoCodigo = null
          atual.produtoNome = null
          atual.vinculoStatus = 'pendente'
        }
      }
      itens[index] = atual
      return { ...n, itens }
    })
  }

  function adicionarItem() {
    setNota(n => n ? { ...n, itens: [...n.itens, itemVazio()] } : n)
  }

  function removerItem(index: number) {
    setNota(n => n ? { ...n, itens: n.itens.filter((_, i) => i !== index) } : n)
    setBuscas(prev => {
      const novo: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (i < index) novo[i] = v
        if (i > index) novo[i - 1] = v
      })
      return novo
    })
  }

  function vincularProduto(index: number, valor: string) {
    setBuscas(prev => ({ ...prev, [index]: valor }))
    const porDisplay = catalogo.find(p => `${p.codigo} — ${p.nome}` === valor)
    const porCodigo = catalogo.find(p => normalizarCodigo(p.codigo) === normalizarCodigo(valor))
    const produto = porDisplay || porCodigo
    if (!produto) return
    setNota(n => {
      if (!n) return n
      const itens = [...n.itens]
      itens[index] = { ...itens[index], produtoId: produto.id, produtoCodigo: produto.codigo, produtoNome: produto.nome, vinculoStatus: 'vinculado' }
      return { ...n, itens }
    })
    setBuscas(prev => ({ ...prev, [index]: `${produto.codigo} — ${produto.nome}` }))
  }

  function desvincularProduto(index: number) {
    setNota(n => {
      if (!n) return n
      const itens = [...n.itens]
      itens[index] = { ...itens[index], produtoId: null, produtoCodigo: null, produtoNome: null, vinculoStatus: 'pendente' }
      return { ...n, itens }
    })
    setBuscas(prev => ({ ...prev, [index]: '' }))
  }

  async function confirmar() {
    if (!nota) return
    if (!nota.itens.length) return setErro('Inclua pelo menos um item.')
    setConfirmando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const form = new FormData()
      form.append('payload', JSON.stringify({ ...nota, observacoes, aplicarCustos }))
      if (arquivo && modo !== 'manual') form.append('arquivo', arquivo)
      const resp = await fetch('/api/compras/nf-entrada/confirmar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível confirmar a entrada.')
      setSucesso(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar a entrada.')
    } finally {
      setConfirmando(false)
    }
  }

  const totais = useMemo(() => {
    const itens = nota?.itens || []
    const total = itens.reduce((s, i) => s + (Number(i.valorTotal) || 0), 0)
    const vinculados = itens.filter(i => i.produtoId).length
    return { total, vinculados, pendentes: itens.length - vinculados }
  }, [nota])

  if (sucesso) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-7 shadow-sm">
          <CheckCircle2 size={44} className="text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Entrada registrada</h1>
          <p className="mt-2 text-slate-600">{sucesso.numero ? `NF ${sucesso.numero}` : 'Nota'} registrada com {sucesso.itensRegistrados} item(ns).</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Resumo titulo="Pendentes de vínculo" valor={sucesso.itensPendentes} />
            <Resumo titulo="Custos atualizados" valor={sucesso.custosAtualizados} />
            <Resumo titulo="Arquivo guardado" valor={sucesso.arquivoGuardado ? 'Sim' : 'Não'} />
          </div>
          {sucesso.avisos?.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{sucesso.avisos.join(' ')}</div> : null}
          <div className="mt-6 flex gap-3">
            <button onClick={() => trocarModo('xml')} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Lançar outra nota</button>
            <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Voltar ao início</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Compras • Recebimento</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Entrada de Nota Fiscal</h1>
            <p className="mt-1 text-sm text-slate-600">Importe XML, envie PDF/DANFE ou lance manualmente. Sempre confira antes de confirmar.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck size={26} className="text-emerald-600" /></div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <ModoCard ativo={modo === 'xml'} onClick={() => trocarModo('xml')} icon={<FileCode2 size={24} />} titulo="Importar XML" descricao="Leitura completa da NF-e e dos itens." />
          <ModoCard ativo={modo === 'pdf'} onClick={() => trocarModo('pdf')} icon={<FileText size={24} />} titulo="Enviar PDF / DANFE" descricao="Leitura assistida + conferência manual." />
          <ModoCard ativo={modo === 'manual'} onClick={() => trocarModo('manual')} icon={<ReceiptText size={24} />} titulo="Lançar manual" descricao="Digite os dados e itens da compra." />
        </section>

        {modo !== 'manual' && !nota && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-400">
              <Upload size={34} className="mx-auto text-slate-400" />
              <div className="mt-3 font-semibold text-slate-800">Selecione {modo === 'xml' ? 'o XML da NF-e' : 'o PDF/DANFE'}</div>
              <div className="mt-1 text-sm text-slate-500">Limite de 15 MB. O arquivo original será guardado após a confirmação.</div>
              <input type="file" accept={modo === 'xml' ? '.xml,application/xml,text/xml' : '.pdf,application/pdf'} onChange={e => setArquivo(e.target.files?.[0] || null)} className="mt-4 text-sm" />
            </label>
            {arquivo && <div className="mt-3 text-sm text-slate-600">Selecionado: <strong>{arquivo.name}</strong></div>}
            <button onClick={lerArquivo} disabled={!arquivo || lendo} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{lendo ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}{lendo ? 'Lendo nota...' : 'Ler e montar prévia'}</button>
          </section>
        )}

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

        {nota && (
          <>
            {nota.avisos?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div>{nota.avisos.map((a, i) => <div key={i}>{a}</div>)}</div></div></div>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Dados da nota e fornecedor</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Campo label="Número da NF" value={nota.numero} onChange={v => atualizarNota('numero', v)} />
                <Campo label="Série" value={nota.serie} onChange={v => atualizarNota('serie', v)} />
                <Campo label="Data de emissão" type="date" value={dataInput(nota.dataEmissao)} onChange={v => atualizarNota('dataEmissao', v ? `${v}T12:00:00.000Z` : '')} />
                <Campo label="Chave de acesso" value={nota.chaveAcesso} onChange={v => atualizarNota('chaveAcesso', v)} />
                <div className="md:col-span-2"><Campo label="Fornecedor / Razão social" value={nota.fornecedorNome} onChange={v => atualizarNota('fornecedorNome', v)} /></div>
                <Campo label="CNPJ / CPF" value={nota.fornecedorCnpj} onChange={v => atualizarNota('fornecedorCnpj', v)} />
                <Campo label="Valor total da NF" type="number" value={nota.valorTotal == null ? '' : String(nota.valorTotal)} onChange={v => atualizarNota('valorTotal', numeroInput(v))} />
              </div>
              {nota.fornecedorId && <div className="mt-3 text-xs font-medium text-emerald-700">Fornecedor já encontrado no cadastro do Atlas.</div>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-semibold text-slate-900">Itens da compra</h2><p className="mt-1 text-sm text-slate-500">Vincule ao produto do Atlas. Código exato é vinculado automaticamente quando houver correspondência única.</p></div>
                <button onClick={adicionarItem} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Plus size={16} /> Adicionar item</button>
              </div>

              <datalist id="catalogo-produtos-atlas">{catalogo.map(p => <option key={p.id} value={`${p.codigo} — ${p.nome}`} />)}</datalist>

              <div className="mt-4 space-y-4">
                {nota.itens.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-700">Item {index + 1}</div>
                      <button onClick={() => removerItem(index)} disabled={nota.itens.length <= 1} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-12">
                      <div className="lg:col-span-2"><Campo label="Código fornecedor" value={item.codigoFornecedor} onChange={v => atualizarItem(index, 'codigoFornecedor', v)} /></div>
                      <div className="lg:col-span-4"><Campo label="Descrição" value={item.descricao} onChange={v => atualizarItem(index, 'descricao', v)} /></div>
                      <div className="lg:col-span-1"><Campo label="Un." value={item.unidade} onChange={v => atualizarItem(index, 'unidade', v)} /></div>
                      <div className="lg:col-span-1"><Campo label="Qtde" type="number" value={item.quantidade == null ? '' : String(item.quantidade)} onChange={v => atualizarItem(index, 'quantidade', numeroInput(v))} /></div>
                      <div className="lg:col-span-2"><Campo label="Custo unit." type="number" value={item.valorUnitario == null ? '' : String(item.valorUnitario)} onChange={v => atualizarItem(index, 'valorUnitario', numeroInput(v))} /></div>
                      <div className="lg:col-span-2"><Campo label="Total item" type="number" value={item.valorTotal == null ? '' : String(item.valorTotal)} onChange={v => atualizarItem(index, 'valorTotal', numeroInput(v))} /></div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-12">
                      <div className="lg:col-span-2"><Campo label="NCM" value={item.ncm} onChange={v => atualizarItem(index, 'ncm', v)} /></div>
                      <div className="lg:col-span-2"><Campo label="CFOP" value={item.cfop} onChange={v => atualizarItem(index, 'cfop', v)} /></div>
                      <div className="lg:col-span-8">
                        <label className="text-xs font-medium text-slate-500">Produto correspondente no Atlas</label>
                        <div className="mt-1 flex gap-2">
                          <input list="catalogo-produtos-atlas" value={buscas[index] ?? (item.produtoId ? `${item.produtoCodigo || ''} — ${item.produtoNome || ''}` : '')} onChange={e => vincularProduto(index, e.target.value)} placeholder="Digite código ou escolha um produto..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
                          {item.produtoId && <button onClick={() => desvincularProduto(index)} className="rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600">Desvincular</button>}
                        </div>
                        <StatusVinculo status={item.produtoId ? 'vinculado' : item.vinculoStatus || 'pendente'} />
                        {!item.produtoId && item.candidatos?.length ? <div className="mt-2 flex flex-wrap gap-2">{item.candidatos.map(c => <button key={c.id} onClick={() => vincularProduto(index, `${c.codigo} — ${c.nome}`)} className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">{c.codigo} — {c.nome}</button>)}</div> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <Resumo titulo="Itens" valor={nota.itens.length} />
                <Resumo titulo="Vinculados" valor={totais.vinculados} />
                <Resumo titulo="Pendentes" valor={totais.pendentes} />
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-start">
                <input id="aplicar-custos" type="checkbox" checked={aplicarCustos} onChange={e => setAplicarCustos(e.target.checked)} className="mt-1 h-4 w-4" />
                <label htmlFor="aplicar-custos" className="text-sm text-blue-950"><strong>Atualizar custo dos produtos vinculados ao confirmar.</strong><br /><span className="text-blue-800">O Atlas guarda o custo anterior no item da NF. Produtos pendentes não são alterados.</span></label>
              </div>
              <label className="mt-4 block text-xs font-medium text-slate-500">Observações<textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" placeholder="Ex.: frete, divergência, lote, conferência..." /></label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">Total calculado dos itens: <strong className="text-slate-900">{moeda(totais.total)}</strong></div>
                <button onClick={confirmar} disabled={confirmando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{confirmando ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{confirmando ? 'Confirmando...' : 'Confirmar entrada da NF'}</button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Campo({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (valor: string) => void; type?: string }) {
  return <label className="block text-xs font-medium text-slate-500">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} step={type === 'number' ? 'any' : undefined} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
}

function ModoCard({ ativo, onClick, icon, titulo, descricao }: { ativo: boolean; onClick: () => void; icon: React.ReactNode; titulo: string; descricao: string }) {
  return <button onClick={onClick} className={`rounded-2xl border p-5 text-left transition ${ativo ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={ativo ? 'text-blue-700' : 'text-slate-500'}>{icon}</div><div className="mt-3 font-semibold text-slate-900">{titulo}</div><div className="mt-1 text-sm text-slate-500">{descricao}</div></button>
}

function StatusVinculo({ status }: { status: StatusVinculo }) {
  if (status === 'vinculado') return <div className="mt-1 text-xs font-medium text-emerald-700">✓ Vinculado ao cadastro do Atlas</div>
  if (status === 'ambiguo') return <div className="mt-1 text-xs font-medium text-amber-700">⚠ Mais de um produto com o mesmo código — escolha o correto</div>
  return <div className="mt-1 text-xs font-medium text-slate-500">Pendente de vínculo — nenhum produto será criado automaticamente</div>
}

function Resumo({ titulo, valor }: { titulo: string; valor: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">{titulo}</div><div className="mt-1 text-lg font-bold text-slate-900">{valor}</div></div>
}
