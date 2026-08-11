'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, CircleDot, ClipboardCheck, Layers3, Loader2,
  Play, Plus, Ruler, ShieldCheck, UserRound, Wrench, XCircle,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import {
  aprovarMedicaoFinal,
  carregarOperacaoMedicaoV2,
  carregarResumoMedicaoV2,
  concluirMedicaoFinal,
  criarPendenciaMedicao,
  definirResponsavelMedicao,
  iniciarMedicaoFinal,
  liberarMedicaoFinal,
  listarPendenciasMedicao,
  listarUsuariosDisponiveisMedicao,
  resolverPendenciaMedicao,
  separarUnidadesNaoMedidas,
  type OperacaoMedicaoV2,
  type PendenciaMedicao,
  type ResumoMedicaoV2,
  type StatusOperacionalMedicao,
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

const STATUS: Record<StatusOperacionalMedicao, { label: string; classe: string }> = {
  aguardando_liberacao: { label: 'Aguardando liberação', classe: 'border-slate-200 bg-slate-100 text-slate-700' },
  liberado: { label: 'Liberado para medir', classe: 'border-sky-200 bg-sky-50 text-sky-700' },
  em_medicao: { label: 'Em medição', classe: 'border-blue-200 bg-blue-50 text-blue-700' },
  com_pendencia: { label: 'Com pendência', classe: 'border-amber-200 bg-amber-50 text-amber-800' },
  concluido: { label: 'Concluído — aguardando aprovação', classe: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  aprovado: { label: 'Aprovado', classe: 'border-emerald-300 bg-emerald-100 text-emerald-800' },
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return null
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function MedicaoFinalFieldSummary({ medicaoId }: { medicaoId: string }) {
  const [resumo, setResumo] = useState<ResumoMedicaoV2>(RESUMO_VAZIO)
  const [operacao, setOperacao] = useState<OperacaoMedicaoV2 | null>(null)
  const [pendencias, setPendencias] = useState<PendenciaMedicao[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [separando, setSeparando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [novaPendencia, setNovaPendencia] = useState('')
  const [mostrandoPendencias, setMostrandoPendencias] = useState(false)

  const master = usuario?.role === 'master'

  const carregar = useCallback(async () => {
    const [dadosResumo, dadosOperacao, dadosPendencias, dadosUsuarios] = await Promise.all([
      carregarResumoMedicaoV2(medicaoId),
      carregarOperacaoMedicaoV2(medicaoId),
      listarPendenciasMedicao(medicaoId),
      listarUsuariosDisponiveisMedicao(),
    ])
    setResumo(dadosResumo)
    setOperacao(dadosOperacao)
    setPendencias(dadosPendencias)
    setUsuarios(dadosUsuarios)
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    void carregar()

    // A tela legada salva o item no proprio estado local. Enquanto a Medicao
    // Final nao emite um evento compartilhado, esse refresh leve mantem o
    // progresso e o status sincronizados sem interferir no formulario.
    const timer = window.setInterval(() => void carregar(), 5000)
    return () => window.clearInterval(timer)
  }, [carregar])

  const responsavelExibicao = useMemo(() => {
    if (operacao?.responsavel_nome) return operacao.responsavel_nome
    if (resumo.medidores.length === 1) return resumo.medidores[0]
    if (resumo.medidores.length > 1) return `${resumo.medidores.length} medidores`
    return 'Não definido'
  }, [operacao?.responsavel_nome, resumo.medidores])

  const statusAtual = STATUS[operacao?.status_operacional || 'aguardando_liberacao']
  const pendenciasAbertas = pendencias.filter(p => p.status === 'aberta')
  const podeConcluir = resumo.totalPecas > 0 && resumo.percentual === 100 && resumo.itensAgrupados.length === 0 && pendenciasAbertas.length === 0

  function limparRetorno() {
    setMensagem('')
    setErro('')
  }

  async function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>, sucesso: string) {
    if (processando) return
    limparRetorno()
    setProcessando(true)
    const resultado = await acao()
    setProcessando(false)
    if (!resultado.ok) setErro(resultado.mensagem || 'Não foi possível concluir a ação.')
    else {
      setMensagem(sucesso)
      await carregar()
    }
  }

  async function trocarResponsavel(id: string) {
    if (!master || processando) return
    limparRetorno()
    const responsavel = usuarios.find(u => u.id === id) || null
    setProcessando(true)
    const ok = await definirResponsavelMedicao(medicaoId, responsavel)
    setProcessando(false)
    if (!ok) setErro('Não foi possível alterar o responsável.')
    else {
      setMensagem(responsavel ? `Responsável definido: ${responsavel.nome}.` : 'Responsável removido.')
      await carregar()
    }
  }

  async function separarPecas() {
    if (separando) return
    const confirmar = window.confirm(
      'Separar cada quantidade em uma peça individual?\n\n' +
      'Isso será feito apenas nos itens que ainda NÃO foram medidos. Itens já medidos ficam intactos para revisão manual.',
    )
    if (!confirmar) return

    setSeparando(true)
    limparRetorno()
    const resultado = await separarUnidadesNaoMedidas(medicaoId)
    setSeparando(false)

    if (!resultado.ok) {
      setErro('Não foi possível separar todas as unidades. Confira a conexão e tente novamente.')
      await carregar()
      return
    }

    const partes: string[] = []
    if (resultado.separadas > 0) partes.push(`${resultado.separadas} peças preparadas individualmente`)
    if (resultado.bloqueadas > 0) partes.push(`${resultado.bloqueadas} item(ns) já medido(s) mantido(s) para revisão`)
    setMensagem(partes.length > 0 ? partes.join(' · ') : 'Nenhum item precisava ser separado.')
    await carregar()
    window.location.reload()
  }

  async function adicionarPendencia() {
    const texto = novaPendencia.trim()
    if (!texto || processando) return
    limparRetorno()
    setProcessando(true)
    const criada = await criarPendenciaMedicao(medicaoId, texto, usuario)
    setProcessando(false)
    if (!criada) {
      setErro('Não foi possível registrar a pendência.')
      return
    }
    setNovaPendencia('')
    setMostrandoPendencias(true)
    setMensagem('Pendência registrada.')
    await carregar()
  }

  async function resolverPendencia(id: string) {
    if (processando) return
    limparRetorno()
    setProcessando(true)
    const ok = await resolverPendenciaMedicao(id, usuario)
    setProcessando(false)
    if (!ok) setErro('Não foi possível resolver a pendência.')
    else {
      setMensagem('Pendência resolvida.')
      await carregar()
    }
  }

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    )
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Execução em campo</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusAtual.classe}`}>
                  <CircleDot size={11} /> {statusAtual.label}
                </span>
                {operacao && <span className="text-[11px] text-slate-400">v{operacao.versao}</span>}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Progresso da Medição Final</h2>
                <span className="text-sm font-bold text-emerald-700">{resumo.percentual}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, resumo.percentual))}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Ruler size={13} /> {resumo.pecasMedidas}/{resumo.totalPecas} peças medidas</span>
                <span className="inline-flex items-center gap-1.5"><UserRound size={13} /> {responsavelExibicao}</span>
                {pendenciasAbertas.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-700"><AlertTriangle size={13} /> {pendenciasAbertas.length} pendência(s)</span>
                )}
                {operacao?.aprovado_em && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><ShieldCheck size={13} /> Aprovado {formatarData(operacao.aprovado_em)}</span>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-72">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Responsável pela medição</label>
              {master ? (
                <select
                  value={operacao?.responsavel_id || ''}
                  onChange={e => void trocarResponsavel(e.target.value)}
                  disabled={processando || operacao?.status_operacional === 'aprovado'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Selecionar responsável</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{responsavelExibicao}</div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {operacao?.status_operacional === 'aguardando_liberacao' && master && (
              <button
                type="button"
                disabled={processando}
                onClick={() => void executar(() => liberarMedicaoFinal(medicaoId, usuario), 'Medição liberada para execução.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <ClipboardCheck size={14} /> Liberar medição
              </button>
            )}

            {['liberado', 'com_pendencia', 'em_medicao'].includes(operacao?.status_operacional || '') && (
              <button
                type="button"
                disabled={processando}
                onClick={() => void executar(() => iniciarMedicaoFinal(medicaoId, usuario), operacao?.iniciado_em ? 'Medição retomada.' : 'Medição iniciada.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <Play size={14} /> {operacao?.iniciado_em ? 'Continuar medição' : 'Iniciar medição final'}
              </button>
            )}

            {['em_medicao', 'com_pendencia'].includes(operacao?.status_operacional || '') && (
              <button
                type="button"
                disabled={processando || !podeConcluir}
                title={!podeConcluir ? 'Meça todas as peças, separe agrupamentos e resolva as pendências antes de concluir.' : undefined}
                onClick={() => void executar(() => concluirMedicaoFinal(medicaoId), 'Medição concluída e enviada para aprovação.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 size={14} /> Concluir medição
              </button>
            )}

            {operacao?.status_operacional === 'concluido' && master && (
              <button
                type="button"
                disabled={processando}
                onClick={() => void executar(() => aprovarMedicaoFinal(medicaoId, usuario), 'Medição aprovada. Pronta para seguir ao próximo setor.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <ShieldCheck size={14} /> Aprovar medição
              </button>
            )}

            <button
              type="button"
              onClick={() => setMostrandoPendencias(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Wrench size={14} /> Pendências {pendenciasAbertas.length > 0 ? `(${pendenciasAbertas.length})` : ''}
            </button>
          </div>
        </div>

        {resumo.itensAgrupados.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 p-3 md:px-4">
            <div className="flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-900">Existem peças agrupadas por quantidade</p>
                <p className="mt-0.5 text-[11px] leading-4 text-amber-800">Cada unidade precisa receber suas próprias medidas antes da conclusão.</p>
                <button
                  type="button"
                  onClick={separarPecas}
                  disabled={separando}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950 disabled:opacity-50"
                >
                  <Layers3 size={13} /> {separando ? 'Separando...' : 'Separar unidades não medidas'}
                </button>
              </div>
            </div>
          </div>
        )}

        {mostrandoPendencias && (
          <div className="border-b border-slate-100 bg-slate-50/70 p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">Pendências da medição</p>
                <p className="text-[11px] text-slate-500">Registre qualquer impedimento encontrado na obra antes de concluir.</p>
              </div>
              <button type="button" onClick={() => setMostrandoPendencias(false)} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600">
                <XCircle size={16} />
              </button>
            </div>

            {operacao?.status_operacional !== 'aprovado' && (
              <div className="mt-3 flex gap-2">
                <input
                  value={novaPendencia}
                  onChange={e => setNovaPendencia(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void adicionarPendencia() }}
                  placeholder="Ex.: soleira ainda não instalada"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => void adicionarPendencia()}
                  disabled={processando || !novaPendencia.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Plus size={14} /> Registrar
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {pendencias.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">Nenhuma pendência registrada.</div>
              ) : pendencias.map(p => (
                <div key={p.id} className={`rounded-lg border bg-white p-3 ${p.status === 'aberta' ? 'border-amber-200' : 'border-slate-200 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${p.status === 'aberta' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.status === 'aberta' ? 'Aberta' : 'Resolvida'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{p.categoria}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-800">{p.descricao}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {p.criado_por_nome ? `Registrada por ${p.criado_por_nome}` : 'Registrada'} · {formatarData(p.created_at)}
                        {p.resolvido_por_nome ? ` · resolvida por ${p.resolvido_por_nome}` : ''}
                      </p>
                    </div>
                    {p.status === 'aberta' && operacao?.status_operacional !== 'aprovado' && (
                      <button
                        type="button"
                        onClick={() => void resolverPendencia(p.id)}
                        disabled={processando}
                        className="shrink-0 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mensagem || erro || processando) && (
          <div className="p-3 md:px-4">
            {processando && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Processando...</p>}
            {mensagem && !processando && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{mensagem}</p>}
            {erro && !processando && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
