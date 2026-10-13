'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Building2, Check, ChevronRight, ClipboardList, Edit3, Info, MapPin, Plus, Save, UserRound, X } from 'lucide-react'

type ClienteDemo = {
  tipo: string; nome: string; documento: string; nascimento: string;
  whatsapp: string; telefone: string; email: string; origem: string;
  responsavel: string; cep: string; endereco: string; numero: string;
  complemento: string; bairro: string; cidade: string; uf: string; observacoes: string
}
type ObraDemo = {
  id: string; nome: string; status: string; endereco: string; numero_endereco: string;
  complemento: string; bairro: string; cidade: string; uf: string; cep: string;
  responsavel: string; data_inicio: string; previsao_entrega: string; observacoes: string
}
const clienteBase: ClienteDemo = {
  tipo: 'Pessoa física', nome: 'Cliente de Exemplo', documento: '000.000.000-00',
  nascimento: '', whatsapp: '(00) 00000-0000', telefone: '', email: 'exemplo@dominio.com',
  origem: 'Indicação', responsavel: 'Comercial', cep: '00000-000', endereco: 'Rua Exemplo',
  numero: '100', complemento: '', bairro: 'Centro', cidade: 'José Bonifácio', uf: 'SP', observacoes: 'Dados ilustrativos para validação da tela.'
}
const obrasBase: ObraDemo[] = [
  { id: 'demo-1', nome: 'Residência — Jardim Europa', status: 'Em andamento', endereco: 'Rua Exemplo',
    numero_endereco: '150', complemento: '', bairro: 'Jardim Europa', cidade: 'José Bonifácio',
    uf: 'SP', cep: '00000-000', responsavel: 'Comercial', data_inicio: '', previsao_entrega: '', observacoes: 'Obra residencial de demonstração.' },
  { id: 'demo-2', nome: 'Reforma — Centro', status: 'Planejamento', endereco: 'Avenida Demonstração',
    numero_endereco: '45', complemento: 'Sala 2', bairro: 'Centro', cidade: 'José Bonifácio',
    uf: 'SP', cep: '00000-000', responsavel: 'Comercial', data_inicio: '', previsao_entrega: '', observacoes: '' },
]
const novaObra: ObraDemo = {
  id: '', nome: '', status: 'Planejamento', endereco: '', numero_endereco: '',
  complemento: '', bairro: '', cidade: '', uf: 'SP', cep: '', responsavel: '',
  data_inicio: '', previsao_entrega: '', observacoes: ''
}

function Campo({ nome, valor, mudar, editavel, placeholder = '', tipo = 'text', grande = false }:{
  nome: string; valor: string; mudar: (valor:string)=>void; editavel: boolean;
  placeholder?: string; tipo?: string; grande?: boolean
}) {
  return <label className={`block min-w-0 ${grande?'sm:col-span-2':''}`}>
    <span className="mb-1.5 block text-xs font-semibold text-slate-500">{nome}</span>
    <input type={tipo} value={valor} placeholder={placeholder || 'Não informado'}
      onChange={e=>mudar(e.target.value)} readOnly={!editavel}
      className={`w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${editavel?'border-slate-300 bg-white text-slate-900':'border-slate-100 bg-slate-50 text-slate-700'}`}
    />
  </label>
}

export default function PreviewCadastroCliente360(){
  const [cliente, setCliente] = useState<ClienteDemo>(clienteBase)
  const [formCliente, setFormCliente] = useState<ClienteDemo>(clienteBase)
  const [editandoCliente, setEditandoCliente] = useState(false)
  const [obras, setObras] = useState<ObraDemo[]>(obrasBase)
  const [aba, setAba] = useState<'cadastro'|'obras'>('cadastro')
  const [modal, setModal] = useState(false)
  const [editandoObraId, setEditandoObraId] = useState<string|null>(null)
  const [formObra, setFormObra] = useState<ObraDemo>(novaObra)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const emAndamento = useMemo(()=>obras.filter(o=>o.status==='Em andamento').length,[obras])

  function campoCliente(chave: keyof ClienteDemo){
    return (valor:string)=>setFormCliente(atual=>({...atual,[chave]:valor}))
  }
  function campoObra(chave: keyof ObraDemo){
    return (valor:string)=>setFormObra(atual=>({...atual,[chave]:valor}))
  }
  function abrirObra(obra?:ObraDemo){
    setErro('');setAviso('')
    setEditandoObraId(obra?.id||null)
    setFormObra(obra ? {...obra} : {...novaObra, cidade: cliente.cidade, uf: cliente.uf})
    setModal(true)
  }
  function salvarCliente(){
    if(!formCliente.nome.trim()){setErro('Informe o nome do cliente.');return}
    setCliente({...formCliente});setEditandoCliente(false);setErro('')
    setAviso('Demonstração: dados do cliente atualizados apenas nesta página. Nada foi salvo no Atlas.')
  }
  function salvarObra(){
    if(!formObra.nome.trim()){setErro('Informe o nome da obra.');return}
    if(!formObra.cidade.trim()){setErro('Informe a cidade da obra.');return}
    if(editandoObraId) setObras(anteriores=>anteriores.map(o=>o.id===editandoObraId?{...formObra}:o))
    else setObras(anteriores=>[{...formObra,id:'demo-'+Date.now()},...anteriores])
    setModal(false);setErro('')
    setAviso('Demonstração: obra '+(editandoObraId?'atualizada':'incluída')+' apenas nesta página. Nenhum cadastro real foi alterado.')
  }
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
        <Info size={16}/><b>PRÉVIA PARA APROVAÇÃO</b>
        <span className="font-normal">Dados fictícios. Os botões simulam alterações somente nesta tela — não salvam no Atlas.</span>
      </div>
    </div>
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-xl border border-slate-200 p-2 text-slate-500"><ArrowLeft size={19}/></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Cliente ativo</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Cliente 360 <span className="mx-1">•</span> Protótipo do cadastro</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{cliente.whatsapp || 'Sem WhatsApp'}</span><span>{cliente.cidade}/{cliente.uf}</span>
                <span>{obras.length} obra(s) vinculada(s)</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={()=>abrirObra()}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
            <Plus size={16}/>Nova obra
          </button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="min-w-40 flex-1 rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-400">Cadastro</p><p className="mt-1 flex items-center gap-2 text-lg font-bold"><UserRound size={18} className="text-blue-700"/>Cliente</p><p className="mt-1 text-xs text-slate-500">Dados e contatos</p></div>
        <div className="min-w-40 flex-1 rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-400">Obras</p><p className="mt-1 flex items-center gap-2 text-lg font-bold"><Building2 size={18} className="text-blue-700"/>{obras.length} cadastradas</p><p className="mt-1 text-xs text-slate-500">{emAndamento} em andamento</p></div>
      </div>
      <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-slate-200 text-sm font-semibold">
        <span className="whitespace-nowrap px-3 py-3 text-slate-400">Visão geral</span>
        <button onClick={()=>setAba('cadastro')} className={`whitespace-nowrap border-b-[3px] px-4 py-3 ${aba==='cadastro'?'border-blue-800 text-blue-900':'border-transparent text-slate-500 hover:text-blue-800'}`}>Cadastro</button>
        <span className="whitespace-nowrap px-3 py-3 text-slate-400">Orçamentos</span>
        <span className="whitespace-nowrap px-3 py-3 text-slate-400">Vendas</span>
        <button onClick={()=>setAba('obras')} className={`whitespace-nowrap border-b-[3px] px-4 py-3 ${aba==='obras'?'border-blue-800 text-blue-900':'border-transparent text-slate-500 hover:text-blue-800'}`}>Obras</button>
        <span className="whitespace-nowrap px-3 py-3 text-slate-400">Financeiro</span>
        <span className="whitespace-nowrap px-3 py-3 text-slate-400">Medições</span>
      </div>
      {aviso && <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><Check size={17} className="mt-0.5 shrink-0"/>{aviso}</div>}
      {erro && !modal && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}
      {aba==='cadastro' && <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h2 className="flex items-center gap-2 font-bold"><UserRound size={18} className="text-blue-700"/>Cadastro do cliente</h2><p className="mt-1 text-xs text-slate-500">Dados do cliente independentes do endereço de cada obra</p></div>
            {!editandoCliente?<button onClick={()=>{setFormCliente({...cliente});setEditandoCliente(true);setErro('');setAviso('')}}
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><Edit3 size={14}/>Editar cadastro</button>
              :<div className="flex flex-wrap gap-2">
                <button onClick={()=>{setEditandoCliente(false);setFormCliente({...cliente});setErro('')}} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
                <button onClick={salvarCliente} className="flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white"><Save size={14}/>Simular salvamento</button>
              </div>}
          </div>
          <div className="space-y-6 p-5">
            <div><h3 className="mb-3 text-sm font-bold text-slate-800">Identificação e contato</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Campo nome="Nome completo / Razão social" valor={formCliente.nome} mudar={campoCliente('nome')} editavel={editandoCliente} grande/>
                <Campo nome="Tipo de pessoa" valor={formCliente.tipo} mudar={campoCliente('tipo')} editavel={editandoCliente}/>
                <Campo nome="CPF / CNPJ" valor={formCliente.documento} mudar={campoCliente('documento')} editavel={editandoCliente}/>
                <Campo nome="Data de nascimento" valor={formCliente.nascimento} mudar={campoCliente('nascimento')} editavel={editandoCliente} tipo={editandoCliente?'date':'text'}/>
                <Campo nome="WhatsApp" valor={formCliente.whatsapp} mudar={campoCliente('whatsapp')} editavel={editandoCliente}/>
                <Campo nome="Telefone" valor={formCliente.telefone} mudar={campoCliente('telefone')} editavel={editandoCliente}/>
                <Campo nome="E-mail" valor={formCliente.email} mudar={campoCliente('email')} editavel={editandoCliente}/>
                <Campo nome="Origem do cliente" valor={formCliente.origem} mudar={campoCliente('origem')} editavel={editandoCliente}/>
                <Campo nome="Responsável pelo atendimento" valor={formCliente.responsavel} mudar={campoCliente('responsavel')} editavel={editandoCliente}/>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5"><h3 className="mb-3 text-sm font-bold text-slate-800">Endereço do cliente</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Campo nome="CEP" valor={formCliente.cep} mudar={campoCliente('cep')} editavel={editandoCliente}/>
                <Campo nome="Rua / avenida" valor={formCliente.endereco} mudar={campoCliente('endereco')} editavel={editandoCliente} grande/>
                <Campo nome="Número" valor={formCliente.numero} mudar={campoCliente('numero')} editavel={editandoCliente}/>
                <Campo nome="Complemento" valor={formCliente.complemento} mudar={campoCliente('complemento')} editavel={editandoCliente}/>
                <Campo nome="Bairro" valor={formCliente.bairro} mudar={campoCliente('bairro')} editavel={editandoCliente}/>
                <Campo nome="Cidade" valor={formCliente.cidade} mudar={campoCliente('cidade')} editavel={editandoCliente}/>
                <Campo nome="UF" valor={formCliente.uf} mudar={campoCliente('uf')} editavel={editandoCliente}/>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5"><h3 className="mb-2 text-sm font-bold">Observações cadastrais</h3>
              <textarea readOnly={!editandoCliente} value={formCliente.observacoes} onChange={e=>campoCliente('observacoes')(e.target.value)}
                rows={2} className={`w-full resize-y rounded-xl border p-3 text-sm ${editandoCliente?'border-slate-300':'border-slate-100 bg-slate-50'}`}/>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-bold"><Building2 size={18} className="text-blue-700"/>Obras deste cliente</h2><p className="mt-1 text-xs text-slate-500">Um cliente pode ter quantas obras forem necessárias, cada uma com seu endereço</p></div>
            <button onClick={()=>abrirObra()} className="flex items-center gap-2 rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/>Cadastrar obra</button>
          </div>
          <div className="space-y-3">
            {obras.map(obra=><div key={obra.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div className="min-w-0"><p className="font-semibold text-slate-900">{obra.nome}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12}/>{[obra.endereco,obra.numero_endereco].filter(Boolean).join(', ') || 'Endereço não informado'} · {obra.cidade}/{obra.uf}</p>
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{obra.status}</span></div>
              <button onClick={()=>abrirObra(obra)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-blue-800"><Edit3 size={14}/>Editar obra</button>
            </div>)}
          </div>
          <button onClick={()=>setAba('obras')} className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-800">Ver todas as obras <ChevronRight size={14}/></button>
        </section>
      </div>}
      {aba==='obras' && <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Obras do cliente</h2><p className="text-sm text-slate-500">Cadastro individual, endereço e acompanhamento</p></div>
          <button onClick={()=>abrirObra()} className="flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>Nova obra</button></div>
        <div className="grid gap-4 lg:grid-cols-2">{obras.map(o=><article key={o.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3"><b>{o.nome}</b><span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{o.status}</span></div>
          <div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0"/>{[o.endereco,o.numero_endereco,o.complemento,o.bairro,o.cidade,o.uf].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
            <p className="flex items-center gap-2"><ClipboardList size={16}/>Responsável: {o.responsavel||'Não definido'}</p></div>
          <div className="mt-4 flex justify-end"><button onClick={()=>abrirObra(o)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-blue-800"><Edit3 size={14}/>Editar cadastro da obra</button></div>
        </article>)}</div>
        <button onClick={()=>setAba('cadastro')} className="mt-5 text-sm font-bold text-blue-800">Voltar ao cadastro do cliente</button>
      </section>}
    </main>
    {modal&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={editandoObraId?'Editar obra':'Cadastrar obra'} className="my-5 max-h-[93vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4">
          <div><h2 className="text-lg font-bold">{editandoObraId?'Editar cadastro da obra':'Cadastrar nova obra'}</h2><p className="mt-1 text-xs text-slate-500">Vinculada automaticamente a {cliente.nome}</p></div>
          <button onClick={()=>{setModal(false);setErro('')}} aria-label="Fechar" className="rounded-lg border p-2 text-slate-600"><X size={18}/></button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo nome="Nome da obra *" valor={formObra.nome} mudar={campoObra('nome')} editavel grande/>
            <label><span className="mb-1.5 block text-xs font-semibold text-slate-500">Situação da obra</span>
              <select value={formObra.status} onChange={e=>campoObra('status')(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                <option>Planejamento</option><option>Em andamento</option><option>Pausada</option><option>Concluída</option>
              </select></label>
            <Campo nome="Responsável" valor={formObra.responsavel} mudar={campoObra('responsavel')} editavel/>
          </div>
          <div className="border-t pt-5"><h3 className="mb-3 font-bold">Endereço da obra</h3>
            <p className="mb-4 text-xs text-slate-500">Endereço independente do cliente, usado em visitas, medições, entregas e instalação.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo nome="CEP" valor={formObra.cep} mudar={campoObra('cep')} editavel/>
              <Campo nome="Rua / avenida" valor={formObra.endereco} mudar={campoObra('endereco')} editavel grande/>
              <Campo nome="Número" valor={formObra.numero_endereco} mudar={campoObra('numero_endereco')} editavel/>
              <Campo nome="Complemento" valor={formObra.complemento} mudar={campoObra('complemento')} editavel/>
              <Campo nome="Bairro" valor={formObra.bairro} mudar={campoObra('bairro')} editavel/>
              <Campo nome="Cidade *" valor={formObra.cidade} mudar={campoObra('cidade')} editavel/>
              <Campo nome="UF" valor={formObra.uf} mudar={campoObra('uf')} editavel/>
            </div>
          </div>
          <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <Campo nome="Início da obra" valor={formObra.data_inicio} mudar={campoObra('data_inicio')} editavel tipo="date"/>
            <Campo nome="Previsão de entrega" valor={formObra.previsao_entrega} mudar={campoObra('previsao_entrega')} editavel tipo="date"/>
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">Observações da obra</span>
            <textarea rows={3} value={formObra.observacoes} onChange={e=>campoObra('observacoes')(e.target.value)}
              className="w-full rounded-xl border p-3 text-sm" placeholder="Referências, detalhes de acesso, instruções..."/></label>
          {erro&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{erro}</p>}
        </div>
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4">
          <button onClick={()=>{setModal(false);setErro('')}} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancelar</button>
          <button onClick={salvarObra} className="flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-bold text-white"><Save size={16}/>Simular salvamento</button>
        </div>
      </div>
    </div>}
  </div>
}
