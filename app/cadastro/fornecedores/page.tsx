'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Pencil, Truck, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import {
  listarFornecedores,
  criarFornecedor,
  atualizarFornecedor,
  alternarAtivoFornecedor,
  excluirFornecedor,
} from '@/lib/fornecedores'
import { Fornecedor } from '@/lib/tipos'

export default function Fornecedores() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])

  const [novoAberto, setNovoAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [contato, setContato] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, {
    nome: string; cnpj_cpf: string; contato: string; telefone: string
    email: string; endereco: string; cidade: string; observacoes: string
  }>>({})
  const [salvandoEdicaoId, setSalvandoEdicaoId] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')
    if (me?.role === 'master') {
      setFornecedores(await listarFornecedores())
    }
    setCarregando(false)
  }

  async function cadastrarFornecedor(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (!nome.trim()) {
      setErro('Preencha o nome do fornecedor')
      return
    }
    setSalvando(true)
    const me = await usuarioAtual()
    const { error } = await criarFornecedor({
      nome: nome.trim(),
      cnpj_cpf: cnpjCpf.trim() || null,
      contato: contato.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      observacoes: observacoes.trim() || null,
      criado_por_id: me?.id || null,
      criado_por_nome: me?.nome || null,
    })
    setSalvando(false)
    if (error) {
      setErro('Erro ao cadastrar fornecedor')
      return
    }
    setSucesso(`Fornecedor ${nome} cadastrado com sucesso.`)
    setNome('')
    setCnpjCpf('')
    setContato('')
    setTelefone('')
    setEmail('')
    setEndereco('')
    setCidade('')
    setObservacoes('')
    setFornecedores(await listarFornecedores())
  }

  function iniciarEdicao(f: Fornecedor) {
    setEditandoId(f.id)
    setEditForm(prev => ({
      ...prev,
      [f.id]: {
        nome: f.nome,
        cnpj_cpf: f.cnpj_cpf || '',
        contato: f.contato || '',
        telefone: f.telefone || '',
        email: f.email || '',
        endereco: f.endereco || '',
        cidade: f.cidade || '',
        observacoes: f.observacoes || '',
      },
    }))
  }

  function cancelarEdicao() {
    setEditandoId(null)
  }

  function mudarCampoEdicao(id: string, campo: string, valor: string) {
    setEditForm(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } as any }))
  }

  async function salvarEdicao(id: string) {
    const dados = editForm[id]
    if (!dados || !dados.nome.trim()) return
    setSalvandoEdicaoId(id)
    await atualizarFornecedor(id, {
      nome: dados.nome.trim(),
      cnpj_cpf: dados.cnpj_cpf.trim() || null,
      contato: dados.contato.trim() || null,
      telefone: dados.telefone.trim() || null,
      email: dados.email.trim() || null,
      endereco: dados.endereco.trim() || null,
      cidade: dados.cidade.trim() || null,
      observacoes: dados.observacoes.trim() || null,
    })
    setFornecedores(await listarFornecedores())
    setSalvandoEdicaoId(null)
    setEditandoId(null)
  }

  async function alternarAtivoAcao(f: Fornecedor) {
    await alternarAtivoFornecedor(f.id, !f.ativo)
    setFornecedores(await listarFornecedores())
  }

  async function excluirComConfirmacao(f: Fornecedor) {
    const confirmar = window.confirm(`Excluir o fornecedor "${f.nome}"? Essa ação não pode ser desfeita.`)
    if (!confirmar) return
    await excluirFornecedor(f.id)
    setFornecedores(await listarFornecedores())
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar Fornecedores.</p>
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
          <Truck size={22} className="text-brand-navy" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Fornecedores</h1>
            <p className="text-sm text-slate-500">Quem vende os produtos que você compra</p>
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
                <Plus size={16} /> Cadastrar fornecedor novo
              </button>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                  <Truck size={16} /> Cadastrar fornecedor novo
                </h3>
                <form onSubmit={cadastrarFornecedor} className="space-y-3">
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Nome / razão social *"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cnpjCpf}
                      onChange={e => setCnpjCpf(e.target.value)}
                      placeholder="CNPJ ou CPF — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="text"
                      value={contato}
                      onChange={e => setContato(e.target.value)}
                      placeholder="Nome do contato — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={telefone}
                      onChange={e => setTelefone(e.target.value)}
                      placeholder="Telefone / WhatsApp — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="E-mail — opcional"
                      className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={endereco}
                    onChange={e => setEndereco(e.target.value)}
                    placeholder="Endereço — opcional"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <input
                    type="text"
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    placeholder="Cidade — opcional"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <textarea
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Observações — opcional"
                    rows={2}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />

                  {erro && <p className="text-red-500 text-sm">{erro}</p>}
                  {sucesso && <p className="text-brand-teal text-sm">{sucesso}</p>}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={salvando}
                      className="flex-1 py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                    >
                      {salvando ? 'Cadastrando...' : 'Cadastrar fornecedor'}
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
            <Truck size={16} /> Fornecedores cadastrados
          </h2>
          {fornecedores.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum fornecedor cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {fornecedores.map(f => (
                <div key={f.id} className="border border-slate-100 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${f.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{f.nome}</p>
                      <p className="text-slate-400 text-xs">
                        {[f.cnpj_cpf, f.contato, f.telefone, f.cidade].filter(Boolean).join(' · ') || 'Sem dados adicionais'}
                      </p>
                      {f.observacoes && <p className="text-slate-400 text-xs">{f.observacoes}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${f.ativo ? 'bg-brand-navyLight text-brand-navyDark' : 'bg-slate-100 text-slate-500'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {editandoId === f.id ? (
                    <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                      <input
                        type="text"
                        value={editForm[f.id]?.nome ?? ''}
                        onChange={e => mudarCampoEdicao(f.id, 'nome', e.target.value)}
                        placeholder="Nome / razão social"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm[f.id]?.cnpj_cpf ?? ''}
                          onChange={e => mudarCampoEdicao(f.id, 'cnpj_cpf', e.target.value)}
                          placeholder="CNPJ ou CPF"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editForm[f.id]?.contato ?? ''}
                          onChange={e => mudarCampoEdicao(f.id, 'contato', e.target.value)}
                          placeholder="Contato"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm[f.id]?.telefone ?? ''}
                          onChange={e => mudarCampoEdicao(f.id, 'telefone', e.target.value)}
                          placeholder="Telefone"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="email"
                          value={editForm[f.id]?.email ?? ''}
                          onChange={e => mudarCampoEdicao(f.id, 'email', e.target.value)}
                          placeholder="E-mail"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={editForm[f.id]?.endereco ?? ''}
                        onChange={e => mudarCampoEdicao(f.id, 'endereco', e.target.value)}
                        placeholder="Endereço"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editForm[f.id]?.cidade ?? ''}
                        onChange={e => mudarCampoEdicao(f.id, 'cidade', e.target.value)}
                        placeholder="Cidade"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <textarea
                        value={editForm[f.id]?.observacoes ?? ''}
                        onChange={e => mudarCampoEdicao(f.id, 'observacoes', e.target.value)}
                        placeholder="Observações"
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={() => salvarEdicao(f.id)}
                          disabled={salvandoEdicaoId === f.id}
                          className="flex-1 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                        >
                          {salvandoEdicaoId === f.id ? 'Salvando...' : 'Salvar'}
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
                        onClick={() => iniciarEdicao(f)}
                        className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        onClick={() => alternarAtivoAcao(f)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        {f.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => excluirComConfirmacao(f)}
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
