'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle2, ExternalLink, MapPin, Pencil, Plus, Save, UserRound, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarObraCliente, type ObraCliente360 } from '@/lib/cliente360'
import type { Cliente } from '@/lib/tipos'
import {
  formularioCliente, formularioObra, patchCliente, patchObra,
  validarCadastroCliente, validarCadastroObra,
  type ClienteCadastroEdicao, type ObraCadastroEdicao,
} from '@/lib/cadastroCliente360Regras'

type ClienteCompleto = Cliente & { apelido?: string | null; updated_at?: string | null }
type Props = {
  cliente: ClienteCompleto
  obras: ObraCliente360[]
  onAtualizado: () => Promise<void>
}

const camposCliente: Array<{
  chave: keyof ClienteCadastroEdicao; titulo: string; tipo?: string; placeholder?: string
}> = [
  { chave:'nome', titulo:'Nome completo *', placeholder:'Nome e sobrenome' },
  { chave:'apelido', titulo:'Apelido / nome fantasia' },
  { chave:'cpf_cnpj', titulo:'CPF / CNPJ' },
  { chave:'data_nascimento', titulo:'Data de nascimento', tipo:'date' },
  { chave:'whatsapp', titulo:'WhatsApp', tipo:'tel' },
  { chave:'telefone', titulo:'Telefone adicional', tipo:'tel' },
  { chave:'email', titulo:'E-mail', tipo:'email' },
  { chave:'origem', titulo:'Origem do cliente' },
  { chave:'endereco', titulo:'Endereço do cliente (não da obra)', placeholder:'Rua, avenida, número, complemento' },
  { chave:'bairro', titulo:'Bairro do cliente' },
  { chave:'cidade', titulo:'Cidade do cliente' },
  { chave:'cep', titulo:'CEP do cliente' },
  { chave:'responsavel', titulo:'Responsável / contato' },
]
const origens: Array<{ value: string; label: string }> = [
  {value:'indicacao',label:'Indicação'},{value:'arquiteto',label:'Arquiteto'},
  {value:'engenheiro',label:'Engenheiro'},{value:'construtora',label:'Construtora'},
  {value:'instagram',label:'Instagram'},{value:'facebook',label:'Facebook'},
  {value:'google',label:'Google'},{value:'whatsapp',label:'WhatsApp'},
  {value:'cliente_antigo',label:'Cliente antigo'},{value:'passou_na_frente',label:'Passou em frente'},
  {value:'outros',label:'Outros'},
]
const camposObra: Array<{
  chave: keyof ObraCadastroEdicao; titulo: string; tipo?: string; placeholder?: string
}> = [
  {chave:'nome',titulo:'Identificação / nome da obra *',placeholder:'Ex.: Residência Silva — etapa 2'},
  {chave:'responsavel',titulo:'Responsável pela obra',placeholder:'Engenheiro, mestre de obras ou contato'},
  {chave:'endereco',titulo:'Rua / avenida da obra',placeholder:'Logradouro da obra'},
  {chave:'numero_endereco',titulo:'Número',placeholder:'123 ou S/N'},
  {chave:'complemento',titulo:'Complemento / referência'},
  {chave:'bairro',titulo:'Bairro'},
  {chave:'cidade',titulo:'Cidade'},
  {chave:'uf',titulo:'UF',placeholder:'SP'},
  {chave:'cep',titulo:'CEP',placeholder:'00000-000'},
  {chave:'data_inicio',titulo:'Início da obra',tipo:'date'},
  {chave:'previsao_entrega',titulo:'Previsão de entrega',tipo:'date'},
]

function enderecoDaObra(obra: ObraCliente360) {
  return [
    [obra.endereco,obra.numero_endereco].filter(Boolean).join(', '),
    obra.complemento,obra.bairro,
    [obra.cidade,obra.uf].filter(Boolean).join(' / '),
    obra.cep ? 'CEP ' + obra.cep : '',
  ].filter(Boolean).join(' · ')
}
function campoInput(className = '') {
  return 'mt-1 block w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-600 ' + className
}

export default function CadastroCliente360({ cliente, obras, onAtualizado }: Props) {
  const [formCliente, setFormCliente] = useState<ClienteCadastroEdicao>(() => formularioCliente(cliente))
  const [editarCliente, setEditarCliente] = useState(false)
  const [obraAberta, setObraAberta] = useState<string | null>(null)
  const [formObra, setFormObra] = useState<ObraCadastroEdicao>(() => formularioObra())
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [salvandoObra, setSalvandoObra] = useState(false)
  const [erroCliente, setErroCliente] = useState('')
  const [erroObra, setErroObra] = useState('')
  const [mensagemCliente, setMensagemCliente] = useState('')
  const [mensagemObra, setMensagemObra] = useState('')

  useEffect(() => {
    setFormCliente(formularioCliente(cliente))
    setEditarCliente(false)
  }, [cliente.id, cliente.updated_at])

  function cancelarCliente() {
    setFormCliente(formularioCliente(cliente))
    setEditarCliente(false)
    setErroCliente('')
  }
  async function salvarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (salvandoCliente) return
    const validacao = validarCadastroCliente(formCliente)
    if (validacao) { setErroCliente(validacao); return }
    setSalvandoCliente(true); setErroCliente(''); setMensagemCliente('')
    try {
      let consulta = supabase.from('clientes').update({
        ...patchCliente(formCliente), updated_at: new Date().toISOString(),
      }).eq('id', cliente.id)
      if (cliente.updated_at) consulta = consulta.eq('updated_at', cliente.updated_at)
      const {data,error} = await consulta.select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Cadastro alterado por outro usuário ou acesso não autorizado. Atualize a página e confira os dados.')
      await onAtualizado()
      setEditarCliente(false)
      setMensagemCliente('Cadastro do cliente atualizado com sucesso.')
    } catch (err) {
      setErroCliente(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.')
    } finally { setSalvandoCliente(false) }
  }

  function abrirObra(obra?: ObraCliente360) {
    if (obraAberta && JSON.stringify(formObra) !== JSON.stringify(
      formularioObra(obras.find(o => o.id === obraAberta)))
      && !window.confirm('Descartar alterações não salvas da obra?')) return
    setObraAberta(obra?.id || 'nova')
    setFormObra(formularioObra(obra))
    setErroObra(''); setMensagemObra('')
  }
  function fecharObra() {
    if (obraAberta && JSON.stringify(formObra) !== JSON.stringify(
      formularioObra(obras.find(o => o.id === obraAberta)))
      && !window.confirm('Descartar alterações não salvas?')) return
    setObraAberta(null);setErroObra('')
  }
  async function salvarObra(e: React.FormEvent) {
    e.preventDefault()
    if (!obraAberta || salvandoObra) return
    const validacao = validarCadastroObra(formObra)
    if (validacao) { setErroObra(validacao); return }
    setSalvandoObra(true); setErroObra(''); setMensagemObra('')
    try {
      const patch = patchObra(formObra)
      if (obraAberta === 'nova') {
        const resultado = await criarObraCliente(cliente.id,{
          ...formObra, status:'planejamento',
          nome:patch.nome, uf:patch.uf || '', cep:patch.cep || '',
        })
        if (!resultado.ok) throw new Error(resultado.error || 'Não foi possível criar a obra.')
        setMensagemObra('Nova obra cadastrada e vinculada ao cliente.')
      } else {
        const original = obras.find(o => o.id === obraAberta)
        if (!original) throw new Error('A obra não está mais na lista do cliente. Atualize a página.')
        let consulta = supabase.from('obras').update({
          ...patch,updated_at:new Date().toISOString(),
        }).eq('id',original.id).eq('cliente_id',cliente.id)
        if (original.updated_at) consulta = consulta.eq('updated_at',original.updated_at)
        const {data,error} = await consulta.select('id').maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Obra modificada por outro usuário ou acesso não autorizado. Atualize para revisar.')
        setMensagemObra('Cadastro da obra atualizado com sucesso.')
      }
      setObraAberta(null);setFormObra(formularioObra())
      await onAtualizado()
    } catch (err) {
      setErroObra(err instanceof Error ? err.message : 'Não foi possível salvar a obra.')
    } finally { setSalvandoObra(false) }
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <UserRound size={21} className="mt-0.5 text-blue-700"/>
          <div>
            <h2 className="font-bold text-slate-900">Cadastro do cliente</h2>
            <p className="mt-1 text-xs text-slate-500">Dados gerais do cliente. Não são o endereço de nenhuma obra.</p>
          </div>
        </div>
        {!editarCliente && <button onClick={() => {setErroCliente('');setMensagemCliente('');setEditarCliente(true)}}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800">
          <Pencil size={14}/> Editar cadastro
        </button>}
      </header>
      <form onSubmit={salvarCliente} className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {camposCliente.map(campo =>
            <label key={campo.chave} className="block min-w-0 text-xs font-semibold text-slate-600">
              {campo.titulo}
              {campo.chave === 'origem' ? (
                <select value={formCliente.origem} disabled={!editarCliente}
                  onChange={e => setFormCliente(f=>({...f,origem:e.target.value}))} className={campoInput()}>
                  {!origens.some(o=>o.value===formCliente.origem) &&
                    <option value={formCliente.origem}>{formCliente.origem}</option>}
                  {origens.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : <input type={campo.tipo || 'text'} value={formCliente[campo.chave]}
                disabled={!editarCliente} placeholder={campo.placeholder}
                onChange={e => setFormCliente(f=>({...f,[campo.chave]:e.target.value}))}
                className={campoInput()}/>}
            </label>
          )}
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-600">
          Observações do cliente
          <textarea rows={3} value={formCliente.observacoes} disabled={!editarCliente}
            onChange={e => setFormCliente(f=>({...f,observacoes:e.target.value}))}
            className={campoInput()} placeholder="Informações importantes sobre o cliente"/>
        </label>
        {erroCliente&&<p role="alert" className="mt-3 text-sm text-red-700">{erroCliente}</p>}
        {mensagemCliente&&<p role="status" className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15}/>{mensagemCliente}</p>}
        {editarCliente&&<div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={salvandoCliente} onClick={cancelarCliente} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          <button disabled={salvandoCliente} type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Save size={15}/>{salvandoCliente?'Salvando...':'Salvar dados do cliente'}
          </button>
        </div>}
        <p className="mt-4 text-[11px] text-slate-400">Corrigir este cadastro não altera orçamentos, contratos ou notas fiscais já emitidos.</p>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <Building2 size={21} className="mt-0.5 text-indigo-700"/>
          <div>
            <h2 className="font-bold text-slate-900">Cadastro de obras</h2>
            <p className="mt-1 text-xs text-slate-500">
              {obras.length} obra(s) vinculada(s) a este cliente. Cada obra possui endereço independente.
            </p>
          </div>
        </div>
        <button type="button" disabled={salvandoObra} onClick={()=>abrirObra()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          <Plus size={14}/> Cadastrar nova obra
        </button>
      </header>
      <div className="space-y-3 p-5">
        {obras.length===0&&<p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Nenhuma obra cadastrada. Clique em Cadastrar nova obra.</p>}
        {obras.map(obra=><article key={obra.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm text-slate-900">{obra.nome}</b>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">Obra #{obra.numero}</span>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">{obra.status?.replace(/_/g,' ') || 'Planejamento'}</span>
              </div>
              <p className="mt-2 flex items-start gap-1 text-xs text-slate-600">
                <MapPin size={13} className="mt-0.5 shrink-0"/>
                {enderecoDaObra(obra)||'Endereço da obra não cadastrado'}
              </p>
              {obra.responsavel && <p className="mt-1 text-xs text-slate-500">Responsável: {obra.responsavel}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>abrirObra(obra)} type="button" disabled={salvandoObra}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700">
                <Pencil size={13}/> Editar cadastro
              </button>
              <Link href={'/obras/'+obra.id} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-indigo-700">
                <ExternalLink size={13}/> Abrir obra
              </Link>
            </div>
          </div>
        </article>)}
        {mensagemObra&&<p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15}/>{mensagemObra}</p>}
        {obraAberta&&<form onSubmit={salvarObra} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h3 className="text-sm font-bold text-slate-900">{obraAberta==='nova'?'Nova obra para '+cliente.nome:'Editar cadastro da obra'}</h3>
              <p className="mt-1 text-xs text-slate-500">Altere somente dados cadastrais. O andamento operacional da obra não será modificado.</p>
            </div>
            <button type="button" onClick={fecharObra} className="rounded-lg p-2 text-slate-600"><X size={17}/></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {camposObra.map(campo=><label key={campo.chave} className="min-w-0 text-xs font-semibold text-slate-600">
              {campo.titulo}
              <input type={campo.tipo||'text'} value={formObra[campo.chave]}
                onChange={e=>setFormObra(f=>({...f,[campo.chave]:e.target.value}))}
                placeholder={campo.placeholder} className={campoInput('bg-white')}/>
            </label>)}
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Observações da obra
            <textarea value={formObra.observacoes} onChange={e=>setFormObra(f=>({...f,observacoes:e.target.value}))}
              rows={3} className={campoInput('bg-white')} />
          </label>
          {erroObra&&<p role="alert" className="mt-3 text-sm text-red-700">{erroObra}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={salvandoObra} onClick={fecharObra} className="rounded-lg border bg-white px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={salvandoObra}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save size={15}/>{salvandoObra?'Salvando...':obraAberta==='nova'?'Salvar nova obra':'Salvar alterações da obra'}
            </button>
          </div>
        </form>}
      </div>
    </section>
  </div>
}
