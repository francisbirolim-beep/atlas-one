'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Local = {id:string;codigo:string;nome:string}
type Produto = {
 id:string; codigo:string|null;nome:string;categoria:string;unidade:string|null
 fotoUrl:string|null;fotoPendente:boolean;custoReferencia:number|null
 saldoId:string|null;atualizadoEm:string|null;fisico:number|null;reservado:number|null
}
type Contagem = {produto:Produto;quantidade:string}
type Inventario = {id:string;status:string;created_at:string;criado_por_nome:string;local_id:string}
const n=(x:number|null)=>x==null?'Não inventariado':Number(x).toLocaleString('pt-BR',{maximumFractionDigits:3})

export default function InventarioInicialPage(){
 const router=useRouter()
 const [locais,setLocais]=useState<Local[]>([])
 const [inventarios,setInventarios]=useState<Inventario[]>([])
 const [localId,setLocalId]=useState('')
 const [pesquisa,setPesquisa]=useState('')
 const [resultados,setResultados]=useState<Produto[]>([])
 const [contagens,setContagens]=useState<Contagem[]>([])
 const [observacoes,setObservacoes]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [buscando,setBuscando]=useState(false)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [aviso,setAviso]=useState('')

 async function consultar(q='',local=''){
  const token=await tokenAtual()
  if(!token)throw new Error('Sessão expirada.')
  const params=new URLSearchParams()
  if(q)params.set('q',q)
  if(local)params.set('localId',local)
  const resp=await fetch('/api/estoque/inventario?'+params.toString(),{
   headers:{Authorization:'Bearer '+token},cache:'no-store'
  })
  const json=await resp.json().catch(()=>({}))
  if(!resp.ok)throw new Error(json.error||'Erro ao consultar inventário.')
  return json
 }
 useEffect(()=>{
  let ativo=true
  async function iniciar(){
   try{
    const json=await consultar()
    if(!ativo)return
    setLocais(json.locais||[])
    setLocalId(json.locais?.[0]?.id||'')
    setInventarios(json.inventarios||[])
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Falha ao carregar.')}
   finally{if(ativo)setCarregando(false)}
  }
  iniciar()
  return ()=>{ativo=false}
 },[])

 async function buscar(){
  if(pesquisa.trim().length<2){setErro('Digite pelo menos duas letras ou um código.');return}
  if(!localId){setErro('Selecione o local do estoque.');return}
  setBuscando(true);setErro('');setAviso('')
  try{const json=await consultar(pesquisa,localId);setResultados(json.produtos||[])}
  catch(e){setErro(e instanceof Error?e.message:'Erro na busca.')}
  finally{setBuscando(false)}
 }
 function adicionar(p:Produto){
  if(contagens.some(l=>l.produto.id===p.id))return
  if(contagens.length>=100){setErro('Limite de 100 produtos por contagem. Salve esta e abra outra.');return}
  setContagens(xs=>[...xs,{produto:p,quantidade:''}])
  setAviso('Produto adicionado. Informe a quantidade física realmente contada.')
 }
 function trocarLocal(id:string){
  if(contagens.length&&!window.confirm('Trocar o local descarta as contagens ainda não salvas. Continuar?'))return
  setLocalId(id);setResultados([]);setContagens([]);setAviso('');setErro('')
 }
 async function salvar(){
  if(!contagens.length){setErro('Adicione pelo menos um produto.');return}
  if(contagens.some(c=>c.quantidade.trim()===''||!Number.isFinite(Number(c.quantidade))||Number(c.quantidade)<0)){
   setErro('Informe a contagem física de todos os produtos, inclusive zero quando conferido.');return
  }
  if(!window.confirm('Salvar a contagem para revisão? Isto NÃO altera o estoque.'))return
  setSalvando(true);setErro('');setAviso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/estoque/inventario',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({localId,observacoes,itens:contagens.map(c=>({
     produtoId:c.produto.id,quantidadeContada:Number(c.quantidade),
     esperadoSaldoId:c.produto.saldoId,esperadoAtualizadoEm:c.produto.atualizadoEm,
     esperadoFisico:c.produto.fisico
    }))})
   })
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw new Error(json.error||'Não foi possível salvar a contagem.')
   router.push('/estoque/inventario/'+json.inventarioId)
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar contagem.')}
  finally{setSalvando(false)}
 }
 if(carregando)return <main className="p-6 text-slate-600"><Loader2 className="inline animate-spin" size={18}/> Carregando inventário...</main>
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
  <header>
   <Link href="/estoque" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Voltar ao estoque</Link>
   <h1 className="mt-3 text-2xl font-bold text-slate-900">Inventário inicial e contagem física</h1>
   <p className="mt-1 text-sm text-slate-600">Conte o que existe na empresa. Salvar uma contagem cria uma revisão, sem alterar saldos ou custos da Engenharia.</p>
  </header>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</p>}
  {aviso&&<p className="rounded-xl border bg-white p-3 text-sm text-slate-600">{aviso}</p>}
  <section className="rounded-2xl border bg-white p-5">
   <div className="grid gap-3 md:grid-cols-[260px_1fr_auto]">
    <label className="text-sm font-medium text-slate-700">Local a conferir
     <select value={localId} onChange={e=>trocarLocal(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5">
      {locais.map(l=><option key={l.id} value={l.id}>{l.nome} ({l.codigo})</option>)}
     </select>
    </label>
    <label className="text-sm font-medium text-slate-700">Buscar perfil, acessório ou outro produto
     <input value={pesquisa} onChange={e=>setPesquisa(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter')buscar()}}
       placeholder="Código ou nome do produto"
       className="mt-1 w-full rounded-lg border px-3 py-2.5"/>
    </label>
    <button onClick={buscar} disabled={buscando||!localId}
      className="self-end inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
      {buscando?<Loader2 className="animate-spin" size={18}/>:<Search size={18}/>} Buscar
    </button>
   </div>
   {!!resultados.length&&<div className="mt-5 overflow-x-auto"><table className="min-w-[800px] w-full text-sm">
    <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Imagem</th><th className="p-2">Produto / código</th><th className="p-2 text-right">Saldo do Atlas</th><th className="p-2 text-right">Reservado</th><th className="p-2">Ação</th></tr></thead>
    <tbody>{resultados.map(p=><tr key={p.id} className="border-t">
     <td className="p-2">{['perfil','acessorio'].includes(p.categoria)&&<Foto produto={p}/>}</td>
     <td className="p-2"><div className="font-semibold">{p.codigo||'—'} — {p.nome}</div><div className="text-xs text-slate-500">{p.unidade||'un.'}{p.fotoPendente?' • Imagem pendente':''}</div></td>
     <td className="p-2 text-right">{n(p.fisico)}</td>
     <td className="p-2 text-right">{p.reservado==null?'—':n(p.reservado)}</td>
     <td className="p-2"><button disabled={contagens.some(c=>c.produto.id===p.id)} onClick={()=>adicionar(p)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"><Plus size={15}/> Adicionar</button></td>
    </tr>)}</tbody>
   </table></div>}
  </section>
  <section className="rounded-2xl border bg-white p-5">
   <div className="flex items-center gap-2"><ClipboardList size={20}/><h2 className="font-bold">Produtos contados ({contagens.length})</h2></div>
   <p className="mt-1 text-sm text-slate-600">Informe a quantidade real no local selecionado; zero significa que conferiu e não encontrou o material. Produto não inventariado não significa estoque zero.</p>
   {!contagens.length?<p className="py-8 text-center text-sm text-slate-500">Busque e adicione os materiais que deseja conferir.</p>:
    <div className="mt-4 space-y-3">{contagens.map(c=><div key={c.produto.id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_150px_90px] md:items-center">
     <div className="flex gap-3">
      {['perfil','acessorio'].includes(c.produto.categoria)&&<Foto produto={c.produto}/>}
      <div><p className="font-semibold">{c.produto.codigo||'—'} — {c.produto.nome}</p>
       <p className="text-xs text-slate-500">Saldo no Atlas: {n(c.produto.fisico)} • {c.produto.unidade||'un.'}</p>
       {c.quantidade!==''&&c.produto.fisico!=null&&<p className="text-xs text-slate-500">Diferença prevista: {n(Number(c.quantidade)-c.produto.fisico)}</p>}
      </div>
     </div>
     <label className="text-xs font-medium text-slate-600">Quantidade física
      <input type="number" min="0" step="any" value={c.quantidade}
       onChange={e=>setContagens(xs=>xs.map(x=>x.produto.id===c.produto.id?{...x,quantidade:e.target.value}:x))}
       className="mt-1 w-full rounded-lg border px-3 py-2 text-base"/>
     </label>
     <button aria-label={'Remover '+c.produto.nome} onClick={()=>setContagens(xs=>xs.filter(x=>x.produto.id!==c.produto.id))} className="justify-self-end rounded-lg border p-3"><Trash2 size={16}/></button>
    </div>)}</div>}
   <label className="mt-4 block text-sm font-medium text-slate-700">Observações da contagem
    <textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={2} placeholder="Onde foi contado, diferenças encontradas, responsável..." className="mt-1 w-full rounded-lg border p-3"/>
   </label>
   <div className="mt-4 flex justify-end"><button onClick={salvar} disabled={salvando||!contagens.length} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-40">{salvando?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>} Salvar contagem para aprovação</button></div>
  </section>
  <section className="rounded-2xl border bg-white p-5">
   <h2 className="font-bold">Contagens registradas</h2>
   <div className="mt-3 space-y-2">{inventarios.map(i=><Link key={i.id} href={'/estoque/inventario/'+i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-slate-50">
    <span>{new Date(i.created_at).toLocaleString('pt-BR')} • {i.criado_por_nome}</span>
    <span className="font-semibold">{i.status==='rascunho'?'Aguardando aprovação':i.status==='aplicado'?'Aplicado':'Cancelado'}</span>
   </Link>)}{!inventarios.length&&<p className="text-sm text-slate-500">Nenhuma contagem salva.</p>}</div>
  </section>
 </div></main>
}
function Foto({produto}:{produto:Produto}){
 return produto.fotoUrl
  ?<img src={produto.fotoUrl} alt={'Imagem do produto '+produto.nome} className="h-14 w-14 shrink-0 rounded-lg border object-contain"/>
  :<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-center text-[10px] text-amber-800">Foto pendente</div>
}
