'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Pencil, Package, ShieldAlert, Image as ImageIcon, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import {
  listarProdutos,
  criarProduto,
  atualizarProduto,
  alternarAtivoProduto,
  excluirProduto,
  CATEGORIAS_PRODUTO,
  labelCategoriaProduto,
} from '@/lib/produtos'
import { listarFornecedores } from '@/lib/fornecedores'
import { listarLinhas } from '@/lib/linhas'
import { listarCores } from '@/lib/cores'
import { uploadFotoProduto } from '@/lib/upload'
import { Produto, CategoriaProduto, Fornecedor, Linha, Cor } from '@/lib/tipos'

// Margem calculada sobre o custo: preço = custo * (1 + margem / 100).
// As duas contas abaixo são usadas nos dois sentidos (digitou margem -> sai
// preço; digitou preço -> sai margem), como pedido: sempre dá pra editar
// qualquer um dos dois na mão.
function precoAPartirDaMargem(custoTexto: string, margemTexto: string): string {
  const custo = parseFloat(custoTexto.replace(',', '.'))
  const margem = parseFloat(margemTexto.replace(',', '.'))
  if (isNaN(custo) || isNaN(margem)) return ''
  return (custo * (1 + margem / 100)).toFixed(2)
}

function margemAPartirDoPreco(custoTexto: string, precoTexto: string): string {
  const custo = parseFloat(custoTexto.replace(',', '.'))
  const preco = parseFloat(precoTexto.replace(',', '.'))
  if (isNaN(custo) || isNaN(preco) || custo <= 0) return ''
  return (((preco - custo) / custo) * 100).toFixed(2)
}

interface FormProduto {
  nome: string
  categoria: CategoriaProduto
  custo: string
  margem: string
  preco: string
  unidade: string
  grupo: string
  marca: string
  peso_kg: string
  fornecedor_id: string
  linha_id: string
  cor_id: string
  largura_mm: string
  altura_mm: string
  descricao: string
  ncm: string
  icms_percentual: string
  ipi_percentual: string
  pis_percentual: string
  cofins_percentual: string
}

const FORM_VAZIO: FormProduto = {
  nome: '',
  categoria: 'porta_janela_padrao',
  custo: '',
  margem: '',
  preco: '',
  unidade: 'unidade',
  grupo: '',
  marca: '',
  peso_kg: '',
  fornecedor_id: '',
  linha_id: '',
  cor_id: '',
  largura_mm: '',
  altura_mm: '',
  descricao: '',
  ncm: '',
  icms_percentual: '',
  ipi_percentual: '',
  pis_percentual: '',
  cofins_percentual: '',
}

export default function Produtos() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [cores, setCores] = useState<Cor[]>([])

  const [novoAberto, setNovoAberto] = useState(false)
  const [impostosNovoAberto, setImpostosNovoAberto] = useState(false)
  const [form, setForm] = useState<FormProduto>(FORM_VAZIO)
  const [fotoNovo, setFotoNovo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, FormProduto>>({})
  const [fotoEditFile, setFotoEditFile] = useState<Record<string, File | null>>({})
  const [impostosEditAberto, setImpostosEditAberto] = useState<Record<string, boolean>>({})
  const [salvandoEdicaoId, setSalvandoEdicaoId] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')
    if (me?.role === 'master') {
      const [listaProdutos, listaFornecedores, listaLinhas, listaCores] = await Promise.all([
        listarProdutos(),
        listarFornecedores(),
        listarLinhas(),
        listarCores(),
      ])
      setProdutos(listaProdutos)
      setFornecedores(listaFornecedores)
      setLinhas(listaLinhas)
      setCores(listaCores)
    }
    setCarregando(false)
  }

  function nomeFornecedor(id?: string | null): string | null {
    if (!id) return null
    return fornecedores.find(f => f.id === id)?.nome || null
  }

  // --- form de cadastro novo ---

  function mudarCampo(campo: keyof FormProduto, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function mudarCusto(valor: string) {
    setForm(prev => ({
      ...prev,
      custo: valor,
      preco: prev.margem.trim() ? precoAPartirDaMargem(valor, prev.margem) || prev.preco : prev.preco,
    }))
  }

  function mudarPreco(valor: string) {
    setForm(prev => ({ ...prev, preco: valor, margem: margemAPartirDoPreco(prev.custo, valor) || prev.margem }))
  }

  function mudarMargem(valor: string) {
    setForm(prev => ({ ...prev, margem: valor, preco: precoAPartirDaMargem(prev.custo, valor) || prev.preco }))
  }

  async function cadastrarProduto(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (!form.nome.trim()) {
      setErro('Preencha o nome do produto')
      return
    }
    const preco = parseFloat(form.preco.replace(',', '.'))
    if (isNaN(preco) || preco < 0) {
      setErro('Preço inválido')
      return
    }
    setSalvando(true)
    const me = await usuarioAtual()
    let fotoUrl: string | null = null
    if (fotoNovo) {
      fotoUrl = await uploadFotoProduto(fotoNovo)
    }
    const { error } = await criarProduto({
      nome: form.nome.trim(),
      categoria: form.categoria,
      preco,
      unidade: form.unidade.trim() || 'unidade',
      largura_mm: form.largura_mm.trim() ? parseInt(form.largura_mm) : null,
      altura_mm: form.altura_mm.trim() ? parseInt(form.altura_mm) : null,
      descricao: form.descricao.trim() || null,
      foto_url: fotoUrl,
      criado_por_id: me?.id || null,
      criado_por_nome: me?.nome || null,
      custo: form.custo.trim() ? parseFloat(form.custo.replace(',', '.')) : null,
      margem_percentual: form.margem.trim() ? parseFloat(form.margem.replace(',', '.')) : null,
      grupo: form.grupo.trim() || null,
      marca: form.marca.trim() || null,
      peso_kg: form.peso_kg.trim() ? parseFloat(form.peso_kg.replace(',', '.')) : null,
      fornecedor_id: form.fornecedor_id || null,
      linha_id: form.linha_id || null,
      cor_id: form.cor_id || null,
      ncm: form.ncm.trim() || null,
      icms_percentual: form.icms_percentual.trim() ? parseFloat(form.icms_percentual.replace(',', '.')) : null,
      ipi_percentual: form.ipi_percentual.trim() ? parseFloat(form.ipi_percentual.replace(',', '.')) : null,
      pis_percentual: form.pis_percentual.trim() ? parseFloat(form.pis_percentual.replace(',', '.')) : null,
      cofins_percentual: form.cofins_percentual.trim() ? parseFloat(form.cofins_percentual.replace(',', '.')) : null,
    })
    setSalvando(false)
    if (error) {
      setErro('Erro ao cadastrar produto')
      return
    }
    setSucesso(`Produto ${form.nome} cadastrado com sucesso.`)
    setForm(FORM_VAZIO)
    setFotoNovo(null)
    setImpostosNovoAberto(false)
    setProdutos(await listarProdutos())
  }

  // --- edição ---

  function iniciarEdicao(p: Produto) {
    setEditandoId(p.id)
    setEditForm(prev => ({
      ...prev,
      [p.id]: {
        nome: p.nome,
        categoria: p.categoria,
        custo: p.custo != null ? String(p.custo) : '',
        margem: p.margem_percentual != null ? String(p.margem_percentual) : '',
        preco: String(p.preco),
        unidade: p.unidade,
        grupo: p.grupo || '',
        marca: p.marca || '',
        peso_kg: p.peso_kg != null ? String(p.peso_kg) : '',
        fornecedor_id: p.fornecedor_id || '',
        linha_id: p.linha_id || '',
        cor_id: p.cor_id || '',
        largura_mm: p.largura_mm != null ? String(p.largura_mm) : '',
        altura_mm: p.altura_mm != null ? String(p.altura_mm) : '',
        descricao: p.descricao || '',
        ncm: p.ncm || '',
        icms_percentual: p.icms_percentual != null ? String(p.icms_percentual) : '',
        ipi_percentual: p.ipi_percentual != null ? String(p.ipi_percentual) : '',
        pis_percentual: p.pis_percentual != null ? String(p.pis_percentual) : '',
        cofins_percentual: p.cofins_percentual != null ? String(p.cofins_percentual) : '',
      },
    }))
  }

  function cancelarEdicao() {
    setEditandoId(null)
  }

  function mudarCampoEdicao(id: string, campo: keyof FormProduto, valor: string) {
    setEditForm(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))
  }

  function mudarCustoEdicao(id: string, valor: string) {
    setEditForm(prev => {
      const atual = prev[id]
      return {
        ...prev,
        [id]: {
          ...atual,
          custo: valor,
          preco: atual.margem.trim() ? precoAPartirDaMargem(valor, atual.margem) || atual.preco : atual.preco,
        },
      }
    })
  }

  function mudarPrecoEdicao(id: string, valor: string) {
    setEditForm(prev => {
      const atual = prev[id]
      return { ...prev, [id]: { ...atual, preco: valor, margem: margemAPartirDoPreco(atual.custo, valor) || atual.margem } }
    })
  }

  function mudarMargemEdicao(id: string, valor: string) {
    setEditForm(prev => {
      const atual = prev[id]
      return { ...prev, [id]: { ...atual, margem: valor, preco: precoAPartirDaMargem(atual.custo, valor) || atual.preco } }
    })
  }

  async function salvarEdicao(id: string) {
    const dados = editForm[id]
    if (!dados) return
    if (!dados.nome.trim()) return
    const preco = parseFloat(dados.preco.replace(',', '.'))
    if (isNaN(preco) || preco < 0) return
    setSalvandoEdicaoId(id)
    let fotoUrl: string | undefined
    const arquivo = fotoEditFile[id]
    if (arquivo) {
      const url = await uploadFotoProduto(arquivo)
      if (url) fotoUrl = url
    }
    await atualizarProduto(id, {
      nome: dados.nome.trim(),
      categoria: dados.categoria,
      preco,
      unidade: dados.unidade.trim() || 'unidade',
      largura_mm: dados.largura_mm.trim() ? parseInt(dados.largura_mm) : null,
      altura_mm: dados.altura_mm.trim() ? parseInt(dados.altura_mm) : null,
      descricao: dados.descricao.trim() || null,
      custo: dados.custo.trim() ? parseFloat(dados.custo.replace(',', '.')) : null,
      margem_percentual: dados.margem.trim() ? parseFloat(dados.margem.replace(',', '.')) : null,
      grupo: dados.grupo.trim() || null,
      marca: dados.marca.trim() || null,
      peso_kg: dados.peso_kg.trim() ? parseFloat(dados.peso_kg.replace(',', '.')) : null,
      fornecedor_id: dados.fornecedor_id || null,
      linha_id: dados.linha_id || null,
      cor_id: dados.cor_id || null,
      ncm: dados.ncm.trim() || null,
      icms_percentual: dados.icms_percentual.trim() ? parseFloat(dados.icms_percentual.replace(',', '.')) : null,
      ipi_percentual: dados.ipi_percentual.trim() ? parseFloat(dados.ipi_percentual.replace(',', '.')) : null,
      pis_percentual: dados.pis_percentual.trim() ? parseFloat(dados.pis_percentual.replace(',', '.')) : null,
      cofins_percentual: dados.cofins_percentual.trim() ? parseFloat(dados.cofins_percentual.replace(',', '.')) : null,
      ...(fotoUrl ? { foto_url: fotoUrl } : {}),
    })
    setProdutos(await listarProdutos())
    setFotoEditFile(prev => ({ ...prev, [id]: null }))
    setSalvandoEdicaoId(null)
    setEditandoId(null)
  }

  async function alternarAtivoAcao(p: Produto) {
    await alternarAtivoProduto(p.id, !p.ativo)
    setProdutos(await listarProdutos())
  }

  async function excluirComConfirmacao(p: Produto) {
    const confirmar = window.confirm(`Excluir o produto "${p.nome}"? Essa ação não pode ser desfeita.`)
    if (!confirmar) return
    await excluirProduto(p.id)
    setProdutos(await listarProdutos())
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar Produtos.</p>
        <Link href="/cadastro" className="text-brand-navy text-sm hover:underline">Voltar ao Cadastro</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cadastro" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <Package size={22} className="text-brand-navy" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Produtos</h1>
            <p className="text-sm text-slate-500">Catálogo, custo, margem e impostos</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-8">
            {!novoAberto ? (
              <button
                onClick={() => setNovoAberto(true)}
                className="flex items-center gap-2 text-sm font-medium text-brand-navy hover:underline"
              >
                <Plus size={16} /> Cadastrar produto novo
              </button>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                  <Package size={16} /> Cadastrar produto novo
                </h3>
                <form onSubmit={cadastrarProduto} className="space-y-3">
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => mudarCampo('nome', e.target.value)}
                    placeholder="Nome do produto"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <select
                    value={form.categoria}
                    onChange={e => mudarCampo('categoria', e.target.value as CategoriaProduto)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  >
                    {CATEGORIAS_PRODUTO.map(c => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={form.custo}
                      onChange={e => mudarCusto(e.target.value)}
                      placeholder="Custo (R$) — opcional"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="text"
                      value={form.margem}
                      onChange={e => mudarMargem(e.target.value)}
                      placeholder="Margem (%) — opcional"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="text"
                      value={form.preco}
                      onChange={e => mudarPreco(e.target.value)}
                      placeholder="Preço de venda (R$) *"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <p className="text-xs text-slate-400 -mt-2">
                    Preencha custo + margem que o preço sai sozinho, ou digite o preço direto que a margem calcula sozinha.
                  </p>

                  <input
                    type="text"
                    value={form.unidade}
                    onChange={e => mudarCampo('unidade', e.target.value)}
                    placeholder="Unidade (ex: unidade, metro, kg)"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={form.grupo}
                      onChange={e => mudarCampo('grupo', e.target.value)}
                      placeholder="Grupo — opcional"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="text"
                      value={form.marca}
                      onChange={e => mudarCampo('marca', e.target.value)}
                      placeholder="Marca — opcional"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={form.peso_kg}
                      onChange={e => mudarCampo('peso_kg', e.target.value)}
                      placeholder="Peso (kg) — opcional"
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <select
                      value={form.fornecedor_id}
                      onChange={e => mudarCampo('fornecedor_id', e.target.value)}
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    >
                      <option value="">Fornecedor — opcional</option>
                      {fornecedores.map(f => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={form.linha_id}
                      onChange={e => mudarCampo('linha_id', e.target.value)}
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    >
                      <option value="">Linha — opcional</option>
                      {linhas.map(l => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                    <select
                      value={form.cor_id}
                      onChange={e => mudarCampo('cor_id', e.target.value)}
                      className="border border-slate-300 rounded-xl p-3 text-sm"
                    >
                      <option value="">Cor — opcional</option>
                      {cores.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.largura_mm}
                      onChange={e => mudarCampo('largura_mm', e.target.value)}
                      placeholder="Largura (mm) — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="text"
                      value={form.altura_mm}
                      onChange={e => mudarCampo('altura_mm', e.target.value)}
                      placeholder="Altura (mm) — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <textarea
                    value={form.descricao}
                    onChange={e => mudarCampo('descricao', e.target.value)}
                    placeholder="Descrição — opcional"
                    rows={2}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <ImageIcon size={13} /> Foto do produto — opcional
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setFotoNovo(e.target.files?.[0] || null)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setImpostosNovoAberto(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                    >
                      <Receipt size={13} />
                      Impostos — opcional
                      {impostosNovoAberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {impostosNovoAberto && (
                      <div className="mt-2 border border-slate-100 rounded-lg p-3 space-y-2">
                        <input
                          type="text"
                          value={form.ncm}
                          onChange={e => mudarCampo('ncm', e.target.value)}
                          placeholder="NCM"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={form.icms_percentual}
                            onChange={e => mudarCampo('icms_percentual', e.target.value)}
                            placeholder="ICMS (%)"
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={form.ipi_percentual}
                            onChange={e => mudarCampo('ipi_percentual', e.target.value)}
                            placeholder="IPI (%)"
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={form.pis_percentual}
                            onChange={e => mudarCampo('pis_percentual', e.target.value)}
                            placeholder="PIS (%)"
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={form.cofins_percentual}
                            onChange={e => mudarCampo('cofins_percentual', e.target.value)}
                            placeholder="COFINS (%)"
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {erro && <p className="text-red-500 text-sm">{erro}</p>}
                  {sucesso && <p className="text-brand-teal text-sm">{sucesso}</p>}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={salvando}
                      className="flex-1 py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                    >
                      {salvando ? 'Cadastrando...' : 'Cadastrar produto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNovoAberto(false)}
                      className="px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <Package size={16} /> Produtos cadastrados
          </h2>
          {produtos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {produtos.map(p => (
                <div key={p.id} className="border border-slate-100 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <ImageIcon size={14} className="text-slate-300" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${p.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{p.nome}</p>
                        <p className="text-slate-400 text-xs">
                          {labelCategoriaProduto(p.categoria)} · R$ {p.preco.toFixed(2)} / {p.unidade}
                          {p.custo != null ? ` · custo R$ ${p.custo.toFixed(2)}` : ''}
                          {p.margem_percentual != null ? ` · margem ${p.margem_percentual.toFixed(1)}%` : ''}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {[p.grupo, p.marca, nomeFornecedor(p.fornecedor_id), (p.largura_mm || p.altura_mm) ? `${p.largura_mm || '?'} x ${p.altura_mm || '?'} mm` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {p.descricao && <p className="text-slate-400 text-xs">{p.descricao}</p>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${p.ativo ? 'bg-brand-navyLight text-brand-navyDark' : 'bg-slate-100 text-slate-500'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {editandoId === p.id ? (
                    <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                      <input
                        type="text"
                        value={editForm[p.id]?.nome ?? ''}
                        onChange={e => mudarCampoEdicao(p.id, 'nome', e.target.value)}
                        placeholder="Nome"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={editForm[p.id]?.categoria ?? 'outro'}
                        onChange={e => mudarCampoEdicao(p.id, 'categoria', e.target.value as CategoriaProduto)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        {CATEGORIAS_PRODUTO.map(c => (
                          <option key={c.valor} value={c.valor}>{c.label}</option>
                        ))}
                      </select>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editForm[p.id]?.custo ?? ''}
                          onChange={e => mudarCustoEdicao(p.id, e.target.value)}
                          placeholder="Custo (R$)"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editForm[p.id]?.margem ?? ''}
                          onChange={e => mudarMargemEdicao(p.id, e.target.value)}
                          placeholder="Margem (%)"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editForm[p.id]?.preco ?? ''}
                          onChange={e => mudarPrecoEdicao(p.id, e.target.value)}
                          placeholder="Preço (R$)"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <input
                        type="text"
                        value={editForm[p.id]?.unidade ?? ''}
                        onChange={e => mudarCampoEdicao(p.id, 'unidade', e.target.value)}
                        placeholder="Unidade"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editForm[p.id]?.grupo ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'grupo', e.target.value)}
                          placeholder="Grupo"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editForm[p.id]?.marca ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'marca', e.target.value)}
                          placeholder="Marca"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editForm[p.id]?.peso_kg ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'peso_kg', e.target.value)}
                          placeholder="Peso (kg)"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <select
                          value={editForm[p.id]?.fornecedor_id ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'fornecedor_id', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Sem fornecedor</option>
                          {fornecedores.map(f => (
                            <option key={f.id} value={f.id}>{f.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editForm[p.id]?.linha_id ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'linha_id', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Sem linha</option>
                          {linhas.map(l => (
                            <option key={l.id} value={l.id}>{l.nome}</option>
                          ))}
                        </select>
                        <select
                          value={editForm[p.id]?.cor_id ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'cor_id', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Sem cor</option>
                          {cores.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm[p.id]?.largura_mm ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'largura_mm', e.target.value)}
                          placeholder="Largura (mm)"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editForm[p.id]?.altura_mm ?? ''}
                          onChange={e => mudarCampoEdicao(p.id, 'altura_mm', e.target.value)}
                          placeholder="Altura (mm)"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <textarea
                        value={editForm[p.id]?.descricao ?? ''}
                        onChange={e => mudarCampoEdicao(p.id, 'descricao', e.target.value)}
                        placeholder="Descrição"
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <ImageIcon size={13} /> Trocar foto — opcional
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => setFotoEditFile(prev => ({ ...prev, [p.id]: e.target.files?.[0] || null }))}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setImpostosEditAberto(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                        >
                          <Receipt size={13} />
                          Impostos — opcional
                          {impostosEditAberto[p.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {impostosEditAberto[p.id] && (
                          <div className="mt-2 border border-slate-100 rounded-lg p-3 space-y-2">
                            <input
                              type="text"
                              value={editForm[p.id]?.ncm ?? ''}
                              onChange={e => mudarCampoEdicao(p.id, 'ncm', e.target.value)}
                              placeholder="NCM"
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editForm[p.id]?.icms_percentual ?? ''}
                                onChange={e => mudarCampoEdicao(p.id, 'icms_percentual', e.target.value)}
                                placeholder="ICMS (%)"
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                              <input
                                type="text"
                                value={editForm[p.id]?.ipi_percentual ?? ''}
                                onChange={e => mudarCampoEdicao(p.id, 'ipi_percentual', e.target.value)}
                                placeholder="IPI (%)"
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                              <input
                                type="text"
                                value={editForm[p.id]?.pis_percentual ?? ''}
                                onChange={e => mudarCampoEdicao(p.id, 'pis_percentual', e.target.value)}
                                placeholder="PIS (%)"
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                              <input
                                type="text"
                                value={editForm[p.id]?.cofins_percentual ?? ''}
                                onChange={e => mudarCampoEdicao(p.id, 'cofins_percentual', e.target.value)}
                                placeholder="COFINS (%)"
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => salvarEdicao(p.id)}
                          disabled={salvandoEdicaoId === p.id}
                          className="flex-1 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                        >
                          {salvandoEdicaoId === p.id ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelarEdicao}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => iniciarEdicao(p)}
                        className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        onClick={() => alternarAtivoAcao(p)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        {p.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => excluirComConfirmacao(p)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
