'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Filter, MapPin, Phone, UserPlus, X } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/tipos'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas, correspondeFiltroAtlas, valoresUnicosAtlas } from '@/lib/buscaAtlas'

type ClienteComApelido = Cliente & { apelido?: string | null }

const origemLabels: Record<string, string> = {
  indicacao: 'Indicação', arquiteto: 'Arquiteto', engenheiro: 'Engenheiro', construtora: 'Construtora',
  instagram: 'Instagram', facebook: 'Facebook', google: 'Google', whatsapp: 'WhatsApp',
  cliente_antigo: 'Cliente antigo', passou_na_frente: 'Passou em frente', outros: 'Outros',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteComApelido[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [apelido, setApelido] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false }).limit(1000)
    if (data) setClientes(data as ClienteComApelido[])
    setCarregando(false)
  }

  const cidades = useMemo(() => valoresUnicosAtlas(clientes.map(c => c.cidade)), [clientes])
  const bairros = useMemo(() => valoresUnicosAtlas(clientes.filter(c => !cidade || correspondeFiltroAtlas(c.cidade, cidade)).map(c => c.bairro)), [clientes, cidade])

  const filtrados = useMemo(() => clientes.filter(c => {
    const geral = correspondeBuscaAtlas(busca, c.nome, c.apelido, c.cpf_cnpj, c.whatsapp, c.telefone, c.email, c.cidade, c.bairro, c.endereco, c.cep, c.observacoes, c.responsavel, c.origem)
    if (!geral) return false
    if (cidade && !correspondeFiltroAtlas(c.cidade, cidade)) return false
    if (bairro && !correspondeFiltroAtlas(c.bairro, bairro)) return false
    if (cpf && !correspondeBuscaAtlas(cpf, c.cpf_cnpj)) return false
    if (telefone && !correspondeBuscaAtlas(telefone, c.telefone, c.whatsapp)) return false
    if (apelido && !correspondeBuscaAtlas(apelido, c.apelido)) return false
    return true
  }), [clientes, busca, cidade, bairro, cpf, telefone, apelido])

  const filtrosAtivos = [cidade, bairro, cpf, telefone, apelido].filter(Boolean).length
  function limparFiltros(){setCidade('');setBairro('');setCpf('');setTelefone('');setApelido('')}

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4"><div className="flex items-center gap-4"><Link href="/" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20}/></Link><img src="/icons/icon-mark.png" alt="" className="h-8 w-8"/><div><h1 className="text-lg font-bold text-slate-800">Clientes</h1><p className="text-sm text-slate-500">{clientes.length} cadastrados</p></div></div><Link href="/clientes/novo" className="flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white"><UserPlus size={16}/>Novo cliente</Link></div></header>
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex gap-2"><BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Buscar em todo o cadastro: nome, apelido, CPF/CNPJ, telefone, cidade, bairro, endereço..." containerClassName="flex-1" inputClassName="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 text-sm"/><button onClick={()=>setMostrarFiltros(v=>!v)} className={`inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${mostrarFiltros||filtrosAtivos?'border-brand-navy bg-brand-navyLight text-brand-navy':'bg-white text-slate-600'}`}><Filter size={16}/>Filtros{filtrosAtivos?` (${filtrosAtivos})`:''}</button></div>
      {mostrarFiltros&&<div className="mt-3 rounded-2xl border bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Filtros específicos</h2><p className="text-xs text-slate-500">Combine os filtros com a busca principal.</p></div>{filtrosAtivos>0&&<button onClick={limparFiltros} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500"><X size={13}/>Limpar</button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs text-slate-500">Cidade<select value={cidade} onChange={e=>{setCidade(e.target.value);setBairro('')}} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todas</option>{cidades.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="text-xs text-slate-500">Bairro<select value={bairro} onChange={e=>setBairro(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todos</option>{bairros.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="text-xs text-slate-500">CPF/CNPJ<BuscaAtlasInput value={cpf} onValueChange={setCpf} mostrarIcone={false} placeholder="CPF/CNPJ" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label><label className="text-xs text-slate-500">Telefone / WhatsApp<BuscaAtlasInput value={telefone} onValueChange={setTelefone} mostrarIcone={false} placeholder="Telefone" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label><label className="text-xs text-slate-500">Apelido<BuscaAtlasInput value={apelido} onValueChange={setApelido} mostrarIcone={false} placeholder="Apelido" inputClassName="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label></div></div>}
      <div className="mb-3 mt-4 text-xs text-slate-500">{filtrados.length} resultado(s)</div>
      {carregando?<div className="py-12 text-center text-slate-400">Carregando...</div>:filtrados.length===0?<div className="py-12 text-center text-slate-400">Nenhum cliente encontrado.</div>:<div className="space-y-2">{filtrados.map(c=><Link key={c.id} href={`/clientes/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-navy hover:shadow-sm"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-800">{c.nome}</p>{c.apelido&&<span className="rounded-full bg-brand-navyLight px-2 py-0.5 text-xs font-medium text-brand-navy">{c.apelido}</span>}</div><div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">{(c.whatsapp||c.telefone)&&<span className="flex items-center gap-1"><Phone size={12}/>{c.whatsapp||c.telefone}</span>}{c.cidade&&<span className="flex items-center gap-1"><MapPin size={12}/>{c.cidade}</span>}{c.bairro&&<span>{c.bairro}</span>}{c.cpf_cnpj&&<span>{c.cpf_cnpj}</span>}</div></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{origemLabels[c.origem]||c.origem}</span></div></Link>)}</div>}
    </main>
  </div>
}
