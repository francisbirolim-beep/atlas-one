'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, Check, Loader2, Plus, RefreshCw, RotateCcw, Trash2, Warehouse } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import {
  adicionarCompraManual,
  adicionarMaterialManual,
  ajustarCompra,
  ajustarMaterial,
  carregarPacoteCompleto,
  excluirMaterialDoPacote,
  gerarPacoteTecnico,
  listarPacotesDaObra,
  listarSobrasDisponiveis,
  recalcularAproveitamentoPacote,
  reservarSobraPerfil,
  separarBarraInteira,
  type CompraPacote,
  type MaterialPacote,
  type PacoteTecnico,
  type SeparacaoPacote,
  type SobraPerfil,
} from '@/lib/materialPlanejamento'
import {
  cancelarSeparacaoMaterial,
  listarProdutosParaMaterial,
  listarSaldosPerfis,
  type SaldoPerfilEstoque,
} from '@/lib/materialSeparacao'

type Aba = 'necessidade' | 'barras' | 'estoque' | 'compras'
type NovoMaterial = { categoria: MaterialPacote['categoria']; produto_id: string; descricao: string; quantidade: string; corte: string; barra: string }
type NovaCompra = { categoria: string; produto_id: string; descricao: string; quantidade: string; barra: string }

const NOVO_MATERIAL: NovoMaterial = { categoria: 'perfil', produto_id: '', descricao: '', quantidade: '1', corte: '', barra: '' }
const NOVA_COMPRA: NovaCompra = { categoria: 'perfil', produto_id: '', descricao: '', quantidade: '1', barra: '' }

function n(v: unknown) { const x = Number(v); return Number.isFinite(x) ? x : 0 }
function qtd(v: unknown) { return n(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) }
function mm(v: unknown) { return `${Math.round(n(v)).toLocaleString('pt-BR')} mm` }
function dinheiro(v: unknown) { return n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function MateriaisObraPage() {
  const params = useParams()
  const obraId = String(params?.id || '')
  const [obra, setObra] = useState<any>(null)
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [orcamentoId, setOrcamentoId] = useState('')
  const [pacotes, setPacotes] = useState<PacoteTecnico[]>([])
  const [pacoteId, setPacoteId] = useState('')
  const [pacote, setPacote] = useState<PacoteTecnico | null>(null)
  const [materiais, setMateriais] = useState<MaterialPacote[]>([])
  const [barras, setBarras] = useState<any[]>([])
  const [cortes, setCortes] = useState<any[]>([])
  const [separacoes, setSeparacoes] = useState<SeparacaoPacote[]>([])
  const [compras, setCompras] = useState<CompraPacote[]>([])
  const [saldos, setSaldos] = useState<SaldoPerfilEstoque[]>([])
  const [sobras, setSobras] = useState<SobraPerfil[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [aba, setAba] = useState<Aba>('necessidade')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [novo, setNovo] = useState<NovoMaterial>(NOVO_MATERIAL)
  const [novaCompra, setNovaCompra] = useState<NovaCompra>(NOVA_COMPRA)

  useEffect(() => { if (obraId) void carregarBase() }, [obraId])
  useEffect(() => { if (pacoteId) void carregarPacote(pacoteId) }, [pacoteId])

  async function carregarBase() {
    setCarregando(true)
    const [obraResp, orcResp, pacoteResp, produtosResp] = await Promise.all([
      supabase.from('obras').select('id,numero,nome,cliente_id,clientes(id,nome)').eq('id', obraId).maybeSingle(),
      supabase.from('orcamentos').select('id,numero,status,valor_estimado,created_at').eq('obra_id', obraId).order('created_at', { ascending: false }),
      listarPacotesDaObra(obraId),
      listarProdutosParaMaterial(),
    ])
    setObra(obraResp.data || null)
    setOrcamentos(orcResp.data || [])
    setPacotes(pacoteResp)
    setProdutos(produtosResp)
    if (!orcamentoId && orcResp.data?.[0]) setOrcamentoId(orcResp.data[0].id)
    if (pacoteResp[0]) setPacoteId(pacoteResp[0].id)
    setCarregando(false)
  }

  async function carregarPacote(id: string) {
    setOcupado(true)
    const c = await carregarPacoteCompleto(id)
    setPacote(c.pacote); setMateriais(c.materiais); setBarras(c.barras); setCortes(c.cortes); setSeparacoes(c.separacoes); setCompras(c.compras)
    const produtoIds = Array.from(new Set(c.materiais.filter(m => ['perfil', 'contramarco'].includes(m.categoria) && m.produto_id).map(m => m.produto_id!)))
    const [sa, so] = await Promise.all([listarSaldosPerfis(produtoIds), listarSobrasDisponiveis(produtoIds)])
    setSaldos(sa); setSobras(so); setOcupado(false)
  }

  async function gerar() {
    if (!orcamentoId) return
    setOcupado(true); setErro(''); setMensagem('')
    const u = await usuarioAtual()
    const r = await gerarPacoteTecnico(orcamentoId, 'projeto_conferido', u, { perdaCorteMm: 0, minimoSobraReaproveitavelMm: 300 })
    setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    setMensagem('Pacote técnico gerado. Agora confira fisicamente estoque, barras e retalhos.')
    await carregarBase(); setPacoteId(r.pacote.id)
  }

  async function recalcular(id = pacote?.id) {
    if (!id) return
    const reservadas = separacoes.filter(s => s.sobra_estoque_id && s.status !== 'cancelado').map(s => s.sobra_estoque_id!)
    setOcupado(true)
    const r = await recalcularAproveitamentoPacote(id, reservadas)
    setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    setMensagem('Aproveitamento e lista de compra recalculados.')
    await carregarPacote(id)
  }

  const ativos = materiais.filter(m => !m.excluido)
  const perfilIds = useMemo(() => new Set(ativos.filter(m => ['perfil', 'contramarco'].includes(m.categoria)).map(m => m.produto_id).filter(Boolean)), [materiais])
  const porCategoria = (cat: string) => ativos.filter(m => m.categoria === cat)
  const cortesDaBarra = (id: string) => cortes.filter(c => c.barra_id === id)

  async function editarMaterial(m: MaterialPacote) {
    const valor = window.prompt(`Quantidade ajustada de ${m.codigo || m.descricao}:`, String(m.quantidade_ajustada).replace('.', ','))
    if (valor == null) return
    const motivo = window.prompt('Motivo do ajuste:', 'Conferência técnica / estoque') || ''
    if (motivo.trim().length < 3) return
    setOcupado(true)
    const r = await ajustarMaterial(m.id, { quantidade_ajustada: Number(valor.replace(',', '.')) || 0, justificativa_ajuste: motivo })
    setOcupado(false)
    if (!r.ok) setErro(r.error); else await recalcular()
  }

  async function removerMaterial(m: MaterialPacote) {
    const motivo = window.prompt(`Motivo para retirar ${m.codigo || m.descricao}:`, '') || ''
    if (motivo.trim().length < 3) return
    setOcupado(true); const r = await excluirMaterialDoPacote(m.id, motivo); setOcupado(false)
    if (!r.ok) setErro(r.error); else await recalcular()
  }

  async function adicionarMaterialComMotivo(motivo: string) {
    if (!pacote || motivo.trim().length < 3) return
    const p = produtos.find((x: any) => x.id === novo.produto_id)
    const descricao = p?.nome || novo.descricao
    if (!descricao?.trim()) { setErro('Escolha um produto ou informe a descrição.'); return }
    setOcupado(true)
    const r = await adicionarMaterialManual(pacote.id, {
      categoria: novo.categoria, produto_id: p?.id || null, codigo: p?.codigo || null, descricao,
      unidade: p?.unidade || 'UN', quantidade: Number(novo.quantidade.replace(',', '.')) || 0,
      comprimento_corte_mm: novo.corte ? Number(novo.corte.replace(',', '.')) : null,
      comprimento_barra_mm: novo.barra ? Number(novo.barra.replace(',', '.')) : (p?.tamanho_barra_mm || null), justificativa: motivo,
    })
    setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    setNovo(NOVO_MATERIAL); await recalcular()
  }

  async function separarSaldo(s: SaldoPerfilEstoque) {
    if (!pacote) return
    const valor = window.prompt(`Quantas barras separar? Disponível: ${qtd(s.disponivel)}`, '1')
    if (valor == null) return
    const usuario = await usuarioAtual(); setOcupado(true)
    const r = await separarBarraInteira(pacote, { produto_id: s.produto_id, local_id: s.local_id, endereco_id: s.endereco_id || null, quantidade: Number(valor.replace(',', '.')) || 0, usuario, observacoes: `Separado para ${obra?.nome || 'obra'}` })
    setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    await carregarPacote(pacote.id); await recalcular(pacote.id)
  }

  async function separarSobra(s: SobraPerfil) {
    if (!pacote) return
    const usuario = await usuarioAtual(); setOcupado(true); const r = await reservarSobraPerfil(pacote, s, usuario); setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    await carregarPacote(pacote.id); await recalcular(pacote.id)
  }

  async function desfazer(s: SeparacaoPacote) {
    if (!window.confirm('Desfazer esta separação e devolver a disponibilidade ao estoque?')) return
    setOcupado(true); const r = await cancelarSeparacaoMaterial(s); setOcupado(false)
    if (!r.ok) { setErro(r.error || 'Erro ao desfazer.'); return }
    await carregarPacote(s.pacote_id); await recalcular(s.pacote_id)
  }

  async function editarCompra(c: CompraPacote) {
    const valor = window.prompt(`Quantidade final para comprar de ${c.codigo || c.descricao}:`, String(c.quantidade_ajustada).replace('.', ','))
    if (valor == null) return
    const motivo = window.prompt('Motivo do ajuste da compra:', 'Conferência física do estoque') || ''
    if (motivo.trim().length < 3) return
    setOcupado(true); const r = await ajustarCompra(c.id, Number(valor.replace(',', '.')) || 0, motivo); setOcupado(false)
    if (!r.ok) setErro(r.error); else await carregarPacote(c.pacote_id)
  }

  async function adicionarCompraComMotivo(motivo: string) {
    if (!pacote || motivo.trim().length < 3) return
    const p = produtos.find((x: any) => x.id === novaCompra.produto_id)
    const descricao = p?.nome || novaCompra.descricao
    if (!descricao?.trim()) { setErro('Escolha um produto ou informe a descrição.'); return }
    setOcupado(true)
    const r = await adicionarCompraManual(pacote.id, {
      categoria: novaCompra.categoria, produto_id: p?.id || null, codigo: p?.codigo || null, descricao,
      unidade: p?.unidade || 'UN', comprimento_barra_mm: novaCompra.barra ? Number(novaCompra.barra.replace(',', '.')) : (p?.tamanho_barra_mm || null),
      quantidade: Number(novaCompra.quantidade.replace(',', '.')) || 0, justificativa: motivo,
    })
    setOcupado(false)
    if (!r.ok) { setErro(r.error); return }
    setNovaCompra(NOVA_COMPRA); await carregarPacote(pacote.id)
  }

  async function marcarConferido() {
    if (!pacote) return
    const pendentes = ativos.filter(m => m.status_calculo === 'pendente_formula')
    if (pendentes.length && !window.confirm(`Existem ${pendentes.length} pendência(s) técnica(s). Marcar a conferência mesmo assim?`)) return
    setOcupado(true); const { error } = await supabase.from('pacotes_tecnicos').update({ status: 'conferido' }).eq('id', pacote.id); setOcupado(false)
    if (error) setErro(error.message); else { setMensagem('Pacote marcado como conferido. A lista de compra continua editável até o envio ao fornecedor.'); await carregarPacote(pacote.id) }
  }

  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin" /></div>

  const abas: Array<{ id: Aba; label: string }> = [
    { id: 'necessidade', label: '1. Necessidade técnica' }, { id: 'barras', label: '2. Plano de barras' },
    { id: 'estoque', label: '3. Conferir estoque / sobras' }, { id: 'compras', label: '4. Compra final' },
  ]

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/obras/${obraId}`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} /> Voltar para obra</Link><div className="flex items-center gap-3"><Boxes className="text-amber-600" /><div><h1 className="text-2xl font-bold text-slate-900">Materiais da Obra</h1><p className="text-sm text-slate-500">{obra?.nome || 'Obra'} · necessidade técnica → estoque → compra final.</p></div></div></div><div className="flex gap-2"><button disabled={ocupado || !orcamentoId} onClick={() => void gerar()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Gerar pacote técnico</button>{pacote && <button disabled={ocupado} onClick={() => void marcarConferido()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Check size={15} className="mr-1 inline" />Marcar conferido</button>}</div></header>
    {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}{mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>}

    <section className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Orçamento / venda<select value={orcamentoId} onChange={e => setOrcamentoId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{orcamentos.map(o => <option key={o.id} value={o.id}>#{o.numero || '—'} · {o.status} · {dinheiro(o.valor_estimado)}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Pacote técnico<select value={pacoteId} onChange={e => setPacoteId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">Selecione...</option>{pacotes.map(p => <option key={p.id} value={p.id}>{p.origem} · v{p.versao} · {p.status}</option>)}</select></label></section>

    {!pacote ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Selecione ou gere um pacote técnico para começar.</div> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Materiais', ativos.length], ['Barras planejadas', barras.length], ['Separações do estoque', separacoes.length], ['Linhas para comprar', compras.filter(c => !c.excluido && n(c.quantidade_ajustada) > 0).length]].map(([l, v]) => <div key={String(l)} className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">{l}</p><p className="text-xl font-bold">{v}</p></div>)}</section>
      <div className="overflow-x-auto border-b"><div className="flex min-w-max gap-1">{abas.map(x => <button key={x.id} onClick={() => setAba(x.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${aba === x.id ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500'}`}>{x.label}</button>)}</div></div>

      {aba === 'necessidade' && <div className="space-y-4">
        {(['perfil', 'contramarco', 'acessorio', 'vidro', 'outro'] as const).map(cat => { const lista = porCategoria(cat); if (!lista.length) return null; return <section key={cat} className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-3 font-bold capitalize">{cat === 'acessorio' ? 'Acessórios' : cat === 'contramarco' ? 'Contramarcos' : `${cat}s`}</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Código</th><th>Descrição</th><th>Técnico</th><th>Ajustado</th><th>Corte</th><th>Status</th><th /></tr></thead><tbody className="divide-y">{lista.map(m => <tr key={m.id} className={m.status_calculo === 'pendente_formula' ? 'bg-amber-50' : ''}><td className="px-4 py-3 font-semibold">{m.codigo || '—'}</td><td>{m.descricao}{m.justificativa_ajuste && <div className="text-[11px] text-slate-500">{m.justificativa_ajuste}</div>}</td><td>{qtd(m.quantidade_tecnica)} {m.unidade}</td><td className="font-semibold">{qtd(m.quantidade_ajustada)} {m.unidade}</td><td>{m.comprimento_corte_mm ? mm(m.comprimento_corte_mm) : '—'}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{m.status_calculo}</span></td><td className="px-4"><div className="flex gap-1"><button onClick={() => void editarMaterial(m)} className="rounded-lg border px-2 py-1 text-xs">Editar</button><button onClick={() => void removerMaterial(m)} className="rounded-lg border p-1.5 text-red-600"><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div></section> })}
        <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Acrescentar material</h3><div className="mt-3 grid gap-3 md:grid-cols-6"><select value={novo.categoria} onChange={e => setNovo({ ...novo, categoria: e.target.value as MaterialPacote['categoria'] })} className="rounded-xl border px-3 py-2 text-sm"><option value="perfil">Perfil</option><option value="contramarco">Contramarco</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="outro">Outro</option></select><select value={novo.produto_id} onChange={e => setNovo({ ...novo, produto_id: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="">Catálogo opcional</option>{produtos.map((p: any) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}</select><input value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} placeholder="Descrição" className="rounded-xl border px-3 py-2 text-sm" /><input value={novo.quantidade} onChange={e => setNovo({ ...novo, quantidade: e.target.value })} placeholder="Qtd." className="rounded-xl border px-3 py-2 text-sm" /><input value={novo.corte} onChange={e => setNovo({ ...novo, corte: e.target.value })} placeholder="Corte mm" className="rounded-xl border px-3 py-2 text-sm" /><button onClick={() => { const motivo = window.prompt('Motivo da inclusão:', 'Ajuste após conferência') || ''; if (motivo.trim().length >= 3) void adicionarMaterialComMotivo(motivo) }} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><Plus size={14} className="mr-1 inline" />Adicionar</button></div></section>
      </div>}

      {aba === 'barras' && <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">Plano otimizado de barras</h2><p className="text-xs text-slate-500">Cortes de todas as tipologias agrupados por perfil + cor.</p></div><button onClick={() => void recalcular()} className="rounded-xl border px-3 py-2 text-sm"><RefreshCw size={14} className="mr-1 inline" />Recalcular</button></div><div className="grid gap-3 p-5 lg:grid-cols-2">{barras.map((b, i) => <div key={b.id} className="rounded-xl border p-4"><div className="flex justify-between"><div><b>Barra {i + 1}</b><p className="text-xs text-slate-500">{b.fonte_tipo === 'sobra_estoque' ? 'Retalho reaproveitado' : 'Barra nova'} · {mm(b.comprimento_inicial_mm)}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">sobra {mm(b.sobra_final_mm)}</span></div><div className="mt-3 flex flex-wrap gap-2">{cortesDaBarra(b.id).map((c: any) => <span key={c.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{c.codigo} · {mm(c.comprimento_mm)}</span>)}</div></div>)}</div></section>}

      {aba === 'estoque' && <div className="space-y-4"><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold"><Warehouse size={16} className="mr-1 inline" />Barras inteiras em estoque</h2></div><div className="divide-y">{saldos.filter(s => perfilIds.has(s.produto_id) && s.disponivel > 0).map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><b>{s.produto?.codigo} · {s.produto?.nome}</b><p className="text-xs text-slate-500">{s.local?.nome || 'Estoque'} · disponível {qtd(s.disponivel)} barra(s)</p></div><button onClick={() => void separarSaldo(s)} className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white">Separar para obra</button></div>)}</div></section><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Retalhos / sobras reaproveitáveis</h2></div><div className="divide-y">{sobras.filter(s => s.status === 'disponivel' || s.pacote_reserva_id === pacote.id).map(s => <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><b>{mm(s.comprimento_mm)}</b><p className="text-xs text-slate-500">{s.status}</p></div>{s.pacote_reserva_id === pacote.id ? <span className="text-xs font-bold text-emerald-700">Reservado nesta obra</span> : <button onClick={() => void separarSobra(s)} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700">Usar nesta obra</button>}</div>)}</div></section><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Separado para esta obra</h2></div><div className="divide-y">{separacoes.map(s => <div key={s.id} className="flex items-center justify-between px-5 py-3"><div className="text-sm"><b>{s.tipo_origem === 'sobra_estoque' ? 'Retalho' : 'Barra inteira'}</b><p className="text-xs text-slate-500">Qtd. {qtd(s.quantidade)} {s.comprimento_disponivel_mm ? `· ${mm(s.comprimento_disponivel_mm)}` : ''}</p></div><button onClick={() => void desfazer(s)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-red-600"><RotateCcw size={12} />Desfazer</button></div>)}</div></section></div>}

      {aba === 'compras' && <div className="space-y-4"><section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">Compra final</h2><p className="text-xs text-slate-500">Necessidade − material separado = somente o que falta comprar.</p></div><button onClick={() => void recalcular()} className="rounded-xl border px-3 py-2 text-sm"><RefreshCw size={14} className="mr-1 inline" />Recalcular</button></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Código</th><th>Material</th><th>Calculado</th><th>Comprar</th><th>Origem</th><th /></tr></thead><tbody className="divide-y">{compras.filter(c => !c.excluido).map(c => <tr key={c.id}><td className="px-4 py-3 font-semibold">{c.codigo || '—'}</td><td>{c.descricao}{c.justificativa_ajuste && <div className="text-[11px] text-amber-700">{c.justificativa_ajuste}</div>}</td><td>{qtd(c.quantidade_calculada)} {c.unidade}</td><td className="font-bold">{qtd(c.quantidade_ajustada)} {c.unidade}</td><td>{c.origem}</td><td className="px-4"><button onClick={() => void editarCompra(c)} className="rounded-lg border px-2 py-1 text-xs">Ajustar</button></td></tr>)}</tbody></table></div></section><section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Acrescentar item na compra</h3><div className="mt-3 grid gap-3 md:grid-cols-5"><select value={novaCompra.categoria} onChange={e => setNovaCompra({ ...novaCompra, categoria: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="perfil">Perfil</option><option value="contramarco">Contramarco</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="outro">Outro</option></select><select value={novaCompra.produto_id} onChange={e => setNovaCompra({ ...novaCompra, produto_id: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="">Catálogo opcional</option>{produtos.map((p: any) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}</select><input value={novaCompra.descricao} onChange={e => setNovaCompra({ ...novaCompra, descricao: e.target.value })} placeholder="Descrição" className="rounded-xl border px-3 py-2 text-sm" /><input value={novaCompra.quantidade} onChange={e => setNovaCompra({ ...novaCompra, quantidade: e.target.value })} placeholder="Quantidade" className="rounded-xl border px-3 py-2 text-sm" /><button onClick={() => { const motivo = window.prompt('Motivo da inclusão na compra:', 'Ajuste após conferência do estoque') || ''; if (motivo.trim().length >= 3) void adicionarCompraComMotivo(motivo) }} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><Plus size={14} className="mr-1 inline" />Adicionar</button></div></section></div>}
    </>}
  </div></main>
}
