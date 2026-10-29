'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, TriangleAlert } from 'lucide-react'
import { carregarPrecificacaoOrcamento, salvarCustoComponente, type ComponentePrecificacao, type PrecificacaoOrcamento, type ProdutoPrecificacao } from '@/lib/orcamentoPrecificacao'

const dinheiro = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
const chave = (v?: string | null) => String(v || '').trim().toUpperCase()
const chaveCor = (v?: string | null) => chave(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function Miniatura({ produto, descricao }: { produto: ProdutoPrecificacao | null; descricao: string }) {
  const [erro, setErro] = useState(false)
  return produto?.foto_url && !erro
    ? <img src={produto.foto_url} onError={() => setErro(true)} alt={descricao} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border bg-white object-contain" />
    : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-400 bg-amber-50 p-1 text-center text-[10px] text-amber-800">Imagem pendente</div>
}

export default function CustosPendentesPage() {
  const params = useParams()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<PrecificacaoOrcamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function atualizar() {
    const resultado = await carregarPrecificacaoOrcamento(orcamentoId)
    setDados(resultado)
    setCarregando(false)
  }
  useEffect(() => { if (orcamentoId) void atualizar() }, [orcamentoId])

  const produtosPorId = useMemo(() => new Map((dados?.produtos || []).map(p => [p.id, p])), [dados?.produtos])
  const produtosPorCodigo = useMemo(() => {
    const mapa = new Map<string, ProdutoPrecificacao | null>()
    for (const p of dados?.produtos || []) {
      const k = chave(p.codigo)
      if (k) mapa.set(k, mapa.has(k) ? null : p)
    }
    return mapa
  }, [dados?.produtos])
  const materiaisPorId = useMemo(() => new Map((dados?.materiais || []).map(m => [m.id, m])), [dados?.materiais])

  function produto(c: ComponentePrecificacao) {
    return c.produto_id ? produtosPorId.get(c.produto_id) || null : produtosPorCodigo.get(chave(c.codigo)) || null
  }
  function corPerfil(c: ComponentePrecificacao) {
    const material = c.material_id ? materiaisPorId.get(c.material_id) : null
    const itens: any[] = Array.isArray(dados?.orcamento?.itens) ? dados!.orcamento.itens : []
    const item = itens.find((i: any, idx: number) => String(i.id || `item-${idx + 1}`) === String(c.item_ref || ''))
    return String(material?.cor_ref || item?.cor || item?.acabamento || item?.cor_nome || dados?.orcamento?.acabamento || '').trim()
  }
  function precoKgPerfil(c: ComponentePrecificacao) {
    const adicional = dados?.adicionaisPorCor[chaveCor(corPerfil(c))]
    return adicional == null ? null : numero(dados?.precoKgAluminio) + adicional
  }
  function diagnosticoPerfil(c: ComponentePrecificacao) {
    const p = produto(c)
    const material = c.material_id ? materiaisPorId.get(c.material_id) : null
    if (!p || !(numero(p.peso_kg_m) > 0 && numero(p.peso_kg_m) < 50)) return 'Peso kg/m do perfil não cadastrado ou inválido.'
    if (!(numero(material?.comprimento_corte_mm) > 0)) return 'Comprimento de corte não validado.'
    if (!(numero(dados?.precoKgAluminio) > 0)) return 'Preço do quilo do alumínio não configurado.'
    if (chaveCor(corPerfil(c)) === 'COR A DEFINIR' || precoKgPerfil(c) == null) return `Acabamento ${corPerfil(c) || 'não informado'} sem preço validado.`
    return ''
  }
  const componentes = dados?.componentes || []
  const perfil = componentes.filter(c => c.categoria === 'perfil')
  const semPreco = componentes.filter(c => c.custo_pendente || numero(c.custo_unitario) <= 0 || (c.categoria === 'perfil' && Boolean(diagnosticoPerfil(c))))
  const acessoriosPendentes = semPreco.filter(c => c.categoria === 'acessorio')
  const perfisPendentes = semPreco.filter(c => c.categoria === 'perfil')
  const demaisPendentes = semPreco.filter(c => c.categoria !== 'perfil' && c.categoria !== 'acessorio')
  const saldoSobraMm = (dados?.barras || []).reduce((s, b) => s + Math.max(0, numero(b.sobra_final_mm)), 0)
  const custoSobra = numero(dados?.orcamento?.otimizacao_orcamento?.custo_sobra_total)

  async function validarCusto(c: ComponentePrecificacao) {
    const texto = (valores[c.id] || '').trim().replace(/\./g, '').replace(',', '.')
    const valor = Number(texto)
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe um custo unitário maior que zero, em reais.'); return }
    setSalvando(c.id); setErro(''); setMensagem('')
    const resposta = await salvarCustoComponente(c, valor, false)
    setSalvando('')
    if (!resposta.ok) { setErro(resposta.error); return }
    setMensagem(`Custo de ${c.codigo || c.descricao} validado somente neste orçamento.`)
    await atualizar()
  }

  if (carregando) return <div className="grid min-h-screen place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  if (!dados) return <div className="p-8">Orçamento não encontrado.</div>
  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href={`/orcamento/${orcamentoId}/precificacao`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} /> Voltar à conferência de custos</Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="text-amber-600" /> Validação de preços do orçamento</h1>
        <p className="text-sm text-slate-500">Orçamento #{dados.orcamento.numero || '—'} · confira o alumínio por quilo e valide os acessórios sem custo.</p>
      </div>
      <Link href={`/orcamento/${orcamentoId}/materiais`} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Lista de materiais com imagens</Link>
    </header>

    <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><span className="mr-1 font-semibold text-slate-800">Conferência técnica:</span><Link href={`/orcamento/${orcamentoId}/materiais?filtro=perfis`} className="rounded-lg border px-3 py-2">Perfis e medidas de corte</Link><Link href={`/orcamento/${orcamentoId}/materiais?filtro=acessorios`} className="rounded-lg border px-3 py-2">Acessórios de montagem</Link><Link href={`/orcamento/${orcamentoId}/plano-corte`} className="rounded-lg border px-3 py-2">Barras, cortes e sobras</Link><Link href="/cadastro/materiais" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 font-semibold text-sky-900">Editar alumínio natural e beneficiamentos</Link></section>
    <p className="text-xs text-slate-500">Valores do cadastro de materiais são globais e exigem acesso autorizado. Atualizar o preço não altera a receita de corte ou as quantidades de montagem; depois da atualização, recalcule o orçamento para refletir os valores revisados.</p>
    {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
    {mensagem && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[['Alumínio (R$/kg)', dinheiro(dados.precoKgAluminio)], ['Perfis para revisar', String(perfisPendentes.length)], ['Acessórios sem custo', String(acessoriosPendentes.length)], ['Sobra nos planos de corte', `${saldoSobraMm.toLocaleString('pt-BR')} mm`]].map(([titulo, valor]) =>
        <div key={titulo} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{titulo}</p><strong className="text-xl">{valor}</strong></div>)}
    </section>
    <p className="text-sm text-slate-600">Custo econômico das sobras no resumo atual: <b>{dinheiro(custoSobra)}</b>. A política de cobrança de sobra e a margem são definidas depois da validação de custos.</p>

    <section className="rounded-2xl border bg-white p-4">
      <h2 className="text-lg font-bold">1. Perfis — conferência por peso</h2>
      <p className="mb-3 text-sm text-slate-500">Custo unitário = peso (kg/m) × comprimento de corte (m) × (preço do alumínio natural/kg + adicional do beneficiamento da cor/kg). Não substituímos peso ausente por custo genérico.</p>
      {perfil.length === 0 ? <p className="text-sm text-slate-500">Não há perfis neste pacote.</p> :
        <div className="space-y-2">{perfil.map(c => { const p = produto(c); const material = c.material_id ? materiaisPorId.get(c.material_id) : null; const falta = diagnosticoPerfil(c)
          return <article key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><Miniatura produto={p} descricao={c.descricao} />
            <div className="min-w-[200px] flex-1"><b>{c.codigo || 'Sem código'} — {c.descricao}</b><p className="text-xs text-slate-500">{numero(p?.peso_kg_m) || '—'} kg/m · {numero(material?.comprimento_corte_mm) || '—'} mm/corte · {c.quantidade} corte(s) · {corPerfil(c) || 'Cor pendente'} · {precoKgPerfil(c) == null ? 'R$/kg pendente' : `${dinheiro(precoKgPerfil(c)!)} /kg`}</p>
              <p className={falta ? 'text-xs font-bold text-amber-800' : 'text-xs font-semibold text-emerald-700'}>{falta || `Custo calculado: ${dinheiro(c.custo_total)}`}</p></div>
            <span className="text-sm font-bold">{dinheiro(c.custo_unitario)}/corte</span>
          </article> })}</div>}
      {perfisPendentes.length > 0 && <p className="mt-3 text-sm text-amber-800">Perfis pendentes precisam ter peso ou comprimento corrigidos no <Link className="underline" href="/engenharia/editor-tecnico">cadastro técnico</Link> e a composição recalculada. Não devem ser validados com preço manual.</p>}
    </section>

    <section className="rounded-2xl border bg-white p-4">
      <h2 className="text-lg font-bold">2. Produtos sem preço — validar neste orçamento</h2>
      <p className="mb-3 text-sm text-slate-500">O valor informado é custo unitário em reais. Salvar aqui não altera o catálogo geral de preços.</p>
      {acessoriosPendentes.length === 0 && demaisPendentes.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Nenhum acessório ou outro produto pendente.</p> : null}
      {[...acessoriosPendentes, ...demaisPendentes].map(c => <article key={c.id} className="flex flex-wrap items-center gap-3 border-t py-3"><Miniatura produto={produto(c)} descricao={c.descricao} />
        <div className="min-w-[200px] flex-1"><b>{c.codigo || 'Sem código'} — {c.descricao}</b><p className="text-xs text-slate-500">{c.categoria} · {c.quantidade} {c.unidade} · custo atual: {dinheiro(c.custo_unitario)}</p></div>
        <label className="text-xs font-semibold">Custo unitário (R$)<input inputMode="decimal" placeholder="0,00" value={valores[c.id] || ''} onChange={e => setValores(v => ({ ...v, [c.id]: e.target.value }))} className="mt-1 block w-32 rounded-lg border px-3 py-2 text-sm" /></label>
        <button disabled={Boolean(salvando)} onClick={() => void validarCusto(c)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando === c.id ? 'Validando...' : 'Validar custo'}</button></article>)}
    </section>

    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"><div className="text-sm">{semPreco.length ? <span className="flex items-center gap-2 font-semibold text-amber-800"><TriangleAlert size={16} /> {semPreco.length} pendência(s); orçamento ainda em conferência.</span> : <span className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Custos conferidos; pode seguir para margem e sobra.</span>}</div>
      {semPreco.length ? <button disabled className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500">Concluir após validar</button> : <Link href={`/orcamento/${orcamentoId}/margem-sobra`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Seguir para margem e sobra</Link>}</footer>
  </div></main>
}