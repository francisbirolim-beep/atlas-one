'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Layers3, Ruler, UserRound } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import {
  carregarResumoMedicaoV2,
  separarUnidadesNaoMedidas,
  type ResumoMedicaoV2,
} from '@/lib/medicaoFinalV2'

const RESUMO_VAZIO: ResumoMedicaoV2 = {
  totalLinhas: 0,
  totalPecas: 0,
  pecasMedidas: 0,
  percentual: 0,
  medidores: [],
  itensAgrupados: [],
  itensAgrupadosMedidos: [],
}

export default function MedicaoFinalFieldSummary({ medicaoId }: { medicaoId: string }) {
  const [resumo, setResumo] = useState<ResumoMedicaoV2>(RESUMO_VAZIO)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [separando, setSeparando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    const dados = await carregarResumoMedicaoV2(medicaoId)
    setResumo(dados)
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    void carregar()

    // A tela legada salva o item no proprio estado local. Enquanto a Medicao
    // Final nao emite um evento compartilhado, esse refresh leve mantem o
    // progresso do cabeçalho sincronizado sem interferir no formulario.
    const timer = window.setInterval(() => void carregar(), 5000)
    return () => window.clearInterval(timer)
  }, [carregar])

  const responsavel = useMemo(() => {
    if (resumo.medidores.length === 1) return resumo.medidores[0]
    if (resumo.medidores.length > 1) return `${resumo.medidores.length} medidores`
    return usuario?.nome || 'Ainda nao iniciado'
  }, [resumo.medidores, usuario?.nome])

  async function separarPecas() {
    if (separando) return
    const confirmar = window.confirm(
      'Separar cada quantidade em uma peca individual?\n\n' +
      'Isso sera feito apenas nos itens que ainda NAO foram medidos. Itens ja medidos ficam intactos para revisao manual.',
    )
    if (!confirmar) return

    setSeparando(true)
    setMensagem('')
    const resultado = await separarUnidadesNaoMedidas(medicaoId)
    setSeparando(false)

    if (!resultado.ok) {
      setMensagem('Nao foi possivel separar todas as unidades. Confira a conexao e tente novamente.')
      await carregar()
      return
    }

    const partes: string[] = []
    if (resultado.separadas > 0) partes.push(`${resultado.separadas} pecas preparadas individualmente`)
    if (resultado.bloqueadas > 0) partes.push(`${resultado.bloqueadas} item(ns) ja medido(s) mantido(s) para revisao`)
    setMensagem(partes.length > 0 ? partes.join(' · ') : 'Nenhum item precisava ser separado.')
    await carregar()
    window.location.reload()
  }

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    )
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Execucao em campo</p>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-900">Progresso da Medicao Final</h2>
              </div>
              <span className="text-sm font-bold text-emerald-700">{resumo.percentual}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, resumo.percentual))}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Ruler size={13} /> {resumo.pecasMedidas}/{resumo.totalPecas} pecas medidas</span>
              <span className="inline-flex items-center gap-1.5"><UserRound size={13} /> {responsavel}</span>
              {resumo.percentual === 100 && resumo.totalPecas > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 size={13} /> Medicao completa</span>
              )}
            </div>
          </div>

          {resumo.itensAgrupados.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 lg:max-w-sm">
              <div className="flex gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900">Existem pecas agrupadas por quantidade</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
                    Para Medicao Final, cada unidade deve poder receber medidas proprias.
                  </p>
                  <button
                    type="button"
                    onClick={separarPecas}
                    disabled={separando}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950 disabled:opacity-50"
                  >
                    <Layers3 size={13} /> {separando ? 'Separando...' : 'Separar unidades nao medidas'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {mensagem && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{mensagem}</p>
        )}
      </div>
    </section>
  )
}
