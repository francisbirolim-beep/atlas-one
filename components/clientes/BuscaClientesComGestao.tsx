'use client'

import { useEffect, useState } from 'react'
import { Archive, ArrowRightLeft, Loader2, UserCheck, X } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { carregarAcessoCadastro, podeAcaoCadastro } from '@/lib/acessoCadastroOperacional'

export type ClienteResultadoGestao = {
  id: string; nome: string; apelido?: string | null; whatsapp?: string | null
  telefone?: string | null; email?: string | null; cpf_cnpj?: string | null
  cidade?: string | null; bairro?: string | null; endereco?: string | null
  cep?: string | null; ativo?: boolean; created_at: string; updated_at: string
  resumo: Record<string, number | null>
}

type Props = {
  busca: string
  selecionadoId?: string | null
  onSelecionar: (cliente: ClienteResultadoGestao) => void
  onAtualizar?: () => void
}

async function consultarClientes(parametros: string, sinal?: AbortSignal): Promise<ClienteResultadoGestao[]> {
  const { data: sessao } = await supabase.auth.getSession()
  if (!sessao.session?.access_token) throw new Error('Sessão expirada. Entre novamente.')
  const r = await fetch('/api/clientes/gestao?'+parametros, {
    headers: { Authorization: 'Bearer '+sessao.session.access_token },
    cache: 'no-store', signal: sinal,
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corpo.error || 'Falha na consulta de clientes.')
  return corpo.clientes || []
}

const quantidade = (valor?: number | null) => valor == null ? '—' : String(valor)

function ResumoCliente({ cliente }: { cliente: ClienteResultadoGestao }) {
  return <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
    <span><strong>{quantidade(cliente.resumo?.orcamentos)}</strong> orçamento(s)</span>
    <span><strong>{quantidade(cliente.resumo?.balcao)}</strong> balcão</span>
    <span><strong>{quantidade(cliente.resumo?.obras)}</strong> obra(s)</span>
    <span><strong>{quantidade(cliente.resumo?.vendas)}</strong> venda(s)</span>
    <span><strong>{quantidade(cliente.resumo?.assistencias)}</strong> assistência(s)</span>
  </div>
}

function Perfil({ cliente }: { cliente: ClienteResultadoGestao }) {
  return <div className="min-w-0">
    <div className="flex flex-wrap gap-2 items-center text-sm font-semibold text-slate-800">
      <span>{cliente.nome}</span>
      {cliente.apelido && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">{cliente.apelido}</span>}
      {cliente.ativo === false && <span className="text-xs text-amber-700">Inativo</span>}
    </div>
    <p className="mt-0.5 text-[11px] text-slate-500">{[
      cliente.cidade, cliente.bairro, cliente.whatsapp || cliente.telefone,
      cliente.cpf_cnpj, cliente.email,
    ].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</p>
    <p className="text-[10px] text-slate-400">Cadastro: {new Date(cliente.created_at).toLocaleDateString('pt-BR')} · ID: {cliente.id.slice(0,8)}</p>
    <ResumoCliente cliente={cliente}/>
  </div>
}

export default function BuscaClientesComGestao({ busca, selecionadoId, onSelecionar, onAtualizar }: Props) {
  const [resultados, setResultados] = useState<ClienteResultadoGestao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const [podeInativar, setPodeInativar] = useState(false)
  const [podeUnificar, setPodeUnificar] = useState(false)
  const [revisao, setRevisao] = useState<{ tipo: 'inativar' | 'unificar'; origem: ClienteResultadoGestao } | null>(null)
  const [destinoBusca, setDestinoBusca] = useState('')
  const [destinos, setDestinos] = useState<ClienteResultadoGestao[]>([])
  const [destino, setDestino] = useState<ClienteResultadoGestao | null>(null)
  const [motivo, setMotivo] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroOperacao, setErroOperacao] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const u = await usuarioAtual()
      const acesso = await carregarAcessoCadastro(u)
      if (ativo) {
        setPodeInativar(podeAcaoCadastro(acesso, 'clientes', 'inativar'))
        setPodeUnificar(podeAcaoCadastro(acesso, 'clientes', 'mesclar'))
      }
    })()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (selecionadoId || busca.trim().length < 2) {
      setResultados([])
      setErroBusca('')
      setCarregando(false)
      return
    }
    const controller = new AbortController()
    setCarregando(true)
    const timer = setTimeout(() => {
      consultarClientes('busca='+encodeURIComponent(busca.trim()), controller.signal)
        .then(rows => { if (!controller.signal.aborted) { setResultados(rows); setErroBusca('') } })
        .catch(e => { if (!controller.signal.aborted) { setErroBusca(e.message); setResultados([]) } })
        .finally(() => { if (!controller.signal.aborted) setCarregando(false) })
    }, 380)
    return () => { clearTimeout(timer); controller.abort() }
  }, [busca, selecionadoId, versao])

  useEffect(() => {
    if (revisao?.tipo !== 'unificar' || destinoBusca.trim().length < 2 || destino) {
      setDestinos([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      consultarClientes('busca='+encodeURIComponent(destinoBusca.trim()), controller.signal)
        .then(rows => { if (!controller.signal.aborted) setDestinos(rows.filter(c => c.id !== revisao.origem.id)) })
        .catch(e => { if (!controller.signal.aborted) setErroOperacao(e.message) })
    }, 380)
    return () => { clearTimeout(timer); controller.abort() }
  }, [destinoBusca, destino, revisao])

  function abrir(tipo: 'inativar' | 'unificar', origem: ClienteResultadoGestao) {
    setRevisao({ tipo, origem })
    setDestinoBusca('')
    setDestinos([])
    setDestino(null)
    setMotivo('')
    setConfirmado(false)
    setErroOperacao('')
  }

  async function salvar() {
    if (!revisao || salvando || motivo.trim().length < 8 || !confirmado) return
    if (revisao.tipo === 'unificar' && !destino) return
    setSalvando(true)
    setErroOperacao('')
    try {
      if (revisao.tipo === 'inativar') {
        const { error } = await supabase.rpc('alterar_status_cadastro_cliente', {
          p_cliente_id: revisao.origem.id, p_ativo: false, p_motivo: motivo.trim(),
        })
        if (error) throw error
      } else if (destino) {
        const { data, error } = await supabase.rpc('unificar_clientes_seguro', {
          p_origem: revisao.origem.id, p_destino: destino.id, p_motivo: motivo.trim(),
          p_origem_atualizado_em: revisao.origem.updated_at,
          p_destino_atualizado_em: destino.updated_at,
        })
        if (error) throw error
        if (!data?.ok) throw new Error('A operação não foi confirmada pelo banco.')
        onSelecionar(destino)
      }
      setRevisao(null)
      setVersao(v => v+1)
      onAtualizar?.()
    } catch (e) {
      setErroOperacao(e instanceof Error ? e.message : 'Operação não concluída. Nada deve ser repetido sem conferência.')
    } finally {
      setSalvando(false)
    }
  }

  return <>
    {!selecionadoId && busca.trim().length >= 2 && <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[390px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
      {carregando ? <p className="p-3 text-xs text-slate-500">Consultando clientes...</p> :
       erroBusca ? <p role="alert" className="p-3 text-xs text-red-700">{erroBusca}</p> :
       resultados.length === 0 ? <p className="p-3 text-xs text-slate-500">Nenhum cliente ativo encontrado.</p> :
       resultados.map(c => <div key={c.id} className="border-b border-slate-100 p-3 last:border-b-0">
         <Perfil cliente={c}/>
         <div className="mt-2 flex flex-wrap items-center gap-2">
           <button type="button" onClick={() => onSelecionar(c)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-bold text-white"><UserCheck size={13}/> Selecionar</button>
           <Link href={'/clientes/'+encodeURIComponent(c.id)} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-3 py-1.5 text-xs text-slate-700">Abrir cadastro</Link>
           {podeInativar && <button type="button" onClick={() => abrir('inativar', c)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-800"><Archive size={13}/> Inativar</button>}
           {podeUnificar && <button type="button" onClick={() => abrir('unificar', c)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-sky-800"><ArrowRightLeft size={13}/> Unificar</button>}
         </div>
       </div>)}
    </div>}

    {revisao && <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
      <section role="dialog" aria-modal="true" aria-label={revisao.tipo === 'inativar' ? 'Inativar cliente' : 'Unificar clientes'} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{revisao.tipo === 'inativar' ? 'Inativar cadastro duplicado' : 'Unificar cadastros de clientes'}</h2><p className="mt-1 text-xs text-slate-500">Operação restrita a Master e usuários expressamente autorizados.</p></div>
          <button type="button" onClick={() => !salvando && setRevisao(null)} aria-label="Fechar" disabled={salvando}><X size={20}/></button>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold text-amber-900">{revisao.tipo === 'unificar' ? 'Origem: este cadastro será inativado' : 'Cadastro a inativar'}</p>
          <Perfil cliente={revisao.origem}/>
        </div>
        {revisao.tipo === 'unificar' && <>
          <p className="mt-3 text-sm text-slate-700">Escolha o cadastro principal que ficará ativo. Orçamentos, obras e vínculos operacionais serão transferidos em uma transação. O histórico original fica preservado.</p>
          {!destino ? <div className="mt-3">
            <label className="text-xs font-semibold text-slate-700">Pesquisar cadastro de destino por nome, apelido, CPF ou telefone</label>
            <input autoFocus value={destinoBusca} onChange={e => setDestinoBusca(e.target.value)} placeholder="Digite para buscar outro cadastro" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{destinos.map(c => <button type="button" key={c.id} onClick={() => { setDestino(c); setDestinos([]); setConfirmado(false) }} className="w-full rounded-lg border p-2 text-left hover:border-blue-500"><Perfil cliente={c}/></button>)}</div>
          </div> : <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex justify-between gap-2"><p className="text-xs font-bold text-emerald-900">Destino: cadastro principal preservado</p><button type="button" onClick={() => { setDestino(null); setConfirmado(false) }} className="text-xs underline">Alterar destino</button></div>
            <Perfil cliente={destino}/>
          </div>}
          {destino && revisao.origem.cpf_cnpj && destino.cpf_cnpj && revisao.origem.cpf_cnpj.replace(/\D/g,'') !== destino.cpf_cnpj.replace(/\D/g,'') &&
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">Os CPF/CNPJ são diferentes. A unificação será bloqueada para evitar misturar pessoas distintas.</p>}
        </>}
        <p className="mt-4 text-xs text-slate-600">{revisao.tipo === 'inativar' ? 'Inativar não apaga orçamentos, obras nem histórico. É possível reativar no Cadastro de Clientes.' : 'Dados preenchidos do cadastro principal prevalecem; campos vazios podem receber dados da origem. Registros de auditoria continuam intactos. Não há exclusão física do cliente de origem.'}</p>
        <label className="mt-3 block text-xs font-bold text-slate-700">Justificativa obrigatória (mínimo 8 caracteres)
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} rows={2} placeholder="Ex.: Cadastros duplicados, identidades conferidas por telefone e CPF..." className="mt-1 block w-full resize-y rounded-xl border p-3 text-sm"/>
        </label>
        <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-0.5"/>
          <span>Conferi os dados e os números de orçamentos dos dois cadastros e confirmo esta ação.</span>
        </label>
        {erroOperacao && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erroOperacao}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={salvando} onClick={() => setRevisao(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={salvando || motivo.trim().length < 8 || !confirmado || (revisao.tipo === 'unificar' && !destino)} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{salvando && <Loader2 size={15} className="animate-spin"/>}{revisao.tipo === 'unificar' ? 'Confirmar unificação' : 'Confirmar inativação'}</button>
        </div>
      </section>
    </div>}
  </>
}
