'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, Menu, MoreVertical,
  Pencil, Plus, Ruler, Save, Trash2, X
} from 'lucide-react'
import type { MedicaoFinal, MedicaoItem, TipoEsquadria, Tipologia, Usuario } from '@/lib/tipos'
import {
  adicionarItemMedicao,
  editarItemMedicao,
  removerItemMedicao,
  salvarMedidaItem as salvarMedidaItemApi,
  type DadosMedidaItem,
} from '@/lib/medicaoFinal'
import { listarTipologias } from '@/lib/tipologias'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import { supabase } from '@/lib/supabase'

type Tela = 'lista' | 'medicao' | 'resumo'

function nomeTipo(item: MedicaoItem, tipos: Tipologia[]) {
  if (item.tipo_esquadria === 'outro') return item.tipo_outro_texto || item.descricao || 'Outro'
  return tipos.find(t => t.chave === item.tipo_esquadria)?.label || item.descricao || item.tipo_esquadria
}

function IconeTipologia({ tipo }: { tipo: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
      <svg viewBox="0 0 36 36" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="30" height="30" rx="2" />
        {tipo.includes('correr') ? (
          <>
            <line x1="18" y1="3" x2="18" y2="33" />
            <path d="M10 18H5m0 0 3-3m-3 3 3 3M26 18h5m0 0-3-3m3 3-3 3" />
          </>
        ) : tipo.includes('porta') ? (
          <>
            <line x1="7" y1="3" x2="7" y2="33" />
            <path d="M7 4 29 30" strokeDasharray="2 2" />
          </>
        ) : (
          <>
            <line x1="18" y1="3" x2="18" y2="33" />
            <line x1="3" y1="18" x2="33" y2="18" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function ContramarcoFlow({
  medicao,
  itensIniciais,
  usuario,
  embedded = false,
}: {
  medicao: MedicaoFinal
  itensIniciais: MedicaoItem[]
  usuario: Usuario | null
  embedded?: boolean
}) {
  const [itens, setItens] = useState<MedicaoItem[]>(itensIniciais)
  const [tipos, setTipos] = useState<Tipologia[]>([])
  const [tela, setTela] = useState<Tela>('lista')
  const [indice, setIndice] = useState(0)
  const [orcamentoNumero, setOrcamentoNumero] = useState<string>('')

  const [modalItem, setModalItem] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formTipo, setFormTipo] = useState<TipoEsquadria>('porta_correr')
  const [formTipoOutro, setFormTipoOutro] = useState('')
  const [formAmbiente, setFormAmbiente] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formQuantidade, setFormQuantidade] = useState(1)
  const [salvandoItem, setSalvandoItem] = useState(false)

  const [vaoLargura, setVaoLargura] = useState('')
  const [vaoAltura, setVaoAltura] = useState('')
  const [folgaLargura, setFolgaLargura] = useState('')
  const [folgaAltura, setFolgaAltura] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvandoMedida, setSalvandoMedida] = useState(false)

  useEffect(() => setItens(itensIniciais), [itensIniciais])

  useEffect(() => {
    void listarTipologias().then(setTipos)
    if (!medicao.orcamento_id) return
    void supabase
      .from('orcamentos')
      .select('numero,wvetro_fluxo')
      .eq('id', medicao.orcamento_id)
      .maybeSingle()
      .then(({ data }) => {
        const numeroWvetro = String((data as any)?.wvetro_fluxo?.numero || '').trim()
        setOrcamentoNumero(numeroWvetro || String((data as any)?.numero || ''))
      })
  }, [medicao.orcamento_id])

  const atual = itens[indice] || null
  const medidos = itens.filter(i => i.medido).length
  const producaoLargura = Math.max(0, (Number(vaoLargura) || 0) - (Number(folgaLargura) || 0))
  const producaoAltura = Math.max(0, (Number(vaoAltura) || 0) - (Number(folgaAltura) || 0))
  const origemLabel = orcamentoNumero ? `Orçamento #${orcamentoNumero}` : 'Sem orçamento'
  const voltarHref = medicao.cliente_id
    ? `/producao/medicao-final/cliente/${medicao.cliente_id}`
    : '/producao/medicao-final'

  function carregarPosicao(pos: number) {
    const item = itens[pos]
    if (!item) return
    setIndice(pos)
    setVaoLargura(item.vao_largura_mm != null ? String(item.vao_largura_mm) : '')
    setVaoAltura(item.vao_altura_mm != null ? String(item.vao_altura_mm) : '')
    setFolgaLargura(item.folga_largura_mm != null ? String(item.folga_largura_mm) : '')
    setFolgaAltura(item.folga_altura_mm != null ? String(item.folga_altura_mm) : '')
    setObservacoes(item.observacoes_medicao || '')
    setTela('medicao')
  }

  function iniciarMedicao() {
    if (!itens.length) return
    const pendente = itens.findIndex(i => !i.medido)
    carregarPosicao(pendente >= 0 ? pendente : 0)
  }

  function abrirNovo() {
    setEditandoId(null)
    setFormTipo('porta_correr')
    setFormTipoOutro('')
    setFormAmbiente('')
    setFormDescricao('')
    setFormQuantidade(1)
    setModalItem(true)
  }

  function abrirEditar(item: MedicaoItem) {
    setEditandoId(item.id)
    setFormTipo(item.tipo_esquadria as TipoEsquadria)
    setFormTipoOutro(item.tipo_outro_texto || '')
    setFormAmbiente(item.ambiente || '')
    setFormDescricao(item.descricao || '')
    setFormQuantidade(item.quantidade || 1)
    setModalItem(true)
  }

  async function salvarItem() {
    if (!formAmbiente.trim()) {
      alert('Informe o ambiente.')
      return
    }
    if (formTipo === 'outro' && !formTipoOutro.trim()) {
      alert('Informe qual é a tipologia.')
      return
    }

    setSalvandoItem(true)
    const outro = formTipo === 'outro' ? formTipoOutro.trim() : null
    const descricao = formDescricao.trim() || (formTipo === 'outro'
      ? formTipoOutro.trim()
      : tipos.find(t => t.chave === formTipo)?.label || String(formTipo))

    if (editandoId) {
      const ok = await editarItemMedicao(editandoId, {
        tipo_esquadria: formTipo,
        tipo_outro_texto: outro,
        ambiente: formAmbiente.trim(),
        descricao,
        quantidade: Math.max(1, formQuantidade),
      })
      if (ok) {
        setItens(prev => prev.map(i => i.id === editandoId ? {
          ...i,
          tipo_esquadria: formTipo,
          tipo_outro_texto: outro,
          ambiente: formAmbiente.trim(),
          descricao,
          quantidade: Math.max(1, formQuantidade),
        } : i))
      }
    } else {
      const criado = await adicionarItemMedicao(
        medicao.id,
        formTipo,
        outro,
        descricao,
        Math.max(1, formQuantidade),
        formAmbiente.trim(),
      )
      if (criado) setItens(prev => [...prev, criado])
    }
    setSalvandoItem(false)
    setModalItem(false)
  }

  async function excluir(item: MedicaoItem) {
    if (!window.confirm(`Remover ${item.ambiente || 'esta posição'} da medição?`)) return
    if (await removerItemMedicao(item.id)) {
      setItens(prev => prev.filter(i => i.id !== item.id))
    }
  }

  async function salvarEAvancar() {
    if (!atual || salvandoMedida) return
    const vaoL = Number(vaoLargura)
    const vaoA = Number(vaoAltura)
    const folgaL = Number(folgaLargura)
    const folgaA = Number(folgaAltura)

    if (!Number.isFinite(vaoL) || vaoL <= 0 || !Number.isFinite(vaoA) || vaoA <= 0) {
      alert('Informe a largura e a altura do vão.')
      return
    }
    if (folgaLargura === '' || folgaAltura === '' || folgaL < 0 || folgaA < 0) {
      alert('Informe a folga da largura e da altura. Use 0 quando não houver folga.')
      return
    }
    if (producaoLargura <= 0 || producaoAltura <= 0) {
      alert('A folga não pode ser maior ou igual à medida do vão.')
      return
    }

    const dados: DadosMedidaItem = {
      largura_baixo_mm: null,
      largura_meio_mm: null,
      largura_cima_mm: null,
      altura_direita_mm: null,
      altura_meio_mm: null,
      altura_esquerda_mm: null,
      vao_largura_mm: vaoL,
      vao_altura_mm: vaoA,
      folga_largura_mm: folgaL,
      folga_altura_mm: folgaA,
      producao_largura_mm: producaoLargura,
      producao_altura_mm: producaoAltura,
      referencia_vista: null,
      contramarco: 'sim',
      cadeirinha: null,
      observacoes_medicao: observacoes.trim() || null,
      foto_larguras_url: null,
      foto_alturas_url: null,
      campos_extras: {},
    }

    setSalvandoMedida(true)
    const ok = await salvarMedidaItemApi(atual.id, dados, usuario)
    setSalvandoMedida(false)
    if (!ok) {
      alert('Não foi possível salvar esta medida.')
      return
    }

    const atualizado: MedicaoItem = {
      ...atual,
      ...dados,
      medido: true,
      status_medicao: 'concluida',
      medido_em: new Date().toISOString(),
      medido_por_nome: usuario?.nome || null,
    }
    const novos = itens.map(i => i.id === atual.id ? atualizado : i)
    setItens(novos)

    if (indice < novos.length - 1) {
      const prox = indice + 1
      const item = novos[prox]
      setIndice(prox)
      setVaoLargura(item.vao_largura_mm != null ? String(item.vao_largura_mm) : '')
      setVaoAltura(item.vao_altura_mm != null ? String(item.vao_altura_mm) : '')
      setFolgaLargura(item.folga_largura_mm != null ? String(item.folga_largura_mm) : '')
      setFolgaAltura(item.folga_altura_mm != null ? String(item.folga_altura_mm) : '')
      setObservacoes(item.observacoes_medicao || '')
    } else {
      setTela('resumo')
    }
  }

  const resumo = useMemo(() => itens.map((item, pos) => ({
    item,
    pos,
    tipo: nomeTipo(item, tipos),
  })), [itens, tipos])

  return (
    <div className={embedded ? 'bg-transparent pb-6' : 'min-h-screen bg-slate-50 pb-24'}>
      {!embedded && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                if (tela === 'lista') window.location.href = voltarHref
                else setTela('lista')
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="flex flex-1 items-center gap-2">
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase tracking-[.12em] text-slate-400">Esquadrifácio</p>
                <h1 className="truncate text-lg font-black text-slate-900">
                  {tela === 'resumo' ? 'Resumo da medição de contramarcos' : 'Contramarco'}
                </h1>
              </div>
            </div>
            <Menu size={20} className="text-slate-600" />
          </div>
        </header>
      )}

      {embedded && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Medição de Contramarco</p>
            <p className="mt-1 text-sm font-bold text-slate-900">1 largura + 1 altura do vão, com desconto das folgas.</p>
            <p className="mt-1 text-xs text-slate-600">Este fluxo não usa 3 larguras, 3 alturas, foto da trena ou croqui técnico.</p>
          </div>
        </div>
      )}

      {tela === 'lista' && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">{origemLabel}</p>
              <p className="text-xs text-slate-500">Adicione as tipologias para medir os vãos.</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{medidos}/{itens.length} medidos</span>
          </div>

          <button
            onClick={abrirNovo}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
          >
            <Plus size={17} /> Adicionar tipologia
          </button>

          <div className="space-y-2">
            {itens.map((item, pos) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <button
                  onClick={() => carregarPosicao(pos)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-black text-blue-700">
                    {pos + 1}
                  </span>
                  <IconeTipologia tipo={item.tipo_esquadria} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{item.ambiente || 'Sem ambiente'}</p>
                    <p className="truncate text-xs text-slate-500">{nomeTipo(item, tipos)}</p>
                    {item.medido && item.producao_largura_mm && item.producao_altura_mm && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-700">
                        Produção: {item.producao_largura_mm} × {item.producao_altura_mm} mm
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{item.quantidade || 1} un</span>
                  <ChevronRight size={17} className="shrink-0 text-slate-400" />
                </button>
                <button onClick={() => abrirEditar(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil size={14} /></button>
                <button onClick={() => excluir(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}

            {!itens.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Ruler size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">Nenhuma tipologia adicionada</p>
                <p className="mt-1 text-xs text-slate-500">Cadastre ambiente, tipologia e quantidade para começar.</p>
              </div>
            )}
          </div>

          <button
            onClick={iniciarMedicao}
            disabled={!itens.length}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-sm disabled:opacity-40"
          >
            Avançar para medição <ChevronRight size={17} />
          </button>
        </main>
      )}

      {tela === 'medicao' && atual && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <IconeTipologia tipo={atual.tipo_esquadria} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{atual.ambiente || 'Sem ambiente'} · {nomeTipo(atual, tipos)}</p>
                <p className="text-xs text-slate-500">Quantidade: {atual.quantidade || 1} unidade{(atual.quantidade || 1) > 1 ? 's' : ''}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-500">{indice + 1} de {itens.length}</span>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Medidas do vão e folga</h2>

            <div className="mt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[.08em] text-slate-500">Largura</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">
                  Largura do vão (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={vaoLargura}
                    onChange={e => setVaoLargura(e.target.value)}
                    placeholder="Ex.: 3000"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Folga da largura (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={folgaLargura}
                    onChange={e => setFolgaLargura(e.target.value)}
                    placeholder="Ex.: 20"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                  />
                </label>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs font-bold text-emerald-700">Largura para produzir</p>
                  <p className="text-2xl font-black text-emerald-700">{producaoLargura > 0 ? `${producaoLargura} mm` : '—'}</p>
                </div>
                {vaoLargura && folgaLargura !== '' && (
                  <p className="mt-1 text-right text-[11px] text-emerald-600">{vaoLargura} − {folgaLargura || '0'} = {producaoLargura} mm</p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-[.08em] text-slate-500">Altura</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">
                  Altura do vão (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={vaoAltura}
                    onChange={e => setVaoAltura(e.target.value)}
                    placeholder="Ex.: 2200"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Folga da altura (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={folgaAltura}
                    onChange={e => setFolgaAltura(e.target.value)}
                    placeholder="Ex.: 20"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-900"
                  />
                </label>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs font-bold text-emerald-700">Altura para produzir</p>
                  <p className="text-2xl font-black text-emerald-700">{producaoAltura > 0 ? `${producaoAltura} mm` : '—'}</p>
                </div>
                {vaoAltura && folgaAltura !== '' && (
                  <p className="mt-1 text-right text-[11px] text-emerald-600">{vaoAltura} − {folgaAltura || '0'} = {producaoAltura} mm</p>
                )}
              </div>
            </div>

            <label className="mt-5 block text-xs text-slate-500">
              Observações
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Opcional"
                className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (indice > 0) carregarPosicao(indice - 1)
                else setTela('lista')
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              <ChevronLeft size={17} /> Anterior
            </button>
            <button
              onClick={salvarEAvancar}
              disabled={salvandoMedida}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {salvandoMedida ? <Save size={16} className="animate-pulse" /> : null}
              {indice === itens.length - 1 ? 'Finalizar' : 'Próximo'} <ChevronRight size={17} />
            </button>
          </div>
        </main>
      )}

      {tela === 'resumo' && (
        <main className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-4">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{origemLabel}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.3fr_.8fr_.7fr_1fr_.35fr] gap-2 border-b bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 sm:grid">
              <span>Ambiente / Tipologia</span>
              <span>Vão (mm)</span>
              <span>Folga (mm)</span>
              <span>Medida (mm)</span>
              <span>Qtd</span>
            </div>
            {resumo.map(({ item, pos, tipo }) => (
              <div key={item.id} className="border-b border-slate-100 p-3 last:border-b-0 sm:grid sm:grid-cols-[1.3fr_.8fr_.7fr_1fr_.35fr] sm:items-center sm:gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{item.ambiente || 'Sem ambiente'}</p>
                  <p className="text-xs text-slate-500">{tipo}</p>
                </div>
                <p className="mt-2 text-xs text-slate-600 sm:mt-0">{item.vao_largura_mm || '—'} × {item.vao_altura_mm || '—'}</p>
                <p className="text-xs text-slate-600">{item.folga_largura_mm ?? '—'} × {item.folga_altura_mm ?? '—'}</p>
                <button
                  onClick={() => carregarPosicao(pos)}
                  className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-left text-xs font-black text-emerald-700 sm:mt-0"
                >
                  {item.producao_largura_mm && item.producao_altura_mm
                    ? `${item.producao_largura_mm} × ${item.producao_altura_mm}`
                    : 'Pendente'}
                </button>
                <p className="text-xs font-bold text-slate-600">{item.quantidade || 1}</p>
              </div>
            ))}
          </div>

          <button
            onClick={abrirNovo}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-600 bg-white px-4 py-3 text-sm font-bold text-blue-700"
          >
            <Plus size={16} /> Adicionar tipologia
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={() => setTela('lista')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
              Voltar
            </button>
            <button
              onClick={() => gerarPdfMedicaoFinal(medicao, itens)}
              disabled={!itens.some(i => i.medido)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              <FileText size={16} /> Gerar PDF para produção
            </button>
          </div>
        </main>
      )}

      {modalItem && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-blue-600">Contramarco</p>
                <h3 className="text-lg font-black text-slate-900">{editandoId ? 'Editar posição' : 'Adicionar posição'}</h3>
              </div>
              <button onClick={() => setModalItem(false)} className="rounded-lg p-2 text-slate-400"><X size={19} /></button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Ambiente
                <input
                  value={formAmbiente}
                  onChange={e => setFormAmbiente(e.target.value)}
                  placeholder="Ex.: Sala"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Tipologia
                <select
                  value={formTipo}
                  onChange={e => setFormTipo(e.target.value as TipoEsquadria)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  {tipos.map(t => <option key={t.chave} value={t.chave}>{t.label}</option>)}
                </select>
              </label>
              {formTipo === 'outro' && (
                <label className="block text-xs font-semibold text-slate-600">
                  Qual tipologia?
                  <input value={formTipoOutro} onChange={e => setFormTipoOutro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-600">
                Quantidade
                <input
                  type="number"
                  min={1}
                  value={formQuantidade}
                  onChange={e => setFormQuantidade(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Descrição (opcional)
                <input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </label>
            </div>

            <button
              onClick={salvarItem}
              disabled={salvandoItem}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <Check size={17} /> {salvandoItem ? 'Salvando...' : 'Salvar posição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
