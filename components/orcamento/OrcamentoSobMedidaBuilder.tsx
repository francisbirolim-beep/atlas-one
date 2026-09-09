'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { listarVidrosPlanoCorte, type VidroCatalogoPlano } from '@/lib/planoCorteVidros'
import type { Tipologia } from '@/lib/tipos'
import TipologiaMiniatura from './TipologiaMiniatura'

type ClienteResumo = {
  id: string
  nome: string
  apelido?: string | null
  telefone?: string | null
  whatsapp?: string | null
  cpf_cnpj?: string | null
  email?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  cep?: string | null
}

type ItemSelecionado = {
  uid: string
  tipologiaId: string
  nome: string
  categoria: string
  linhaId: string
  cor: string
  contramarco: 'sim' | 'nao'
  vidro: string
  arremate: 'sim' | 'nao'
  quantidade: number
}

const ROTULOS_CATEGORIA: Record<string, string> = {
  porta: 'Portas',
  janela: 'Janelas',
  modulo_fixo: 'Módulos Fixos',
  fachada: 'Fachadas',
  box: 'Boxes',
  painel_ripado: 'Painéis / Ripados',
  acm: 'ACM',
  cobertura_claraboia: 'Coberturas',
  contramarco_arremate: 'Contramarcos / Arremates',
  espelho: 'Espelhos',
  portao_grade: 'Portões / Grades',
  guarda_corpo_corrimao: 'Guarda-corpos / Corrimãos',
  vidro: 'Vidros',
  tela_mosquiteira: 'Telas Mosquiteiras',
  outros: 'Outros',
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function OrcamentoSobMedidaBuilder() {
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('cliente')

  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [cidade, setCidade] = useState('')
  const [temperatura, setTemperatura] = useState('')

  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState('')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [vidros, setVidros] = useState<VidroCatalogoPlano[]>([])
  const [vidroAbertoUid, setVidroAbertoUid] = useState<string | null>(null)

  const [corPadrao, setCorPadrao] = useState('preto')
  const [contramarcoPadrao, setContramarcoPadrao] = useState<'sim' | 'nao'>('sim')
  const [arrematePadrao, setArrematePadrao] = useState<'sim' | 'nao'>('sim')
  const [itens, setItens] = useState<ItemSelecionado[]>([])
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    async function carregar() {
      const [ts, ls, clientesResp, catalogoVidros] = await Promise.all([
        listarTipologias(),
        listarLinhasTecnicas(),
        supabase
          .from('clientes')
          .select('id,nome,apelido,telefone,whatsapp,cpf_cnpj,email,cidade,bairro,endereco,cep')
          .order('nome')
          .limit(1000),
        listarVidrosPlanoCorte(),
      ])

      setTipologias(ts)
      setLinhas(ls.filter(l => l.ativo))
      setVidros(catalogoVidros)
      const listaClientes = (clientesResp.data || []) as ClienteResumo[]
      setClientes(listaClientes)

      if (clienteIdParam) {
        const encontrado = listaClientes.find(c => c.id === clienteIdParam)
        if (encontrado) selecionarCliente(encontrado)
      }
    }

    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIdParam])

  const clientesEncontrados = useMemo(() => {
    if (cliente || buscaCliente.trim().length < 2) return []
    return clientes
      .filter(c => correspondeBuscaAtlas(
        buscaCliente,
        c.nome,
        c.apelido,
        c.cpf_cnpj,
        c.whatsapp,
        c.telefone,
        c.email,
        c.cidade,
        c.bairro,
        c.endereco,
        c.cep,
      ))
      .slice(0, 12)
  }, [buscaCliente, cliente, clientes])

  const linhaSelecionada = useMemo(
    () => linhas.find(l => l.id === linhaSelecionadaId) || null,
    [linhaSelecionadaId, linhas],
  )

  const categoriasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const permitidas = new Set(linhaSelecionada.tipologia_ids || [])
    return Array.from(new Set(
      tipologias
        .filter(t => permitidas.has(t.id))
        .map(t => t.categoria)
        .filter(Boolean),
    )).sort()
  }, [linhaSelecionada, tipologias])

  const filtradas = useMemo(() => {
    if (!linhaSelecionada) return []
    const permitidas = new Set(linhaSelecionada.tipologia_ids || [])

    return tipologias.filter(t => {
      if (!permitidas.has(t.id)) return false
      if (categoria && t.categoria !== categoria) return false
      if (!busca.trim()) return true
      return correspondeBuscaAtlas(
        busca,
        t.label,
        t.chave,
        ROTULOS_CATEGORIA[t.categoria] || t.categoria,
        linhaSelecionada.nome,
        linhaSelecionada.fabricante,
        linhaSelecionada.descricao,
        ...(linhaSelecionada.apelidos || []),
      )
    })
  }, [busca, categoria, linhaSelecionada, tipologias])

  function selecionarCliente(c: ClienteResumo) {
    setCliente(c)
    setBuscaCliente(c.nome)
    setCidade(c.cidade || '')
  }

  function limparCliente() {
    setCliente(null)
    setBuscaCliente('')
    setCidade('')
  }

  function trocarLinha(id: string) {
    setLinhaSelecionadaId(id)
    setBusca('')
    setCategoria('')
  }

  function trocarContramarcoPadrao(valor: 'sim' | 'nao') {
    setContramarcoPadrao(valor)
    if (valor === 'sim') setArrematePadrao('sim')
    setSalvo(false)
  }

  function adicionar(t: Tipologia) {
    if (!linhaSelecionadaId) return
    setItens(prev => [...prev, {
      uid: uid(),
      tipologiaId: t.id,
      nome: t.label,
      categoria: t.categoria,
      linhaId: linhaSelecionadaId,
      cor: corPadrao,
      contramarco: contramarcoPadrao,
      vidro: '',
      arremate: contramarcoPadrao === 'sim' ? 'sim' : arrematePadrao,
      quantidade: 1,
    }])
    setSalvo(false)
  }

  function atualizarItem(id: string, patch: Partial<ItemSelecionado>) {
    setItens(prev => prev.map(item => item.uid === id ? { ...item, ...patch } : item))
    setSalvo(false)
  }

  function atualizarContramarcoItem(id: string, valor: 'sim' | 'nao') {
    setItens(prev => prev.map(item => {
      if (item.uid !== id) return item
      return {
        ...item,
        contramarco: valor,
        arremate: valor === 'sim' ? 'sim' : item.arremate,
      }
    }))
    setSalvo(false)
  }

  function linhasDoItem(item: ItemSelecionado) {
    return linhas.filter(l => (l.tipologia_ids || []).includes(item.tipologiaId))
  }

  function sugestoesVidro(item: ItemSelecionado) {
    if (!item.vidro.trim()) return vidros.slice(0, 20)
    return vidros
      .filter(v => correspondeBuscaAtlas(item.vidro, v.nome, v.codigo))
      .slice(0, 20)
  }

  function salvarPreview() {
    if (!cliente || !itens.length) return
    window.sessionStorage.setItem('atlas_orcamento_sob_medida_builder_v1', JSON.stringify({
      clienteId: cliente.id,
      cidade,
      temperatura,
      padroes: {
        cor: corPadrao,
        contramarco: contramarcoPadrao,
        arremate: contramarcoPadrao === 'sim' ? 'sim' : arrematePadrao,
      },
      itens,
    }))
    setSalvo(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-4 lg:px-6">
          <Link href={cliente ? `/clientes/${cliente.id}` : '/clientes/identificar'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cliente 360 · Orçamento</p>
            <h1 className="truncate text-xl font-bold">Novo Orçamento Sob Medida</h1>
            <p className="text-xs text-slate-500">Escolha o cliente, defina os padrões e depois selecione linha e tipologias.</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">1 Dados</span>
            <ChevronRight size={15} className="text-slate-300"/>
            <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">2 Tipologias</span>
            <ChevronRight size={15} className="text-slate-300"/>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">3 Configurar</span>
            <ChevronRight size={15} className="text-slate-300"/>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">4 Precificar</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <section className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span><h2 className="font-bold">Dados do cliente e da obra</h2></div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Cliente</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
                  <input
                    value={buscaCliente}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="search"
                    onChange={e => {
                      const valor = e.target.value
                      setBuscaCliente(valor)
                      if (cliente && valor !== cliente.nome) setCliente(null)
                    }}
                    placeholder="Digite nome, telefone, CPF/CNPJ..."
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue-500"
                  />
                  {cliente && <button type="button" onClick={limparCliente} className="absolute right-3 top-2.5 text-slate-400"><X size={18}/></button>}
                </div>
                {!cliente && buscaCliente.trim().length >= 2 && <div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {clientesEncontrados.length === 0 && <div className="px-3 py-3 text-xs text-slate-500">Nenhum cliente encontrado.</div>}
                  {clientesEncontrados.map(c => <button type="button" key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => selecionarCliente(c)} className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-blue-50"><span className="block text-sm font-semibold">{c.nome}</span><span className="text-xs text-slate-500">{c.cidade || 'Cidade não informada'} · {c.whatsapp || c.telefone || 'Sem telefone'}</span></button>)}
                </div>}
              </div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Cidade</label><input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade da obra" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Temperatura</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['quente', 'morno', 'frio'] as const).map(valor => <button key={valor} type="button" onClick={() => setTemperatura(valor)} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold capitalize transition ${temperatura === valor ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}>{valor}</button>)}
                </div>
              </div>
            </div>
            {!cliente && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><span>Não encontrou o cliente? Cadastre antes de montar o orçamento.</span><Link href="/clientes/novo" className="inline-flex items-center gap-1.5 font-semibold text-blue-700"><UserPlus size={15}/>Cadastrar novo cliente</Link></div>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span><div><h2 className="font-bold">Padrões do orçamento</h2><p className="text-xs text-slate-500">Servem como padrão inicial. Cada tipologia pode receber valores próprios depois.</p></div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Cor geral</label><select value={corPadrao} onChange={e => setCorPadrao(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="preto">Preto</option><option value="branco">Branco</option><option value="madeirado">Amadeirado</option><option value="outro">Outra cor</option></select></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Contramarco</label><select value={contramarcoPadrao} onChange={e => trocarContramarcoPadrao(e.target.value as 'sim' | 'nao')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="sim">Sim</option><option value="nao">Não</option></select></div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Arremate / guarnição</label>
                <select value={contramarcoPadrao === 'sim' ? 'sim' : arrematePadrao} disabled={contramarcoPadrao === 'sim'} onChange={e => setArrematePadrao(e.target.value as 'sim' | 'nao')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-600"><option value="sim">Sim</option><option value="nao">Não</option></select>
                {contramarcoPadrao === 'sim' && <p className="mt-1 text-[11px] font-medium text-blue-700">Obrigatório quando a obra usa contramarco.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">3</span><div><h2 className="font-bold">Adicionar tipologias</h2><p className="text-xs text-slate-500">Primeiro escolha a linha. Depois pesquise livremente no cadastro da tipologia ou veja tudo que pertence à linha.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select value={linhaSelecionadaId} onChange={e => trocarLinha(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">1. Escolha a linha</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
              <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} disabled={!linhaSelecionadaId} onChange={e => setBusca(e.target.value)} placeholder={linhaSelecionadaId ? '2. Ex.: porta 3, porta correr, maxim-ar...' : 'Escolha a linha primeiro'} className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"/></div>
              <select value={categoria} disabled={!linhaSelecionadaId} onChange={e => setCategoria(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"><option value="">Todas as categorias da linha</option>{categoriasDaLinha.map(c => <option key={c} value={c}>{ROTULOS_CATEGORIA[c] || c}</option>)}</select>
            </div>

            {!linhaSelecionadaId && <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Escolha uma linha para ver as tipologias disponíveis.</div>}
            {linhaSelecionadaId && filtradas.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Nenhuma tipologia encontrada com esses termos nessa linha.</div>}
            {linhaSelecionadaId && filtradas.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtradas.slice(0, 80).map(t => <div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm"><div className="h-28 bg-slate-50"><TipologiaMiniatura nome={t.label} className="h-full w-full"/></div><div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{t.label}</p><p className="truncate text-xs text-slate-500">{ROTULOS_CATEGORIA[t.categoria] || t.categoria}</p></div><button type="button" onClick={() => adicionar(t)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Adicionar"><Plus size={18}/></button></div></div></div>)}
            </div>}
          </div>
        </section>

        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-bold">Tipologias no orçamento</h2><p className="text-xs text-slate-500">{itens.length} {itens.length === 1 ? 'item adicionado' : 'itens adicionados'}</p></div><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 text-sm font-bold text-blue-700">{itens.length}</span></div>
            <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">
              {itens.length === 0 && <div className="py-10 text-center text-sm text-slate-500">Nenhuma tipologia adicionada ainda.</div>}
              {itens.map((item, index) => {
                const sugestoes = sugestoesVidro(item)
                return <div key={item.uid} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-3 flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.nome}</p><p className="text-[11px] text-slate-500">Pode alterar cor, contramarco, arremate e vidro só desta peça.</p></div><button type="button" onClick={() => setItens(prev => prev.filter(i => i.uid !== item.uid))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <select value={item.linhaId} onChange={e => atualizarItem(item.uid, { linhaId: e.target.value })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">Linha</option>{linhasDoItem(item).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
                    <select value={item.cor} onChange={e => atualizarItem(item.uid, { cor: e.target.value })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="preto">Cor: Preto</option><option value="branco">Cor: Branco</option><option value="madeirado">Cor: Amadeirado</option><option value="outro">Cor: Outra</option></select>
                    <select value={item.contramarco} onChange={e => atualizarContramarcoItem(item.uid, e.target.value as 'sim' | 'nao')} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="sim">Com contramarco</option><option value="nao">Sem contramarco</option></select>
                    <select value={item.arremate} disabled={item.contramarco === 'sim'} onChange={e => atualizarItem(item.uid, { arremate: e.target.value as 'sim' | 'nao' })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs disabled:bg-slate-100 disabled:text-slate-600"><option value="sim">Com arremate</option><option value="nao">Sem arremate</option></select>
                    <div className="relative sm:col-span-2 lg:col-span-1 xl:col-span-2">
                      <Search size={14} className="absolute left-2.5 top-2.5 z-10 text-slate-400"/>
                      <input
                        value={item.vidro}
                        autoComplete="off"
                        onFocus={() => setVidroAbertoUid(item.uid)}
                        onBlur={() => window.setTimeout(() => setVidroAbertoUid(atual => atual === item.uid ? null : atual), 120)}
                        onChange={e => { atualizarItem(item.uid, { vidro: e.target.value }); setVidroAbertoUid(item.uid) }}
                        placeholder="Vidro: digite 6, 8, temperado..."
                        className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs"
                      />
                      {vidroAbertoUid === item.uid && <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                        {vidros.length === 0 && <div className="px-3 py-2.5 text-xs text-slate-500">Nenhum vidro cadastrado no catálogo de produtos.</div>}
                        {vidros.length > 0 && sugestoes.length === 0 && <div className="px-3 py-2.5 text-xs text-slate-500">Nenhum vidro cadastrado corresponde à busca.</div>}
                        {sugestoes.map(v => <button key={v.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { atualizarItem(item.uid, { vidro: v.nome }); setVidroAbertoUid(null) }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-blue-50"><span className="font-semibold">{v.nome}</span>{v.codigo && <span className="ml-2 text-slate-400">{v.codigo}</span>}</button>)}
                      </div>}
                    </div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-slate-500">Qtd.</span><input type="number" min={1} value={item.quantidade} onChange={e => atualizarItem(item.uid, { quantidade: Math.max(1, Number(e.target.value) || 1) })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"/></div>
                  </div>
                  {item.contramarco === 'sim' && <p className="mt-2 text-[11px] font-medium text-blue-700">Arremate obrigatório porque esta tipologia está com contramarco.</p>}
                </div>
              })}
            </div>
            <div className="border-t border-slate-100 p-4"><button disabled={!cliente || itens.length === 0} onClick={salvarPreview} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{salvo ? <><Check size={17}/>Seleção salva para próxima etapa</> : <>Avançar para configurar tipologias <ChevronRight size={17}/></>}</button>{salvo && <p className="mt-2 text-center text-xs text-emerald-700">Preview validável: os dados ficaram guardados nesta sessão. A próxima etapa conectará cada tipologia às variáveis técnicas e à precificação.</p>}</div>
          </div>
        </aside>
      </main>
    </div>
  )
}
