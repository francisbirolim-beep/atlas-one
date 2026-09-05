'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch, History, Plus, RefreshCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarRevisaoOrcamento, type TipoRevisaoOrcamento } from '@/lib/orcamentoRevisoes'

type OrcamentoLinha = {
  id: string
  numero: number | null
  created_at: string
  valor_estimado: number | null
  status: string | null
  revisao_grupo_id: string | null
  revisao_versao: number | null
  revisao_atual: boolean | null
  revisao_tipo: TipoRevisaoOrcamento | null
  revisao_motivo: string | null
  revisao_criada_em: string | null
  revisao_criada_por_nome: string | null
}

function moeda(valor?: number | null) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

export default function OrcamentosRevisoesClientePage() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params?.id as string
  const [clienteNome, setClienteNome] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoLinha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState<{ orcamento: OrcamentoLinha; tipo: TipoRevisaoOrcamento } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { if (clienteId) void carregar() }, [clienteId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    const [clienteResp, orcResp] = await Promise.all([
      supabase.from('clientes').select('nome').eq('id', clienteId).maybeSingle(),
      supabase
        .from('orcamentos')
        .select('id,numero,created_at,valor_estimado,status,revisao_grupo_id,revisao_versao,revisao_atual,revisao_tipo,revisao_motivo,revisao_criada_em,revisao_criada_por_nome')
        .eq('cliente_id', clienteId)
        .or('modo_entrada.is.null,modo_entrada.neq.balcao')
        .order('numero', { ascending: false })
        .order('revisao_versao', { ascending: false }),
    ])
    if (clienteResp.data?.nome) setClienteNome(clienteResp.data.nome)
    if (orcResp.error) setErro(orcResp.error.message)
    setOrcamentos((orcResp.data || []) as OrcamentoLinha[])
    setCarregando(false)
  }

  const grupos = useMemo(() => {
    const mapa = new Map<string, OrcamentoLinha[]>()
    for (const orc of orcamentos) {
      const chave = orc.revisao_grupo_id || orc.id
      const lista = mapa.get(chave) || []
      lista.push(orc)
      mapa.set(chave, lista)
    }
    return Array.from(mapa.entries())
      .map(([id, versoes]) => ({
        id,
        versoes: [...versoes].sort((a, b) => Number(b.revisao_versao || 1) - Number(a.revisao_versao || 1)),
      }))
      .sort((a, b) => Number(b.versoes[0]?.numero || 0) - Number(a.versoes[0]?.numero || 0))
  }, [orcamentos])

  async function confirmarRevisao() {
    if (!modal) return
    setSalvando(true)
    setErro('')
    const resposta = await criarRevisaoOrcamento({
      orcamentoId: modal.orcamento.id,
      tipo: modal.tipo,
      motivo,
    })
    if (!resposta.ok || !resposta.id) {
      setErro(resposta.error || 'Não foi possível criar a nova versão.')
      setSalvando(false)
      return
    }
    setModal(null)
    setMotivo('')
    setSalvando(false)
    router.push(`/kanban?orcamento=${resposta.id}`)
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 p-6 text-slate-500">Carregando versões...</div>

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href={`/clientes/${clienteId}`} className="mt-1 rounded-xl border bg-white p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18}/></Link>
          <div>
            <div className="flex items-center gap-2"><GitBranch size={20} className="text-blue-600"/><h1 className="text-xl font-bold text-slate-900">Versões dos orçamentos</h1></div>
            <p className="mt-1 text-sm text-slate-500">{clienteNome || 'Cliente'} · V1, V2, V3 sem apagar versões anteriores.</p>
          </div>
        </div>
        <button onClick={carregar} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={15}/>Atualizar</button>
      </header>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Regra do Atlas:</strong> alteração ou complemento sempre cria uma nova versão. A versão anterior fica congelada no histórico e a nova nasce em Fazer orçamento para ser revisada.
      </div>

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {grupos.length === 0 ? <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Este cliente ainda não possui orçamento sob medida.</div> :
        <div className="space-y-4">{grupos.map(grupo => {
          const atual = grupo.versoes.find(v => v.revisao_atual !== false) || grupo.versoes[0]
          return <section key={grupo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
              <div>
                <div className="font-bold text-slate-900">Orçamento #{atual.numero ?? '—'} · V{atual.revisao_versao || 1}</div>
                <div className="text-xs text-slate-500">Versão atual · {moeda(atual.valor_estimado)} · {atual.status || 'rascunho'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setModal({ orcamento: atual, tipo: 'alteracao' }); setMotivo('') }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/>Solicitar alteração</button>
                <button onClick={() => { setModal({ orcamento: atual, tipo: 'complemento' }); setMotivo('') }} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700"><GitBranch size={14}/>Complemento</button>
              </div>
            </div>
            <div className="divide-y">{grupo.versoes.map(v => <div key={v.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[100px_1fr_180px_110px] sm:items-center">
              <div className="flex items-center gap-2"><History size={14} className="text-slate-400"/><strong>V{v.revisao_versao || 1}</strong>{v.revisao_atual !== false && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">ATUAL</span>}</div>
              <div className="min-w-0"><div className="truncate text-slate-700">{v.revisao_motivo || (v.revisao_versao === 1 ? 'Versão original' : 'Sem observação')}</div><div className="text-xs text-slate-400">{v.revisao_tipo === 'complemento' ? 'Complemento' : v.revisao_tipo === 'alteracao' ? 'Alteração' : 'Original'} · {v.revisao_criada_por_nome || 'Atlas'}</div></div>
              <div className="text-xs text-slate-500">{dataBR(v.revisao_criada_em || v.created_at)}</div>
              <Link href={`/kanban?orcamento=${v.id}`} className="text-xs font-semibold text-blue-600 hover:underline">Abrir versão</Link>
            </div>)}</div>
          </section>
        })}</div>}
    </div>

    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{modal.tipo === 'complemento' ? 'Criar complemento' : 'Solicitar alteração'}</h2><p className="mt-1 text-sm text-slate-500">Orçamento #{modal.orcamento.numero ?? '—'} · atual V{modal.orcamento.revisao_versao || 1}</p></div><button onClick={() => setModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
        <label className="mt-4 block text-sm font-medium text-slate-700">O que precisa mudar?<textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={4} placeholder="Ex.: acrescentar porta da lavanderia; alterar medidas da janela da sala..." className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">A versão atual não será sobrescrita. O Atlas criará a próxima versão e manterá esta no histórico.</div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setModal(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={salvando} onClick={confirmarRevisao} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando ? 'Criando...' : 'Criar nova versão'}</button></div>
      </div>
    </div>}
  </main>
}
