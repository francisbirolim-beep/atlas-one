'use client'

import { useState } from 'react'
import { AlertTriangle, FileSearch, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { ItemEsquadria } from '@/lib/tipos'

interface Props {
  orcamentoId: string
  temPdf: boolean
  itensIniciais: ItemEsquadria[]
  onItensSalvos: (itens: ItemEsquadria[]) => void
}

type ItemEdicao = ItemEsquadria & { id: string }

function novoItem(indice: number): ItemEdicao {
  return {
    id: `novo-${Date.now()}-${indice}`,
    ambiente: '',
    tipo_esquadria: 'outro',
    tipo_outro_texto: '',
    largura_mm: 0,
    altura_mm: 0,
    quantidade: 1,
    descricao: '',
  }
}

export default function WVetroImportReview({ orcamentoId, temPdf, itensIniciais, onItensSalvos }: Props) {
  const [itens, setItens] = useState<ItemEdicao[]>(itensIniciais as ItemEdicao[])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function importar() {
    setErro('')
    setMensagem('')
    setCarregando(true)
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/importar-itens-orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ orcamentoId, persistirOrcamento: false }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível ler o PDF.')
      const importados = (json.itens || []) as ItemEdicao[]
      setItens(importados)
      setMensagem(`${importados.length} item(ns) identificado(s). Confira antes de salvar.`)
    } catch (e: any) {
      setErro(e.message || 'Erro ao importar o PDF.')
    } finally {
      setCarregando(false)
    }
  }

  function atualizar(index: number, campo: keyof ItemEdicao, valor: string | number) {
    setItens(atuais => atuais.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
    setMensagem('')
  }

  function adicionar() {
    setItens(atuais => [...atuais, novoItem(atuais.length)])
    setMensagem('')
  }

  function remover(index: number) {
    setItens(atuais => atuais.filter((_, i) => i !== index))
    setMensagem('')
  }

  async function salvar() {
    setErro('')
    setMensagem('')
    if (itens.length === 0) {
      setErro('Inclua pelo menos uma peça antes de salvar o orçamento estruturado.')
      return
    }

    const invalidos = itens.filter(item => !item.descricao?.trim() && !item.ambiente?.trim())
    if (invalidos.length > 0) {
      setErro('Todos os itens precisam ter ao menos ambiente ou descrição.')
      return
    }

    setSalvando(true)
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/salvar-itens-orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ orcamentoId, itens }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível salvar os itens.')
      const salvos = (json.itens || itens) as ItemEsquadria[]
      setItens(salvos as ItemEdicao[])
      onItensSalvos(salvos)
      setMensagem('Orçamento estruturado salvo. Os itens estão prontos para a confirmação da venda.')
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar os itens.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">PDF W.Vetro → Orçamento Atlas</p>
          <p className="mt-0.5 text-xs text-slate-500">Leia o PDF, confira as peças e corrija o que for necessário antes de liberar a venda.</p>
        </div>
        <button
          type="button"
          onClick={importar}
          disabled={!temPdf || carregando}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-brand-navy disabled:opacity-40"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : itens.length > 0 ? <RotateCcw size={16} /> : <FileSearch size={16} />}
          {itens.length > 0 ? 'Ler PDF novamente' : 'Ler PDF e gerar itens'}
        </button>
      </div>

      {!temPdf && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>Este orçamento não possui PDF anexado. Você pode cadastrar as peças manualmente abaixo.</span>
        </div>
      )}

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</div>}

      <div className="space-y-3">
        {itens.map((item, index) => (
          <div key={item.id || index} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Peça {index + 1}</p>
              <button type="button" onClick={() => remover(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Excluir peça">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Ambiente</span>
                <input value={item.ambiente || ''} onChange={e => atualizar(index, 'ambiente', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Sala" />
              </label>
              <label className="lg:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Tipo / produto</span>
                <input value={item.tipo_outro_texto || item.tipo_esquadria || ''} onChange={e => atualizar(index, 'tipo_outro_texto', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Porta de correr 4 folhas" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Quantidade</span>
                <input type="number" min={1} value={item.quantidade || 1} onChange={e => atualizar(index, 'quantidade', Number(e.target.value) || 1)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-600">L (mm)</span>
                  <input type="number" min={0} value={item.largura_mm || 0} onChange={e => atualizar(index, 'largura_mm', Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-600">A (mm)</span>
                  <input type="number" min={0} value={item.altura_mm || 0} onChange={e => atualizar(index, 'altura_mm', Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
              </div>
              <label className="md:col-span-2 lg:col-span-6">
                <span className="mb-1 block text-xs font-medium text-slate-600">Descrição completa</span>
                <textarea value={item.descricao || ''} onChange={e => atualizar(index, 'descricao', e.target.value)} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Descrição extraída do W.Vetro ou ajustada manualmente" />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          <Plus size={16} /> Adicionar peça
        </button>
        <button type="button" onClick={salvar} disabled={itens.length === 0 || salvando} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando...' : 'Salvar orçamento estruturado'}
        </button>
      </div>
    </div>
  )
}
