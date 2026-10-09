'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Ruler, RotateCcw } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { listarItensMedicao } from '@/lib/medicaoFinal'
import type { MedicaoItem, Usuario } from '@/lib/tipos'

export default function MedicaoConferenciaPanel({ medicaoId }: { medicaoId: string }) {
  const [itens, setItens] = useState<MedicaoItem[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const lista = await listarItensMedicao(medicaoId)
    setItens(lista.filter(item => item.status_medicao === 'aguardando_conferencia'))
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    void usuarioAtual().then(setUsuario)
    void carregar()
    const atualizar = () => void carregar()
    window.addEventListener('atlas-medicao-atualizada', atualizar)
    return () => window.removeEventListener('atlas-medicao-atualizada', atualizar)
  }, [carregar])

  async function agir(item: MedicaoItem, action: 'aprovar' | 'remediar') {
    if (processandoId) return

    let motivo = ''
    if (action === 'aprovar') {
      if (!window.confirm(`Aprovar a medida de “${item.descricao || item.tipo_outro_texto || item.tipo_esquadria}”?`)) return
    } else {
      motivo = window.prompt('Informe o motivo da nova medição:')?.trim() || ''
      if (!motivo) return
    }

    setProcessandoId(item.id)
    setMensagem('')
    setErro('')
    try {
      const token = await tokenAtual()
      const resp = await fetch(`/api/medicao-final/${medicaoId}/conferencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ action, itemId: item.id, motivo }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErro(json?.error || 'Não foi possível processar a conferência.')
        return
      }

      setMensagem(action === 'aprovar'
        ? 'Medida aprovada. A peça saiu da fila de conferência.'
        : 'Nova medição solicitada. A peça voltou para correção.')
      await carregar()
      window.dispatchEvent(new CustomEvent('atlas-medicao-atualizada', { detail: { medicaoId } }))
    } catch (e) {
      console.error('Erro ao processar conferência da Medição Final:', e)
      setErro('Não foi possível processar a conferência.')
    } finally {
      setProcessandoId(null)
    }
  }

  if (carregando || itens.length === 0) return null

  const master = usuario?.role === 'master'

  return (
    <section className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-4">
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">Aguardando conferência</p>
              <p className="text-xs text-amber-800">{itens.length} peça(s) enviada(s) pelo medidor aguardando validação.</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {itens.map(item => (
            <div key={item.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.descricao || item.tipo_outro_texto || item.tipo_esquadria}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {item.ambiente && <span>{item.ambiente}</span>}
                  <span className="inline-flex items-center gap-1"><Ruler size={12} /> Medido por {item.medido_por_nome || '—'}</span>
                  {item.medido_em && <span>{new Date(item.medido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                </div>
              </div>

              {master ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(processandoId)}
                    onClick={() => void agir(item, 'remediar')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {processandoId === item.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Pedir nova medição
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(processandoId)}
                    onClick={() => void agir(item, 'aprovar')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {processandoId === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Aprovar medida
                  </button>
                </div>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Aguardando Master</span>
              )}
            </div>
          ))}
        </div>

        {(mensagem || erro) && (
          <div className="border-t border-slate-100 px-4 py-3">
            {mensagem && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{mensagem}</p>}
            {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
