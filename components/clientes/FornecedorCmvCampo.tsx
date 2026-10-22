'use client'

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { carregarAcessoCadastro, podeAcaoCadastro } from '@/lib/acessoCadastroOperacional'
import { correspondeBuscaAtlas, normalizarBuscaAtlas, somenteNumerosAtlas } from '@/lib/buscaAtlas'
import { criarFornecedor, listarFornecedores } from '@/lib/fornecedores'
import type { Fornecedor } from '@/lib/tipos'

type FornecedorDetalhado = Fornecedor & { whatsapp?: string | null }
type CampoFornecedor = {
  nome: string
  cnpj_cpf: string
  contato: string
  telefone: string
  whatsapp: string
  email: string
  endereco: string
  cidade: string
  observacoes: string
  pedido_minimo: string
  frete_gratis_minimo: string
  prazo_medio_dias: string
  condicao_pagamento_padrao: string
  observacoes_comerciais: string
}

const vazio: CampoFornecedor = {
  nome: '', cnpj_cpf: '', contato: '', telefone: '', whatsapp: '', email: '',
  endereco: '', cidade: '', observacoes: '', pedido_minimo: '',
  frete_gratis_minimo: '', prazo_medio_dias: '', condicao_pagamento_padrao: '',
  observacoes_comerciais: ''
}
const moedaNumero = (v: string) => {
  const valor = v.trim()
  const n = Number(valor.includes(',') ? valor.replace(/\./g, '').replace(',', '.') : valor)
  return v.trim() && Number.isFinite(n) ? n : null
}
const optional = (v: string) => v.trim() || null

export default function FornecedorCmvCampo({ inicial = '' }: { inicial?: string }) {
  const [lista, setLista] = useState<FornecedorDetalhado[]>([])
  const [consulta, setConsulta] = useState(inicial)
  const [selecionado, setSelecionado] = useState<FornecedorDetalhado | null>(null)
  const [legado, setLegado] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [podeCriar, setPodeCriar] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<CampoFornecedor>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const [fornecedores, usuario] = await Promise.all([listarFornecedores(true), usuarioAtual()])
        if (!ativo) return
        setLista(fornecedores as FornecedorDetalhado[])
        const original = fornecedores.find(f => normalizarBuscaAtlas(f.nome) === normalizarBuscaAtlas(inicial))
        if (original) { setSelecionado(original); setConsulta(original.nome); inputRef.current?.setCustomValidity('') }
        else if (inicial.trim()) { setLegado(true); inputRef.current?.setCustomValidity('') }
        if (usuario) {
          const acesso = await carregarAcessoCadastro(usuario)
          if (ativo) setPodeCriar(podeAcaoCadastro(acesso, 'fornecedores', 'criar'))
        }
      } catch {
        if (ativo) setErro('Não foi possível consultar os fornecedores. Tente novamente.')
      } finally { if (ativo) setCarregando(false) }
    }
    void carregar()
    return () => { ativo = false }
  }, [inicial])

  const resultados = useMemo(() => {
    const termo = consulta.trim()
    return lista.filter(f => !termo || correspondeBuscaAtlas(
      termo, f.nome, f.cnpj_cpf, f.contato, f.telefone, f.cidade, f.email
    )).slice(0, 10)
  }, [lista, consulta])

  function escolher(f: FornecedorDetalhado) {
    setConsulta(f.nome)
    setSelecionado(f)
    setLegado(false)
    setAberto(false)
    setAviso('')
    setErro('')
    inputRef.current?.setCustomValidity('')
  }

  function digitar(v: string) {
    setConsulta(v)
    setSelecionado(null)
    setLegado(false)
    setAberto(true)
    setAviso('')
    inputRef.current?.setCustomValidity(v.trim() ? 'Selecione um fornecedor da lista ou cadastre um novo.' : '')
  }

  function abrirCadastro() {
    setAberto(false)
    setErro('')
    setForm({ ...vazio, nome: consulta.trim() })
    setModal(true)
  }

  async function cadastrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (salvando || !podeCriar) return
    setErro('')
    const nome = form.nome.trim()
    const documento = somenteNumerosAtlas(form.cnpj_cpf)
    const telefone = somenteNumerosAtlas(form.telefone)
    if (!nome) return setErro('Informe o nome ou razão social.')
    if (![11, 14].includes(documento.length)) return setErro('Informe um CPF ou CNPJ com 11 ou 14 dígitos.')
    if (telefone.length < 10 || telefone.length > 11) return setErro('Informe um telefone com DDD.')
    setSalvando(true)
    try {
      const fornecedores = await listarFornecedores()
      const existente = fornecedores.find(f => somenteNumerosAtlas(f.cnpj_cpf) === documento)
      if (existente) {
        if (!existente.ativo) throw new Error('Esse CPF/CNPJ já está cadastrado, mas está inativo. Ative-o no cadastro de fornecedores.')
        setLista(fornecedores.filter(f => f.ativo))
        escolher(existente)
        setModal(false)
        setAviso('Fornecedor já cadastrado. Registro existente selecionado, sem duplicar.')
        return
      }
      const usuario = await usuarioAtual()
      if (!usuario) throw new Error('Sessão expirada. Entre novamente para cadastrar.')
      const acesso = await carregarAcessoCadastro(usuario)
      if (!podeAcaoCadastro(acesso, 'fornecedores', 'criar')) throw new Error('Seu usuário não tem permissão para criar fornecedores.')
      const { error } = await criarFornecedor({
        nome, cnpj_cpf: form.cnpj_cpf.trim(), contato: optional(form.contato),
        telefone: form.telefone.trim(), whatsapp: optional(form.whatsapp),
        email: optional(form.email), endereco: optional(form.endereco),
        cidade: optional(form.cidade), observacoes: optional(form.observacoes),
        pedido_minimo: moedaNumero(form.pedido_minimo),
        frete_gratis_minimo: moedaNumero(form.frete_gratis_minimo),
        prazo_medio_dias: form.prazo_medio_dias.trim() ? Math.max(0, Math.round(moedaNumero(form.prazo_medio_dias) || 0)) : null,
        condicao_pagamento_padrao: optional(form.condicao_pagamento_padrao),
        observacoes_comerciais: optional(form.observacoes_comerciais),
        criado_por_id: usuario.id, criado_por_nome: usuario.nome || null
      })
      if (error) throw new Error('Não foi possível cadastrar o fornecedor. Confira os dados e tente novamente.')
      const atualizados = await listarFornecedores(true)
      setLista(atualizados as FornecedorDetalhado[])
      const novo = atualizados.find(f => somenteNumerosAtlas(f.cnpj_cpf) === documento)
      if (!novo) throw new Error('Cadastro enviado, mas não localizado na lista. Confira o cadastro antes de tentar novamente.')
      escolher(novo)
      setModal(false)
      setAviso('Fornecedor cadastrado e selecionado para este lançamento.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cadastrar fornecedor.')
    } finally {
      setSalvando(false)
    }
  }

  const campo = (key: keyof CampoFornecedor, valor: string) =>
    setForm(p => ({ ...p, [key]: valor }))

  return <div className="relative min-w-0">
    <label htmlFor={inputId} className="text-xs font-semibold">Fornecedor *</label>
    <div className="relative mt-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
      <input id={inputId} ref={inputRef} name="fornecedor" required maxLength={150}
        autoComplete="off" value={consulta}
        onChange={e => digitar(e.target.value)}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 170)}
        aria-expanded={aberto} aria-controls={inputId + '-opcoes'} role="combobox"
        aria-autocomplete="list" placeholder="Digite nome, CPF/CNPJ ou cidade..."
        className="w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm" />
    </div>
    {legado && <p className="mt-1 text-[11px] text-amber-800">Lançamento antigo: nome original preservado. Para trocar, selecione um fornecedor cadastrado.</p>}
    {selecionado && <div className="mt-1 text-[11px] text-emerald-700">
      Selecionado do cadastro: {selecionado.nome}{selecionado.cidade ? ' · ' + selecionado.cidade : ''}
    </div>}
    {aviso && <p role="status" className="mt-1 text-[11px] text-emerald-700">{aviso}</p>}
    {aberto && <div id={inputId + '-opcoes'} role="listbox"
      className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
      {carregando && <p className="p-2 text-xs text-slate-500">Buscando fornecedores...</p>}
      {!carregando && resultados.map(f => <button type="button" role="option"
        aria-selected={selecionado?.id === f.id} key={f.id}
        onMouseDown={e => e.preventDefault()} onClick={() => escolher(f)}
        className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-blue-50">
        <strong className="block text-slate-800">{f.nome}</strong>
        <span className="text-slate-500">{[f.cnpj_cpf, f.cidade, f.telefone].filter(Boolean).join(' · ')}</span>
      </button>)}
      {!carregando && !resultados.length && <p className="p-2 text-xs text-slate-500">Nenhum fornecedor encontrado.</p>}
      {podeCriar && <button type="button" onMouseDown={e => e.preventDefault()}
        onClick={abrirCadastro}
        className="mt-1 flex w-full items-center gap-1 rounded-md border-t px-3 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50">
        <Plus size={14} /> Cadastrar novo fornecedor (cadastro completo)
      </button>}
      {!podeCriar && !carregando && <p className="p-2 text-[11px] text-slate-500">Para cadastrar outro fornecedor, solicite permissão ao administrador.</p>}
    </div>}
    {erro && !modal && <p role="alert" className="mt-1 text-[11px] text-red-700">{erro}</p>}

    {modal && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-fornecedor-cmv"
          className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div><h2 id="titulo-fornecedor-cmv" className="font-bold text-slate-900">Cadastrar fornecedor</h2>
              <p className="text-xs text-slate-500">Cadastro oficial do Atlas One. Nome, CPF/CNPJ e telefone são obrigatórios.</p></div>
            <button type="button" onClick={() => { setModal(false); setErro('') }}
              aria-label="Fechar cadastro" className="rounded-lg p-1.5 hover:bg-slate-100"><X size={20} /></button>
          </div>
          <form onSubmit={e => { e.stopPropagation(); void cadastrar(e) }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['nome', 'Nome / razão social *'], ['cnpj_cpf', 'CPF / CNPJ *'],
                ['telefone', 'Telefone com DDD *'], ['contato', 'Nome do contato'],
                ['whatsapp', 'WhatsApp'], ['email', 'E-mail'],
                ['cidade', 'Cidade'], ['endereco', 'Endereço']
              ] as [keyof CampoFornecedor, string][]).map(([key, label]) =>
                <label key={key} className="text-xs font-semibold text-slate-600">{label}
                  <input required={['nome', 'cnpj_cpf', 'telefone'].includes(key)}
                    value={form[key]} onChange={e => campo(key, e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" />
                </label>)}
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <b className="text-xs text-blue-800">Condições comerciais</b>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {([
                  ['pedido_minimo', 'Pedido mínimo (R$)'],
                  ['frete_gratis_minimo', 'Frete grátis a partir de (R$)'],
                  ['prazo_medio_dias', 'Prazo médio de entrega (dias)'],
                  ['condicao_pagamento_padrao', 'Condição de pagamento']
                ] as [keyof CampoFornecedor, string][]).map(([key, label]) =>
                  <label key={key} className="text-xs text-slate-600">{label}
                    <input value={form[key]} onChange={e => campo(key, e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" />
                  </label>)}
                <label className="text-xs text-slate-600 sm:col-span-2">Observações comerciais
                  <textarea rows={2} value={form.observacoes_comerciais}
                    onChange={e => campo('observacoes_comerciais', e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" /></label>
              </div>
            </div>
            <label className="block text-xs text-slate-600">Observações gerais
              <textarea rows={2} value={form.observacoes}
                onChange={e => campo('observacoes', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" /></label>
            {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setModal(false); setErro('') }}
                className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={salvando}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {salvando ? 'Cadastrando...' : 'Salvar fornecedor e selecionar'}
              </button>
            </div>
          </form>
        </div>
      </div>, document.body
    )}
  </div>
}
