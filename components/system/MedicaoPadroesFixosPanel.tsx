'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageSquare, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { MedicaoItem } from '@/lib/tipos'

type RespostaSimNao = '' | 'sim' | 'nao'

type CampoPadrao = {
  chave: string
  nome: string
}

const CAMPOS_PADRAO: CampoPadrao[] = [
  { chave: 'padrao_contramarco', nome: 'Contramarco' },
  { chave: 'padrao_arremate', nome: 'Arremate' },
  { chave: 'padrao_cadeirinha', nome: 'Cadeirinha' },
  { chave: 'padrao_cantoneira', nome: 'Cantoneira' },
]

function valorTexto(item: MedicaoItem | null, chave: string): string {
  const valor = item?.campos_extras?.[chave]
  return valor == null ? '' : String(valor)
}

export default function MedicaoPadroesFixosPanel({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<MedicaoItem | null>(null)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    void carregar()
  }, [itemId])

  useEffect(() => {
    setObservacao(valorTexto(item, 'observacao_medicao'))
    setMensagem('')
  }, [item])

  async function carregar() {
    if (!itemId) {
      setItem(null)
      setCarregando(false)
      return
    }

    setCarregando(true)
    const { data, error } = await supabase
      .from('medicao_itens')
      .select('*')
      .eq('id', itemId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar padrões fixos da medição:', error)
      setItem(null)
      setCarregando(false)
      return
    }

    setItem((data || null) as MedicaoItem | null)
    setCarregando(false)
  }

  const extrasAtuais = useMemo(() => item?.campos_extras || {}, [item])

  async function salvarExtras(extras: Record<string, string | number>) {
    if (!item) return false

    const { error } = await supabase
      .from('medicao_itens')
      .update({ campos_extras: extras })
      .eq('id', item.id)

    if (error) {
      console.error('Erro ao salvar padrões fixos da medição:', error)
      return false
    }

    setItem(atual => atual ? { ...atual, campos_extras: extras } : atual)
    return true
  }

  async function escolher(chave: string, valor: RespostaSimNao) {
    if (!item || salvando) return
    setSalvando(chave)
    setMensagem('')

    const ok = await salvarExtras({ ...extrasAtuais, [chave]: valor })

    setSalvando(null)
    setMensagem(ok ? 'Informação salva.' : 'Não foi possível salvar esta informação.')
  }

  async function salvarObservacao() {
    if (!item || salvando) return
    setSalvando('observacao_medicao')
    setMensagem('')

    const ok = await salvarExtras({ ...extrasAtuais, observacao_medicao: observacao.trim() })

    setSalvando(null)
    setMensagem(ok ? 'Observação salva.' : 'Não foi possível salvar a observação.')
  }

  if (carregando) {
    return <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
  }

  if (!item) return null

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Conferências fixas</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">Complete na sequência das medidas da peça</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[1fr_78px_78px] border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 sm:grid-cols-[1fr_88px_88px]">
          <div className="px-3 py-2 text-left">Item</div>
          <div className="border-l border-slate-200 px-2 py-2">SIM</div>
          <div className="border-l border-slate-200 px-2 py-2">NÃO</div>
        </div>

        {CAMPOS_PADRAO.map(campo => {
          const valor = valorTexto(item, campo.chave) as RespostaSimNao
          return (
            <div key={campo.chave} className="grid grid-cols-[1fr_78px_78px] border-b border-slate-100 last:border-b-0 sm:grid-cols-[1fr_88px_88px]">
              <div className="px-3 py-2.5 text-sm font-medium text-slate-700">{campo.nome}</div>
              <button
                type="button"
                disabled={!!salvando}
                onClick={() => void escolher(campo.chave, 'sim')}
                className={`flex items-center justify-center border-l border-slate-200 px-2 py-2.5 text-xs font-semibold transition ${valor === 'sim' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              >
                {salvando === campo.chave ? <Loader2 size={15} className="animate-spin" /> : valor === 'sim' ? <Check size={16} /> : 'SIM'}
              </button>
              <button
                type="button"
                disabled={!!salvando}
                onClick={() => void escolher(campo.chave, 'nao')}
                className={`flex items-center justify-center border-l border-slate-200 px-2 py-2.5 text-xs font-semibold transition ${valor === 'nao' ? 'bg-red-50 text-red-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
              >
                {salvando === campo.chave ? <Loader2 size={15} className="animate-spin" /> : valor === 'nao' ? <Check size={16} /> : 'NÃO'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <MessageSquare size={14} /> Observação da peça
        </label>
        <textarea
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          rows={4}
          placeholder="Digite aqui qualquer observação encontrada durante a medição..."
          className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!!salvando}
            onClick={() => void salvarObservacao()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando === 'observacao_medicao' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar observação
          </button>
        </div>
      </div>

      {mensagem && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{mensagem}</p>}
    </div>
  )
}
