'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Clock3, FileText, MessageSquare, ShieldCheck, UserRound } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Historico = { id: string; tipo: string | null; descricao: string | null; autor: string | null; data: string | null }
type Tarefa = { id: string; titulo: string; descricao: string | null; vencimento: string | null; concluida: boolean; responsavel: string | null }
type Consulta = {
  ok: true; somenteLeitura: true; fonte: string; historicoVisivel: boolean; tarefasVisiveis: boolean;
  historico: Historico[]; tarefas: Tarefa[]
}
type Rascunho = { id: string; tipo: 'contato' | 'tarefa'; titulo: string; detalhe: string; data?: string }
const formatar = (v: string | null) => v ? new Date(v.length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('pt-BR') : 'Sem data'

export default function RelacionamentoPreview({ oportunidadeId }: { oportunidadeId: string }) {
  const [dados, setDados] = useState<Consulta | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [tipo, setTipo] = useState<'contato' | 'tarefa'>('contato')
  const [titulo, setTitulo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [prazo, setPrazo] = useState('')
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([])
  const [avisou, setAvisou] = useState(false)

  useEffect(() => {
    let ativo = true
    setDados(null); setErro(''); setCarregando(true)
    setRascunhos([]); setAvisou(false); setTitulo(''); setDetalhe(''); setPrazo('')
    async function carregar() {
      try {
        const [fonte, id] = oportunidadeId.split(':', 2)
        if (!id || !['orc', 'pro'].includes(fonte)) throw new Error('Oportunidade inválida.')
        const token = await tokenAtual()
        if (!token) throw new Error('Faça login para consultar o acompanhamento.')
        const resp = await fetch('/api/crm/comercial/relacionamento?fonte=' + encodeURIComponent(fonte) + '&id=' + encodeURIComponent(id), {
          headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
        })
        const payload = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(payload.error || 'Falha ao carregar o histórico.')
        if (ativo) setDados(payload as Consulta)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível consultar.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregar()
    return () => { ativo = false }
  }, [oportunidadeId])

  function adicionarRascunho() {
    const assunto = titulo.trim()
    if (!assunto || (tipo === 'tarefa' && !prazo)) return
    setRascunhos(prev => [{
      id: String(Date.now()) + '-' + String(prev.length),
      tipo, titulo: assunto, detalhe: detalhe.trim(), data: tipo === 'tarefa' ? prazo : undefined,
    }, ...prev])
    setTitulo(''); setDetalhe(''); setPrazo(''); setAvisou(true)
  }
  return <section className="space-y-4 border-t border-slate-200 pt-5">
    <div className="flex items-center gap-2">
      <ShieldCheck size={17} className="text-teal-700"/>
      <h3 className="text-sm font-black">Acompanhamento do cliente</h3>
    </div>
    <p className="text-xs leading-relaxed text-slate-500">Histórico e retornos vinculados à oportunidade e liberados para sua carteira.</p>
    {carregando && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Verificando as permissões e carregando o histórico...</p>}
    {erro && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{erro}</p>}
    {dados && <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-xs font-black"><MessageSquare size={14}/> Histórico comercial</h4><span className="text-[10px] text-slate-500">{dados.historicoVisivel ? dados.historico.length + ' registro(s)' : 'Sem permissão'}</span></div>
        {dados.historicoVisivel
          ? <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">{dados.historico.map(h =>
            <div key={h.id} className="border-l-2 border-teal-300 pl-3">
              <p className="text-xs font-bold">{h.tipo || 'Contato'} · {h.autor || 'Atendimento'}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{h.descricao || 'Sem descrição'}</p>
              <p className="mt-1 text-[10px] text-slate-400">{formatar(h.data)}</p>
            </div>
          )}{!dados.historico.length && <p className="text-xs text-slate-400">Nenhuma interação vinculada nesta consulta.</p>}</div>
          : <p className="mt-3 text-xs text-slate-500">Histórico não liberado para seu usuário.</p>}
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-xs font-black"><CalendarClock size={14}/> Tarefas vinculadas</h4><span className="text-[10px] text-slate-500">{dados.tarefasVisiveis ? dados.tarefas.length + ' registro(s)' : 'Sem permissão'}</span></div>
        {dados.tarefasVisiveis
          ? <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{dados.tarefas.map(t =>
            <div key={t.id} className="rounded-lg bg-slate-50 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold">{t.concluida ? <CheckCircle2 size={12} className="text-emerald-600"/> : <Clock3 size={12} className="text-amber-600"/>}{t.titulo}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t.responsavel || 'Sem responsável'} · {formatar(t.vencimento)}</p>
            </div>
          )}{!dados.tarefas.length && <p className="text-xs text-slate-400">Nenhuma tarefa vinculada nesta consulta.</p>}</div>
          : <p className="mt-3 text-xs text-slate-500">Tarefas não liberadas para seu usuário.</p>}
      </div>
    </div>}
    <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-4">
      <div className="flex items-center gap-2"><FileText size={17} className="text-teal-700"/><h4 className="text-xs font-black text-teal-900">Simular um novo acompanhamento</h4></div>
      <p className="mt-1 text-[11px] leading-relaxed text-teal-800">Esta etapa é uma demonstração. Novos contatos e retornos abaixo ficam apenas nesta tela e não são gravados no Atlas.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setTipo('contato')} className={'rounded-lg px-2 py-2 text-xs font-bold ' + (tipo === 'contato' ? 'bg-teal-700 text-white' : 'border bg-white text-slate-700')}><MessageSquare size={13} className="mr-1 inline"/> Contato</button>
        <button type="button" onClick={() => setTipo('tarefa')} className={'rounded-lg px-2 py-2 text-xs font-bold ' + (tipo === 'tarefa' ? 'bg-teal-700 text-white' : 'border bg-white text-slate-700')}><CalendarClock size={13} className="mr-1 inline"/> Retorno</button>
      </div>
      <label className="mt-3 block text-xs font-bold text-slate-700">{tipo === 'contato' ? 'Assunto do contato' : 'Próxima ação'}<input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} placeholder={tipo === 'contato' ? 'Ex.: Ligação sobre orçamento' : 'Ex.: Retornar proposta'} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>
      <label className="mt-3 block text-xs font-bold text-slate-700">Observações<textarea rows={2} maxLength={700} value={detalhe} onChange={e => setDetalhe(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm" placeholder="Detalhes do atendimento..."/></label>
      {tipo === 'tarefa' && <label className="mt-3 block text-xs font-bold text-slate-700">Data do retorno<input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>}
      <button type="button" disabled={!titulo.trim() || (tipo === 'tarefa' && !prazo)} onClick={adicionarRascunho} className="mt-3 w-full rounded-lg bg-teal-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Adicionar somente na demonstração</button>
      {avisou && <p role="status" className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-teal-800"><CheckCircle2 size={14} className="shrink-0"/> Rascunho adicionado localmente. Nenhuma alteração foi enviada ao banco.</p>}
      {rascunhos.map(r => <div key={r.id} className="mt-2 rounded-lg border border-teal-200 bg-white p-2.5 text-xs"><p className="font-bold">{r.tipo === 'tarefa' ? 'Retorno' : 'Contato'} · {r.titulo}</p>{r.detalhe && <p className="mt-1 whitespace-pre-wrap break-words text-slate-500">{r.detalhe}</p>}{r.data && <p className="mt-1 text-teal-700">{formatar(r.data)}</p>}</div>)}
    </div>
  </section>
}