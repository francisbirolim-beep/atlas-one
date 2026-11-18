'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, RefreshCw, UsersRound, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type Tipo='funcionario'|'prestador'|'terceiro'|'fornecedor'
type Pessoa={id:string;nome:string;tipo:Tipo;cpf_cnpj:string|null;telefone:string|null;email:string|null;endereco:string|null;cargo:string|null;setor:string|null;data_admissao:string|null;salario_base:number|null;observacoes:string|null;ativo:boolean;created_at?:string}
type FormPessoa={nome:string;tipo:Tipo;cpf_cnpj:string;telefone:string;email:string;endereco:string;cargo:string;setor:string;data_admissao:string;salario_base:string;observacoes:string;ativo:boolean}
const vazio=():FormPessoa=>({nome:'',tipo:'funcionario',cpf_cnpj:'',telefone:'',email:'',endereco:'',cargo:'',setor:'',data_admissao:'',salario_base:'',observacoes:'',ativo:true})
const tipos:Record<Tipo,string>={funcionario:'Funcionário',prestador:'Prestador de serviço',terceiro:'Terceiro',fornecedor:'Fornecedor'}
const campo='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none'
export default function PessoasRH(){
 const[pessoas,setPessoas]=useState<Pessoa[]>([])
 const [podeEditar,setPodeEditar]=useState(false)
 const[carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false)
 const[erro,setErro]=useState(''),[aviso,setAviso]=useState('')
 const[busca,setBusca]=useState(''),[filtro,setFiltro]=useState<Tipo|'todos'>('todos'),[inativos,setInativos]=useState(false)
 const[aberto,setAberto]=useState(false),[editando,setEditando]=useState('')
 const[form,setForm]=useState<FormPessoa>(vazio)
 const mudar=(campo:keyof FormPessoa,valor:string|boolean)=>setForm(p=>({...p,[campo]:valor}))
 async function carregar(){
  setCarregando(true);setErro('')
  try{
   const t=await tokenAtual()
   if(!t)throw new Error('Sessão expirada. Faça login novamente.')
   const r=await fetch('/api/rh/pessoas',{headers:{Authorization:'Bearer '+t},cache:'no-store'})
   const j=await r.json()
   if(!r.ok)throw new Error(j.error||'Não foi possível consultar RH.')
   setPessoas(j.pessoas||[]);setPodeEditar(j.podeEditar===true)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar RH.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 function iniciar(p?:Pessoa){
  setErro('');setAviso('');setEditando(p?.id||'')
  setForm(p?{nome:p.nome,tipo:p.tipo,cpf_cnpj:p.cpf_cnpj||'',telefone:p.telefone||'',email:p.email||'',endereco:p.endereco||'',cargo:p.cargo||'',setor:p.setor||'',data_admissao:p.data_admissao||'',salario_base:p.salario_base==null?'':String(p.salario_base),observacoes:p.observacoes||'',ativo:p.ativo}:vazio())
  setAberto(true)
 }
 const filtradas=useMemo(()=>pessoas.filter(p=>(inativos||p.ativo)&&(filtro==='todos'||p.tipo===filtro)&&correspondeBuscaAtlas(busca,p.nome,p.cpf_cnpj,p.cargo,p.setor,p.telefone,p.email)),[pessoas,inativos,filtro,busca])
 const totais=useMemo(()=>({ativos:pessoas.filter(p=>p.ativo).length,funcionarios:pessoas.filter(p=>p.ativo&&p.tipo==='funcionario').length,prestadores:pessoas.filter(p=>p.ativo&&p.tipo==='prestador').length}),[pessoas])
 async function salvar(e:React.FormEvent){
  e.preventDefault();setErro('')
  if(form.nome.trim().length<3){setErro('Informe o nome completo ou razão social.');return}
  setSalvando(true)
  try{
   const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
   const r=await fetch('/api/rh/pessoas',{method:editando?'PATCH':'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({...form,id:editando||undefined,salario_base:form.salario_base===''?null:Number(form.salario_base)})})
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível salvar.')
   setAberto(false);setAviso('Cadastro salvo com sucesso.');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar cadastro.')}
  finally{setSalvando(false)}
 }
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Recursos Humanos</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Cadastro de pessoas</h1><p className="mt-1 text-sm text-slate-600">Funcionários, prestadores, terceiros e fornecedores, sem criar usuário ou senha de acesso.</p></div>
   <div className="flex flex-wrap gap-2"><Link href="/rh/holerites" className="inline-flex items-center rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">Gerar holerite</Link><button onClick={()=>void carregar()} title="Atualizar" className="rounded-xl border bg-white p-2.5"><RefreshCw size={18}/></button>{podeEditar&&<button onClick={()=>iniciar()} className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>Novo cadastro</button>}</div>
  </header>
  <div className="grid grid-cols-3 gap-3">{[['Ativos',totais.ativos],['Funcionários',totais.funcionarios],['Prestadores',totais.prestadores]].map(([rotulo,valor])=><div key={rotulo} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{rotulo}</p><p className="text-2xl font-bold text-slate-900">{valor}</p></div>)}</div>
  <div className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs font-semibold text-slate-600">Pesquisar<input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome, CPF/CNPJ, cargo ou setor" className={campo}/></label><label className="text-xs font-semibold text-slate-600">Tipo<select value={filtro} onChange={e=>setFiltro(e.target.value as Tipo|'todos')} className={campo}><option value="todos">Todos os tipos</option>{Object.entries(tipos).map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label><label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" checked={inativos} onChange={e=>setInativos(e.target.checked)}/>Mostrar inativos</label></div></div>
  {aviso&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{aviso}</p>}
  {erro&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
  {carregando?<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={17}/>Carregando RH...</p>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">Nome</th><th className="p-3">Vínculo</th><th className="p-3">Cargo / setor</th><th className="p-3">Contato</th><th className="p-3">Situação</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{filtradas.map(p=><tr key={p.id} className="border-t"><td className="p-3 font-semibold">{p.nome}<div className="text-xs font-normal text-slate-500">{p.cpf_cnpj||'Documento não informado'}</div></td><td className="p-3">{tipos[p.tipo]}</td><td className="p-3">{[p.cargo,p.setor].filter(Boolean).join(' · ')||'—'}</td><td className="p-3">{p.telefone||p.email||'—'}</td><td className="p-3">{p.ativo?'Ativo':'Inativo'}</td><td className="p-3 text-right">{podeEditar?<button onClick={()=>iniciar(p)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Editar</button>:<span className="text-xs text-slate-500">Consulta</span>}</td></tr>)}</tbody></table>{!filtradas.length&&<p className="p-8 text-center text-sm text-slate-500">Nenhum cadastro encontrado.</p>}</div>}
  <p className="text-xs text-slate-500">Dados de salário e admissão ficam restritos ao RH/Master. Para criar títulos, use <Link className="font-semibold text-blue-700 underline" href="/financeiro/contas-pagar">Contas a Pagar</Link> ou <Link className="font-semibold text-blue-700 underline" href="/financeiro/contas-receber">Contas a Receber</Link>.</p>
  {podeEditar&&aberto&&<div role="dialog" aria-modal="true" aria-label="Cadastro de pessoa" className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-8"><section className="mx-auto max-w-3xl rounded-2xl border bg-white p-5 shadow-xl"><header className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{editando?'Editar cadastro':'Cadastrar pessoa'}</h2><button onClick={()=>setAberto(false)} title="Fechar" className="rounded-lg border p-2"><X size={18}/></button></header><form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
   <label className="text-xs font-semibold">Nome completo / razão social *<input required minLength={3} value={form.nome} onChange={e=>mudar('nome',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Tipo de vínculo *<select value={form.tipo} onChange={e=>mudar('tipo',e.target.value)} className={campo}>{Object.entries(tipos).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label className="text-xs font-semibold">CPF/CNPJ (opcional)<input value={form.cpf_cnpj} onChange={e=>mudar('cpf_cnpj',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Telefone<input value={form.telefone} onChange={e=>mudar('telefone',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">E-mail<input type="email" value={form.email} onChange={e=>mudar('email',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Endereço<input value={form.endereco} onChange={e=>mudar('endereco',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Cargo / função<input value={form.cargo} onChange={e=>mudar('cargo',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Setor<input value={form.setor} onChange={e=>mudar('setor',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Data de admissão (se aplicável)<input type="date" value={form.data_admissao} onChange={e=>mudar('data_admissao',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold">Salário base em R$ (se aplicável)<input type="number" min="0" step=".01" value={form.salario_base} onChange={e=>mudar('salario_base',e.target.value)} className={campo}/></label>
   <label className="text-xs font-semibold sm:col-span-2">Observações<textarea rows={3} value={form.observacoes} onChange={e=>mudar('observacoes',e.target.value)} className={campo}/></label>
   <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.ativo} onChange={e=>mudar('ativo',e.target.checked)}/>Cadastro ativo</label>
   <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={()=>setAberto(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} className="rounded-lg bg-blue-900 px-5 py-2 text-sm font-bold text-white">{salvando?'Salvando...':'Salvar cadastro'}</button></div>
  </form></section></div>}
 </div></main>
}
