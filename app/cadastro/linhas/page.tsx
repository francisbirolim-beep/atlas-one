'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Layers3, Plus, Save, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos, labelCategoriaProduto } from '@/lib/produtos'
import { listarTipologias } from '@/lib/tipologias'
import { alternarLinhaTecnica, LinhaTecnica, listarLinhasTecnicas, salvarLinhaTecnica } from '@/lib/linhasTecnicas'
import { Produto, Tipologia } from '@/lib/tipos'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type FormLinha = {
  id?: string
  nome: string
  fabricante: string
  descricao: string
  apelidos: string
  ativo: boolean
  produto_ids: string[]
  tipologia_ids: string[]
}

const vazio: FormLinha = { nome: '', fabricante: '', descricao: '', apelidos: '', ativo: true, produto_ids: [], tipologia_ids: [] }

export default function CadastroLinhas() {
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [form, setForm] = useState<FormLinha>(vazio)
  const [editando, setEditando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaProdutos, setBuscaProdutos] = useState('')
  const [autorizado, setAutorizado] = useState<boolean | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    const master = me?.role === 'master'
    setAutorizado(master)
    if (master) {
      const [l, p, t] = await Promise.all([listarLinhasTecnicas(), listarProdutos(), listarTipologias()])
      setLinhas(l)
      setProdutos(p)
      setTipologias(t)
      if (typeof window !== 'undefined') {
        const linhaUrl = new URLSearchParams(window.location.search).get('linha') || ''
        const linhaSelecionada = l.find(linha => linha.id === linhaUrl)
        if (linhaSelecionada) abrirEdicao(linhaSelecionada)
      }
    }
    setCarregando(false)
  }

  const filtradas = useMemo(() => {
    if (!busca.trim()) return linhas
    return linhas.filter(l => correspondeBuscaAtlas(busca, l.nome, l.fabricante, l.descricao, ...(l.apelidos || [])))
  }, [linhas, busca])

  const produtosFiltrados = useMemo(() => {
    if (!buscaProdutos.trim()) return produtos
    return produtos.filter(produto => correspondeBuscaAtlas(
      buscaProdutos,
      produto.codigo,
      produto.nome,
      produto.descricao,
      labelCategoriaProduto(produto.categoria),
      produto.grupo,
      produto.marca,
      produto.ncm,
      produto.unidade,
      produto.codigo_origem,
      produto.origem
    ))
  }, [produtos, buscaProdutos])

  function abrirNova() { setForm(vazio); setBuscaProdutos(''); setErro(''); setEditando(true) }
  function abrirEdicao(linha: LinhaTecnica) {
    setForm({ id: linha.id, nome: linha.nome, fabricante: linha.fabricante || '', descricao: linha.descricao || '', apelidos: (linha.apelidos || []).join(', '), ativo: linha.ativo, produto_ids: linha.produto_ids || [], tipologia_ids: linha.tipologia_ids || [] })
    setBuscaProdutos(''); setErro(''); setEditando(true)
  }
  function alternarLista(campo: 'produto_ids' | 'tipologia_ids', id: string) { setForm(prev => ({ ...prev, [campo]: prev[campo].includes(id) ? prev[campo].filter(x => x !== id) : [...prev[campo], id] })) }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Informe o nome da linha.'); return }
    setSalvando(true); setErro('')
    try {
      await salvarLinhaTecnica({ id: form.id, nome: form.nome, fabricante: form.fabricante, descricao: form.descricao, apelidos: form.apelidos.split(',').map(x => x.trim()).filter(Boolean), ativo: form.ativo, produto_ids: form.produto_ids, tipologia_ids: form.tipologia_ids })
      setLinhas(await listarLinhasTecnicas()); setEditando(false); setForm(vazio); setBuscaProdutos('')
    } catch (e: any) { setErro(e?.message || 'Erro ao salvar a linha.') }
    setSalvando(false)
  }
  async function alternarAtivo(linha: LinhaTecnica) { await alternarLinhaTecnica(linha.id, !linha.ativo); setLinhas(prev => prev.map(l => l.id === linha.id ? { ...l, ativo: !l.ativo } : l)) }

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  if (!autorizado) return <div className="min-h-screen flex items-center justify-center text-slate-500">Apenas o usuário master pode acessar este cadastro.</div>

  return <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-200"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3"><Link href="/cadastro" className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20}/></Link><Layers3 size={24} className="text-brand-navy"/><div className="flex-1"><h1 className="font-bold text-slate-800">Linhas técnicas</h1><p className="text-xs text-slate-500">Associe linhas a perfis, acessórios, produtos e tipologias.</p></div><button onClick={abrirNova} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy text-white px-3 py-2 text-sm font-medium"><Plus size={16}/>Nova linha</button></div></header>
    <main className="max-w-5xl mx-auto p-4 md:py-8 space-y-4">
      <BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Pesquisar nome, fabricante, descrição ou apelido da linha..." inputClassName="w-full bg-white border border-slate-200 rounded-xl py-3 pr-4 text-sm outline-none focus:border-brand-navy"/>
      <div className="grid gap-3 md:grid-cols-2">{filtradas.map(linha => <div key={linha.id} className={`bg-white border rounded-2xl p-4 ${linha.ativo ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}><div className="flex items-start justify-between gap-3"><button onClick={() => abrirEdicao(linha)} className="text-left flex-1"><div className="font-bold text-slate-800">{linha.nome}</div>{linha.fabricante&&<div className="text-xs text-slate-500 mt-0.5">Fabricante: {linha.fabricante}</div>}{linha.descricao&&<div className="mt-1 text-xs text-slate-500 line-clamp-2">{linha.descricao}</div>}{linha.apelidos?.length>0&&<div className="text-xs text-slate-400 mt-1">Também reconhece: {linha.apelidos.join(', ')}</div>}</button><button onClick={() => alternarAtivo(linha)} className={`text-xs rounded-full px-2.5 py-1 ${linha.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{linha.ativo?'ATIVA':'INATIVA'}</button></div><div className="flex gap-2 mt-3 text-xs text-slate-500"><span className="bg-slate-50 rounded-lg px-2 py-1">{linha.produto_ids?.length||0} produtos</span><span className="bg-slate-50 rounded-lg px-2 py-1">{linha.tipologia_ids?.length||0} tipologias</span></div></div>)}</div>
      {editando&&<div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end md:items-center justify-center"><div className="bg-white w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl p-5 md:p-7"><div className="flex items-center justify-between mb-5"><div><h2 className="font-bold text-lg text-slate-800">{form.id?'Editar linha':'Nova linha'}</h2><p className="text-xs text-slate-500">Uma linha pode reunir vários nomes usados no W Vetro e no dia a dia.</p></div><button onClick={() => setEditando(false)} className="p-2"><X size={20}/></button></div>
        <div className="grid md:grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">Nome da linha<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-2.5" placeholder="EX.: SUPREMA"/></label><label className="text-xs font-medium text-slate-600">Fabricante<input value={form.fabricante} onChange={e=>setForm({...form,fabricante:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-2.5" placeholder="OPCIONAL"/></label></div>
        <label className="block text-xs font-medium text-slate-600 mt-3">Apelidos / nomes de reconhecimento<input value={form.apelidos} onChange={e=>setForm({...form,apelidos:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-2.5" placeholder="L. SUPREMA, LINHA SUPREMA"/><span className="font-normal text-slate-400">Separe por vírgula.</span></label>
        <label className="block text-xs font-medium text-slate-600 mt-3">Descrição<textarea value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-2.5 min-h-20"/></label>
        <div className="mt-5"><h3 className="text-sm font-bold text-slate-700">Tipologias associadas</h3><p className="text-xs text-slate-400 mt-0.5">Estas tipologias aparecem quando a linha for escolhida.</p><div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">{tipologias.map(t=><label key={t.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 text-xs"><input type="checkbox" checked={form.tipologia_ids.includes(t.id)} onChange={()=>alternarLista('tipologia_ids',t.id)}/>{t.label}</label>)}</div></div>
        <div className="mt-5"><h3 className="text-sm font-bold text-slate-700">Produtos, perfis e acessórios associados</h3><p className="text-xs text-slate-400">Busque por código, nome, descrição, categoria, marca, grupo, NCM ou unidade.</p><BuscaAtlasInput value={buscaProdutos} onValueChange={setBuscaProdutos} placeholder="Buscar produto, perfil ou acessório..." containerClassName="mt-2" inputClassName="w-full border rounded-xl py-2.5 pr-3 text-xs"/><div className="grid sm:grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">{produtosFiltrados.map(p=><label key={p.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 text-xs"><input type="checkbox" checked={form.produto_ids.includes(p.id)} onChange={()=>alternarLista('produto_ids',p.id)}/><span className="flex-1 min-w-0"><span className="block truncate">{p.nome}</span>{p.codigo&&<span className="block text-[10px] font-mono text-slate-400">{p.codigo}</span>}</span><span className="text-slate-400">{labelCategoriaProduto(p.categoria)}</span></label>)}{produtosFiltrados.length===0&&<p className="sm:col-span-2 text-xs text-slate-400 p-3 text-center">Nenhum item encontrado.</p>}</div></div>
        {erro&&<p className="text-sm text-red-600 mt-4">{erro}</p>}<div className="flex justify-end gap-2 mt-6"><button onClick={()=>setEditando(false)} className="px-4 py-2.5 rounded-xl border text-sm">Cancelar</button><button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-medium disabled:opacity-50"><Save size={16}/>{salvando?'Salvando...':'Salvar linha'}</button></div>
      </div></div>}
    </main>
  </div>
}
