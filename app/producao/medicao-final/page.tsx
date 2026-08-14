'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Ruler, Settings, X, Trash2, Search, FileUp, Loader2, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { MedicaoColuna, MedicaoFinal, MedicaoItem, TipologiaCampoExtra, TipoValorCampoExtra, Usuario, TipoEsquadria, Tipologia } from '@/lib/tipos'
import {
  listarColunasMedicao, criarColunaMedicao, renomearColunaMedicao, excluirColunaMedicao,
  listarMedicoes, moverMedicao, listarOrcamentosSemMedicao, criarMedicaoDoOrcamento,
  listarTodosCamposExtras, criarCampoExtra, excluirCampoExtra,
  lerLimiteAlertaDiferenca, salvarLimiteAlertaDiferenca,
} from '@/lib/medicaoFinal'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { listarTipologias } from '@/lib/tipologias'

interface PreviewWVetro {
  parece_wvetro: boolean
  numero_orcamento: string | null
  cliente_nome: string | null
  cidade: string | null
  uf: string | null
  valor_total: number | null
  itens: Array<{
    ambiente: string | null
    tipo_esquadria: string
    tipo_outro_texto: string | null
    descricao: string
    quantidade: number
    largura_mm: number
    altura_mm: number
    cor: string | null
    linha: string | null
    vidro: string | null
  }>
}

let tiposCache: Tipologia[] = []

function labelTipo(valor: string) {
  return tiposCache.find(t => t.chave === valor)?.label || valor
}

function formatarMoeda(valor: number | null) {
  if (valor == null || !Number.isFinite(valor)) return null
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MedicaoFinalQuadro() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<MedicaoColuna[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoFinal[]>([])
  const [itensPorMedicao, setItensPorMedicao] = useState<Record<string, MedicaoItem[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [excluindoMedicaoId, setExcluindoMedicaoId] = useState<string | null>(null)

  const [modalNova, setModalNova] = useState(false)
  const [buscaOrcamento, setBuscaOrcamento] = useState('')
  const [orcamentosDisponiveis, setOrcamentosDisponiveis] = useState<
    { id: string; cliente_nome: string; cidade: string | null; created_at: string }[]
  >([])
  const [criandoMedicao, setCriandoMedicao] = useState(false)
  const [arquivoWVetro, setArquivoWVetro] = useState<File | null>(null)
  const [previewWVetro, setPreviewWVetro] = useState<PreviewWVetro | null>(null)
  const [clienteWVetro, setClienteWVetro] = useState('')
  const [cidadeWVetro, setCidadeWVetro] = useState('')
  const [lendoWVetro, setLendoWVetro] = useState(false)
  const [criandoWVetro, setCriandoWVetro] = useState(false)
  const [erroWVetro, setErroWVetro] = useState('')

  const [modalConfig, setModalConfig] = useState(false)
  const [camposExtras, setCamposExtras] = useState<TipologiaCampoExtra[]>([])
  const [novoTipo, setNovoTipo] = useState<TipoEsquadria>('janela_correr')
  const [novaChave, setNovaChave] = useState('')
  const [novoNomeCampo, setNovoNomeCampo] = useState('')
  const [novoTipoValor, setNovoTipoValor] = useState<TipoValorCampoExtra>('numero')
  const [limiteAlerta, setLimiteAlerta] = useState(100)
  const [salvandoLimite, setSalvandoLimite] = useState(false)

  const master = usuario?.role === 'master'

  const [tipos, setTipos] = useState<Tipologia[]>([])

  useEffect(() => {
    carregar()
    usuarioAtual().then(setUsuario)
    listarTipologias().then(list => { tiposCache = list; setTipos(list) })
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

  async function apagarMedicao(medicao: MedicaoFinal) {
    if (!master || excluindoMedicaoId) return

    const confirmar = window.confirm(
      `Excluir a Medição Final de "${medicao.cliente_nome}"?\n\n` +
      'Os itens e medidas desta Medição Final também serão removidos. O orçamento e o cliente NÃO serão apagados.'
    )
    if (!confirmar) return

    setExcluindoMedicaoId(medicao.id)
    try {
      const token = await tokenAtual()
      if (!token) {
        alert('Sua sessão expirou. Entre novamente para excluir a medição.')
        return
      }

      const resp = await fetch(`/api/medicao-final/${medicao.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        alert(json.error || 'Não foi possível excluir a Medição Final.')
        return
      }

      setMedicoes(prev => prev.filter(m => m.id !== medicao.id))
      setItensPorMedicao(prev => {
        const proximo = { ...prev }
        delete proximo[medicao.id]
        return proximo
      })
    } finally {
      setExcluindoMedicaoId(null)
    }
  }

  function limparImportacaoWVetro() {
    setArquivoWVetro(null)
    setPreviewWVetro(null)
    setClienteWVetro('')
    setCidadeWVetro('')
    setErroWVetro('')
    setLendoWVetro(false)
    setCriandoWVetro(false)
  }

  async function abrirModalNova() {
    setModalNova(true)
    setBuscaOrcamento('')
    limparImportacaoWVetro()
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

  async function analisarOrcamentoWVetro(file: File) {
    setArquivoWVetro(file)
    setPreviewWVetro(null)
    setClienteWVetro('')
    setCidadeWVetro('')
    setErroWVetro('')
    setLendoWVetro(true)

    try {
      const token = await tokenAtual()
      if (!token) {
        setErroWVetro('Sua sessão expirou. Entre novamente antes de importar o PDF.')
        return
      }

      const form = new FormData()
      form.append('acao', 'preview')
      form.append('arquivo', file)
      const resp = await fetch('/api/medicao-final/importar-wvetro', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErroWVetro(json.error || 'Não foi possível ler o orçamento W.Vetro.')
        return
      }

      const resumo = json.resumo as PreviewWVetro
      setPreviewWVetro(resumo)
      setClienteWVetro(resumo.cliente_nome || '')
      setCidadeWVetro([resumo.cidade, resumo.uf].filter(Boolean).join(' - '))
    } catch (e) {
      console.error('Erro ao analisar orçamento W.Vetro:', e)
      setErroWVetro('Erro ao enviar e analisar o PDF do W.Vetro.')
    } finally {
      setLendoWVetro(false)
    }
  }

  async function confirmarOrcamentoWVetro() {
    if (!arquivoWVetro || !previewWVetro || !clienteWVetro.trim()) return
    setCriandoWVetro(true)
    setErroWVetro('')

    try {
      const token = await tokenAtual()
      if (!token) {
        setErroWVetro('Sua sessão expirou. Entre novamente antes de criar a Medição Final.')
        return
      }

      const form = new FormData()
      form.append('acao', 'confirmar')
      form.append('arquivo', arquivoWVetro)
      form.append('cliente_nome', clienteWVetro.trim())
      form.append('cidade', cidadeWVetro.trim())
      if (usuario?.id) form.append('criado_por_id', usuario.id)
      if (usuario?.nome) form.append('criado_por_nome', usuario.nome)

      const resp = await fetch('/api/medicao-final/importar-wvetro', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        if (resp.status === 409 && json.medicao_id) {
          setModalNova(false)
          router.push(`/producao/medicao-final/${json.medicao_id}`)
          return
        }
        setErroWVetro(json.error || 'Não foi possível criar a Medição Final a partir do W.Vetro.')
        return
      }

      setModalNova(false)
      router.push(`/producao/medicao-final/${json.medicao_id}`)
    } catch (e) {
      console.error('Erro ao confirmar orçamento W.Vetro:', e)
      setErroWVetro('Erro ao criar a Medição Final importada do W.Vetro.')
    } finally {
      setCriandoWVetro(false)
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
    const campo = await criarCampoExtra(novoTipo, chaveSlug, novoNomeCampo.trim(), novoTipoValor, false)
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
                        className="relative rounded-xl border-2 border-slate-200 bg-white p-3 cursor-pointer hover:shadow-md transition"
                      >
                        {master && (
                          <button
                            type="button"
                            title="Excluir Medição Final"
                            aria-label={`Excluir Medição Final de ${m.cliente_nome}`}
                            disabled={excluindoMedicaoId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void apagarMedicao(m)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute right-2 top-2 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <p className="font-medium text-sm text-slate-800 pr-7">{m.cliente_nome}</p>
                        {(m.endereco || m.cidade) && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate pr-7">
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
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">Nova medição</h3>
                <p className="text-xs text-slate-500 mt-0.5">Importe um W.Vetro ou escolha uma venda que já está no Atlas.</p>
              </div>
              <button onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white border border-emerald-200 p-2 text-emerald-700">
                  <FileUp size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Importar orçamento W.Vetro</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    O Atlas lê o PDF, mostra o que encontrou e cria a Medição Final com as esquadrias automaticamente.
                  </p>
                </div>
              </div>
              <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition ${lendoWVetro || criandoWVetro ? 'cursor-not-allowed border-slate-200 text-slate-400 bg-white/60' : 'cursor-pointer border-emerald-300 text-emerald-800 bg-white hover:border-emerald-500'}`}>
                {lendoWVetro ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {lendoWVetro ? 'Lendo orçamento...' : arquivoWVetro ? `Trocar PDF: ${arquivoWVetro.name}` : 'Selecionar PDF do W.Vetro'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={lendoWVetro || criandoWVetro}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.currentTarget.value = ''
                    if (file) void analisarOrcamentoWVetro(file)
                  }}
                />
              </label>

              {erroWVetro && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {erroWVetro}
                </div>
              )}

              {previewWVetro && (
                <div className="rounded-xl bg-white border border-emerald-200 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 size={14} /> PDF lido
                    </span>
                    {previewWVetro.numero_orcamento && <span className="text-slate-500">Orçamento #{previewWVetro.numero_orcamento}</span>}
                    {previewWVetro.valor_total != null && <span className="text-slate-500">Total {formatarMoeda(previewWVetro.valor_total)}</span>}
                    <span className="text-slate-500">{previewWVetro.itens.length} item(ns)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente</label>
                      <input
                        value={clienteWVetro}
                        onChange={e => setClienteWVetro(e.target.value)}
                        placeholder="Confirme o nome do cliente"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Cidade</label>
                      <input
                        value={cidadeWVetro}
                        onChange={e => setCidadeWVetro(e.target.value)}
                        placeholder="Cidade da obra"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {previewWVetro.itens.map((item, idx) => (
                      <div key={`${item.descricao}-${idx}`} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">
                              {idx + 1}. {item.ambiente || 'Ambiente não informado'} — {labelTipo(item.tipo_esquadria)}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.descricao}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-slate-700">
                              {item.largura_mm > 0 && item.altura_mm > 0
                                ? `${item.largura_mm} × ${item.altura_mm}`
                                : 'Sem medida no PDF'}
                            </p>
                            <p className="text-[10px] text-slate-400">qtd. {item.quantidade}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                    Quando o W.Vetro traz largura e altura, elas entram apenas como <strong>referência</strong>. Se o PDF não traz essas medidas, o Atlas cria os itens sem inventar tamanho. As 3 larguras e 3 alturas da Medição Final continuam vazias para conferência na obra.
                  </div>

                  <button
                    onClick={confirmarOrcamentoWVetro}
                    disabled={criandoWVetro || !clienteWVetro.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white py-2.5 text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                  >
                    {criandoWVetro ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {criandoWVetro ? 'Criando Medição Final...' : 'Confirmar e criar Medição Final'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[11px] uppercase tracking-wide text-slate-400">ou usar orçamento do Atlas</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaOrcamento}
                onChange={e => setBuscaOrcamento(e.target.value)}
                placeholder="Buscar pelo nome do cliente..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <div className="overflow-y-auto space-y-1.5 flex-1 min-h-0">
              {orcamentosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Nenhum orçamento aprovado/convertido sem medição encontrado.
                </p>
              ) : (
                orcamentosFiltrados.map(o => (
                  <button
                    key={o.id}
                    onClick={() => criarDoOrcamento(o.id)}
                    disabled={criandoMedicao || criandoWVetro}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-brand-navy hover:bg-brand-navyLight transition disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{o.cliente_nome}</p>
                    {o.cidade && <p className="text-xs text-slate-400">{o.cidade}</p>}
                  </button>
                ))}
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
                const camposDoTipo = camposExtras.filter(c => c.tipo_esquadria === t.chave)
                if (camposDoTipo.length === 0) return null
                return (
                  <div key={t.chave} className="text-sm">
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
                    <option key={t.chave} value={t.chave}>{t.label}</option>
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
