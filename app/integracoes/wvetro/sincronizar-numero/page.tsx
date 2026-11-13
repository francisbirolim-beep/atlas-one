'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileSearch, Loader2, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Resumo = {
  ok: boolean; numero: string; nomeWVetro: string; valor: number | null; quantidadeItens: number;
  data: string | null; situacao: string | null; origem: string;
  clienteAtlas: { id: string; nome: string } | null;
  compativel: boolean; conflito: boolean;
  existe: { id: string; clienteId: string | null; nome: string } | null;
  semelhantes: Array<{ id: string; nome: string }>;
  podeCriarNovo: boolean; tokenConferencia: string;
}
type Sucesso = {
  cliente: { id: string; nome: string }; orcamentoAtlasId?: string;
  numero: string; mensagem: string; situacaoWvetro?: string | null; valorOrigem?: number | null
}
const dinheiro = (v: number | null) => v == null ? 'Não informado' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (v: string | null) => v ? new Date(v.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informada'

export default function SincronizarNumeroWVetroPage() {
  const [numero, setNumero] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [novo, setNovo] = useState(false)
  const [previa, setPrevia] = useState<Resumo | null>(null)
  const [confirmou, setConfirmou] = useState(false)
  const [divergencia, setDivergencia] = useState(false)
  const [sucesso, setSucesso] = useState<Sucesso | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const id = query.get('clienteId') || ''
    if (/^[0-9a-f-]{36}$/i.test(id)) setClienteId(id)
    const n = query.get('numero') || ''
    if (/^[0-9]{1,10}$/.test(n)) setNumero(n)
  }, [])

  function invalidar() { setPrevia(null); setConfirmou(false); setDivergencia(false); setSucesso(null); setErro('') }
  async function requisitar(acao: 'consultar' | 'confirmar') {
    if (ocupado) return
    setOcupado(true); setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const body: Record<string, unknown> = { acao, numero, clienteId: novo ? '' : clienteId, criarNovo: novo }
      if (acao === 'confirmar') {
        body.tokenConferencia = previa?.tokenConferencia
        body.confirmaNumero = previa?.numero
        body.confirmaNome = previa?.nomeWVetro
        body.confirmouVinculo = confirmou
        body.confirmouDivergencia = divergencia
      }
      const resposta = await fetch('/api/integracoes/wvetro/orcamentos/sincronizar-numero', {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Falha ao consultar o W.Vetro.')
      if (acao === 'consultar') {
        setPrevia(json as Resumo)
        setSucesso(null)
        setConfirmou(false); setDivergencia(false)
      } else {
        setSucesso({ ...(json as Sucesso), situacaoWvetro: previa?.situacao || null, valorOrigem: previa?.valor ?? null })
        setPrevia(null)
      }
    } catch(e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a operação.')
    } finally { setOcupado(false) }
  }

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href={clienteId ? '/clientes/' + clienteId : '/clientes'} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-700"><ArrowLeft size={16}/> Voltar ao Cliente 360</Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-xl bg-blue-100 p-3 text-blue-700"><FileSearch size={25}/></span>
          <div><h1 className="text-2xl font-bold text-slate-900">Sincronizar por número W.Vetro</h1>
            <p className="text-sm text-slate-600">Consulte o orçamento exato e confira o cliente antes de vincular ao Atlas One.</p></div>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block"><span className="text-sm font-bold text-slate-800">Número exato do orçamento W.Vetro</span>
            <input type="text" inputMode="numeric" maxLength={10} value={numero}
              onChange={e => { setNumero(e.target.value.replace(/\D/g, '')); invalidar() }}
              placeholder="Ex.: 588 ou 714" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <button type="button" disabled={!/^[1-9][0-9]{0,9}$/.test(numero) || ocupado}
            onClick={() => void requisitar('consultar')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">
            {ocupado ? <Loader2 size={17} className="animate-spin"/> : <FileSearch size={17}/>}
            {ocupado ? 'Consultando…' : 'Buscar número'}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">A busca não modifica cadastros, preços ou orçamentos. A sincronização antiga por período continua disponível.</p>
      </section>
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
      {sucesso && <section className="rounded-2xl border border-emerald-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-700"><CheckCircle2 size={20}/> Vinculação confirmada!</h2>
        <p className="mt-2 text-sm text-slate-700">{sucesso.mensagem}</p>
        <p className="mt-2 text-sm">Cliente: <strong>{sucesso.cliente.nome}</strong> · W.Vetro <strong>#{sucesso.numero}</strong></p>
        {sucesso.situacaoWvetro?.trim().toUpperCase() === 'V' && sucesso.orcamentoAtlasId && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">A origem W.Vetro está vendida, mas vincular o número não confirma a venda no Atlas.</p>
            <p className="mt-2">Confira o cadastro, a obra e o valor antes de concluir. Valor informado pelo W.Vetro: <strong>{dinheiro(sucesso.valorOrigem ?? null)}</strong>. A confirmação comercial é uma etapa separada e cria os registros operacionais e financeiros.</p>
            <Link href={'/vendas/confirmar?orcamento=' + encodeURIComponent(sucesso.orcamentoAtlasId)}
              className="mt-3 inline-flex rounded-lg bg-amber-800 px-4 py-2.5 font-bold text-white hover:bg-amber-900">
              Conferir e confirmar venda no Atlas
            </Link>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={'/clientes/' + sucesso.cliente.id} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Abrir Cliente 360</Link>
          {sucesso.orcamentoAtlasId && <Link href={'/orcamento/' + sucesso.orcamentoAtlasId + '/composicao'} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Abrir orçamento</Link>}
          <button type="button" onClick={() => { setNumero('');setClienteId('');setNovo(false);invalidar() }} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><RefreshCw size={14}/> Buscar outro número</button>
        </div>
      </section>}
      {previa && !sucesso && <section className="space-y-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck size={20} className="text-blue-700"/> Conferência antes de sincronizar</h2>
          <p className="mt-1 text-xs text-slate-500">Fonte: {previa.origem}. Estes são os dados existentes; nenhum vínculo foi executado.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Número W.Vetro</p><strong className="mt-1 block text-2xl">#{previa.numero}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Cliente informado no W.Vetro</p><strong className="mt-1 block text-base">{previa.nomeWVetro}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Itens registrados</p><strong className="mt-1 block">{previa.quantidadeItens}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Valor de origem · não altera preços atuais</p><strong className="mt-1 block">{dinheiro(previa.valor)}</strong></div>
        </div>
        <p className="text-xs text-slate-500">Data de origem: {dataBR(previa.data)} · Situação: {previa.situacao || 'Não informada'}</p>
        {previa.existe && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Já existe um orçamento Atlas relacionado: {previa.existe.nome || 'Cliente não identificado'}. Não será criado outro caso exista vínculo operacional.
        </div>}
        {previa.situacao?.trim().toUpperCase() === 'V' && previa.existe && !previa.conflito &&
          previa.existe.clienteId === clienteId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Vendido no W.Vetro não significa venda confirmada no Atlas.</p>
            <p className="mt-1">O vínculo do número não cria venda nem movimenta este orçamento para Vendido. Para concluir, abra a confirmação comercial e confira os dados e valores.</p>
            <Link href={'/vendas/confirmar?orcamento=' + encodeURIComponent(previa.existe.id)}
              className="mt-3 inline-flex rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 hover:bg-amber-100">
              Verificar e confirmar venda existente no Atlas
            </Link>
          </div>
        )}
        {previa.conflito && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <ShieldAlert size={16} className="mr-1 inline"/> Este número já tem um vínculo incompatível. A sincronização foi bloqueada.
        </div>}
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-900">Cliente de destino no Atlas</h3>
          {previa.clienteAtlas ? <p className="mt-2 text-sm">Selecionado: <b>{previa.clienteAtlas.nome}</b>{previa.compativel
            ? <span className="ml-2 text-emerald-700">· Nome compatível</span>
            : <span className="ml-2 font-semibold text-amber-700">· Nome diferente, exige conferência</span>}</p>
            : <p className="mt-2 text-sm text-slate-600">Nenhum cliente selecionado. Escolha um cadastro existente ou crie um novo após a conferência.</p>}
          {previa.semelhantes.length > 0 && <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Cadastros que podem corresponder ao nome (seleção manual)</p>
            <div className="flex flex-wrap gap-2">
              {previa.semelhantes.map(c=><button type="button" key={c.id}
                onClick={() => { setClienteId(c.id);setNovo(false);invalidar() }}
                className={'rounded-lg border px-3 py-2 text-xs font-medium hover:bg-blue-50 ' + (clienteId===c.id?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200')}>
                {c.nome}</button>)}
            </div>
          </div>}
          {clienteId && <button type="button" onClick={() => {setClienteId('');setNovo(false);invalidar()}}
            className="mt-3 text-xs font-semibold text-blue-700 underline">Não é este cliente / escolher outro</button>}
          {!clienteId && previa.podeCriarNovo && <button type="button"
            onClick={() => {setNovo(true);invalidar()}} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 underline">
            <UserPlus size={14}/> Criar Cliente 360 com o nome confirmado no W.Vetro</button>}
        </div>
        {!previa.conflito && (clienteId || novo) && <>
          {!previa.compativel && previa.clienteAtlas && <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" checked={divergencia} onChange={e=>setDivergencia(e.target.checked)} className="mt-1"/>
            Conferi que <b>{previa.nomeWVetro}</b> e <b>{previa.clienteAtlas.nome}</b> são a mesma pessoa, apesar do nome diferente.
          </label>}
          {novo && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Ao confirmar, será criado um novo Cliente 360 chamado <b>{previa.nomeWVetro}</b>. Nenhum cliente existente será alterado.</p>}
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
            <input type="checkbox" checked={confirmou} onChange={e=>setConfirmou(e.target.checked)} className="mt-1"/>
            Conferi o orçamento W.Vetro <b>#{previa.numero}</b>, o nome <b>{previa.nomeWVetro}</b> e autorizo vincular somente este orçamento.
          </label>
          <button type="button" disabled={ocupado || !confirmou || (!previa.compativel && !!previa.clienteAtlas && !divergencia)}
            onClick={() => void requisitar('confirmar')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {ocupado ? <Loader2 size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>}
            {ocupado ? 'Confirmando…' : 'Confirmar vínculo deste número'}
          </button>
        </>}
        {(!clienteId&&!novo)&&<p className="text-sm text-amber-700">Após selecionar ou criar o cliente, clique novamente em <b>Buscar número</b> para gerar uma nova prévia segura.</p>}
      </section>}
      {novo&&!previa&&!sucesso && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Opção marcada: criar cliente novo após a conferência. Clique em <b>Buscar número</b> novamente para confirmar os dados.
        <button type="button" onClick={()=>{setNovo(false);invalidar()}} className="ml-2 font-bold underline">Cancelar criação</button>
      </div>}
    </div>
  </main>
}