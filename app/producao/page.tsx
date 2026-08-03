'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Package } from 'lucide-react'
import Link from 'next/link'
import { ProducaoColuna, ProducaoItem, Usuario } from '@/lib/tipos'
import {
  listarColunasProducao,
  criarColunaProducao,
  renomearColunaProducao,
  excluirColunaProducao,
  listarItensProducao,
  criarItemProducao,
  moverItemProducao,
  excluirItemProducao,
} from '@/lib/producaoKanban'
import { usuarioAtual } from '@/lib/auth'

export default function Producao() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<ProducaoColuna[]>([])
  const [itens, setItens] = useState<ProducaoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [novoEm, setNovoEm] = useState<string | null>(null)
  const [tituloNovo, setTituloNovo] = useState('')
  const [descNova, setDescNova] = useState('')
  const [selecionado, setSelecionado] = useState<ProducaoItem | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [u, cols, its] = await Promise.all([usuarioAtual(), listarColunasProducao(), listarItensProducao()])
    setUsuario(u)
    setColunas(cols)
    setItens(its)
    setCarregando(false)
  }

  function itensDaColuna(colunaId: string) {
    return itens.filter((i) => i.coluna_id === colunaId)
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, coluna_id: colunaId } : i)))
    await moverItemProducao(id, colunaId)
  }

  async function novaColuna() {
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColunaProducao(nome.trim())
    if (col) setColunas((prev) => [...prev, col])
  }

  async function editarColuna(col: ProducaoColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColunaProducao(col.id, novoNome.trim())
    if (ok) setColunas((prev) => prev.map((c) => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: ProducaoColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter((c) => c.id !== col.id)
    const destino = outras[0]
    const qtd = itens.filter((i) => i.coluna_id === col.id).length
    const msg = qtd > 0
      ? `Essa coluna tem ${qtd} card(s). Eles vao para a coluna "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a coluna "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColunaProducao(col.id, destino.id)
    if (ok) {
      setItens((prev) => prev.map((i) => (i.coluna_id === col.id ? { ...i, coluna_id: destino.id } : i)))
      setColunas(outras)
    }
  }

  function abrirNovoItem(colunaId: string) {
    setNovoEm(colunaId)
    setTituloNovo('')
    setDescNova('')
  }

  async function salvarNovoItem() {
    if (!novoEm || !tituloNovo.trim()) return
    const item = await criarItemProducao(novoEm, tituloNovo.trim(), descNova.trim() || undefined, usuario?.id, usuario?.nome)
    if (item) setItens((prev) => [...prev, item])
    setNovoEm(null)
  }

  async function apagar(item: ProducaoItem) {
    const confirmar = window.confirm('Apagar o card "' + item.titulo + '"?')
    if (!confirmar) return
    const ok = await excluirItemProducao(item.id)
    if (ok) {
      setItens((prev) => prev.filter((x) => x.id !== item.id))
      setSelecionado(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/setores" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Produção</h1>
            <p className="text-xs text-slate-400">Kanban de produção - time todo ve e mexe aqui</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{itens.length} card(s)</p>
          <button onClick={novaColuna} className="flex items-center gap-1.5 text-sm text-brand-navy hover:underline">
            <Plus size={16} /> Nova coluna
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((col) => {
            const cardsColuna = itensDaColuna(col.id)
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setColunaArrastando(col.id) }}
                onDragLeave={() => setColunaArrastando(null)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3 transition ${
                  colunaArrastando === col.id ? 'ring-2 ring-brand-navy bg-brand-navyLight' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-700">{col.nome}</span>
                    <span className="text-xs text-slate-400">{cardsColuna.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editarColuna(col)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => apagarColuna(col)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                      onClick={() => setSelecionado(item)}
                      className="rounded-xl border-2 border-slate-200 bg-white p-3 cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package size={14} className="text-slate-300 flex-shrink-0" />
                        <p className="font-medium text-sm truncate flex-1 text-slate-800">{item.titulo}</p>
                      </div>
                      {item.criado_por_nome && (
                        <p className="text-xs text-slate-400">por {item.criado_por_nome}</p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => abrirNovoItem(col.id)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-brand-navy py-2 rounded-lg hover:bg-white transition"
                >
                  <Plus size={14} /> Adicionar card
                </button>
              </div>
            )
          })}
        </div>
      </main>

      {novoEm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Novo card</h3>
              <button onClick={() => setNovoEm(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <input
              value={tituloNovo}
              onChange={(e) => setTituloNovo(e.target.value)}
              placeholder="Titulo (ex: nome do cliente)"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
            <textarea
              value={descNova}
              onChange={(e) => setDescNova(e.target.value)}
              placeholder="Descricao (opcional)"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              rows={3}
            />
            <button
              onClick={salvarNovoItem}
              disabled={!tituloNovo.trim()}
              className="w-full bg-brand-navy text-white rounded-xl py-2 text-sm font-medium disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {selecionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">{selecionado.titulo}</h3>
              <button onClick={() => setSelecionado(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {selecionado.descricao && <p className="text-sm text-slate-500">{selecionado.descricao}</p>}
            {selecionado.criado_por_nome && (
              <p className="text-xs text-slate-400">Criado por {selecionado.criado_por_nome}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => apagar(selecionado)}
                className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium"
              >
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
