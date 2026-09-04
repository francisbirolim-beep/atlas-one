'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, History, Pencil, Plus, ShieldAlert, Trash2, Truck } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { listarFornecedores, criarFornecedor, atualizarFornecedor, alternarAtivoFornecedor, excluirFornecedor } from '@/lib/fornecedores'
import { Fornecedor } from '@/lib/tipos'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type FornecedorComercial = Fornecedor & {
  whatsapp?: string | null
  pedido_minimo?: number | null
  frete_gratis_minimo?: number | null
  prazo_medio_dias?: number | null
  condicao_pagamento_padrao?: string | null
  observacoes_comerciais?: string | null
}

type FormFornecedor = {
  nome: string; cnpj_cpf: string; contato: string; telefone: string; whatsapp: string; email: string; endereco: string; cidade: string; observacoes: string
  pedido_minimo: string; frete_gratis_minimo: string; prazo_medio_dias: string; condicao_pagamento_padrao: string; observacoes_comerciais: string
}

const vazio: FormFornecedor = { nome:'', cnpj_cpf:'', contato:'', telefone:'', whatsapp:'', email:'', endereco:'', cidade:'', observacoes:'', pedido_minimo:'', frete_gratis_minimo:'', prazo_medio_dias:'', condicao_pagamento_padrao:'', observacoes_comerciais:'' }

function numero(v:string) { const t=v.trim().replace(',','.'); if(!t) return null; const n=Number(t); return Number.isFinite(n)?n:null }
function moeda(v:number|null|undefined) { return v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function formFornecedor(f:FornecedorComercial):FormFornecedor { return { nome:f.nome, cnpj_cpf:f.cnpj_cpf||'', contato:f.contato||'', telefone:f.telefone||'', whatsapp:f.whatsapp||'', email:f.email||'', endereco:f.endereco||'', cidade:f.cidade||'', observacoes:f.observacoes||'', pedido_minimo:f.pedido_minimo!=null?String(f.pedido_minimo):'', frete_gratis_minimo:f.frete_gratis_minimo!=null?String(f.frete_gratis_minimo):'', prazo_medio_dias:f.prazo_medio_dias!=null?String(f.prazo_medio_dias):'', condicao_pagamento_padrao:f.condicao_pagamento_padrao||'', observacoes_comerciais:f.observacoes_comerciais||'' } }

export default function Fornecedores() {
  const [carregando,setCarregando]=useState(true)
  const [euSouMaster,setEuSouMaster]=useState<boolean|null>(null)
  const [fornecedores,setFornecedores]=useState<FornecedorComercial[]>([])
  const [busca,setBusca]=useState('')
  const [novoAberto,setNovoAberto]=useState(false)
  const [form,setForm]=useState<FormFornecedor>(vazio)
  const [editandoId,setEditandoId]=useState<string|null>(null)
  const [editForm,setEditForm]=useState<Record<string,FormFornecedor>>({})
  const [salvando,setSalvando]=useState(false)
  const [salvandoEdicaoId,setSalvandoEdicaoId]=useState<string|null>(null)
  const [erro,setErro]=useState('')
  const [sucesso,setSucesso]=useState('')

  useEffect(()=>{ void carregar() },[])

  async function carregar() {
    setCarregando(true)
    const me=await usuarioAtual()
    setEuSouMaster(me?.role==='master')
    if(me?.role==='master') setFornecedores((await listarFornecedores()) as FornecedorComercial[])
    setCarregando(false)
  }

  const filtrados=useMemo(()=>!busca.trim()?fornecedores:fornecedores.filter(f=>correspondeBuscaAtlas(busca,f.nome,f.cnpj_cpf,f.contato,f.telefone,f.whatsapp,f.email,f.endereco,f.cidade,f.observacoes,f.condicao_pagamento_padrao,f.observacoes_comerciais,f.ativo?'ativo':'inativo')),[fornecedores,busca])
  function campo(c:keyof FormFornecedor,v:string){setForm(p=>({...p,[c]:v}))}
  function iniciarEdicao(f:FornecedorComercial){setEditandoId(f.id);setEditForm(p=>({...p,[f.id]:formFornecedor(f)}))}
  function campoEd(id:string,c:keyof FormFornecedor,v:string){setEditForm(p=>({...p,[id]:{...p[id],[c]:v}}))}
  function payload(d:FormFornecedor){return{nome:d.nome.trim(),cnpj_cpf:d.cnpj_cpf.trim()||null,contato:d.contato.trim()||null,telefone:d.telefone.trim()||null,whatsapp:d.whatsapp.trim()||null,email:d.email.trim()||null,endereco:d.endereco.trim()||null,cidade:d.cidade.trim()||null,observacoes:d.observacoes.trim()||null,pedido_minimo:numero(d.pedido_minimo),frete_gratis_minimo:numero(d.frete_gratis_minimo),prazo_medio_dias:d.prazo_medio_dias.trim()?Math.max(0,Math.round(numero(d.prazo_medio_dias)||0)):null,condicao_pagamento_padrao:d.condicao_pagamento_padrao.trim()||null,observacoes_comerciais:d.observacoes_comerciais.trim()||null}}

  async function cadastrar(e:React.FormEvent){e.preventDefault();setErro('');setSucesso('');if(!form.nome.trim())return setErro('Preencha o nome do fornecedor.');setSalvando(true);const me=await usuarioAtual();const{error}=await criarFornecedor({...payload(form),criado_por_id:me?.id||null,criado_por_nome:me?.nome||null});setSalvando(false);if(error)return setErro('Erro ao cadastrar fornecedor.');setSucesso(`Fornecedor ${form.nome} cadastrado com sucesso.`);setForm(vazio);setNovoAberto(false);setFornecedores((await listarFornecedores()) as FornecedorComercial[])}
  async function salvarEd(id:string){const d=editForm[id];if(!d?.nome.trim())return;setSalvandoEdicaoId(id);const{error}=await atualizarFornecedor(id,payload(d));if(error)setErro('Não foi possível salvar o fornecedor.');setFornecedores((await listarFornecedores()) as FornecedorComercial[]);setSalvandoEdicaoId(null);if(!error)setEditandoId(null)}
  async function alternar(f:FornecedorComercial){await alternarAtivoFornecedor(f.id,!f.ativo);setFornecedores((await listarFornecedores()) as FornecedorComercial[])}
  async function excluir(f:FornecedorComercial){if(!window.confirm(`Excluir o fornecedor "${f.nome}"? O histórico será preservado.`))return;await excluirFornecedor(f.id);setFornecedores((await listarFornecedores()) as FornecedorComercial[])}

  if(carregando)return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  if(!euSouMaster)return <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center"><ShieldAlert size={40} className="text-slate-300"/><p className="text-slate-500">Só o usuário master pode acessar Fornecedores.</p><Link href="/cadastros" className="text-brand-navy text-sm">Voltar</Link></div>

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
    <header className="bg-white border-b"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4"><Link href="/cadastros" className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20}/></Link><Truck size={22} className="text-brand-navy"/><div className="flex-1"><h1 className="text-lg font-bold">Fornecedores</h1><p className="text-sm text-slate-500">Abra o fornecedor para acessar a central completa de relacionamento, compras e catálogos</p></div><Link href="/cadastro/historico" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><History size={15}/>Histórico</Link><button onClick={()=>setNovoAberto(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white"><Plus size={15}/>Novo</button></div></header>

    <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {sucesso&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</div>}
      {novoAberto&&<form onSubmit={cadastrar} className="rounded-2xl border bg-white p-4 space-y-3"><h2 className="font-semibold">Novo fornecedor</h2><Form dados={form} onCampo={campo}/><div className="flex gap-2"><button disabled={salvando} className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white">{salvando?'Salvando...':'Cadastrar'}</button><button type="button" onClick={()=>setNovoAberto(false)} className="rounded-xl border px-4 py-2.5 text-sm">Cancelar</button></div></form>}

      <section className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Buscar fornecedor, condição, cidade, contato..." containerClassName="flex-1" inputClassName="w-full rounded-xl border py-2.5 pr-3 text-sm"/><span className="text-xs text-slate-400">{filtrados.length} resultado(s)</span></div>
        <div className="space-y-2">
          {filtrados.map(f=><div key={f.id} className="rounded-xl border border-slate-200 transition hover:border-slate-300 hover:shadow-sm">
            {editandoId===f.id ? <div className="space-y-3 p-4"><Form dados={editForm[f.id]||vazio} onCampo={(c,v)=>campoEd(f.id,c,v)}/><div className="flex gap-2"><button onClick={()=>void salvarEd(f.id)} disabled={salvandoEdicaoId===f.id} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">{salvandoEdicaoId===f.id?'Salvando...':'Salvar'}</button><button onClick={()=>setEditandoId(null)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button></div></div> : <>
              <Link href={`/fornecedores/${f.id}`} className="group flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className={`text-base font-semibold group-hover:text-brand-navy ${f.ativo?'text-slate-800':'text-slate-400 line-through'}`}>{f.nome}</div>
                  <div className="mt-1 text-xs text-slate-500">{[f.cnpj_cpf,f.contato,f.whatsapp||f.telefone,f.email,f.cidade].filter(Boolean).join(' • ')||'Sem dados adicionais'}</div>
                  {f.endereco&&<div className="text-xs text-slate-400">{f.endereco}</div>}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-600">{f.pedido_minimo!=null&&<span className="rounded bg-slate-100 px-2 py-1">Pedido mín. {moeda(f.pedido_minimo)}</span>}{f.frete_gratis_minimo!=null&&<span className="rounded bg-slate-100 px-2 py-1">Frete grátis ≥ {moeda(f.frete_gratis_minimo)}</span>}{f.prazo_medio_dias!=null&&<span className="rounded bg-slate-100 px-2 py-1">Prazo {f.prazo_medio_dias} dia(s)</span>}{f.condicao_pagamento_padrao&&<span className="rounded bg-slate-100 px-2 py-1">{f.condicao_pagamento_padrao}</span>}</div>
                </div>
                <div className="flex items-center gap-3"><span className={`rounded-full px-2 py-1 text-xs ${f.ativo?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{f.ativo?'Ativo':'Inativo'}</span><ChevronRight size={19} className="text-slate-300 group-hover:text-brand-navy"/></div>
              </Link>
              <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-xs">
                <Link href={`/fornecedores/${f.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-navy"><Truck size={12}/>Abrir Fornecedor 360</Link>
                <button onClick={()=>iniciarEdicao(f)} className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-navy"><Pencil size={12}/>Editar cadastro</button>
                <button onClick={()=>void alternar(f)} className="text-slate-500">{f.ativo?'Desativar':'Ativar'}</button>
                <button onClick={()=>void excluir(f)} className="inline-flex items-center gap-1 text-red-500"><Trash2 size={12}/>Excluir</button>
              </div>
            </>}
          </div>)}
          {!filtrados.length&&<p className="py-8 text-center text-sm text-slate-400">Nenhum fornecedor encontrado.</p>}
        </div>
      </section>
    </main>
  </div>
}

function Form({dados,onCampo}:{dados:FormFornecedor;onCampo:(c:keyof FormFornecedor,v:string)=>void}){return <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-2"><Campo label="Nome / razão social *" valor={dados.nome} onChange={v=>onCampo('nome',v)}/><Campo label="CNPJ / CPF" valor={dados.cnpj_cpf} onChange={v=>onCampo('cnpj_cpf',v)}/><Campo label="Contato" valor={dados.contato} onChange={v=>onCampo('contato',v)}/><Campo label="Telefone" valor={dados.telefone} onChange={v=>onCampo('telefone',v)}/><Campo label="WhatsApp" valor={dados.whatsapp} onChange={v=>onCampo('whatsapp',v)}/><Campo label="E-mail" valor={dados.email} onChange={v=>onCampo('email',v)}/><Campo label="Cidade" valor={dados.cidade} onChange={v=>onCampo('cidade',v)}/><Campo label="Endereço" valor={dados.endereco} onChange={v=>onCampo('endereco',v)}/></div><div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Condições comerciais para cotação</p><div className="grid gap-2 sm:grid-cols-2"><Campo label="Pedido mínimo (R$)" valor={dados.pedido_minimo} onChange={v=>onCampo('pedido_minimo',v)}/><Campo label="Frete grátis a partir de (R$)" valor={dados.frete_gratis_minimo} onChange={v=>onCampo('frete_gratis_minimo',v)}/><Campo label="Prazo médio de entrega (dias)" valor={dados.prazo_medio_dias} onChange={v=>onCampo('prazo_medio_dias',v)}/><Campo label="Condição de pagamento padrão" valor={dados.condicao_pagamento_padrao} onChange={v=>onCampo('condicao_pagamento_padrao',v)}/><label className="sm:col-span-2 text-xs text-slate-500">Observações comerciais<textarea value={dados.observacoes_comerciais} onChange={e=>onCampo('observacoes_comerciais',e.target.value)} rows={2} className="mt-1 w-full rounded-xl border p-2.5 text-sm" placeholder="Ex.: entrega terça e quinta, desconto no PIX, contato do vendedor..."/></label></div></div><label className="block text-xs text-slate-500">Observações gerais<textarea value={dados.observacoes} onChange={e=>onCampo('observacoes',e.target.value)} rows={2} className="mt-1 w-full rounded-xl border p-2.5 text-sm"/></label></div>}
function Campo({label,valor,onChange}:{label:string;valor:string;onChange:(v:string)=>void}){return <label className="text-xs text-slate-500">{label}<input value={valor} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm"/></label>}
