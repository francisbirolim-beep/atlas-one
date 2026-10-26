'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Clipboard, Clock3, Mail, MapPin, Phone, Save, UserRound, UserRoundPlus, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

export type ConversaContatoFicha = {
  id: string
  telefone: string
  contato_nome?: string | null
  cliente_id?: string | null
  status: string
  responsavel_nome?: string | null
  setor?: string | null
}

type DadosCliente = {
  nome?: string | null
  email?: string | null
  telefone?: string | null
  cidade?: string | null
  observacoes?: string | null
}

type CamposContato = {
  nome: string
  empresa: string
  email: string
  telefoneSecundario: string
  cpfCnpj: string
  cidade: string
  endereco: string
  bairro: string
  observacoes: string
}

const camposVazios: CamposContato = {
  nome: '', empresa: '', email: '', telefoneSecundario: '', cpfCnpj: '',
  cidade: '', endereco: '', bairro: '', observacoes: '',
}

function formatarTelefone(valor: string) {
  const numero = String(valor || '').replace(/\D/g, '')
  if (numero.startsWith('55') && numero.length === 13)
    return `+55 (${numero.slice(2, 4)}) ${numero.slice(4, 9)}-${numero.slice(9)}`
  if (numero.startsWith('55') && numero.length === 12)
    return `+55 (${numero.slice(2, 4)}) ${numero.slice(4, 8)}-${numero.slice(8)}`
  return valor
}

function campo(rotulo: string, valor: string, aoAlterar: (v: string) => void, props: {
  placeholder?: string; tipo?: string; obrigatorio?: boolean; maximo?: number
} = {}) {
  return (
    <label className="min-w-0 text-xs font-semibold text-slate-700">
      {rotulo}{props.obrigatorio && <span className="ml-1 text-red-600">*</span>}
      <input
        type={props.tipo || 'text'} value={valor} onChange={e=>aoAlterar(e.target.value)}
        placeholder={props.placeholder} required={props.obrigatorio} maxLength={props.maximo || 160}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

export function FichaContatoWhatsApp({
  conversa, nomeCanal, cliente, aoCadastrar,
}: {
  conversa: ConversaContatoFicha
  nomeCanal?: string | null
  cliente?: DadosCliente | null
  aoCadastrar: (novo: {id: string; nome: string}) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState<CamposContato>(camposVazios)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [duplicado, setDuplicado] = useState<{id:string; nome:string}|null>(null)

  useEffect(() => {
    setAberto(false)
    setCampos({...camposVazios, nome: conversa.contato_nome || ''})
    setErro('')
    setDuplicado(null)
  }, [conversa.id])

  function alterar(chave: keyof CamposContato, valor: string) {
    setCampos(atual=>({...atual, [chave]:valor}))
    setErro('')
    setDuplicado(null)
  }

  async function salvar(confirmarVinculo = false) {
    if (salvando || conversa.cliente_id) return
    if (campos.nome.trim().length < 2) {
      setErro('Informe o nome completo com pelo menos 2 caracteres.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/integracoes/whatsapp/cadastrar-contato', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token || ''}` },
        body: JSON.stringify({
          conversaId: conversa.id, ...campos, confirmarVinculo,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        if (resp.status === 409 && json.clienteExistente) setDuplicado(json.clienteExistente)
        throw new Error(json.error || 'Não foi possível cadastrar este contato.')
      }
      if (!json.cliente?.id) throw new Error('Servidor não retornou o cadastro salvo.')
      setAberto(false)
      setDuplicado(null)
      aoCadastrar(json.cliente)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar contato.')
    } finally {
      setSalvando(false)
    }
  }

  const salvo = Boolean(conversa.cliente_id)
  const nome = cliente?.nome || conversa.contato_nome || 'Contato sem nome'
  const empresa = cliente?.observacoes?.split('\n')
    .find(linha=>linha.startsWith('Empresa/organização: '))?.replace('Empresa/organização: ','')
  const situacao = conversa.status === 'finalizado' ? 'Encerrado'
    : conversa.status === 'em_atendimento' ? 'Em atendimento' : 'Aguardando'

  return (
    <section aria-label="Ficha do contato WhatsApp"
      className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-xl font-extrabold text-blue-700">
            {nome.slice(0, 1).toLocaleUpperCase('pt-BR')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="max-w-full truncate text-base font-bold text-slate-900" title={nome}>{nome}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${salvo?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-800'}`}>
                {salvo ? 'Cliente cadastrado' : 'Contato não salvo'}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              {formatarTelefone(conversa.telefone)}
              <button type="button" onClick={()=>void navigator.clipboard?.writeText(conversa.telefone)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Copiar número do WhatsApp" aria-label="Copiar telefone"><Clipboard size={13}/></button>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{situacao}</span>
              {nomeCanal && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Via {nomeCanal}</span>}
            </div>
          </div>
          {!salvo && (
            <button type="button" onClick={()=>setAberto(v=>!v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
              aria-expanded={aberto}>
              {aberto ? <X size={14}/> : <UserRoundPlus size={15}/>}
              {aberto ? 'Fechar cadastro' : 'Cadastrar contato'}
            </button>
          )}
        </div>

        {!aberto && (
          <div className="mt-3 grid gap-x-5 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2"><UserRound size={16} className="shrink-0 text-blue-600"/>
              <span className="min-w-0"><small className="block text-[10px] text-slate-500">Responsável</small>
                <b className="block truncate text-slate-800">{conversa.responsavel_nome || 'Não atribuído'}</b>
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2"><Building2 size={16} className="shrink-0 text-blue-600"/>
              <span className="min-w-0"><small className="block text-[10px] text-slate-500">Setor</small>
                <b className="block truncate text-slate-800">{conversa.setor || 'Não definido'}</b>
              </span>
            </div>
            {salvo && (
              <>
                <div className="flex min-w-0 items-center gap-2"><Mail size={16} className="shrink-0 text-blue-600"/>
                  <span className="min-w-0"><small className="block text-[10px] text-slate-500">E-mail</small>
                    <b className="block truncate text-slate-800">{cliente?.email || 'Não informado'}</b></span>
                </div>
                <div className="flex min-w-0 items-center gap-2"><Phone size={16} className="shrink-0 text-blue-600"/>
                  <span className="min-w-0"><small className="block text-[10px] text-slate-500">Telefone secundário</small>
                    <b className="block truncate text-slate-800">{cliente?.telefone || 'Não informado'}</b></span>
                </div>
                {(empresa || cliente?.cidade) && <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
                  <MapPin size={16} className="shrink-0 text-blue-600"/>
                  <span className="truncate text-slate-700">{[empresa, cliente?.cidade].filter(Boolean).join(' · ')}</span>
                </div>}
              </>
            )}
          </div>
        )}

        {!salvo && aberto && (
          <form className="mt-3 max-h-[42dvh] overflow-y-auto rounded-xl border border-blue-100 bg-blue-50/40 p-3"
            onSubmit={e=>{e.preventDefault();void salvar(false)}}>
            <div className="mb-3 flex items-center gap-2">
              <UserRoundPlus className="text-blue-700" size={18}/>
              <div><b className="text-sm text-slate-900">Cadastrar contato no Cliente 360</b>
                <p className="text-[11px] text-slate-500">WhatsApp preenchido automaticamente. Os demais campos são opcionais.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {campo('Nome completo', campos.nome, v=>alterar('nome',v), {placeholder:'Digite o nome completo',obrigatorio:true})}
              {campo('Empresa / organização', campos.empresa, v=>alterar('empresa',v), {placeholder:'Empresa (opcional)'})}
              {campo('E-mail', campos.email, v=>alterar('email',v), {tipo:'email',placeholder:'contato@exemplo.com',maximo:254})}
              <label className="text-xs font-semibold text-slate-700">WhatsApp principal
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-normal text-slate-700">
                  {formatarTelefone(conversa.telefone)}
                </div>
              </label>
              {campo('Telefone secundário',campos.telefoneSecundario,v=>alterar('telefoneSecundario',v),{placeholder:'Telefone adicional',maximo:30})}
              {campo('CPF / CNPJ',campos.cpfCnpj,v=>alterar('cpfCnpj',v),{placeholder:'CPF ou CNPJ',maximo:20})}
              {campo('Cidade',campos.cidade,v=>alterar('cidade',v),{placeholder:'Cidade',maximo:120})}
              {campo('Bairro',campos.bairro,v=>alterar('bairro',v),{placeholder:'Bairro',maximo:120})}
              <div className="sm:col-span-2">
                {campo('Endereço',campos.endereco,v=>alterar('endereco',v),{placeholder:'Endereço (opcional)',maximo:250})}
              </div>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                Observações
                <textarea value={campos.observacoes} onChange={e=>alterar('observacoes',e.target.value)}
                  maxLength={3000} rows={2} placeholder="Informações adicionais sobre o contato"
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500"/>
              </label>
            </div>
            {erro && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
            {duplicado && <button type="button" disabled={salvando} onClick={()=>void salvar(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <Check size={14}/> Vincular cadastro existente: {duplicado.nome}
            </button>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={salvando || !campos.nome.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save size={15}/>{salvando ? 'Salvando...' : 'Salvar contato'}
              </button>
              <button type="button" disabled={salvando} onClick={()=>{setAberto(false);setDuplicado(null);setErro('')}}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
