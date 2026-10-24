'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ClipboardCheck, Loader2, Plus, RefreshCw, Ruler } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { criarMedicaoDoOrcamento, type TipoMedicaoFinal } from '@/lib/medicaoFinal'
import { medicaoRequerConferencia } from '@/lib/medicaoComprovacao'
import type { MedicaoItem } from '@/lib/tipos'

type MedicaoDaObra = {
  id: string
  orcamento_id: string | null
  obra_id: string | null
  tipo_medicao: TipoMedicaoFinal | null
  status_operacional: string | null
  created_at: string
}

type ItemResumo = Pick<MedicaoItem,
  'medicao_id' | 'largura_baixo_mm' | 'largura_meio_mm' | 'largura_cima_mm' |
  'altura_direita_mm' | 'altura_meio_mm' | 'altura_esquerda_mm' |
  'foto_larguras_url' | 'foto_alturas_url'>

type Filtro = 'todas' | 'abertas' | 'concluidas' | 'conferencia'
const statusConcluidos = new Set(['concluido', 'aprovado'])

function descricaoStatus(status: string | null) {
  return ({
    concluido: 'Concluída',
    aprovado: 'Aprovada',
    em_medicao: 'Em medição',
    aguardando_liberacao: 'Aguardando liberação',
    liberado: 'Liberada',
    com_pendencia: 'Com pendência',
  } as Record<string, string>)[status || ''] || String(status || 'Pendente').replaceAll('_', ' ')
}

export default function VendaMedidaFinal({ clienteId, vendaId, obraId, orcamentoId }: {
  clienteId: string
  vendaId: string
  obraId: string | null
  orcamentoId: string
}) {
  const [medicoes, setMedicoes] = useState<MedicaoDaObra[]>([])
  const [itens, setItens] = useState<ItemResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<TipoMedicaoFinal>('tipologia')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [erro, setErro] = useState('')

  function registrarRetorno(medicaoId: string) {
    window.sessionStorage.setItem(`atlas-medicao-retorno:${medicaoId}`,
      `/clientes/${clienteId}/vendas/${vendaId}?aba=medida-final`)
  }

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const escopo = obraId
        ? `obra_id.eq.${obraId},orcamento_id.eq.${orcamentoId}`
        : `orcamento_id.eq.${orcamentoId}`
      const { data, error } = await supabase.from('medicoes_finais')
        .select('id,orcamento_id,obra_id,tipo_medicao,status_operacional,created_at')
        .eq('cliente_id', clienteId).or(escopo)
        .order('created_at', { ascending: false })
      if (error) throw error
      const lista = (data || []) as MedicaoDaObra[]
      setMedicoes(lista)
      if (lista.length === 0) { setItens([]); return }
      const { data: pecas, error: erroPecas } = await supabase.from('medicao_itens')
        .select('medicao_id,largura_baixo_mm,largura_meio_mm,largura_cima_mm,altura_direita_mm,altura_meio_mm,altura_esquerda_mm,foto_larguras_url,foto_alturas_url')
        .in('medicao_id', lista.map(m => m.id))
      if (erroPecas) throw erroPecas
      setItens((pecas || []) as ItemResumo[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar as medições desta obra.')
    } finally {
      setCarregando(false)
    }
  }, [clienteId, obraId, orcamentoId])

  useEffect(() => { void carregar() }, [carregar])

  const resumo = useMemo(() => medicoes.map(m => {
    const pecas = itens.filter(i => i.medicao_id === m.id)
    return { ...m, totalPecas: pecas.length, conferir: pecas.filter(medicaoRequerConferencia).length }
  }), [medicoes, itens])
  const abertas = resumo.filter(m => !statusConcluidos.has(m.status_operacional || '')).length
  const concluidas = resumo.length - abertas
  const conferir = resumo.filter(m => m.conferir > 0).length
  const filtradas = resumo.filter(m => filtro === 'todas' ||
    (filtro === 'abertas' && !statusConcluidos.has(m.status_operacional || '')) ||
    (filtro === 'concluidas' && statusConcluidos.has(m.status_operacional || '')) ||
    (filtro === 'conferencia' && m.conferir > 0))

  async function iniciar() {
    if (criando) return
    setCriando(true)
    setErro('')
    try {
      const usuario = await usuarioAtual()
      const registro = await criarMedicaoDoOrcamento(orcamentoId, usuario, tipo)
      if (!registro) {
        setErro('Não foi possível iniciar a Medida Final. Confira o orçamento vendido.')
        return
      }
      // O criador também recupera a medição existente quando o orçamento e o tipo já estão vinculados.
      registrarRetorno(registro.id)
      window.location.assign(`/producao/medicao-final/${registro.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao iniciar a Medida Final.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Medições vinculadas a esta obra</p>
          <p className="text-xs text-slate-500">Acompanhe as peças, confira as fotos e continue de onde parou.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/producao/medicao-final/cliente/${clienteId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
            Central de Medida Final do cliente
          </Link>
          <button type="button" onClick={() => void carregar()} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {([
          ['todas', 'Todas', resumo.length],
          ['abertas', 'Em aberto', abertas],
          ['concluidas', 'Concluídas', concluidas],
          ['conferencia', 'Conferir valores', conferir],
        ] as const).map(([id, nome, total]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)}
            className={`rounded-full border px-3 py-2 ${filtro === id ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            {nome}: {total}
          </button>
        ))}
      </div>
      {carregando ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Carregando medições...</p> :
        filtradas.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Nenhuma medição encontrada neste filtro para esta obra.</p> :
        <div className="grid gap-3 md:grid-cols-2">
          {filtradas.map(m => (
            <Link key={m.id} href={`/producao/medicao-final/${m.id}`} onClick={() => registrarRetorno(m.id)} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800"><Ruler size={16} /> {m.tipo_medicao === 'contramarco' ? 'Contramarco' : 'Tipologia / esquadria'}</span>
                <span className="text-xs font-bold text-blue-700">Abrir / conferir →</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{descricaoStatus(m.status_operacional)} · {new Date(m.created_at).toLocaleDateString('pt-BR')} · {m.totalPecas} peça(s)</p>
              {m.conferir > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{m.conferir} peça(s) com foto aguardando conferência numérica antes da fabricação</p>}
              {m.conferir === 0 && statusConcluidos.has(m.status_operacional || '') && <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> Concluída</p>}
            </Link>
          ))}
        </div>
      }
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardCheck size={17} /> Iniciar ou continuar medição do orçamento desta venda</p>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tipo de Medida Final" value={tipo} onChange={e => setTipo(e.target.value as TipoMedicaoFinal)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="tipologia">Tipologia / esquadria</option>
            <option value="contramarco">Contramarco</option>
          </select>
          <button type="button" onClick={() => void iniciar()} disabled={criando}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {criando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {criando ? 'Abrindo medição...' : 'Iniciar / continuar Medida Final'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Caso já exista uma medição deste tipo para o orçamento, ela será reaberta sem duplicação.</p>
      </div>
      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{erro}</p>}
    </div>
  )
}
