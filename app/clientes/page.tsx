'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ClipboardList, Filter, MapPin, Phone, UserPlus, X, Archive, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/tipos'
import { usuarioAtual } from '@/lib/auth'
import { carregarAcessoCadastro, podeAcaoCadastro } from '@/lib/acessoCadastroOperacional'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas, correspondeFiltroAtlas, valoresUnicosAtlas } from '@/lib/buscaAtlas'
import { nomeClienteComApelido } from '@/lib/nomeClienteComApelido'

type ClienteComStatus = Cliente & { apelido?: string | null; ativo?: boolean | null }
type StatusFiltro = 'ativos' | 'inativos' | 'todos'
const CHAVE_CACHE = 'atlas_clientes_offline_v2_status'
const origemLabels: Record<string, string> = {
  indicacao: 'Indicação', arquiteto: 'Arquiteto', engenheiro: 'Engenheiro', construtora: 'Construtora',
  instagram: 'Instagram', facebook: 'Facebook', google: 'Google', whatsapp: 'WhatsApp',
  cliente_antigo: 'Cliente antigo', passou_na_frente: 'Passou em frente', outros: 'Outros',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteComStatus[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [apelido, setApelido] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('ativos')
  const [podeInativar, setPodeInativar] = useState(false)
  const [podeReativar, setPodeReativar] = useState(false)
  const [pendente, setPendente] = useState<ClienteComStatus | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void carregar()
    let montado = true
    void (async () => {
      const usuario = await usuarioAtual()
      const acesso = await carregarAcessoCadastro(usuario)
      if (montado) {
        setPodeInativar(podeAcaoCadastro(acesso, 'clientes', 'inativar'))
        setPodeReativar(podeAcaoCadastro(acesso, 'clientes', 'reativar'))
      }
    })()
    return () => { montado = false }
  }, [])

  async function carregar() {
    setCarregando(true)
    if (!navigator.onLine) {
      try {
        const salvos = JSON.parse(localStorage.getItem(CHAVE_CACHE) || '[]')
        if (Array.isArray(salvos)) setClientes(salvos as ClienteComStatus[])
      } catch { /* sem cache */ }
      setCarregando(false)
      return
    }
    try {
      const { data, error } = await supabase.from('clientes').select('*')
        .order('created_at', { ascending: false }).limit(1000)
      if (error) throw error
      const registros = (data || []) as ClienteComStatus[]
      setClientes(registros)
      try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(registros)) } catch { /* sem espaco */ }
    } catch {
      try {
        const salvos = JSON.parse(localStorage.getItem(CHAVE_CACHE) || '[]')
        if (Array.isArray(salvos)) setClientes(salvos as ClienteComStatus[])
      } catch { /* sem cache */ }
    }
    setCarregando(false)
  }

  const ativos = useMemo(() => clientes.filter(c => c.ativo !== false).length, [clientes])
  const inativos = clientes.length - ativos
  const cidades = useMemo(() => valoresUnicosAtlas(clientes.filter(c => statusFiltro === 'todos' || (statusFiltro === 'ativos' ? c.ativo !== false : c.ativo === false)).map(c => c.cidade)), [clientes, statusFiltro])
  const bairros = useMemo(() => valoresUnicosAtlas(clientes.filter(c => !cidade || correspondeFiltroAtlas(c.cidade, cidade)).map(c => c.bairro)), [clientes, cidade])

  const filtrados = useMemo(() => clientes.filter(c => {
    if (statusFiltro === 'ativos' && c.ativo === false) return false
    if (statusFiltro === 'inativos' && c.ativo !== false) return false
    if (!correspondeBuscaAtlas(busca, c.nome, c.apelido, c.cpf_cnpj, c.whatsapp, c.telefone, c.email, c.cidade, c.bairro, c.endereco, c.cep, c.observacoes, c.responsavel, c.origem)) return false
    if (cidade && !correspondeFiltroAtlas(c.cidade, cidade)) return false
    if (bairro && !correspondeFiltroAtlas(c.bairro, bairro)) return false
    if (cpf && !correspondeBuscaAtlas(cpf, c.cpf_cnpj)) return false
    if (telefone && !correspondeBuscaAtlas(telefone, c.telefone, c.whatsapp)) return false
    if (apelido && !correspondeBuscaAtlas(apelido, c.apelido)) return false
    return true
  }), [clientes, statusFiltro, busca, cidade, bairro, cpf, telefone, apelido])

  const filtrosAtivos = [cidade, bairro, cpf, telefone, apelido].filter(Boolean).length
  function limparFiltros() { setCidade(''); setBairro(''); setCpf(''); setTelefone(''); setApelido('') }

  function prepararMudanca(cliente: ClienteComStatus) {
    setPendente(cliente)
    setMotivo('')
    setErro('')
  }

  async function confirmarMudanca() {
    if (!pendente || salvando || !navigator.onLine) return
    const reativar = pendente.ativo === false
    if (!reativar && !motivo.trim()) { setErro('Informe por que este cliente será inativado.'); return }
    setSalvando(true)
    setErro('')
    const { error } = await supabase.rpc('alterar_status_cadastro_cliente', {
      p_cliente_id: pendente.id,
      p_ativo: reativar,
      p_motivo: motivo.trim() || null,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message || 'Não foi possível alterar a situação do cadastro.')
      return
    }
    setPendente(null)
    await carregar()
  }

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-4"><Link href="/" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20}/></Link><img src="/icons/icon-mark.png" alt="" className="h-8 w-8"/><div><h1 className="text-lg font-bold text-slate-800">Clientes</h1><p className="text-sm text-slate-500">{ativos} ativos · {inativos} inativos</p></div></div>
        <div className="flex items-center gap-2"><Link href="/cadastros/pendencias" className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"><ClipboardList size={16}/>Pendências</Link><Link href="/clientes/novo" className="flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white"><UserPlus size={16}/>Novo cliente</Link></div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Situação do cadastro">
        {([['ativos', 'Ativos', ativos], ['inativos', 'Inativos', inativos], ['todos', 'Todos', clientes.length]] as const).map(([valor, label, total]) =>
          <button key={valor} type="button" onClick={() => setStatusFiltro(valor)} aria-pressed={statusFiltro === valor} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${statusFiltro === valor ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{label} ({total})</button>)}
      </div>
      <div className="flex gap-2"><BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Buscar nome, apelido, CPF/CNPJ, telefone, cidade..." containerClassName="flex-1" inputClassName="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 text-sm"/><button onClick={() => setMostrarFiltros(v => !v)} className={`inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${mostrarFiltros || filtrosAtivos ? 'border-brand-navy bg-brand-navyLight text-brand-navy' : 'bg-white text-slate-600'}`}><Filter size={16}/>Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}</button></div>
      {mostrarFiltros && <div className="mt-3 rounded-2xl border bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Filtros específicos</h2><p className="text-xs text-slate-500">Combine os filtros com a busca principal.</p></div>{filtrosAtivos > 0 && <button onClick={limparFiltros} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500"><X size={13}/>Limpar</button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-slate-500">Cidade<select value={cidade} onChange={e => { setCidade(e.target.value); setBairro('') }} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todas</option>{cidades.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="text-xs text-slate-500">Bairro<select value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todos</option>{bairros.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="text-xs text-slate-500">CPF/CNPJ<BuscaAtlasInput value={cpf} onValueChange={setCpf} mostrarIcone={false} placeholder="CPF/CNPJ" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
        <label className="text-xs text-slate-500">Telefone / WhatsApp<BuscaAtlasInput value={telefone} onValueChange={setTelefone} mostrarIcone={false} placeholder="Telefone" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
        <label className="text-xs text-slate-500">Apelido<BuscaAtlasInput value={apelido} onValueChange={setApelido} mostrarIcone={false} placeholder="Apelido" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
      </div></div>}
      <div className="mb-3 mt-4 text-xs text-slate-500">{filtrados.length} resultado(s)</div>
      {carregando ? <div className="py-12 text-center text-slate-400">Carregando...</div> : filtrados.length === 0 ? <div className="py-12 text-center text-slate-400">Nenhum cliente encontrado.</div> : <div className="space-y-2">{filtrados.map(c =>
        <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-navy hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/clientes/${c.id}/central`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-800">{nomeClienteComApelido(c.nome, c.apelido)}</p>{c.ativo === false && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Inativo</span>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">{(c.whatsapp || c.telefone) && <span className="flex items-center gap-1"><Phone size={12}/>{c.whatsapp || c.telefone}</span>}{c.cidade && <span className="flex items-center gap-1"><MapPin size={12}/>{c.cidade}</span>}{c.bairro && <span>{c.bairro}</span>}{c.cpf_cnpj && <span>{c.cpf_cnpj}</span>}</div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{origemLabels[c.origem] || c.origem}</span>
            {typeof navigator !== 'undefined' && navigator.onLine && ((c.ativo === false && podeReativar) || (c.ativo !== false && podeInativar)) && <button type="button" onClick={() => prepararMudanca(c)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${c.ativo === false ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-800'}`}>{c.ativo === false ? <RotateCcw size={14}/> : <Archive size={14}/>} {c.ativo === false ? 'Reativar' : 'Inativar'}</button>}
          </div>
        </div>)}</div>}
    </main>
    {pendente && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Alterar situação do cliente" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">{pendente.ativo === false ? 'Reativar cliente' : 'Inativar cliente'}</h2>
        <p className="mt-2 text-sm text-slate-600">Cliente: <strong>{pendente.nome}</strong>. O histórico de orçamentos, vendas e obras será preservado.</p>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Motivo {pendente.ativo === false ? '(opcional)' : '(obrigatório)'}
          <textarea autoFocus maxLength={500} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm" placeholder="Informe o motivo para auditoria"/>
        </label>
        {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={salvando} onClick={() => setPendente(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Cancelar</button>
          <button type="button" disabled={salvando || (!motivo.trim() && pendente.ativo !== false)} onClick={() => void confirmarMudanca()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando && <Loader2 size={14} className="animate-spin"/>}{pendente.ativo === false ? 'Confirmar reativação' : 'Confirmar inativação'}</button>
        </div>
      </section>
    </div>}
  </div>
}
