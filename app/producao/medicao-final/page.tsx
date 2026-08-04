'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Ruler, Settings, X, Trash2, Search } from 'lucide-react'
import Link from 'next/link'
import { MedicaoColuna, MedicaoFinal, MedicaoItem, TipologiaCampoExtra, TipoValorCampoExtra, Usuario, TipoEsquadria } from '@/lib/tipos'
import {
  listarColunasMedicao, criarColunaMedicao, renomearColunaMedicao, excluirColunaMedicao,
  listarMedicoes, moverMedicao, listarOrcamentosSemMedicao, criarMedicaoDoOrcamento,
  listarTodosCamposExtras, criarCampoExtra, excluirCampoExtra,
  lerLimiteAlertaDiferenca, salvarLimiteAlertaDiferenca,
} from '@/lib/medicaoFinal'
import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const tipos: { value: TipoEsquadria; label: string }[] = [
  { value: 'porta_correr', label: 'Porta de Correr' },
  { value: 'porta_pivotante', label: 'Porta Pivotante' },
  { value: 'porta_abrir', label: 'Porta de Abrir' },
  { value: 'janela_correr', label: 'Janela de Correr' },
  { value: 'janela_maximiar', label: 'Janela Maximiar' },
  { value: 'janela_basculante', label: 'Janela Basculante' },
  { value: 'vitro', label: 'Vitrô' },
  { value: 'fachada', label: 'Fachada' },
  { value: 'box', label: 'Box de Banheiro' },
  { value: 'outro', label: 'Outro' },
]

function labelTipo(valor: string) {
  return tipos.find(t => t.value === valor)?.label || valor
}

export default function MedicaoFinalQuadro() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<MedicaoColuna[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoFinal[]>([])
  const [itensPorMedicao, setItensPorMedicao] = useState<Record<string, MedicaoItem[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)

  const [modalNova, setModalNova] = useState(false)
  const [buscaOrcamento, setBuscaOrcamento] = useState('')
  const [orcamentosDisponiveis, setOrcamentosDisponiveis] = useState<
    { id: string; cliente_nome: string; cidade: string | null; created_at: string }[]
  >([])
  const [criandoMedicao, setCriandoMedicao] = useState(false)

  const [modalConfig, setModalConfig] = useState(false)
  const [camposExtras, setCamposExtras] = useState<TipologiaCampoExtra[]>([])
  const [novoTipo, setNovoTipo] = useState<TipoEsquadria>('janela_correr')
  const [novaChave, setNovaChave] = useState('')
  const [novoNomeCampo, setNovoNomeCampo] = useState('')
  const [novoTipoValor, setNovoTipoValor] = useState<TipoValorCampoExtra>('numero')
  const [limiteAlerta, setLimiteAlerta] = useState(100)
  const [salvandoLimite, setSalvandoLimite] = useState(false)

  const master = usuario?.role === 'master'

  useEffect(() => {
    carregar()
    usuarioAtual().then(setUsuario)
  }, [])

  async function carregar() {
    setCarregando(true)
    const [cols, meds] = await Promise.all([listarColunasMedicao(), listarMedicoes()])
    setColunas(cols)
    setMedicoes(meds)

    if (meds.length > 0) {
      const { data } = await supabase
        .from('medicao_itens')
        .select('*')
        .in('medicao_id', meds.map(m => m.id))
      const agrupado: Record<string, MedicaoItem[]> = {}
      ;(data || []).forEach((it: any) => {
        if (!agrupado[it.medicao_id]) agrupado[it.medicao_id] = []
        agrupado[it.medicao_id].push(it)
      })
      setItensPorMedicao(agrupado)
    } else {
      setItensPorMedicao({})
    }
    setCarregando(false)
  }

  function medicoesDaColuna(colunaId: string) {
    return medicoes.filter(m => m.coluna_id === colunaId)
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setMedicoes(prev => prev.map(m => (m.id === id ? { ...m, coluna_id: colunaId } : m)))
    await moverMedicao(id, colunaId)
  }

  async function novaColuna() {
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColunaMedicao(nome.trim())
    if (col) setColunas(prev => [...prev, col])
  }

  async function editarColuna(col: MedicaoColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColunaMedicao(col.id, novoNome.trim())
    if (ok) setColunas(prev => prev.map(c => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: MedicaoColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter(c => c.id !== col.id)
    const destino = outras[0]
    const qtd = medicoesDaColuna(col.id).length
    const msg = qtd > 0
      ? `Essa coluna tem ${qtd} card(s). Eles vao para a coluna "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a coluna "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColunaMedicao(col.id, destino.id)
    if (ok) {
      setMedicoes(prev => prev.map(m => (m.coluna_id === col.id ? { ...m, coluna_id: destino.id } : m)))
      setColunas(outras)
    }
  }

  async function abrirModalNova() {
    setModalNova(true)
    setBuscaOrcamento('')
    const lista = await listarOrcamentosSemMedicao()
    setOrcamentosDisponiveis(lista)
  }

  async function criarDoOrcamento(orcamentoId: string) {
    setCriandoMedicao(true)
    const medicao = await criarMedicaoDoOrcamento(orcamentoId, usuario)
    setCriandoMedicao(false)
    if (medicao) {
      setModalNova(false)
      router.push(`/producao/medicao-final/${medicao.id}`)
    } else {
      alert('Erro ao criar a medição. Tenta de novo.')
    }
  }

  async function abrirModalConfig() {
    setModalConfig(true)
    const [campos, limite] = await Promise.all([listarTodosCamposExtras(), lerLimiteAlertaDiferenca()])
    setCamposExtras(campos)
    setLimiteAlerta(limite)
  }

  async function adicionarCampoExtra() {
    if (!novaChave.trim() || !novoNomeCampo.trim()) return
    const chaveSlug = novaChave.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    const campo = await criarCampoExtra(novoTipo, chaveSlug, novoNomeCampo.trim(), novoTipoValor)
    if (campo) {
      setCamposExtras(prev => [...prev, campo])
      setNovaChave('')
      setNovoNomeCampo('')
    }
  }

  async function removerCampoExtra(id: string) {
    if (!window.confirm('Remover esse campo extra?')) return
    const ok = await excluirCampoExtra(id)
    if (ok) setCamposExtras(prev => prev.filter(c => c.id !== id))
  }

  async function salvarLimite() {
    setSalvandoLimite(true)
    await salvarLimiteAlertaDiferenca(limiteAlerta)
    setSalvandoLimite(false)
  }

  const orcamentosFiltrados = orcamentosDisponiveis.filter(o =>
    o.cliente_nome.toLowerCase().includes(buscaOrcamento.toLowerCase())
  )

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/producao" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </Link>
          <Ruler size={20} className="text-brand-navy" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-brand-navy">Medição Final</h1>
            <p className="text-xs text-slate-400">Obras vendidas aguardando ou em processo de medida final</p>
          </div>
          {master && (
            <button
              onClick={abrirModalConfig}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-navy"
            >
              <Settings size={16} /> Configurar
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{medicoes.length} medição(ões)</p>
          <div className="flex items-center gap-3">
            <button onClick={novaColuna} className="flex items-center gap-1.5 text-sm text-brand-navy hover:underline">
              <Plus size={16} /> Nova coluna
            </button>
            <button
              onClick={abrirModalNova}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition"
            >
              <Plus size={16} /> Nova medição
            </button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map(col => {
            const cardsColuna = medicoesDaColuna(col.id)
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
                      <Settings size={12} />
                    </button>
                    <button onClick={() => apagarColuna(col)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map(m => {
                    const itensDaMedicao = itensPorMedicao[m.id] || []
                    const medidos = itensDaMedicao.filter(i => i.medido).length
                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', m.id)}
                        onClick={() => router.push(`/producao/medicao-final/${m.id}`)}
                        className="rounded-xl border-2 border-slate-200 bg-white p-3 cursor-pointer hover:shadow-md transition"
                      >
                        <p className="font-medium text-sm text-slate-800">{m.cliente_nome}</p>
                        {(m.endereco || m.cidade) && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {[m.endereco, m.bairro, m.cidade].filter(Boolean).join(' - ')}
                          </p>
                        )}
                        {itensDaMedicao.length > 0 && (
                          <p className="text-xs text-brand-navy font-medium mt-1.5">
                            {medidos}/{itensDaMedicao.length} tipologias medidas
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {modalNova && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Nova medição</h3>
              <button onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Escolha o orçamento vendido. Vamos puxar o cliente, endereço e as tipologias automaticamente.
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaOrcamento}
                onChange={e => setBuscaOrcamento(e.target.value)}
                placeholder="Buscar pelo nome do cliente..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {orcamentosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  Nenhum orçamento aprovado/convertido sem medição encontrado.
                </p>
              ) : (
                orcamentosFiltrados.map(o => (
                  <button
                    key={o.id}
                    onClick={() => criarDoOrcamento(o.id)}
                    disabled={criandoMedicao}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-brand-navy hover:bg-brand-navyLight transition disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{o.cliente_nome}</p>
                    {o.cidade && <p className="text-xs text-slate-400">{o.cidade}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {modalConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Configurar medição final</h3>
              <button onClick={() => setModalConfig(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Alertar quando a diferença entre a menor e a maior medida do mesmo grupo (larguras ou alturas) for maior que:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={limiteAlerta}
                  onChange={e => setLimiteAlerta(parseInt(e.target.value) || 0)}
                  className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-500">mm</span>
                <button
                  onClick={salvarLimite}
                  disabled={salvandoLimite}
                  className="ml-auto px-3 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                >
                  {salvandoLimite ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Campos extras por tipologia (ex: janela pede altura de peitoril, porta não)
              </label>

              {tipos.map(t => {
                const camposDoTipo = camposExtras.filter(c => c.tipo_esquadria === t.value)
                if (camposDoTipo.length === 0) return null
                return (
                  <div key={t.value} className="text-sm">
                    <p className="font-medium text-slate-700">{t.label}</p>
                    <div className="space-y-1 mt-1">
                      {camposDoTipo.map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5">
                          <span className="text-slate-600">{c.nome} <span className="text-slate-400">({c.tipo_valor})</span></span>
                          <button onClick={() => removerCampoExtra(c.id)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Adicionar campo extra</p>
                <select
                  value={novoTipo}
                  onChange={e => setNovoTipo(e.target.value as TipoEsquadria)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {tipos.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  value={novoNomeCampo}
                  onChange={e => setNovoNomeCampo(e.target.value)}
                  placeholder="Nome do campo (ex: Altura do peitoril (mm))"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={novaChave}
                  onChange={e => setNovaChave(e.target.value)}
                  placeholder="Chave interna (ex: peitoril_mm)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={novoTipoValor}
                  onChange={e => setNovoTipoValor(e.target.value as TipoValorCampoExtra)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="numero">Número</option>
                  <option value="texto">Texto</option>
                </select>
                <button
                  onClick={adicionarCampoExtra}
                  disabled={!novaChave.trim() || !novoNomeCampo.trim()}
                  className="w-full py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
