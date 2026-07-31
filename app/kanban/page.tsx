'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Phone, MapPin, Camera, FileText } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KanbanColuna, OrcamentoRapido } from '@/lib/tipos'
import { listarColunas, criarColuna, renomearColuna, excluirColuna, moverCard } from '@/lib/kanban'

const tipoLabels: Record<string, string> = {
  porta_correr: 'Porta de Correr',
  porta_pivotante: 'Porta Pivotante',
  porta_abrir: 'Porta de Abrir',
  janela_correr: 'Janela de Correr',
  janela_maximiar: 'Janela Maximiar',
  janela_basculante: 'Janela Basculante',
  vitro: 'Vitrô',
  fachada: 'Fachada',
  box: 'Box de Banheiro',
  outro: 'Outro',
}

export default function Kanban() {
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [cards, setCards] = useState<OrcamentoRapido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [cardSelecionado, setCardSelecionado] = useState<OrcamentoRapido | null>(null)
  const [valorEdit, setValorEdit] = useState('')
  const [colunaEdit, setColunaEdit] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [cols, { data: orc }] = await Promise.all([
      listarColunas(),
      supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setColunas(cols)
    if (orc) setCards(orc as OrcamentoRapido[])
    setCarregando(false)
  }

  function cardsDaColuna(colunaId: string, index: number) {
    return cards.filter(c => (c.coluna_id || colunas[0]?.id) === colunaId || (!c.coluna_id && index === 0))
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, coluna_id: colunaId } : c)))
    await moverCard(cardId, colunaId)
  }

  async function novaColuna() {
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColuna(nome.trim())
    if (col) setColunas(prev => [...prev, col])
  }

  async function editarColuna(col: KanbanColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColuna(col.id, novoNome.trim())
    if (ok) setColunas(prev => prev.map(c => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: KanbanColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter(c => c.id !== col.id)
    const destino = outras[0]
    const qtd = cards.filter(c => (c.coluna_id || colunas[0]?.id) === col.id).length
    const msg = qtd > 0
      ? `Essa coluna tem ${qtd} card(s). Eles vão pra coluna "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a coluna "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColuna(col.id, destino.id)
    if (ok) {
      setColunas(prev => prev.filter(c => c.id !== col.id))
      setCards(prev => prev.map(c => (c.coluna_id === col.id ? { ...c, coluna_id: destino.id } : c)))
    }
  }

  function abrirCard(card: OrcamentoRapido) {
    setCardSelecionado(card)
    setValorEdit(card.valor_estimado != null ? String(card.valor_estimado) : '')
    setColunaEdit(card.coluna_id || colunas[0]?.id || '')
  }

  async function salvarCard() {
    if (!cardSelecionado) return
    setSalvando(true)
    const valor = valorEdit.trim() ? parseFloat(valorEdit.replace(',', '.')) : null
    const { error } = await supabase
      .from('orcamentos')
      .update({ valor_estimado: valor, coluna_id: colunaEdit })
      .eq('id', cardSelecionado.id)
    setSalvando(false)
    if (!error) {
      setCards(prev =>
        prev.map(c => (c.id === cardSelecionado.id ? { ...c, valor_estimado: valor, coluna_id: colunaEdit } : c))
      )
      setCardSelecionado(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Painel de Orçamentos</h1>
            <p className="text-sm text-slate-500">Arraste os cards entre as colunas</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((col, index) => {
            const cardsColuna = cardsDaColuna(col.id, index)
            return (
              <div
                key={col.id}
                onDragOver={e => { e.preventDefault(); setColunaArrastando(col.id) }}
                onDragLeave={() => setColunaArrastando(null)}
                onDrop={e => handleDrop(e, col.id)}
                className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3 transition ${
                  colunaArrastando === col.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-700 text-sm">{col.nome}</h3>
                    <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                      {cardsColuna.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editarColuna(col)} className="p-1 text-slate-400 hover:text-slate-600">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => apagarColuna(col)} className="p-1 text-slate-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map(card => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', card.id)}
                      onClick={() => abrirCard(card)}
                      className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1 rounded ${(card as any).modo_entrada === 'detalhado' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                          {(card as any).modo_entrada === 'detalhado'
                            ? <Camera size={12} className="text-emerald-600" />
                            : <FileText size={12} className="text-blue-600" />}
                        </div>
                        <p className="font-medium text-slate-800 text-sm truncate">{card.cliente_nome}</p>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {tipoLabels[card.tipo_esquadria] || card.tipo_esquadria}
                        {card.largura_mm ? ` — ${card.largura_mm}×${card.altura_mm}mm` : ''}
                      </p>
                      {card.descricao_livre && (
                        <p className="text-xs text-slate-400 line-clamp-2">{card.descricao_livre}</p>
                      )}
                      {card.valor_estimado != null && (
                        <p className="text-xs font-semibold text-emerald-600 mt-1">R$ {card.valor_estimado.toFixed(2)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button
            onClick={novaColuna}
            className="flex-shrink-0 w-72 h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition"
          >
            <Plus size={16} /> Nova coluna
          </button>
        </div>
      </main>

      {cardSelecionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{cardSelecionado.cliente_nome}</h3>
              <button onClick={() => setCardSelecionado(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                {cardSelecionado.cliente_whatsapp && (
                  <span className="flex items-center gap-1.5"><Phone size={14} /> {cardSelecionado.cliente_whatsapp}</span>
                )}
                {cardSelecionado.cidade && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {cardSelecionado.cidade}</span>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <p className="text-slate-700 font-medium mb-1">
                  {tipoLabels[cardSelecionado.tipo_esquadria] || cardSelecionado.tipo_esquadria}
                </p>
                {cardSelecionado.largura_mm ? (
                  <p className="text-slate-500">
                    {cardSelecionado.largura_mm}mm × {cardSelecionado.altura_mm}mm — qtd {cardSelecionado.quantidade}
                  </p>
                ) : null}
                {cardSelecionado.descricao_livre && (
                  <p className="text-slate-500 mt-2 whitespace-pre-wrap">{cardSelecionado.descricao_livre}</p>
                )}
                {cardSelecionado.observacoes && (
                  <p className="text-slate-400 mt-2 text-xs whitespace-pre-wrap">Obs: {cardSelecionado.observacoes}</p>
                )}
              </div>

              {(cardSelecionado as any).fotos_urls?.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {(cardSelecionado as any).fotos_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Foto ${i + 1}`} className="w-full h-16 object-cover rounded-lg" />
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor do orçamento (opcional)</label>
                <input
                  type="text"
                  value={valorEdit}
                  onChange={e => setValorEdit(e.target.value)}
                  placeholder="Ex: 2500.00"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Coluna</label>
                <select
                  value={colunaEdit}
                  onChange={e => setColunaEdit(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                >
                  {colunas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={salvarCard}
                disabled={salvando}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
