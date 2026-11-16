'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, SlidersHorizontal, ChevronRight, RefreshCw, Tag, ShieldCheck, X, PackageSearch, Layers3 } from 'lucide-react'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'
import EditorProdutoUnitarioPreview, { type ProdutoEditavel } from '@/components/previews/EditorProdutoUnitarioPreview'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Categoria='todos'|'perfil'|'acessorio'|'vidro'|'pronto'|'outros'
type Produto=ProdutoEditavel
type Linha={id:string;nome:string;ativa:boolean}
const categorias:{id:Categoria;nome:string;icone:string}[]=[
  {id:'todos',nome:'Todos',icone:'▦'},
  {id:'perfil',nome:'Perfis',icone:'▥'},
  {id:'acessorio',nome:'Acessórios',icone:'⚙'},
  {id:'vidro',nome:'Vidros',icone:'◈'},
  {id:'pronto',nome:'Produtos prontos',icone:'▣'},
  {id:'outros',nome:'Outros',icone:'⋯'},
]
function precoProduto(p:Produto){return p.precoPromocional!=null && p.precoPromocional>0?p.precoPromocional:p.preco}
function moeda(n:number){return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function categoriaNome(v:string){return v==='perfil'?'Perfil':v==='acessorio'?'Acessório':v==='vidro'?'Vidro':(['produto','kit','pu','porta_janela_padrao'].includes(v)?'Produto pronto':v)}
export default function PreviaConsultaPreco(){
 const [busca,setBusca]=useState(''),[categoria,setCategoria]=useState<Categoria>('todos'),[linha,setLinha]=useState('')
 const [precoFiltro,setPrecoFiltro]=useState<'todos'|'com'|'sem'>('todos')
 const [produtos,setProdutos]=useState<Produto[]>([]),[linhas,setLinhas]=useState<Linha[]>([])
 const [carregando,setCarregando]=useState(false),[erro,setErro]=useState(''),[selecionado,setSelecionado]=useState<Produto|null>(null)
 const [editarProduto,setEditarProduto]=useState<Produto|null>(null)
 const [podeEditar,setPodeEditar]=useState(false)
 const alteracoesRef=useRef<Record<string,Produto>>({})
 const [versao,setVersao]=useState(0)
 const [fotosLocais,setFotosLocais]=useState<Record<string,string>>({})
 const [fotosOcultas,setFotosOcultas]=useState<Record<string,boolean>>({})
 const fotosRef=useRef<Record<string,string>>({})
 const requisicao=useRef(0)
 useEffect(()=>()=>{Object.values(fotosRef.current).forEach(url=>URL.revokeObjectURL(url))},[])
 useEffect(()=>{let ativo=true;void usuarioAtual().then(u=>{if(ativo)setPodeEditar(u?.role==='master')});return()=>{ativo=false}},[])
 function selecionarFoto(id:string,arquivo:File|null){
   const prox={...fotosRef.current}
   if(prox[id])URL.revokeObjectURL(prox[id])
   if(arquivo)prox[id]=URL.createObjectURL(arquivo)
   else delete prox[id]
   fotosRef.current=prox
   setFotosLocais(prox)
 }
 useEffect(()=>{
   const seq=++requisicao.current
   const ctrl=new AbortController()
   const timer=setTimeout(()=>{
     void (async()=>{
       setCarregando(true);setErro('')
       try{
         const token=await tokenAtual()
         if(!token)throw new Error('Faça login para consultar o cadastro.')
         const params=new URLSearchParams({tipo:'produtos',q:busca,categoria,precoFiltro})
         if(linha)params.set('linhaId',linha)
         const response=await fetch('/api/previews/comercial?'+params.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:ctrl.signal})
         const json=await response.json()
         if(!response.ok)throw new Error(json.error||'Falha na consulta.')
         if(seq!==requisicao.current)return
         setProdutos((json.produtos||[]).map((p:Produto)=>alteracoesRef.current[p.id]||p));setLinhas(json.linhas||[])
       }catch(e){
         if((e as {name?:string})?.name==='AbortError'||seq!==requisicao.current)return
         setErro(e instanceof Error?e.message:'Erro ao pesquisar.')
         setProdutos([])
       }finally{if(seq===requisicao.current)setCarregando(false)}
     })()
   },busca?240:50)
   return()=>{ctrl.abort();clearTimeout(timer)}
 },[busca,categoria,linha,precoFiltro,versao])

 function aplicarEdicao(p:Produto){
   alteracoesRef.current={...alteracoesRef.current,[p.id]:p}
   setProdutos(atual=>atual.map(x=>x.id===p.id?p:x))
   setSelecionado(p)
   setEditarProduto(null)
 }
 const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
 return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-16 pt-5 text-slate-900 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-[1430px] space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3">
     <div className="flex items-center gap-3"><Link href="/" aria-label="Voltar ao início" className="rounded-xl border bg-white p-2.5 text-slate-600 hover:bg-blue-50"><ArrowLeft size={19}/></Link>
       <div><p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">Atlas One / Comercial / Prévia</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Consulta de Preço</h1><p className="text-xs text-slate-500 sm:text-sm">Uma tela própria para pesquisar o catálogo, sem entrar na Venda Balcão.</p></div></div>
     <div className="flex items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">PRÉVIA · EDIÇÃO SIMULADA (MASTER)</span><Link href="/previews/venda" className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800">Ver tela de Venda</Link></div>
   </header>
   <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
     <div className="mb-3 flex items-center gap-2"><Search size={18} className="text-blue-700"/><h2 className="text-sm font-black">O que você quer consultar?</h2></div>
     <div className="relative">
       <Search size={20} className="absolute left-4 top-3.5 text-slate-400"/>
       <input autoFocus value={busca} onInput={e=>setBusca(e.currentTarget.value)} onCompositionUpdate={e=>setBusca(e.currentTarget.value)} placeholder="Código, nome ou descrição completa. Ex.: janela de correr duas folhas" className={input+' pl-12 pr-11 text-base'}/>
       {busca&&<button type="button" aria-label="Limpar busca" onClick={()=>setBusca('')} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17}/></button>}
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold text-slate-500">Experimente:</span>
       {['janela de correr duas folhas','roldana','puxador','SU 008'].map(v=><button type="button" key={v} onClick={()=>setBusca(v)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 hover:border-blue-300">{v}</button>)}
     </div>
     <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
       {categorias.map(c=><button key={c.id} type="button" aria-pressed={categoria===c.id} onClick={()=>{setCategoria(c.id);setLinha('');setSelecionado(null)}} className={'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition '+(categoria===c.id?'border-blue-600 bg-blue-700 text-white shadow-sm':'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300')}><span className="text-lg">{c.icone}</span>{c.nome}</button>)}
     </div>
     <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
       <label className="block"><span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-600"><Layers3 size={14}/> Filtrar pela linha técnica do produto</span>
         <select value={linha} onChange={e=>{setLinha(e.target.value);setSelecionado(null)}} className={input}><option value="">Todas as linhas vinculadas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}{!l.ativa?' (histórica)':''}</option>)}</select>
       </label>
       <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Filtrar por preço</span>
          <select value={precoFiltro} onChange={e=>setPrecoFiltro(e.target.value as 'todos'|'com'|'sem')} className={input}>
            <option value="todos">Todos os preços</option><option value="com">Com preço</option><option value="sem">Sem preço</option>
          </select>
        </label>
        <div className="flex items-end"><p className="mb-1 rounded-xl bg-blue-50 px-3 py-2.5 text-[11px] leading-relaxed text-blue-800"><ShieldCheck size={14} className="mr-1 inline"/> Produtos, linhas e preços reais do cadastro.</p></div>
       <button type="button" onClick={()=>{setBusca('');setCategoria('todos');setLinha('');setPrecoFiltro('todos');setSelecionado(null);setVersao(v=>v+1)}} className="self-end rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} className="mr-1 inline"/> Limpar filtros</button>
     </div>
   </section>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-lg font-black">Resultado da consulta</h2><p className="text-xs text-slate-500">{carregando?'Consultando o cadastro...':produtos.length+' produto(s) na seleção'} · clique em um produto para ver detalhes.</p></div>
    <div className="flex items-center gap-2 text-xs text-slate-500"><SlidersHorizontal size={15}/> {categorias.find(c=>c.id===categoria)?.nome}{linha?' · '+(linhas.find(l=>l.id===linha)?.nome||'Linha'):''}{precoFiltro!=='todos'?' · '+(precoFiltro==='com'?'Com preço':'Sem preço'):''}</div>
   </div>
   {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
   {carregando&&<div className="grid min-h-44 place-items-center rounded-2xl bg-white text-sm text-slate-500">Buscando itens no catálogo...</div>}
   {!carregando&&!erro&&produtos.length===0&&<div className="grid min-h-56 place-items-center rounded-2xl border border-dashed bg-white p-6 text-center"><div><PackageSearch size={34} className="mx-auto mb-3 text-slate-400"/><b className="text-sm">Nenhum produto cadastrado para esses filtros.</b><p className="mt-2 text-xs text-slate-500">Experimente outra descrição, linha ou categoria. Só aparecem na linha selecionada os produtos realmente vinculados a ela; cadastros sem vínculo precisam ser revisados.</p></div></div>}
   {!carregando&&produtos.length>0&&<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {produtos.map(p=><article key={p.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md">
      <FotoProdutoPreview nome={p.nome} fotoUrl={p.fotoUrl} fotoCandidataUrl={p.fotoCandidataUrl} imagemLocal={fotosLocais[p.id]} oculta={!!fotosOcultas[p.id]} onOcultarFoto={valor=>setFotosOcultas(v=>({...v,[p.id]:valor}))} onSelecionarImagem={arquivo=>selecionarFoto(p.id,arquivo)}/>
      <div className="flex min-w-0 flex-1 flex-col">
      <button type="button" onClick={()=>setSelecionado(p)} className="flex min-w-0 flex-1 flex-col text-left">
        <div className="flex items-start justify-between gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{categoriaNome(p.categoria)}</span><ChevronRight size={16} className="shrink-0 text-slate-400"/></div>
        <b className="mt-2 line-clamp-2 text-sm leading-tight">{p.nome}</b><span className="mt-1 text-[11px] text-slate-500">{p.codigo||'Sem código'}{p.linha?' · '+p.linha:''}</span>
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{p.descricao||'Sem descrição complementar cadastrada'}</p>
        <div className="mt-auto border-t border-slate-100 pt-2"><span className={precoProduto(p)!=null?'text-base font-black text-blue-700':'text-xs font-extrabold text-amber-700'}>{precoProduto(p)!=null?moeda(precoProduto(p)!):'Preço a cadastrar'}</span><span className="ml-1 text-[10px] text-slate-500">/{p.unidade}</span></div>
      </button>
      {podeEditar&&<button type="button" onClick={()=>setEditarProduto(p)} className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100">Editar cadastro · Prévia</button>}
      </div>
    </article>)}
   </div>}
   {selecionado&&<div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Detalhes do produto" onClick={()=>setSelecionado(null)}>
    <aside className="h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><b className="text-base">Ficha de consulta</b><button type="button" aria-label="Fechar" onClick={()=>setSelecionado(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button></div>
      <FotoProdutoPreview nome={selecionado.nome} fotoUrl={selecionado.fotoUrl} fotoCandidataUrl={selecionado.fotoCandidataUrl} tamanho="detalhe" imagemLocal={fotosLocais[selecionado.id]} oculta={!!fotosOcultas[selecionado.id]} onOcultarFoto={valor=>setFotosOcultas(v=>({...v,[selecionado.id]:valor}))} onSelecionarImagem={arquivo=>selecionarFoto(selecionado.id,arquivo)}/>
      <span className="mt-4 block text-[11px] font-semibold uppercase tracking-widest text-blue-700">{categoriaNome(selecionado.categoria)}</span>
      <h3 className="mt-2 text-xl font-black">{selecionado.nome}</h3>
      <p className="mt-1 text-xs text-slate-500">Código {selecionado.codigo||'não cadastrado'}</p>
      <div className="mt-4 space-y-3 border-t pt-4 text-sm"><p><b>Descrição:</b> {selecionado.descricao||'Sem descrição cadastrada'}</p><p><b>Linha:</b> {selecionado.linha||'Não vinculada'}</p><p><b>Unidade:</b> {selecionado.unidade}</p></div>
      <div className="mt-5 rounded-xl bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Preço de venda cadastrado</p><p className="mt-1 text-2xl font-black text-blue-900">{precoProduto(selecionado)!=null?moeda(precoProduto(selecionado)!):'Preço a cadastrar'}</p></div>
      <p className="mt-4 text-xs text-slate-500">Esta ficha mostra o cadastro atual e as alterações simuladas nesta sessão. Nenhuma foto, linha, custo, margem ou preço é gravado no banco.</p>
      {podeEditar&&<button type="button" onClick={()=>{setEditarProduto(selecionado);setSelecionado(null)}} className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Editar produto (prévia Master)</button>}
    </aside>
   </div>}
   {editarProduto&&podeEditar&&<EditorProdutoUnitarioPreview
     key={editarProduto.id}
     produto={alteracoesRef.current[editarProduto.id]||editarProduto}
     linhas={linhas}
     fechar={()=>setEditarProduto(null)}
     salvar={aplicarEdicao}
     imagemLocal={fotosLocais[editarProduto.id]}
     selecionarImagem={arquivo=>selecionarFoto(editarProduto.id,arquivo)}
     ocultaFoto={!!fotosOcultas[editarProduto.id]}
     ocultarFoto={valor=>setFotosOcultas(v=>({...v,[editarProduto.id]:valor}))}
   />}
   <footer className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Tag size={16} className="shrink-0"/> Todas as fotos já cadastradas para os produtos aparecem automaticamente. Se alguma imagem estiver incorreta, use “Trocar imagem” ou “Remover imagem”; as alterações são apenas nesta prévia. Os filtros por linha e preço funcionam em conjunto. A edição de descrição, custo, margem unitária, peso e linhas é simulada apenas para o Master; tipologias mantêm cálculo independente.</footer>
  </div>
 </main>
}
