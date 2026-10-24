'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Layers3, Loader2, PackageCheck, RefreshCcw, Ruler } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario } from '@/lib/setores'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { podeExecutarAcao } from '@/lib/producaoPermissoes'

type Material = { id: string; categoria?: string; codigo?: string | null; descricao?: string; cor?: string | null; quantidade?: number; unidade?: string }
type Peca = {
  id: string; medicaoId: string; clienteNome: string; descricao: string; ambiente: string
  larguraMm: number | null; alturaMm: number | null; listaDisponivel: boolean
  motivoListaIndisponivel: string | null; pacoteId: string | null; materiais: Material[]
  status: 'aguardando' | 'pendente' | 'separado'; motivo: string; materiaisConferidos: string[]
  atualizadoPor: string | null; atualizadoEm: string | null
  historico: Array<{status: string; motivo?: string | null; usuario_nome?: string | null; created_at: string}>
}
type Edicao = { conferidos: string[]; motivo: string }
const nomeStatus: Record<Peca['status'], string> = {
  aguardando: 'Aguardando separação', pendente: 'Aguardando material', separado: 'Materiais conferidos',
}
const estiloStatus: Record<Peca['status'], string> = {
  aguardando: 'bg-slate-100 text-slate-700',
  pendente: 'bg-amber-100 text-amber-800',
  separado: 'bg-emerald-100 text-emerald-800',
}

export default function SeparacaoMateriaisPage() {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({})
  const [medicaoFiltro, setMedicaoFiltro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const [gerandoPacote, setGerandoPacote] = useState<string | null>(null)
  const [acoes, setAcoes] = useState({ editar:false, pacote:false, medicao:false })

  // Consulta não implica permissão para alterar separação ou gerar pacote.
  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const usuario = await usuarioAtual()
        if (!usuario) return
        if (usuario.role === 'master') {
          if (ativo) setAcoes({ editar:true, pacote:true, medicao:true })
          return
        }
        const [setores, acesso] = await Promise.all([
          listarPermissoesUsuario(usuario.id), lerAcessoUsuarioConfig(usuario),
        ])
        if (ativo) setAcoes({
          editar:podeExecutarAcao(usuario.role,setores,acesso,'producao','producao.separacao.editar','edicao'),
          pacote:podeExecutarAcao(usuario.role,setores,acesso,'producao','producao.plano_corte.gerar','edicao'),
          medicao:podeExecutarAcao(usuario.role,setores,acesso,'medida-final-msdwtt9y','producao.medida_final.consultar'),
        })
      } catch {
        if (ativo) setAcoes({ editar:false, pacote:false, medicao:false })
      }
    })()
    return () => { ativo = false }
  }, [])

  const carregar = useCallback(async (filtro?: string) => {
    setCarregando(true); setErro('')
    try {
      const token = await tokenAtual()
      const pesquisa = filtro || ''
      const res = await fetch('/api/producao/separacao' + (pesquisa ? '?medicao=' + encodeURIComponent(pesquisa) : ''), {
        headers: { Authorization: 'Bearer ' + (token || '') }, cache: 'no-store',
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error || 'Falha ao carregar as peças.')
      const lista = Array.isArray(dados.itens) ? dados.itens as Peca[] : []
      setPecas(lista)
      setEdicoes(Object.fromEntries(lista.map(x => [x.id, { conferidos: x.materiaisConferidos || [], motivo: x.motivo || '' }])))
    } catch (e: any) { setErro(e?.message || 'Erro ao carregar a separação.') }
    finally { setCarregando(false) }
  }, [])

  useEffect(() => {
    const filtro = new URLSearchParams(window.location.search).get('medicao') || ''
    setMedicaoFiltro(filtro)
    void carregar(filtro)
  }, [carregar])

  const estatisticas = useMemo(() => ({
    total: pecas.length, separadas: pecas.filter(p => p.status === 'separado').length,
    pendentes: pecas.filter(p => p.status === 'pendente').length,
    aguardando: pecas.filter(p => p.status === 'aguardando').length,
  }), [pecas])

  const grupos = useMemo(() => {
    const mapa = new Map<string, Peca[]>()
    pecas.forEach(p => mapa.set(p.medicaoId, [...(mapa.get(p.medicaoId) || []), p]))
    return [...mapa.entries()]
  }, [pecas])

  function alterar(id: string, patch: Partial<Edicao>) {
    if (!acoes.editar) return
    setEdicoes(prev => ({ ...prev, [id]: { conferidos: prev[id]?.conferidos || [], motivo: prev[id]?.motivo || '', ...patch } }))
  }

  async function salvar(peca: Peca, status: Peca['status']) {
    if (!acoes.editar) return
    const edicao = edicoes[peca.id] || { conferidos: [], motivo: '' }
    if (status === 'pendente' && edicao.motivo.trim().length < 5) {
      setErro('Informe o motivo da pendência da peça com pelo menos cinco caracteres.'); return
    }
    if (status === 'separado' && (!peca.listaDisponivel || peca.materiais.length === 0
      || peca.materiais.some(m => !edicao.conferidos.includes(m.id)))) {
      setErro('Conclua a conferência de todos os materiais da peça e valide o pacote técnico individual.'); return
    }
    setErro(''); setSucesso(''); setProcessando(peca.id)
    try {
      const token = await tokenAtual()
      const res = await fetch('/api/producao/separacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ medicaoItemId: peca.id, status, motivo: edicao.motivo, materiaisConferidos: edicao.conferidos }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error || 'Não foi possível salvar a conferência.')
      setSucesso(dados.mensagem || 'Atualizado.')
      await carregar(medicaoFiltro)
    } catch (e: any) { setErro(e?.message || 'Falha ao salvar.') }
    finally { setProcessando(null) }
  }

  async function gerarPacote(medicaoId: string) {
    if (!acoes.pacote) return
    if (!window.confirm('Gerar novo pacote técnico apenas para as unidades aprovadas nesta medição?\\n\\nIsso não libera Corte, não reserva estoque e não altera a medição das demais peças.')) return
    setErro(''); setSucesso(''); setGerandoPacote(medicaoId)
    try {
      const token = await tokenAtual()
      const res = await fetch('/api/producao/separacao/pacote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ medicaoId }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error || 'Falha ao gerar pacote parcial.')
      await carregar(medicaoFiltro)
      setSucesso(dados.mensagem || 'Pacote parcial gerado.')
    } catch (e: any) { setErro(e?.message || 'Não foi possível gerar pacote parcial.') }
    finally { setGerandoPacote(null) }
  }

  return <div className="min-h-screen bg-slate-50 pb-12">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <div className="flex items-center gap-3">
          <Link href="/producao" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
          <span className="rounded-xl bg-blue-50 p-3 text-blue-800"><Layers3 size={22}/></span>
          <div><h1 className="text-xl font-bold text-slate-900">Separação de Materiais</h1>
            <p className="text-xs text-slate-500">Produção → peças individualmente aprovadas na Medição Final</p></div>
        </div>
        <button onClick={() => void carregar(medicaoFiltro)} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <RefreshCcw size={15}/> Atualizar</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Somente peças <b>medidas e aprovadas individualmente</b> aparecem aqui. Tipologias sem aprovação, mesmo da mesma obra, continuam fora da fila.
        Esta primeira versão registra a conferência física por peça, sem reservar/baixar estoque e sem liberar automaticamente Corte, Produção ou Instalação.
      </div>
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([['Peças aprovadas', estatisticas.total], ['Conferidas', estatisticas.separadas], ['Com pendência', estatisticas.pendentes], ['Aguardando', estatisticas.aguardando]] as const).map(([rotulo, valor]) =>
          <div key={rotulo} className="rounded-xl border bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{rotulo}</p><p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
          </div>)}
      </div>
      {carregando ? <div className="flex justify-center p-16 text-slate-500"><Loader2 className="mr-2 animate-spin"/> Carregando peças...</div>
      : grupos.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <ClipboardCheck className="mx-auto mb-3 text-slate-400" size={32}/>
          <h2 className="font-bold text-slate-800">Nenhuma peça aprovada para separação</h2>
          <p className="mt-2 text-sm text-slate-500">Assim que uma peça medida for aprovada na conferência da Medição Final, poderá aparecer aqui.</p>
          <Link href="/producao/medicao-final" className="mt-4 inline-block text-sm font-semibold text-blue-700">Abrir Medição Final</Link>
        </div>
      : grupos.map(([medicaoId, lista]) =>
        <section key={medicaoId} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 p-4">
            <div><h2 className="font-bold text-slate-900">{lista[0].clienteNome}</h2>
              <p className="text-xs text-slate-500">{lista.length} peça(s) aprovada(s) nesta medição</p></div>
            <div className="flex flex-wrap items-center gap-3">
              {acoes.pacote && lista.some(p => !p.listaDisponivel) && <button
                onClick={() => void gerarPacote(medicaoId)} disabled={Boolean(gerandoPacote)}
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">
                {gerandoPacote === medicaoId ? <Loader2 size={14} className="animate-spin"/> : <PackageCheck size={14}/>}
                Gerar pacote técnico das peças aprovadas
              </button>}
              {acoes.medicao && <Link href={'/producao/medicao-final/' + medicaoId} className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                <Ruler size={14}/> Conferir Medição Final</Link>}
            </div>
          </div>
          <div className="space-y-3 p-3 sm:p-4">{lista.map(peca => {
            const edicao = edicoes[peca.id] || { conferidos: [], motivo: '' }
            const todas = peca.materiais.length > 0 && peca.listaDisponivel &&
              peca.materiais.every(m => edicao.conferidos.includes(m.id))
            return <article key={peca.id} className="rounded-xl border border-slate-200">
              <button onClick={() => setAberta(aberta === peca.id ? null : peca.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left">
                <div><p className="font-semibold text-slate-900">{peca.descricao}</p>
                  <p className="mt-1 text-xs text-slate-500">{peca.ambiente || 'Ambiente não informado'} · {peca.larguraMm || '—'} × {peca.alturaMm || '—'} mm</p>
                  <p className="mt-1 text-xs text-slate-500">{peca.materiais.length} material(is) na lista técnica</p>
                </div>
                <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + estiloStatus[peca.status]}>{nomeStatus[peca.status]}</span>
              </button>
              {aberta === peca.id && <div className="space-y-4 border-t p-4">
                {!peca.listaDisponivel && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 shrink-0" size={16}/> {peca.motivoListaIndisponivel}
                </div>}
                {peca.materiais.length > 0 && <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Conferir material físico</p>
                  {peca.materiais.map(m => <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" disabled={!acoes.editar} className="mt-1 h-4 w-4" checked={edicao.conferidos.includes(m.id)}
                      onChange={e => alterar(peca.id, { conferidos: e.target.checked
                        ? [...new Set([...edicao.conferidos, m.id])] : edicao.conferidos.filter(v => v !== m.id) })}/>
                    <span><b>{m.codigo ? m.codigo + ' — ' : ''}{m.descricao || 'Material'}</b>
                      <span className="block text-xs text-slate-500">{m.categoria} · {m.quantidade} {m.unidade || ''} {m.cor ? '· ' + m.cor : ''}</span></span>
                  </label>)}
                </div>}
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Motivo / observação da peça</span>
                  <textarea disabled={!acoes.editar} value={edicao.motivo} onChange={e => alterar(peca.id, { motivo: e.target.value })}
                    className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex.: aguardando perfil SU..., material riscado, troca solicitada ao fornecedor."/></label>
                {acoes.editar && <div className="flex flex-wrap gap-2">
                  <button disabled={processando === peca.id} onClick={() => void salvar(peca, 'aguardando')}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700">Salvar em aguardando</button>
                  <button disabled={processando === peca.id} onClick={() => void salvar(peca, 'pendente')}
                    className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Registrar pendência</button>
                  <button disabled={processando === peca.id || !todas} onClick={() => void salvar(peca, 'separado')}
                    className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                    <PackageCheck size={14}/> Materiais conferidos</button>
                </div>}
                {peca.status === 'pendente' && peca.motivo && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  Pendência registrada: {peca.motivo}</p>}
                {peca.historico?.length > 0 && <div className="space-y-1 rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-700">Histórico da peça</p>
                  {peca.historico.map((evento, index) => <p key={index} className="text-xs text-slate-600">
                    {new Date(evento.created_at).toLocaleString('pt-BR')} · {evento.usuario_nome || 'Usuário'}
                    {' · '}{evento.status === 'pendente' ? 'Pendência' : evento.status === 'separado' ? 'Conferência completa' : 'Aguardando'}
                    {evento.motivo ? ' — ' + evento.motivo : ''}
                  </p>)}
                </div>}
                {peca.atualizadoPor && <p className="text-xs text-slate-500">Última conferência: {peca.atualizadoPor} · {peca.atualizadoEm ? new Date(peca.atualizadoEm).toLocaleString('pt-BR') : ''}</p>}
                {peca.status === 'separado' && <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={15}/> Material conferido. A liberação operacional permanece sujeita às regras técnicas.</p>}
              </div>}
            </article>
          })}</div>
        </section>)}
    </main>
  </div>
}
