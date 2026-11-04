'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ClipboardCheck, Loader2, Plus, RefreshCw, Ruler } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { criarMedicaoDoOrcamento, type TipoMedicaoFinal } from '@/lib/medicaoFinal'
import { liberarMedicaoFinal } from '@/lib/medicaoFinalV2'
import { medicaoRequerConferencia } from '@/lib/medicaoComprovacao'
import type { ItemEsquadria, MedicaoItem } from '@/lib/tipos'

type MedicaoDaObra = {
  id: string
  orcamento_id: string | null
  obra_id: string | null
  tipo_medicao: TipoMedicaoFinal | null
  status_operacional: string | null
  created_at: string
}

type ItemResumo = Pick<MedicaoItem,
  'medicao_id' | 'ordem' | 'quantidade' | 'tipo_esquadria' | 'tipo_outro_texto' | 'descricao' | 'ambiente' | 'largura_baixo_mm' | 'largura_meio_mm' | 'largura_cima_mm' |
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

export default function VendaMedidaFinal({ clienteId, vendaId, obraId, orcamentoId, itensVendidos }: {
  clienteId: string
  vendaId: string
  obraId: string | null
  orcamentoId: string
  itensVendidos: ItemEsquadria[]
}) {
  const [medicoes, setMedicoes] = useState<MedicaoDaObra[]>([])
  const [itens, setItens] = useState<ItemResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<TipoMedicaoFinal>('tipologia')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [erro, setErro] = useState('')
  const [conferidas, setConferidas] = useState<Set<number>>(() => new Set())
  const [liberando, setLiberando] = useState(false)
  const temItensVendidos = itensVendidos.length > 0

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
      let lista = (data || []) as MedicaoDaObra[]
      // Recupera também as vendas antigas que ficaram sem card na Central.
      // Não inicia a medição: apenas prepara o registro como pendente.
      if (temItensVendidos && !lista.some(m => m.orcamento_id === orcamentoId && (m.tipo_medicao || 'tipologia') === 'tipologia')) {
        const preparada = await criarMedicaoDoOrcamento(orcamentoId, await usuarioAtual(), 'tipologia')
        if (!preparada) throw new Error('A venda existe, mas a Medida Final não pôde ser preparada. Confira as tipologias do orçamento.')
        lista = [{
          id: preparada.id,
          orcamento_id: orcamentoId,
          obra_id: obraId,
          tipo_medicao: 'tipologia',
          status_operacional: preparada.status_operacional || 'aguardando_liberacao',
          created_at: preparada.created_at,
        }, ...lista]
      }
      setMedicoes(lista)
      if (lista.length === 0) { setItens([]); return }
      const { data: pecas, error: erroPecas } = await supabase.from('medicao_itens')
        .select('medicao_id,ordem,quantidade,tipo_esquadria,tipo_outro_texto,descricao,ambiente,largura_baixo_mm,largura_meio_mm,largura_cima_mm,altura_direita_mm,altura_meio_mm,altura_esquerda_mm,foto_larguras_url,foto_alturas_url')
        .in('medicao_id', lista.map(m => m.id))
      if (erroPecas) throw erroPecas
      setItens((pecas || []) as ItemResumo[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar as medições desta obra.')
    } finally {
      setCarregando(false)
    }
  }, [clienteId, obraId, orcamentoId, temItensVendidos])

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

  const medicaoTipologia = resumo.find(m => m.orcamento_id === orcamentoId && (m.tipo_medicao || 'tipologia') === 'tipologia')
  const aguardandoConferencia = !medicaoTipologia || ['aguardando_liberacao', 'a_medir', ''].includes(medicaoTipologia.status_operacional || '')
  const listaTipologias = temItensVendidos
    ? itensVendidos.map((it, indice) => ({
        indice, descricao: it.descricao || it.tipo_outro_texto || it.tipo_esquadria || 'Esquadria',
        ambiente: it.ambiente || '', quantidade: Math.max(1, Number(it.quantidade) || 1),
        largura: Number(it.largura_mm) || 0, altura: Number(it.altura_mm) || 0, fotoUrl: it.foto_url || null,
      }))
    : itens.filter(it => it.medicao_id === medicaoTipologia?.id).sort((a, b) => a.ordem - b.ordem)
      .map((it, indice) => ({
        indice, descricao: it.descricao || it.tipo_outro_texto || it.tipo_esquadria || 'Esquadria',
        ambiente: it.ambiente || '', quantidade: Math.max(1, Number(it.quantidade) || 1),
        largura: 0, altura: 0, fotoUrl: null as string | null,
      }))
  const todasConferidas = listaTipologias.length > 0 && listaTipologias.every(it => conferidas.has(it.indice))

  async function confirmarTipologias() {
    if (!todasConferidas || liberando || !aguardandoConferencia) return
    setLiberando(true)
    setErro('')
    try {
      const usuario = await usuarioAtual()
      if (usuario?.role !== 'master') throw new Error('A liberação da Medida Final deve ser confirmada pelo usuário Master.')
      const registro = medicaoTipologia || await criarMedicaoDoOrcamento(orcamentoId, usuario, 'tipologia')
      if (!registro) throw new Error('Não foi possível preparar a Medida Final desta venda.')
      if (!itens.some(item => item.medicao_id === registro.id)) throw new Error('Não há peças vinculadas à Medida Final. Confira o orçamento antes de liberar.')
      if (registro.status_operacional && !['aguardando_liberacao', 'a_medir'].includes(registro.status_operacional)) {
        await carregar()
        return
      }
      const resultado = await liberarMedicaoFinal(registro.id, usuario)
      if (!resultado.ok) throw new Error(resultado.mensagem || 'Não foi possível liberar a medição.')
      await carregar()
      window.dispatchEvent(new Event('atlas-medicao-atualizada'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao confirmar as tipologias.')
    } finally {
      setLiberando(false)
    }
  }

  async function iniciar() {
    if (criando) return
    if (tipo === 'tipologia' && aguardandoConferencia) {
      setErro('Confira e confirme todas as tipologias vendidas antes de iniciar a Medida Final.')
      return
    }
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
      <section aria-label="Conferência das tipologias vendidas" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Conferir tipologias vendidas</h3>
            <p className="mt-1 text-xs text-slate-600">A venda já entrou na Medida Final. Confira as peças do orçamento antes de liberar a execução.</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${aguardandoConferencia ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {aguardandoConferencia ? 'Aguardando confirmação' : 'Liberada / em andamento'}
          </span>
        </div>
        {aguardandoConferencia && listaTipologias.length > 0 && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs font-bold text-blue-800">
            <input type="checkbox" checked={todasConferidas} onChange={e => setConferidas(e.target.checked ? new Set(listaTipologias.map(it => it.indice)) : new Set())} />
            Confirmar todas as tipologias ({listaTipologias.length})
          </label>
        )}
        <div className="mt-3 space-y-2">
          {listaTipologias.map(it => (
            <label key={it.indice} className={`flex items-start gap-3 rounded-lg border bg-white p-3 ${aguardandoConferencia ? 'cursor-pointer border-amber-200' : 'border-emerald-200'}`}>
              {aguardandoConferencia && <input type="checkbox" className="mt-0.5" checked={conferidas.has(it.indice)} onChange={e => setConferidas(anterior => {
                const proximo = new Set(anterior)
                if (e.target.checked) proximo.add(it.indice)
                else proximo.delete(it.indice)
                return proximo
              })} />}
              {!aguardandoConferencia && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
              {it.fotoUrl && <img src={it.fotoUrl} alt={'Esquadria vendida: ' + it.descricao} className="h-14 w-14 shrink-0 rounded-md border bg-white object-contain" loading="lazy" />}
              <span className="min-w-0 text-xs text-slate-700"><strong className="block text-sm text-slate-900">{it.descricao}</strong>
                {it.ambiente ? `Ambiente: ${it.ambiente} · ` : ''}Quantidade: {it.quantidade}
                {it.largura > 0 && it.altura > 0 ? ` · ${it.largura} × ${it.altura} mm (orçamento)` : ''}
              </span>
            </label>
          ))}
        </div>
        {aguardandoConferencia && (
          <div className="mt-3">
            <button type="button" onClick={() => void confirmarTipologias()} disabled={!todasConferidas || liberando || carregando}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {liberando ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
              {liberando ? 'Liberando...' : 'Confirmar tipologias e liberar Medida Final'}
            </button>
            {listaTipologias.length === 0 && <p className="mt-2 text-xs text-amber-800">Nenhuma tipologia encontrada na venda. Confira os itens do orçamento antes de liberar a medição.</p>}
            {listaTipologias.length > 0 && !todasConferidas && <p className="mt-2 text-xs text-slate-600">Marque todas as peças conferidas para habilitar a liberação.</p>}
          </div>
        )}
        {!aguardandoConferencia && <p className="mt-3 text-xs font-semibold text-emerald-800">Tipologias confirmadas para o andamento da medição. A fabricação continua sujeita à aprovação técnica.</p>}
      </section>
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardCheck size={17} /> Iniciar ou continuar medição do orçamento desta venda</p>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tipo de Medida Final" value={tipo} onChange={e => setTipo(e.target.value as TipoMedicaoFinal)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="tipologia">Tipologia / esquadria</option>
            <option value="contramarco">Contramarco</option>
          </select>
          <button type="button" onClick={() => void iniciar()} disabled={criando || (tipo === 'tipologia' && aguardandoConferencia)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {criando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {criando ? 'Abrindo medição...' : tipo === 'tipologia' && aguardandoConferencia ? 'Confirme as tipologias acima' : 'Iniciar / continuar Medida Final'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Caso já exista uma medição deste tipo para o orçamento, ela será reaberta sem duplicação.</p>
      </div>
      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{erro}</p>}
    </div>
  )
}
