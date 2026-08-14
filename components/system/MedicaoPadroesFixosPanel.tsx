'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, MessageSquare, Save } from 'lucide-react'
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

export default function MedicaoPadroesFixosPanel({ medicaoId }: { medicaoId: string }) {
  const [itens, setItens] = useState<MedicaoItem[]>([])
  const [itemId, setItemId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    void carregar()
  }, [medicaoId])

  const item = useMemo(() => itens.find(i => i.id === itemId) || null, [itens, itemId])

  useEffect(() => {
    setObservacao(valorTexto(item, 'observacao_medicao'))
    setMensagem('')
  }, [itemId, item])

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('medicao_itens')
      .select('*')
      .eq('medicao_id', medicaoId)
      .order('ordem', { ascending: true })

    if (error) {
      console.error('Erro ao carregar padrões fixos da medição:', error)
      setItens([])
      setCarregando(false)
      return
    }

    const lista = (data || []) as MedicaoItem[]
    setItens(lista)
    setItemId(atual => atual && lista.some(i => i.id === atual) ? atual : (lista[0]?.id || ''))
    setCarregando(false)
  }

  async function salvarExtras(itemAtual: MedicaoItem, extras: Record<string, string | number>) {
    const { error } = await supabase
      .from('medicao_itens')
      .update({ campos_extras: extras })
      .eq('id', itemAtual.id)

    if (error) {
      console.error('Erro ao salvar padrões fixos da medição:', error)
      return false
    }

    setItens(prev => prev.map(i => i.id === itemAtual.id ? { ...i, campos_extras: extras } : i))
    return true
  }

  async function escolher(chave: string, valor: RespostaSimNao) {
    if (!item || salvando) return
    setSalvando(chave)
    setMensagem('')

    const extras = { ...(item.campos_extras || {}), [chave]: valor }
    const ok = await salvarExtras(item, extras)

    setSalvando(null)
    setMensagem(ok ? 'Informação salva.' : 'Não foi possível salvar esta informação.')
  }

  async function salvarObservacao() {
    if (!item || salvando) return
    setSalvando('observacao_medicao')
    setMensagem('')

    const extras = { ...(item.campos_extras || {}), observacao_medicao: observacao.trim() }
    const ok = await salvarExtras(item, extras)

    setSalvando(null)
    setMensagem(ok ? 'Observação salva.' : 'Não foi possível salvar a observação.')
  }

  if (carregando) {
    return (
      <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </section>
    )
  }

  if (itens.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Padrões da medição</p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-900">Conferências fixas e observação por peça</h2>
        </div>

        <div className="p-4">
          <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-bold uppercase">Atenção na medição</p>
              <p className="mt-0.5 text-sm font-semibold">Sempre fazer a medição pela vista interna do vão.</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3">
            {itens.map((peca, indice) => (
              <button
                key={peca.id}
                type="button"
                onClick={() => setItemId(peca.id)}
                className={`min-w-[145px] rounded-lg border px-3 py-2 text-left text-xs transition ${peca.id === itemId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                <span className="block font-semibold">Peça {indice + 1}</span>
                <span className={`mt-0.5 block truncate ${peca.id === itemId ? 'text-slate-300' : 'text-slate-400'}`}>{peca.descricao || peca.tipo_esquadria}</span>
              </button>
            ))}
          </div>

          {item && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[1fr_88px_88px] border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600">
                  <div className="px-3 py-2 text-left">Item</div>
                  <div className="border-l border-slate-200 px-2 py-2">SIM</div>
                  <div className="border-l border-slate-200 px-2 py-2">NÃO</div>
                </div>

                {CAMPOS_PADRAO.map(campo => {
                  const valor = valorTexto(item, campo.chave) as RespostaSimNao
                  return (
                    <div key={campo.chave} className="grid grid-cols-[1fr_88px_88px] border-b border-slate-100 last:border-b-0">
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
          )}
        </div>
      </div>
    </section>
  )
}
