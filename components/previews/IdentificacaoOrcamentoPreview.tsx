'use client'

import { useEffect, useState } from 'react'
import { MapPin, Search, UserRound, Users } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

export type IdentificacaoOrcamento={
  clienteId:string;clienteNome:string;clienteDocumento:string;clienteTelefone:string;enderecoCliente:string;
  entregaTipo:'cliente'|'obra'|'outro'|'definir';obraId:string;obraNome:string;enderecoEntrega:string;
  vendedorId:string;vendedorNome:string
}
export const identificacaoVazia:IdentificacaoOrcamento={
  clienteId:'',clienteNome:'',clienteDocumento:'',clienteTelefone:'',enderecoCliente:'',
  entregaTipo:'definir',obraId:'',obraNome:'',enderecoEntrega:'',vendedorId:'',vendedorNome:''
}
type Cliente={
  id:string;nome:string;apelido?:string|null;cpf_cnpj?:string|null;telefone?:string|null;whatsapp?:string|null;
  endereco?:string|null;bairro?:string|null;cidade?:string|null;cep?:string|null
}
type Obra={id:string;nome:string;endereco?:string|null;numero_endereco?:string|null;
  complemento?:string|null;bairro?:string|null;cidade?:string|null;uf?:string|null;cep?:string|null}
type Vendedor={id:string;nome:string;cargo?:string|null}
const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500'
const enderecoCliente=(c:Cliente)=>[c.endereco,c.bairro,c.cidade,c.cep?'CEP '+c.cep:null].filter(Boolean).join(' · ')
const enderecoObra=(o:Obra)=>[
  [o.endereco,o.numero_endereco,o.complemento].filter(Boolean).join(', '),
  o.bairro,[o.cidade,o.uf].filter(Boolean).join(' / '),o.cep?'CEP '+o.cep:null
].filter(Boolean).join(' · ')

export default function IdentificacaoOrcamentoPreview({value,onChange}:{value:IdentificacaoOrcamento;onChange:(next:IdentificacaoOrcamento)=>void}){
  const [busca,setBusca]=useState('')
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [obras,setObras]=useState<Obra[]>([])
  const [vendedores,setVendedores]=useState<Vendedor[]>([])
  const [erro,setErro]=useState('')
  const [buscando,setBuscando]=useState(false)
  const [carregandoVendedores,setCarregandoVendedores]=useState(true)
  // Reutiliza os usuários cadastrados, pois ainda não há tabela específica de vendedores.
  useEffect(()=>{
    let ativo=true
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const [usuario,token]=await Promise.all([usuarioAtual(),tokenAtual()])
        if(!token||!usuario)throw Error('Faça login para selecionar o vendedor.')
        const resp=await fetch('/api/previews/comercial?tipo=vendedores',{
          headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'
        })
        const j=await resp.json()
        if(!resp.ok)throw Error(j.error||'Vendedores indisponíveis.')
        if(ativo){
          setVendedores(j.vendedores||[])
          if(!value.vendedorId&&usuario.id){
            onChange({...value,vendedorId:usuario.id,vendedorNome:usuario.nome||''})
          }
        }
      }catch(e){if(ativo&&!(e instanceof DOMException&&e.name==='AbortError'))setErro(e instanceof Error?e.message:'Falha ao consultar usuários.')}
      finally{if(ativo)setCarregandoVendedores(false)}
    })()
    return()=>{ativo=false;ctrl.abort()}
  // A identidade do usuário só precisa ser lida quando o formulário é montado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{
    if(busca.trim().length<2){setClientes([]);return}
    const ctrl=new AbortController()
    const timer=setTimeout(()=>void (async()=>{
      setBuscando(true)
      try{
        const token=await tokenAtual()
        if(!token)throw Error('Sessão expirada.')
        const r=await fetch('/api/previews/comercial?tipo=clientes&q='+encodeURIComponent(busca.trim()),{
          headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'
        })
        const j=await r.json()
        if(!r.ok)throw Error(j.error||'Não foi possível consultar os clientes.')
        if(!ctrl.signal.aborted)setClientes(j.clientes||[])
      }catch(e){if(!ctrl.signal.aborted)setErro(e instanceof Error?e.message:'Erro na busca.')}
      finally{if(!ctrl.signal.aborted)setBuscando(false)}
    })(),240)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[busca])
  useEffect(()=>{
    if(!value.clienteId){setObras([]);return}
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const token=await tokenAtual();if(!token)return
        const r=await fetch('/api/previews/comercial?tipo=obras&clienteId='+encodeURIComponent(value.clienteId),{
          headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'
        })
        const j=await r.json()
        if(!r.ok)throw Error(j.error||'Não foi possível consultar as obras.')
        if(!ctrl.signal.aborted)setObras(j.obras||[])
      }catch(e){if(!ctrl.signal.aborted)setErro(e instanceof Error?e.message:'Erro na consulta das obras.')}
    })()
    return()=>ctrl.abort()
  },[value.clienteId])
  function atualizar(parte:Partial<IdentificacaoOrcamento>){onChange({...value,...parte})}
  function selecionarCliente(c:Cliente){
    const endereco=enderecoCliente(c)
    atualizar({clienteId:c.id,clienteNome:c.nome,clienteDocumento:c.cpf_cnpj||'',clienteTelefone:c.whatsapp||c.telefone||'',
      enderecoCliente:endereco,entregaTipo:endereco?'cliente':'definir',obraId:'',obraNome:'',enderecoEntrega:endereco})
    setBusca('');setClientes([]);setErro('')
  }
  function escolherEntrega(tipo:IdentificacaoOrcamento['entregaTipo']){
    atualizar({entregaTipo:tipo,obraId:'',obraNome:'',
      enderecoEntrega:tipo==='cliente'?value.enderecoCliente:''})
  }
  function selecionarObra(id:string){
    const obra=obras.find(o=>o.id===id)
    atualizar({entregaTipo:'obra',obraId:id,obraNome:obra?.nome||'',enderecoEntrega:obra?enderecoObra(obra):''})
  }
  function selecionarVendedor(id:string){
    const vendedor=vendedores.find(v=>v.id===id)
    atualizar({vendedorId:id,vendedorNome:vendedor?.nome||''})
  }
  return <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
    <h2 className="flex items-center gap-2 text-base font-black"><UserRound size={19} className="text-indigo-700"/> Cliente, entrega e vendedor</h2>
    <p className="mt-1 text-xs text-slate-500">Dados para o cabeçalho do orçamento. A seleção não modifica o cadastro de clientes nem de usuários.</p>
    {erro&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{erro}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="block text-xs font-bold">Nome do cliente / responsável
        <input className={input+' mt-1'} value={value.clienteNome} onChange={e=>atualizar({
          clienteNome:e.target.value,clienteId:'',clienteDocumento:'',clienteTelefone:'',enderecoCliente:'',
          entregaTipo:'definir',obraId:'',obraNome:'',enderecoEntrega:''
        })} placeholder="Digite o nome ou selecione um cliente cadastrado"/>
      </label>
      <div className="relative">
        <label className="block text-xs font-bold" htmlFor="busca-clientes-orcamento">Buscar cliente cadastrado
          <span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-3 text-slate-400"/>
            <input id="busca-clientes-orcamento" className={input+' pl-9'} value={busca}
              onChange={e=>setBusca(e.target.value)} placeholder="Nome, CPF/CNPJ ou WhatsApp" autoComplete="off"/>
          </span>
        </label>
        {buscando&&<p className="mt-1 text-[11px] text-slate-500">Consultando clientes...</p>}
        {clientes.length>0&&<div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-white shadow-xl">
          {clientes.map(c=><button type="button" key={c.id} onClick={()=>selecionarCliente(c)}
            className="block w-full border-b px-3 py-2 text-left hover:bg-indigo-50">
            <b className="block text-xs">{c.nome}</b>
            <span className="text-[11px] text-slate-600">{[c.cidade,c.whatsapp||c.telefone].filter(Boolean).join(' · ')||'Cliente cadastrado'}</span>
          </button>)}
        </div>}
      </div>
    </div>
    {value.clienteId&&<p className="mt-2 inline-block rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Cliente identificado no cadastro do Atlas One</p>}
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="block text-xs font-bold">CPF/CNPJ do cliente (se cadastrado)
        <input className={input+' mt-1'} value={value.clienteDocumento}
          onChange={e=>atualizar({clienteDocumento:e.target.value})} placeholder="Não informado"/>
      </label>
      <label className="block text-xs font-bold">WhatsApp / telefone
        <input className={input+' mt-1'} value={value.clienteTelefone}
          onChange={e=>atualizar({clienteTelefone:e.target.value})} placeholder="Não informado"/>
      </label>
      <label className="block text-xs font-bold md:col-span-2">Endereço cadastral do cliente
        <input className={input+' mt-1'} value={value.enderecoCliente}
          onChange={e=>atualizar({enderecoCliente:e.target.value,...(value.entregaTipo==='cliente'?{enderecoEntrega:e.target.value}:{})})}
          placeholder="Rua, número, bairro, cidade, CEP — quando houver"/>
      </label>
    </div>
    <div className="mt-5 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-black"><MapPin size={17} className="text-indigo-700"/> Local da entrega / obra</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {([
          {id:'cliente',label:'Mesmo endereço do cliente'},
          {id:'obra',label:'Selecionar obra do cliente'},
          {id:'outro',label:'Outro endereço de entrega'},
          {id:'definir',label:'Local a definir'}
        ] as const).map(o=><label key={o.id}
          className={'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold '+(value.entregaTipo===o.id?'border-indigo-600 bg-indigo-50':'border-slate-200 bg-white')}>
          <input type="radio" name="entrega-orcamento" value={o.id} checked={value.entregaTipo===o.id}
            onChange={()=>escolherEntrega(o.id)} disabled={o.id==='obra'&&!value.clienteId}/>
          {o.label}
        </label>)}
      </div>
      {value.entregaTipo==='obra'&&<label className="mt-3 block text-xs font-bold">Obras vinculadas ao cliente
        <select className={input+' mt-1'} value={value.obraId} onChange={e=>selecionarObra(e.target.value)}>
          <option value="">Selecione uma obra cadastrada</option>
          {obras.map(o=><option key={o.id} value={o.id}>{o.nome} · {o.cidade||'Cidade não informada'}</option>)}
        </select>
        {!obras.length&&<span className="mt-1 block text-[11px] font-normal text-slate-500">Nenhuma obra vinculada encontrada para este cliente.</span>}
      </label>}
      {value.entregaTipo!=='definir'&&<label className="mt-3 block text-xs font-bold">Endereço da entrega / obra (no orçamento)
        <input className={input+' mt-1'} value={value.enderecoEntrega}
          onChange={e=>atualizar({enderecoEntrega:e.target.value})}
          placeholder="Informe o local da entrega, incluindo cidade"/>
      </label>}
      <p className="mt-2 text-[11px] text-slate-500">Se escolher uma obra, o endereço vem do cadastro da obra. Você pode ajustar somente o texto desta prévia.</p>
    </div>
    <div className="mt-4 border-t pt-4">
      <label className="block text-xs font-bold" htmlFor="vendedor-orcamento">
        <span className="flex items-center gap-2"><Users size={17} className="text-indigo-700"/> Vendedor / responsável comercial</span>
        <select id="vendedor-orcamento" className={input+' mt-2'} value={value.vendedorId} onChange={e=>selecionarVendedor(e.target.value)}>
          <option value="">{carregandoVendedores?'Carregando usuários...':'Selecione o vendedor'}</option>
          {vendedores.map(v=><option value={v.id} key={v.id}>{v.nome}{v.cargo?' · '+v.cargo:''}</option>)}
        </select>
      </label>
      <p className="mt-1 text-[11px] text-slate-500">Preenchido inicialmente pelo usuário logado. É possível trocar por outro usuário cadastrado da empresa.</p>
    </div>
  </section>
}
