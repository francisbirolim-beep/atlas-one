'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShieldAlert, ArrowRight, Plus, Pencil, Trash2, X, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { ehMedicaoFinalLegada, listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import { Usuario, Setor, NivelPermissao, SetorKanbanColuna, SetorKanbanItem } from '@/lib/tipos'
import {
  listarColunasSetor,
  criarColunaSetor,
  renomearColunaSetor,
  excluirColunaSetor,
  listarItensSetor,
  criarItemSetor,
  moverItemSetor,
  excluirItemSetor,
} from '@/lib/setorKanban'

export default function SetorDetalhe() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params?.slug || '')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setor, setSetor] = useState<Setor | null | undefined>(undefined)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [carregando, setCarregando] = useState(true)

  const [colunas, setColunas] = useState<SetorKanbanColuna[]>([])
  const [itens, setItens] = useState<SetorKanbanItem[]>([])
  const [carregandoKanban, setCarregandoKanban] = useState(false)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [novoEm, setNovoEm] = useState<string | null>(null)
  const [tituloNovo, setTituloNovo] = useState('')
  const [descNova, setDescNova] = useState('')
  const [selecionado, setSelecionado] = useState<SetorKanbanItem | null>(null)

  useEffect(() => {
    if (slug) carregar()
  }, [slug])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    const { data } = await supabase.from('setores').select('*').eq('id', slug).maybeSingle()
    const s = (data as Setor) || null

    // O antigo setor genérico "Medida final" não deve mais abrir seu Kanban
    // vazio. Qualquer acesso antigo/favorito salvo é levado para o fluxo oficial.
    if (ehMedicaoFinalLegada(s)) {
      router.replace('/producao/medicao-final')
      return
    }

    setSetor(s)
    let nivelAtual: NivelPermissao = 'oculto'
    if (s) {
      let mapa: Record<string, NivelPermissao> = {}
      if (me && me.role !== 'master') mapa = await listarPermissoesUsuario(me.id)
      nivelAtual = nivelEfetivo(me, s.id, mapa)
      setNivel(nivelAtual)
    }
    setCarregando(false)

    if (s && nivelAtual !== 'oculto' && !(s.ativo && s.rota)) {
      carregarKanban()
    }
  }

  async function carregarKanban() {
    setCarregandoKanban(true)
    const [cols, its] = await Promise.all([listarColunasSetor(slug), listarItensSetor(slug)])
    setColunas(cols)
    setItens(its)
    setCarregandoKanban(false)
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
    await moverItemSetor(id, colunaId)
  }

  async function novaColuna() {
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColunaSetor(slug, nome.trim())
    if (col) setColunas((prev) => [...prev, col])
  }

  async function editarColuna(col: SetorKanbanColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColunaSetor(col.id, novoNome.trim())
    if (ok) setColunas((prev) => prev.map((c) => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: SetorKanbanColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter((c) => c.id !== col.id)
    const destino = outras[0]
    const qtd = itens.filter((i) => i.coluna_id === col.id).length
    const msg = qtd > 0
      ? 'Essa coluna tem ' + qtd + ' card(s). Eles vao para a coluna "' + destino.nome + '". Apagar mesmo assim?'
      : 'Apagar a coluna "' + col.nome + '"?'
    if (!window.confirm(msg)) return

    const ok = await excluirColunaSetor(col.id, destino.id)
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
    const item = await criarItemSetor(novoEm, tituloNovo.trim(), descNova.trim() || undefined, usuario?.id, usuario?.nome)
    if (item) setItens((prev) => [...prev, item])
    setNovoEm(null)
  }

  async function apagar(item: SetorKanbanItem) {
    const confirmar = window.confirm('Apagar o card "' + item.titulo + '"?')
    if (!confirmar) return
    const ok = await excluirItemSetor(item.id)
    if (ok) {
      setItens((prev) => prev.filter((x) => x.id !== item.id))
      setSelecionado(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!setor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <p className="text-slate-500">Setor não encontrado.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  if (nivel === 'oculto') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Você não tem acesso a este setor. Fale com o administrador se precisar.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  const editavel = nivel === 'edicao'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/setores" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{setor.nome}</h1>
            <p className="text-sm text-slate-500">{setor.grupo}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {setor.ativo && setor.rota ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-navyLight flex items-center justify-center text-brand-navy">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Área disponível</h2>
                <p className="text-sm text-slate-500">Este setor já possui uma área própria no Atlas.</p>
              </div>
            </div>
            <Link
              href={setor.rota}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Abrir {setor.nome} <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-slate-700">{itens.length} card(s)</p>
                {carregandoKanban && <p className="text-xs text-slate-400">Atualizando...</p>}
              </div>
              {editavel && (
                <button onClick={novaColuna} className="flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-greenLight px-3 py-2 text-sm font-medium text-brand-green hover:bg-emerald-100">
                  <Plus size={16} /> Nova coluna
                </button>
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {colunas.map((col) => (
                <section
                  key={col.id}
                  onDragOver={(e) => { e.preventDefault(); setColunaArrastando(col.id) }}
                  onDragLeave={() => setColunaArrastando(null)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`w-80 flex-shrink-0 rounded-xl border bg-slate-100 p-3 transition ${colunaArrastando === col.id ? 'border-brand-green ring-2 ring-brand-green/20' : 'border-slate-200'}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2 px-1">
                    <h3 className="font-semibold text-slate-700">{col.nome} <span className="ml-1 font-normal text-slate-400">{itensDaColuna(col.id).length}</span></h3>
                    {editavel && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => editarColuna(col)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-brand-navy" title="Renomear coluna"><Pencil size={14} /></button>
                        <button onClick={() => apagarColuna(col)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-500" title="Apagar coluna"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 min-h-32">
                    {itensDaColuna(col.id).map((item) => (
                      <button
                        key={item.id}
                        draggable={editavel}
                        onDragStart={(e) => { if (editavel) e.dataTransfer.setData('text/plain', item.id) }}
                        onClick={() => setSelecionado(item)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-slate-300"
                      >
                        <p className="text-sm font-medium text-slate-800">{item.titulo}</p>
                        {item.descricao && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.descricao}</p>}
                      </button>
                    ))}
                  </div>

                  {editavel && (
                    <button onClick={() => abrirNovoItem(col.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-slate-500 hover:bg-white hover:text-brand-navy">
                      <Plus size={16} /> Adicionar card
                    </button>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      {novoEm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setNovoEm(null) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Novo card</h2>
              <button onClick={() => setNovoEm(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <input autoFocus value={tituloNovo} onChange={(e) => setTituloNovo(e.target.value)} placeholder="Título" className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-navy" />
            <textarea value={descNova} onChange={(e) => setDescNova(e.target.value)} placeholder="Descrição (opcional)" rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-navy" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNovoEm(null)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button onClick={salvarNovoItem} disabled={!tituloNovo.trim()} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Criar</button>
            </div>
          </div>
        </div>
      )}

      {selecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setSelecionado(null) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{selecionado.titulo}</h2>
              <button onClick={() => setSelecionado(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            {selecionado.descricao && <p className="whitespace-pre-wrap text-sm text-slate-600">{selecionado.descricao}</p>}
            <div className="mt-5 flex justify-between">
              {editavel ? (
                <button onClick={() => apagar(selecionado)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"><Trash2 size={16} /> Excluir</button>
              ) : <span />}
              <button onClick={() => setSelecionado(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
