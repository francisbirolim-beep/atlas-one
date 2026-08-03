'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, X, Package } from 'lucide-react'
import Link from 'next/link'
import { ProducaoItem, Usuario } from '@/lib/tipos'
import { listarItensProducao, criarItemProducao, excluirItemProducao } from '@/lib/producaoKanban'
import { usuarioAtual } from '@/lib/auth'

export default function Producao() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [itens, setItens] = useState<ProducaoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)
  const [tituloNovo, setTituloNovo] = useState('')
  const [descNova, setDescNova] = useState('')
  const [selecionado, setSelecionado] = useState<ProducaoItem | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [u, its] = await Promise.all([usuarioAtual(), listarItensProducao()])
    setUsuario(u)
    setItens(its)
    setCarregando(false)
  }

  function abrirNovo() {
    setTituloNovo('')
    setDescNova('')
    setNovo(true)
  }

  async function salvarNovo() {
    if (!tituloNovo.trim()) return
    const item = await criarItemProducao(
      tituloNovo.trim(),
      descNova.trim() || undefined,
      usuario?.id,
      usuario?.nome
    )
    if (item) setItens((prev) => [...prev, item])
    setNovo(false)
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
            <p className="text-xs text-slate-400">Kanban de produção - comecando pela Medição final</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{itens.length} card(s)</p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          <div className="flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-700">Medição final</span>
                <span className="text-xs text-slate-400">{itens.length}</span>
              </div>
            </div>

            <div className="space-y-2 min-h-[80px]">
              {itens.map((item) => (
                <div
                  key={item.id}
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
              onClick={abrirNovo}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-brand-navy py-2 rounded-lg hover:bg-white transition"
            >
              <Plus size={14} /> Adicionar card
            </button>
          </div>
        </div>
      </main>

      {novo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Novo card - Medição final</h3>
              <button onClick={() => setNovo(false)} className="text-slate-400 hover:text-slate-600">
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
              onClick={salvarNovo}
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
