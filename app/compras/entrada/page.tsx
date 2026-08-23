'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FileCode2,
  FileText,
  Link2,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Modo = 'xml' | 'pdf' | 'manual'
type StatusVinculo = 'vinculado' | 'pendente' | 'ambiguo'
type SugestaoProduto = { id: string; codigo: string; nome: string; score: number; motivo: string }
type Pagamento = { numero: string; vencimento: string | null; valor: number | null; forma?: string | null }

type Item = {
  codigoFornecedor: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  cst?: string
  csosn?: string
  baseIcms?: number | null
  valorIcms?: number | null
  aliquotaIcms?: number | null
  baseIcmsSt?: number | null
  valorIcmsSt?: number | null
  aliquotaIcmsSt?: number | null
  valorIpi?: number | null
  aliquotaIpi?: number | null
  valorPis?: number | null
  aliquotaPis?: number | null
  valorCofins?: number | null
  aliquotaCofins?: number | null
  produtoId?: string | null
  produtoCodigo?: string | null
  produtoNome?: string | null
  vinculoStatus?: StatusVinculo
  candidatos?: Array<{ id: string; codigo: string; nome: string }>
  sugestoes?: SugestaoProduto[]
  unidadeEstoque?: string | null
  fatorConversao?: number | null
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
  baseIcms?: number | null
  valorIcms?: number | null
  baseIcmsSt?: number | null
  valorIcmsSt?: number | null
  valorIpi?: number | null
  valorPis?: number | null
  valorCofins?: number | null
  valorFrete?: number | null
  valorSeguro?: number | null
  valorDesconto?: number | null
  outrasDespesas?: number | null
  pagamentos?: Pagamento[]
  itens: Item[]
  avisos: string[]
}

type ProdutoCatalogo = { id: string; codigo: string; nome: string; unidade: string | null; custo: number | null }
type CadastroNovo = { aberto: boolean; categoria: string; unidadeEstoque: string; fator: string; salvando: boolean; erro?: string }

const itemVazio = (): Item => ({
  codigoFornecedor: '', descricao: '', ncm: '', cfop: '', unidade: 'UN', quantidade: 1,
  valorUnitario: null, valorTotal: null, produtoId: null, produtoCodigo: null, produtoNome: null,
  vinculoStatus: 'pendente', sugestoes: [], candidatos: [], unidadeEstoque: 'UN', fatorConversao: 1,
})

const notaManual = (): Nota => ({
  origem: 'manual', chaveAcesso: '', numero: '', serie: '', dataEmissao: new Date().toISOString(),
  fornecedorId: null, fornecedorNome: '', fornecedorCnpj: '', valorProdutos: null, valorTotal: null,
  baseIcms: null, valorIcms: null, baseIcmsSt: null, valorIcmsSt: null, valorIpi: null,
  valorPis: null, valorCofins: null, valorFrete: null, valorSeguro: null, valorDesconto: null,
  outrasDespesas: null, pagamentos: [], itens: [itemVazio()], avisos: [],
})

function normalizarCodigo(valor: string) {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '')
}
function numeroInput(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function moeda(valor: number | null | undefined) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dataInput(iso: string) {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sugerirConversao(item: Item) {
  const un = (item.unidade || '').toUpperCase()
  const desc = (item.descricao || '').toUpperCase()
  if (un === 'UN' || un === 'PC' || un === 'PCS') return { unidadeEstoque: 'UN', fator: 1, motivo: 'A unidade da NF já representa peça/unidade.' }
  if (un === 'PCT' || un === 'PT' || un === 'PAC') {
    const m = desc.match(/(?:PACOTE|COM|C\/)?\s*(\d{1,4})\s*(?:PCS|PC|PECAS|PEÇAS)/i)
    if (m?.[1]) return { unidadeEstoque: 'UN', fator: Number(m[1]), motivo: `A descrição informa pacote com ${m[1]} peças.` }
  }
  return { unidadeEstoque: un || 'UN', fator: un ? 1 : 1, motivo: 'Confirme a unidade e o fator antes de cadastrar.' }
}

export default function EntradaComprasPage() {
  const [modo, setModo] = useState<Modo>('xml')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [nota, setNota] = useState<Nota | null>(null)
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([])
  const [buscas, setBuscas] = useState<Record<number, string>>({})
  const [cadastros, setCadastros] = useState<Record<number, CadastroNovo>>({})
  const [lendo, setLendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [gerarContasPagar, setGerarContasPagar] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{
    nfId: string; numero?: string; itensRegistrados: number; itensPendentes: number; custosAtualizados: number;
    contasPagarGeradas?: number; arquivoGuardado: boolean; avisos?: string[]
  } | null>(null)

  useEffect(() => { carregarCatalogo() }, [])

  async function carregarCatalogo() {
    try {
      const token = await tokenAtual(); if (!token) return
      const resp = await fetch('/api/compras/nf-entrada/catalogo', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await resp.json(); if (resp.ok) setCatalogo(json.produtos || [])
    } catch {}
  }

  function trocarModo(novo: Modo) {
    setModo(novo); setArquivo(null); setNota(novo === 'manual' ? notaManual() : null); setBuscas({}); setCadastros({})
    setErro(''); setSucesso(null); setGerarContasPagar(true); setObservacoes('')
  }

  async function lerArquivo() {
    if (!arquivo) return setErro('Selecione um arquivo primeiro.')
    setLendo(true); setErro(''); setSucesso(null)
    try {
      const token = await tokenAtual(); if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const form = new FormData(); form.append('modo', modo); form.append('arquivo', arquivo)
      const resp = await fetch('/api/compras/nf-entrada/preview', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const json = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(json?.error || 'Não foi possível ler a nota.')
      setNota(json.nf)
      const novasBuscas: Record<number, string> = {}
      ;(json.nf?.itens || []).forEach((item: Item, i: number) => { if (item.produtoId) novasBuscas[i] = `${item.produtoCodigo || ''} — ${item.produtoNome || ''}` })
      setBuscas(novasBuscas); setCadastros({})
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao ler a nota.') } finally { setLendo(false) }
  }

  function atualizarNota<K extends keyof Nota>(campo: K, valor: Nota[K]) { setNota(n => n ? { ...n, [campo]: valor } : n) }
  function atualizarItem(index: number, campo: keyof Item, valor: string | number | null) {
    setNota(n => {
      if (!n) return n
      const itens = [...n.itens]; const atual = { ...itens[index], [campo]: valor }
      if (campo === 'quantidade' || campo === 'valorUnitario') {
        const qtd = campo === 'quantidade' ? Number(valor) : Number(atual.quantidade)
        const unit = campo === 'valorUnitario' ? Number(valor) : Number(atual.valorUnitario)
        if (Number.isFinite(qtd) && Number.isFinite(unit)) atual.valorTotal = qtd * unit
      }
      if (campo === 'codigoFornecedor') {
        const codigo = normalizarCodigo(String(valor || ''))
        const encontrados = catalogo.filter(p => normalizarCodigo(p.codigo) === codigo)
        if (encontrados.length === 1) {
          const p = encontrados[0]; atual.produtoId = p.id; atual.produtoCodigo = p.codigo; atual.produtoNome = p.nome; atual.vinculoStatus = 'vinculado'; atual.unidadeEstoque = p.unidade
          setBuscas(prev => ({ ...prev, [index]: `${p.codigo} — ${p.nome}` }))
        }
      }
      itens[index] = atual; return { ...n, itens }
    })
  }
  function atualizarPagamento(index: number, campo: keyof Pagamento, valor: string | number | null) {
    setNota(n => { if (!n) return n; const pagamentos = [...(n.pagamentos || [])]; pagamentos[index] = { ...pagamentos[index], [campo]: valor }; return { ...n, pagamentos } })
  }
  function adicionarPagamento() { setNota(n => n ? { ...n, pagamentos: [...(n.pagamentos || []), { numero: String((n.pagamentos?.length || 0) + 1), vencimento: null, valor: null, forma: null }] } : n) }
  function removerPagamento(index: number) { setNota(n => n ? { ...n, pagamentos: (n.pagamentos || []).filter((_, i) => i !== index) } : n) }
  function adicionarItem() { setNota(n => n ? { ...n, itens: [...n.itens, itemVazio()] } : n) }
  function removerItem(index: number) {
    setNota(n => n ? { ...n, itens: n.itens.filter((_, i) => i !== index) } : n)
    setBuscas(prev => { const novo: Record<number, string> = {}; Object.entries(prev).forEach(([k, v]) => { const i = Number(k); if (i < index) novo[i] = v; if (i > index) novo[i - 1] = v }); return novo })
  }

  function vincularProduto(index: number, valor: string) {
    setBuscas(prev => ({ ...prev, [index]: valor }))
    const produto = catalogo.find(p => `${p.codigo} — ${p.nome}` === valor) || catalogo.find(p => normalizarCodigo(p.codigo) === normalizarCodigo(valor))
    if (!produto) return
    setNota(n => { if (!n) return n; const itens = [...n.itens]; itens[index] = { ...itens[index], produtoId: produto.id, produtoCodigo: produto.codigo, produtoNome: produto.nome, unidadeEstoque: produto.unidade, vinculoStatus: 'vinculado' }; return { ...n, itens } })
    setBuscas(prev => ({ ...prev, [index]: `${produto.codigo} — ${produto.nome}` }))
  }
  function desvincularProduto(index: number) {
    setNota(n => { if (!n) return n; const itens = [...n.itens]; itens[index] = { ...itens[index], produtoId: null, produtoCodigo: null, produtoNome: null, vinculoStatus: 'pendente', fatorConversao: null }; return { ...n, itens } })
    setBuscas(prev => ({ ...prev, [index]: '' }))
  }

  function abrirCadastro(index: number) {
    if (!nota) return
    const s = sugerirConversao(nota.itens[index])
    setCadastros(prev => ({ ...prev, [index]: { aberto: true, categoria: 'acessorio', unidadeEstoque: s.unidadeEstoque, fator: String(s.fator), salvando: false } }))
  }
  function mudarCadastro(index: number, patch: Partial<CadastroNovo>) { setCadastros(prev => ({ ...prev, [index]: { ...(prev[index] || { aberto: true, categoria: 'acessorio', unidadeEstoque: 'UN', fator: '1', salvando: false }), ...patch } })) }

  async function cadastrarProdutoDaNf(index: number) {
    if (!nota) return
    const item = nota.itens[index]; const cfg = cadastros[index]; if (!cfg) return
    mudarCadastro(index, { salvando: true, erro: '' })
    try {
      const token = await tokenAtual(); if (!token) throw new Error('Sessão expirada.')
      const resp = await fetch('/api/compras/produtos/vincular', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedorId: nota.fornecedorId, fornecedorNome: nota.fornecedorNome, fornecedorCnpj: nota.fornecedorCnpj,
          codigoFornecedor: item.codigoFornecedor, descricao: item.descricao, ncm: item.ncm,
          unidadeCompra: item.unidade, unidadeEstoque: cfg.unidadeEstoque, fatorConversao: numeroInput(cfg.fator), categoria: cfg.categoria,
        }),
      })
      const json = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(json.error || 'Não foi possível cadastrar o produto.')
      const p = json.produto
      setNota(n => { if (!n) return n; const itens = [...n.itens]; itens[index] = { ...itens[index], produtoId: p.id, produtoCodigo: p.codigo, produtoNome: p.nome, unidadeEstoque: p.unidade || cfg.unidadeEstoque, fatorConversao: numeroInput(cfg.fator), vinculoStatus: 'vinculado', sugestoes: [] }; return { ...n, fornecedorId: json.fornecedor?.id || n.fornecedorId, itens } })
      setCatalogo(prev => prev.some(x => x.id === p.id) ? prev : [...prev, { id: p.id, codigo: p.codigo || item.codigoFornecedor, nome: p.nome, unidade: p.unidade || cfg.unidadeEstoque, custo: null }])
      setBuscas(prev => ({ ...prev, [index]: `${p.codigo || item.codigoFornecedor} — ${p.nome}` }))
      mudarCadastro(index, { aberto: false, salvando: false })
    } catch (e) { mudarCadastro(index, { salvando: false, erro: e instanceof Error ? e.message : 'Erro ao cadastrar.' }) }
  }

  async function confirmar() {
    if (!nota) return
    if (!nota.itens.length) return setErro('Inclua pelo menos um item.')
    setConfirmando(true); setErro('')
    try {
      const token = await tokenAtual(); if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const form = new FormData(); form.append('payload', JSON.stringify({ ...nota, observacoes, gerarContasPagar })); if (arquivo && modo !== 'manual') form.append('arquivo', arquivo)
      const resp = await fetch('/api/compras/nf-entrada/confirmar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const json = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(json?.error || 'Não foi possível confirmar a entrada.')
      setSucesso(json)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao confirmar a entrada.') } finally { setConfirmando(false) }
  }

  const totais = useMemo(() => {
    const itens = nota?.itens || []; const total = itens.reduce((s, i) => s + (Number(i.valorTotal) || 0), 0); const vinculados = itens.filter(i => i.produtoId).length
    const parcelas = (nota?.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0)
    return { total, vinculados, pendentes: itens.length - vinculados, parcelas }
  }, [nota])

  if (sucesso) return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-7 shadow-sm">
    <CheckCircle2 size={44} className="text-emerald-600" /><h1 className="mt-4 text-2xl font-bold">Entrada registrada</h1><p className="mt-2 text-slate-600">{sucesso.numero ? `NF ${sucesso.numero}` : 'Nota'} registrada com {sucesso.itensRegistrados} item(ns).</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Resumo titulo="Pendentes de vínculo" valor={sucesso.itensPendentes}/><Resumo titulo="Contas a pagar" valor={sucesso.contasPagarGeradas || 0}/><Resumo titulo="Arquivo guardado" valor={sucesso.arquivoGuardado ? 'Sim' : 'Não'}/></div>
    {sucesso.avisos?.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{sucesso.avisos.join(' ')}</div> : null}
    <div className="mt-6 flex flex-wrap gap-3"><Link href={`/compras/recebimentos/${sucesso.nfId}`} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Conferir recebimento</Link><Link href="/financeiro/contas-pagar" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Ver Contas a Pagar</Link><Link href="/compras" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Central de Compras</Link></div>
  </div></main>

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Compras • Recebimento</p><h1 className="mt-1 text-2xl font-bold">Entrada de Nota Fiscal</h1><p className="mt-1 text-sm text-slate-600">NF → fiscal → vínculo → Contas a Pagar → recebimento → estoque.</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck size={26} className="text-emerald-600"/></div></header>

    <section className="grid gap-3 md:grid-cols-3"><ModoCard ativo={modo==='xml'} onClick={()=>trocarModo('xml')} icon={<FileCode2 size={24}/>} titulo="Importar XML" descricao="Leitura fiscal completa da NF-e."/><ModoCard ativo={modo==='pdf'} onClick={()=>trocarModo('pdf')} icon={<FileText size={24}/>} titulo="Enviar PDF / DANFE" descricao="Leitura assistida + conferência."/><ModoCard ativo={modo==='manual'} onClick={()=>trocarModo('manual')} icon={<ReceiptText size={24}/>} titulo="Lançar manual" descricao="Digite dados fiscais e itens."/></section>

    {modo !== 'manual' && !nota && <section className="rounded-2xl border bg-white p-6 shadow-sm"><label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Upload size={34} className="mx-auto text-slate-400"/><div className="mt-3 font-semibold">Selecione {modo==='xml'?'o XML da NF-e':'o PDF/DANFE'}</div><div className="mt-1 text-sm text-slate-500">Limite 15 MB. O original será guardado na confirmação.</div><input type="file" accept={modo==='xml'?'.xml,application/xml,text/xml':'.pdf,application/pdf'} onChange={e=>setArquivo(e.target.files?.[0]||null)} className="mt-4 text-sm"/></label>{arquivo&&<div className="mt-3 text-sm">Selecionado: <strong>{arquivo.name}</strong></div>}<button onClick={lerArquivo} disabled={!arquivo||lendo} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{lendo?<Loader2 size={16} className="animate-spin"/>:<FileText size={16}/>} {lendo?'Lendo nota...':'Ler e montar prévia'}</button></section>}

    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

    {nota && <>
      {nota.avisos?.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><div>{nota.avisos.map((a,i)=><div key={i}>{a}</div>)}</div></div></div>}

      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Dados da nota e fornecedor</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><Campo label="Número da NF" value={nota.numero} onChange={v=>atualizarNota('numero',v)}/><Campo label="Série" value={nota.serie} onChange={v=>atualizarNota('serie',v)}/><Campo label="Data de emissão" type="date" value={dataInput(nota.dataEmissao)} onChange={v=>atualizarNota('dataEmissao',v?`${v}T12:00:00.000Z`:'')}/><Campo label="Chave de acesso" value={nota.chaveAcesso} onChange={v=>atualizarNota('chaveAcesso',v)}/><div className="md:col-span-2"><Campo label="Fornecedor / Razão social" value={nota.fornecedorNome} onChange={v=>atualizarNota('fornecedorNome',v)}/></div><Campo label="CNPJ / CPF" value={nota.fornecedorCnpj} onChange={v=>atualizarNota('fornecedorCnpj',v)}/><CampoNumero label="Valor total da NF" value={nota.valorTotal} onChange={v=>atualizarNota('valorTotal',v)}/></div>{nota.fornecedorId&&<div className="mt-3 text-xs font-medium text-emerald-700">✓ Fornecedor já encontrado no Atlas.</div>}</section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ReceiptText size={20}/><h2 className="font-semibold">Resumo fiscal</h2></div><p className="mt-1 text-xs text-slate-500">XML é a fonte preferencial. No PDF/DANFE, confira os tributos identificados.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fiscal label="Produtos" valor={nota.valorProdutos}/><Fiscal label="Base ICMS" valor={nota.baseIcms}/><Fiscal label="ICMS" valor={nota.valorIcms}/><Fiscal label="ICMS-ST" valor={nota.valorIcmsSt}/><Fiscal label="IPI" valor={nota.valorIpi}/><Fiscal label="PIS" valor={nota.valorPis}/><Fiscal label="COFINS" valor={nota.valorCofins}/><Fiscal label="Frete" valor={nota.valorFrete}/><Fiscal label="Seguro" valor={nota.valorSeguro}/><Fiscal label="Desconto" valor={nota.valorDesconto}/><Fiscal label="Outras despesas" valor={nota.outrasDespesas}/><Fiscal label="Total NF" valor={nota.valorTotal} destaque/></div></section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><WalletCards size={20}/><h2 className="font-semibold">Contas a Pagar</h2></div><p className="mt-1 text-sm text-slate-500">As parcelas encontradas na NF serão enviadas ao Financeiro quando você confirmar.</p></div><button onClick={adicionarPagamento} className="rounded-lg border px-3 py-2 text-sm font-semibold"><Plus size={15} className="mr-1 inline"/>Adicionar parcela</button></div><div className="mt-4 space-y-2">{(nota.pagamentos||[]).map((p,i)=><div key={i} className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[100px_1fr_1fr_42px]"><Campo label="Parcela" value={p.numero} onChange={v=>atualizarPagamento(i,'numero',v)}/><Campo label="Vencimento" type="date" value={p.vencimento||''} onChange={v=>atualizarPagamento(i,'vencimento',v||null)}/><CampoNumero label="Valor" value={p.valor} onChange={v=>atualizarPagamento(i,'valor',v)}/><button onClick={()=>removerPagamento(i)} className="mt-5 h-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} className="mx-auto"/></button></div>)}{!(nota.pagamentos||[]).length&&<div className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Nenhuma parcela foi identificada. Se você mantiver a geração financeira ativa, o Atlas criará uma conta pelo total da NF com vencimento pendente para conferência.</div>}</div><div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><input id="gerar-cp" type="checkbox" checked={gerarContasPagar} onChange={e=>setGerarContasPagar(e.target.checked)} className="mt-1 h-4 w-4"/><label htmlFor="gerar-cp" className="text-sm text-emerald-950"><strong>Gerar Contas a Pagar ao confirmar a NF.</strong><br/><span className="text-emerald-800">Parcelas: {moeda(totais.parcelas)} • Total da NF: {moeda(nota.valorTotal)}</span></label></div></section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Itens da compra</h2><p className="mt-1 text-sm text-slate-500">Código exato vincula; sem código, o Atlas apenas sugere por descrição/NCM e você decide.</p></div><button onClick={adicionarItem} className="rounded-lg border px-3 py-2 text-sm font-semibold"><Plus size={16} className="mr-1 inline"/>Adicionar item</button></div><datalist id="catalogo-produtos-atlas">{catalogo.map(p=><option key={p.id} value={`${p.codigo} — ${p.nome}`}/>)}</datalist><div className="mt-4 space-y-4">{nota.itens.map((item,index)=><div key={index} className="rounded-xl border p-4">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold">Item {index+1}</div><button onClick={()=>removerItem(index)} disabled={nota.itens.length<=1} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={16}/></button></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-12"><div className="lg:col-span-2"><Campo label="Código fornecedor" value={item.codigoFornecedor} onChange={v=>atualizarItem(index,'codigoFornecedor',v)}/></div><div className="lg:col-span-4"><Campo label="Descrição" value={item.descricao} onChange={v=>atualizarItem(index,'descricao',v)}/></div><div className="lg:col-span-1"><Campo label="Un. compra" value={item.unidade} onChange={v=>atualizarItem(index,'unidade',v)}/></div><div className="lg:col-span-1"><CampoNumero label="Qtde" value={item.quantidade} onChange={v=>atualizarItem(index,'quantidade',v)}/></div><div className="lg:col-span-2"><CampoNumero label="Unitário" value={item.valorUnitario} onChange={v=>atualizarItem(index,'valorUnitario',v)}/></div><div className="lg:col-span-2"><CampoNumero label="Total item" value={item.valorTotal} onChange={v=>atualizarItem(index,'valorTotal',v)}/></div></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-12"><div className="lg:col-span-2"><Campo label="NCM" value={item.ncm} onChange={v=>atualizarItem(index,'ncm',v)}/></div><div className="lg:col-span-2"><Campo label="CFOP" value={item.cfop} onChange={v=>atualizarItem(index,'cfop',v)}/></div><div className="lg:col-span-1"><Campo label="CST" value={item.cst||item.csosn||''} onChange={v=>atualizarItem(index,'cst',v)}/></div><div className="lg:col-span-2"><CampoNumero label="BC ICMS" value={item.baseIcms} onChange={v=>atualizarItem(index,'baseIcms',v)}/></div><div className="lg:col-span-2"><CampoNumero label="ICMS" value={item.valorIcms} onChange={v=>atualizarItem(index,'valorIcms',v)}/></div><div className="lg:col-span-1"><CampoNumero label="% ICMS" value={item.aliquotaIcms} onChange={v=>atualizarItem(index,'aliquotaIcms',v)}/></div><div className="lg:col-span-2"><CampoNumero label="IPI" value={item.valorIpi} onChange={v=>atualizarItem(index,'valorIpi',v)}/></div></div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3"><label className="text-xs font-medium text-slate-500">Produto correspondente no Atlas</label><div className="mt-1 flex gap-2"><input list="catalogo-produtos-atlas" value={buscas[index]??(item.produtoId?`${item.produtoCodigo||''} — ${item.produtoNome||''}`:'')} onChange={e=>vincularProduto(index,e.target.value)} placeholder="Digite código ou escolha um produto..." className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>{item.produtoId&&<button onClick={()=>desvincularProduto(index)} className="rounded-lg border px-3 text-xs font-semibold">Desvincular</button>}</div><StatusVinculo status={item.produtoId?'vinculado':item.vinculoStatus||'pendente'}/>
          {!item.produtoId&&item.candidatos?.length?<div className="mt-2 flex flex-wrap gap-2">{item.candidatos.map(c=><button key={c.id} onClick={()=>vincularProduto(index,`${c.codigo} — ${c.nome}`)} className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs">{c.codigo} — {c.nome}</button>)}</div>:null}
          {!item.produtoId&&item.sugestoes?.length?<div className="mt-3"><div className="text-xs font-semibold text-blue-700">Sugestões — confirme antes de associar:</div><div className="mt-2 flex flex-wrap gap-2">{item.sugestoes.map(s=><button key={s.id} onClick={()=>vincularProduto(index,`${s.codigo} — ${s.nome}`)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-left text-xs text-blue-900"><strong>{s.codigo || 'sem código'}</strong> — {s.nome}<span className="ml-1 text-blue-600">({s.score}% • {s.motivo})</span></button>)}</div></div>:null}
          {item.produtoId?<div className="mt-3 grid gap-2 sm:grid-cols-2"><Campo label="Unidade de estoque" value={item.unidadeEstoque||''} onChange={v=>atualizarItem(index,'unidadeEstoque',v)}/><CampoNumero label="Fator: 1 un. compra = X un. estoque" value={item.fatorConversao} onChange={v=>atualizarItem(index,'fatorConversao',v)}/></div>:<div className="mt-3"><button onClick={()=>abrirCadastro(index)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/>Cadastrar produto a partir da NF</button></div>}
          {cadastros[index]?.aberto&&<CadastroProduto item={item} cfg={cadastros[index]} onChange={p=>mudarCadastro(index,p)} onConfirm={()=>cadastrarProdutoDaNf(index)} onCancel={()=>mudarCadastro(index,{aberto:false})}/>} 
        </div>
      </div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="grid gap-3 sm:grid-cols-3"><Resumo titulo="Itens" valor={nota.itens.length}/><Resumo titulo="Vinculados" valor={totais.vinculados}/><Resumo titulo="Pendentes" valor={totais.pendentes}/></div><div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><strong><Boxes size={16} className="mr-1 inline"/>Estoque:</strong> confirmar a NF não aumenta o saldo. A entrada ocorre quando o recebimento físico for conferido; item sem vínculo ou conversão fica pendente.</div><label className="mt-4 block text-xs font-medium text-slate-500">Observações<textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Frete, divergência, lote, conferência..."/></label><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-600">Total dos itens: <strong>{moeda(totais.total)}</strong></div><button onClick={confirmar} disabled={confirmando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{confirmando?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>} {confirmando?'Confirmando...':'Confirmar NF + Financeiro'}</button></div></section>
    </>}
  </div></main>
}

function CadastroProduto({item,cfg,onChange,onConfirm,onCancel}:{item:Item;cfg:CadastroNovo;onChange:(p:Partial<CadastroNovo>)=>void;onConfirm:()=>void;onCancel:()=>void}){
 const s=sugerirConversao(item)
 return <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><div className="font-semibold text-indigo-950">Cadastrar novo produto</div><p className="mt-1 text-xs text-indigo-800">Código e descrição vêm da NF. Confirme categoria, unidade de estoque e conversão. Sugestão: {s.motivo}</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="text-xs text-slate-600">Categoria<select value={cfg.categoria} onChange={e=>onChange({categoria:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"><option value="acessorio">Acessório</option><option value="perfil">Perfil</option><option value="produto">Produto</option><option value="outro">Outro</option></select></label><Campo label="Unidade de estoque" value={cfg.unidadeEstoque} onChange={v=>onChange({unidadeEstoque:v})}/><Campo label="Fator de conversão" type="number" value={cfg.fator} onChange={v=>onChange({fator:v})}/></div>{cfg.erro&&<div className="mt-2 text-xs font-medium text-red-700">{cfg.erro}</div>}<div className="mt-3 flex gap-2"><button disabled={cfg.salvando} onClick={onConfirm} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{cfg.salvando?'Salvando...':'Confirmar cadastro e vínculo'}</button><button onClick={onCancel} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Cancelar</button></div></div>
}
function Campo({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <label className="block text-xs font-medium text-slate-500">{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} step={type==='number'?'any':undefined} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"/></label>}
function CampoNumero({label,value,onChange}:{label:string;value:number|null|undefined;onChange:(v:number|null)=>void}){return <Campo label={label} type="number" value={value==null?'':String(value)} onChange={v=>onChange(numeroInput(v))}/>}
function ModoCard({ativo,onClick,icon,titulo,descricao}:{ativo:boolean;onClick:()=>void;icon:React.ReactNode;titulo:string;descricao:string}){return <button onClick={onClick} className={`rounded-2xl border p-5 text-left transition ${ativo?'border-blue-400 bg-blue-50 ring-2 ring-blue-100':'border-slate-200 bg-white hover:border-slate-300'}`}><div className={ativo?'text-blue-700':'text-slate-500'}>{icon}</div><div className="mt-3 font-semibold">{titulo}</div><div className="mt-1 text-sm text-slate-500">{descricao}</div></button>}
function StatusVinculo({status}:{status:StatusVinculo}){if(status==='vinculado')return <div className="mt-1 text-xs font-medium text-emerald-700">✓ Vinculado ao cadastro do Atlas</div>;if(status==='ambiguo')return <div className="mt-1 text-xs font-medium text-amber-700">⚠ Mais de um produto com o mesmo código — escolha o correto</div>;return <div className="mt-1 text-xs font-medium text-slate-500">Pendente — escolha uma sugestão ou cadastre o produto</div>}
function Resumo({titulo,valor}:{titulo:string;valor:string|number}){return <div className="rounded-xl border bg-slate-50 p-3"><div className="text-xs text-slate-500">{titulo}</div><div className="mt-1 text-lg font-bold">{valor}</div></div>}
function Fiscal({label,valor,destaque=false}:{label:string;valor:number|null|undefined;destaque?:boolean}){return <div className={`rounded-xl border p-3 ${destaque?'border-emerald-200 bg-emerald-50':'bg-slate-50'}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-bold">{moeda(valor)}</div></div>}
