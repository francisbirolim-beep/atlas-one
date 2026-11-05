'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {CheckCircle2,FileDown,ImageOff,Loader2,Plus,RefreshCw,Save,ShoppingCart,Trash2} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import type {ItemPreCompra,CategoriaPreCompra} from '@/lib/preparacaoCompraMateriaisServer'

type Rascunho={id:string;chave_item:string;categoria:CategoriaPreCompra;origem:string;codigo:string;descricao:string;
 cor:string;medida:string;unidade:string;quantidade_necessaria:number;quantidade_estoque:number;
 quantidade_comprar:number;fonte_hash:string;estoque_conferido:boolean;justificativa:string|null;
 solicitacao_id:string|null}
type Dados={ok:boolean;itens:ItemPreCompra[];rascunhos:Rascunho[];aviso:string|null;manuaisImagens?:Record<string,{imagemUrl:string|null;produtoId:string|null}>}
type Edicao={estoque:string;comprar:string;conferido:boolean;justificativa:string}
const nomes:Record<CategoriaPreCompra,string>={perfil:'Perfis · barras',acessorio:'Acessórios',vidro:'Vidros'}
const numero=(x:unknown)=>Number(x||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const n=(s:string)=>Number(s.replace(',','.'))
const api='/api/vendas/materiais/preparacao'
export default function VendaPreparacaoCompra({vendaId,obraId,pacoteId,solicitarSync=0}:{
 vendaId:string;obraId?:string|null;pacoteId?:string|null;solicitarSync?:number
}){
 const [dados,setDados]=useState<Dados|null>(null)
 const [edicoes,setEdicoes]=useState<Record<string,Edicao>>({})
 const [categoria,setCategoria]=useState<CategoriaPreCompra>('perfil')
 const [ocupado,setOcupado]=useState<string|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 const [aviso,setAviso]=useState('')
 const [linkPedido,setLinkPedido]=useState('')
 const carregar=useCallback(async()=>{
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sessão expirada.')
   const r=await fetch(api+'?vendaId='+encodeURIComponent(vendaId),{cache:'no-store',
    headers:{Authorization:'Bearer '+token}})
   const data=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(data.error||'Falha na preparação de materiais.')
   const d=data as Dados
   setDados(d)
   setEdicoes(Object.fromEntries([...d.itens,...d.rascunhos.filter(s=>s.origem==='manual').map(s=>({
    chave:s.chave_item,categoria:s.categoria,codigo:s.codigo,descricao:s.descricao,cor:s.cor,
    medida:s.medida,unidade:s.unidade,necessidade:s.quantidade_necessaria,origem:'manual' as const,
    fonteHash:'manual',imagemUrl:d.manuaisImagens?.[s.chave_item]?.imagemUrl||null,
    imagemPendente:s.categoria!=='vidro'&&!d.manuaisImagens?.[s.chave_item]?.imagemUrl,
    produtoId:d.manuaisImagens?.[s.chave_item]?.produtoId||null,
   }))].map(i=>{
    const salvo=d.rascunhos.find(s=>s.chave_item===i.chave&&s.categoria===i.categoria)
    const atual=salvo?.fonte_hash===i.fonteHash
    const estoque=atual?Number(salvo?.quantidade_estoque||0):0
    const comprar=atual?Number(salvo?.quantidade_comprar):i.necessidade
    return [i.chave,{estoque:String(estoque),comprar:String(comprar),
     conferido:Boolean(atual&&salvo?.estoque_conferido),
     justificativa:atual?salvo?.justificativa||'':''}]
   })))
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar a lista de preparação.')}
  finally{setCarregando(false)}
 },[vendaId])
 useEffect(()=>{void carregar()},[carregar,solicitarSync])
 const linhas=useMemo(()=>{
  const base=dados?.itens.filter(i=>i.categoria===categoria)||[]
  const manuais=(dados?.rascunhos||[]).filter(s=>s.categoria===categoria&&s.origem==='manual')
   .map(s=>({chave:s.chave_item,categoria:s.categoria,codigo:s.codigo,descricao:s.descricao,
    cor:s.cor,medida:s.medida,unidade:s.unidade,necessidade:s.quantidade_necessaria,
    origem:'manual' as const,fonteHash:'manual',imagemUrl:dados?.manuaisImagens?.[s.chave_item]?.imagemUrl||null,
    imagemPendente:s.categoria!=='vidro'&&!dados?.manuaisImagens?.[s.chave_item]?.imagemUrl,
    produtoId:dados?.manuaisImagens?.[s.chave_item]?.produtoId||null}))
  return [...base,...manuais]
 },[dados,categoria])
 const rascunhos=useMemo(()=>new Map((dados?.rascunhos||[]).map(s=>[s.chave_item,s])),[dados])
 const linhasConferidas=linhas.filter(i=>{
  const s=rascunhos.get(i.chave)
  return s&&s.fonte_hash===i.fonteHash&&s.estoque_conferido
 }).length
 const edicoesPendentes=linhas.some(i=>{
  const salvo=rascunhos.get(i.chave),ed=edicoes[i.chave]
  return Boolean(salvo&&ed&&(Number(ed.estoque)!==Number(salvo.quantidade_estoque)||
   Number(ed.comprar)!==Number(salvo.quantidade_comprar)||
   ed.justificativa.trim()!==(salvo.justificativa||'')||
   !ed.conferido))
 })
 const quantidadeComprar=linhas.reduce((s,i)=>{
  const salvo=rascunhos.get(i.chave)
  return s+(salvo?.fonte_hash===i.fonteHash?Number(salvo.quantidade_comprar):i.necessidade)
 },0)
 function mudar(chave:string,alteracao:Partial<Edicao>){
  setEdicoes(old=>({...old,[chave]:{...old[chave],...alteracao}}))
 }
 async function enviar(body:object,metodo:'PATCH'|'POST'){
  const token=await tokenAtual()
  if(!token)throw Error('Sessão expirada.')
  const resposta=await fetch(api,{method:metodo,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({vendaId,...body})})
  const json=await resposta.json().catch(()=>({}))
  if(!resposta.ok)throw Error(json.error||'Não foi possível salvar a conferência.')
  return json
 }
 async function salvar(i:ItemPreCompra,zerar=false){
  const ed=edicoes[i.chave]
  if(!ed)return
  const comprar=zerar?0:n(ed.comprar),estoque=n(ed.estoque)
  const justificativa=zerar
   ?window.prompt('Motivo para não comprar este material (o projeto técnico será mantido):',ed.justificativa||'Não comprar: já disponível no estoque')
   :ed.justificativa
  if(justificativa==null)return
  if(!Number.isFinite(comprar)||!Number.isFinite(estoque)||comprar<0||estoque<0){
   setErro('Informe quantidades válidas e não negativas.');return
  }
  if(!zerar&&!ed.conferido){setErro('Marque a conferência de estoque antes de salvar.');return}
  setOcupado(i.chave);setErro('');setAviso('')
  try{
   const resp=await enviar({categoria:i.categoria,chave:i.chave,fonteHash:i.fonteHash,
    estoque,comprar,justificativa,conferido:true},'PATCH')
   setDados(prev=>prev?{...prev,rascunhos:[...prev.rascunhos.filter(s=>s.chave_item!==i.chave),resp.rascunho]}:prev)
   mudar(i.chave,{comprar:String(comprar),conferido:true,justificativa})
   setAviso(i.codigo+' salvo. A composição e os cortes da tipologia continuam intactos.')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setOcupado(null)}
 }
 async function adicionar(){
  const codigo=window.prompt('Código do produto no catálogo (obrigatório):','')?.trim()
  if(!codigo)return
  const quantidade=window.prompt('Quantidade extra a comprar (não altera a tipologia):','1')
  if(quantidade==null)return
  const cor=window.prompt('Cor / acabamento:','')
  if(cor==null)return
  const medida=categoria==='vidro'?window.prompt('Medida / especificação do vidro:',''):''
  if(medida==null)return
  setOcupado('novo');setErro('')
  try{
   await enviar({acao:'adicionar',categoria,codigo,comprar:n(quantidade),cor,medida,
    justificativa:'Material incluído somente no pedido após conferência do estoque.'},'POST')
   await carregar()
   setAviso('Material extra incluído somente na preparação da compra.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao incluir material.')}
  finally{setOcupado(null)}
 }
 async function enviarCategoria(){
  if(linhasConferidas!==linhas.length||!linhas.length){setErro('Confira e salve todos os materiais desta categoria antes de enviar.');return}
  if(!window.confirm('Enviar a lista revisada de '+nomes[categoria]+' para a Central de Compras? A tipologia e o plano de corte não serão modificados.'))return
  setOcupado('enviar');setErro('')
  try{
   const res=await enviar({acao:'enviar',categoria},'POST')
   setLinkPedido(res.solicitacaoId)
   setAviso(res.itens+' itens enviados para a Central de Compras. A necessidade técnica foi preservada.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao enviar para Compras.')}
  finally{setOcupado(null)}
 }
 return <section id="materiais-preparacao-compra" className="rounded-xl border border-blue-200 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="text-base font-bold text-slate-900">Preparação de compras · Conferência do estoque</h3>
    <p className="mt-1 text-xs text-slate-600">Necessidade da obra, estoque e quantidade a comprar são independentes. Alterar ou zerar a compra <b>não modifica tipologia, peça, plano de corte ou estoque real.</b></p>
   </div>
   <button type="button" onClick={()=>void carregar()} disabled={carregando||Boolean(ocupado)}
    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40"><RefreshCw size={13}/>Atualizar necessidades</button>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   {obraId&&<Link target="_blank" href={'/obras/'+obraId+'/materiais/pdf?'+(pacoteId?'pacote='+pacoteId+'&':'')+'grupo=perfis'}
    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><FileDown size={13}/>Imprimir plano de corte (consulta)</Link>}
   <Link target="_blank" href={'/vendas/'+vendaId+'/materiais/conferencia?categoria=perfil'}
    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><FileDown size={13}/>Imprimir relação de barras · conferência</Link>
   <Link target="_blank" href={'/vendas/'+vendaId+'/materiais/conferencia?categoria='+categoria}
    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><FileDown size={13}/>Imprimir lista de {nomes[categoria].toLowerCase()} · conferência</Link>
  </div>
  {carregando&&<p role="status" className="mt-3 flex items-center gap-1 text-xs text-blue-700"><Loader2 size={13} className="animate-spin"/>Atualizando materiais...</p>}
  {erro&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700">{erro}</p>}
  {aviso&&<p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{aviso}</p>}
  {dados?.aviso&&<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{dados.aviso}</p>}
  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
   {(Object.keys(nomes) as CategoriaPreCompra[]).map(cat=><button type="button" key={cat} onClick={()=>{setCategoria(cat);setErro('');setLinkPedido('')}}
    className={'rounded-lg border px-3 py-2 text-left text-xs font-bold '+(cat===categoria?'border-blue-600 bg-blue-50 text-blue-900':'border-slate-200 text-slate-600')}>
     {nomes[cat]} <span className="block mt-1 font-normal">{(dados?.itens||[]).filter(i=>i.categoria===cat).length+(dados?.rascunhos||[]).filter(r=>r.categoria===cat&&r.origem==='manual').length} materiais</span>
   </button>)}
  </div>
  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
   <div><b>{linhasConferidas} de {linhas.length} conferidos</b><span className="ml-3 text-slate-500">Previsão atual a comprar: {numero(quantidadeComprar)}</span></div>
   <button type="button" onClick={()=>void adicionar()} disabled={Boolean(ocupado)||carregando||!dados}
    className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-40"><Plus size={13}/>Incluir somente na compra</button>
  </div>
  <div className="mt-3 overflow-x-auto rounded-lg border">
   <table className="w-full min-w-[1050px] text-left text-xs">
    <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Imagem</th><th className="p-2">Material</th><th className="p-2 text-right">Necessidade</th>
     <th className="p-2 text-right">No estoque</th><th className="p-2 text-right">Comprar</th><th className="p-2">Conferi</th><th className="p-2">Motivo / observação</th><th className="p-2">Ações</th></tr></thead>
    <tbody>{linhas.map(i=>{
     const salvo=rascunhos.get(i.chave)
     const ed=edicoes[i.chave]
     const desatualizado=salvo&&salvo.fonte_hash!==i.fonteHash
     const enviado=Boolean(salvo?.solicitacao_id)
     return <tr key={i.chave} className="border-t align-top">
      <td className="p-2">{i.imagemUrl?<img src={i.imagemUrl} alt={'Produto '+i.codigo} className="h-14 w-14 object-contain"/>:
       <span className="flex flex-col items-center gap-1 text-[10px] text-amber-700"><ImageOff size={18}/>Imagem pendente</span>}</td>
      <td className="p-2"><div className="font-mono font-bold">{i.codigo}</div><div className="max-w-[210px] font-semibold">{i.descricao}</div>
       <div className="text-[10px] text-slate-500">{i.cor}{i.medida?' · '+i.medida:''}</div>
       {i.origem==='manual'&&<div className="text-[10px] font-bold text-blue-700">Extra somente na compra</div>}
       {desatualizado&&<div className="mt-1 font-bold text-amber-700">Tipologia alterada; reconferir</div>}
       {i.categoria==='perfil'&&i.origem==='tipologia'&&i.necessidade===0&&<div className="mt-1 text-[10px] font-bold text-amber-800">Perfil novo: confira o corte para definir quantas barras comprar.</div>}
       {enviado&&<div className="mt-1 font-bold text-emerald-700">Enviado para Compras</div>}
      </td>
      <td className="p-2 text-right font-bold">{numero(i.necessidade)} {i.unidade}</td>
      <td className="p-2"><input aria-label={'Estoque de '+i.codigo} disabled={enviado||Boolean(ocupado)} type="number" min="0" step={categoria==='acessorio'?'0.001':'1'}
       value={ed?.estoque??'0'} onChange={e=>{
        const qtdEstoque=Number(e.target.value)
        mudar(i.chave,{estoque:e.target.value,comprar:String(Math.max(0,i.necessidade-qtdEstoque)),conferido:false})
       }} className="w-24 rounded border px-2 py-1 text-right"/></td>
      <td className="p-2"><input aria-label={'Comprar '+i.codigo} disabled={enviado||Boolean(ocupado)} type="number" min="0" step={categoria==='acessorio'?'0.001':'1'}
       value={ed?.comprar??String(i.necessidade)} onChange={e=>mudar(i.chave,{comprar:e.target.value,conferido:false})} className="w-24 rounded border px-2 py-1 text-right"/></td>
      <td className="p-2"><label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(ed?.conferido)} disabled={enviado||Boolean(ocupado)}
       onChange={e=>mudar(i.chave,{conferido:e.target.checked})}/><span>Sim</span></label></td>
      <td className="p-2"><textarea aria-label={'Justificativa '+i.codigo} disabled={enviado||Boolean(ocupado)}
       value={ed?.justificativa||''} onChange={e=>mudar(i.chave,{justificativa:e.target.value})}
       className="min-h-[36px] w-44 resize-y rounded border px-2 py-1" placeholder="Se alterar o cálculo, informe o motivo."/></td>
      <td className="p-2"><div className="flex flex-col gap-1">
       <button type="button" disabled={enviado||Boolean(ocupado)||!ed?.conferido} onClick={()=>void salvar(i)}
        className="inline-flex items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 font-bold text-blue-700 disabled:opacity-40"><Save size={12}/>Salvar</button>
       <button type="button" disabled={enviado||Boolean(ocupado)} onClick={()=>void salvar(i,true)}
        className="inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-slate-600 disabled:opacity-40"><Trash2 size={12}/>Não comprar</button>
       {salvo&&salvo.fonte_hash===i.fonteHash&&salvo.estoque_conferido&&!enviado&&<span className="text-center text-[10px] font-semibold text-emerald-700">Conferido e salvo</span>}
      </div></td>
     </tr>
    })}
    {!linhas.length&&<tr><td colSpan={8} className="p-5 text-center text-slate-500">{carregando?'Carregando...':'Nenhum material cadastrado nesta categoria.'}</td></tr>}
    </tbody>
   </table>
  </div>
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
   <p className="max-w-[620px] text-xs text-slate-500">Só materiais com quantidade a comprar maior que zero virarão itens da solicitação. Materiais com estoque suficiente continuam no projeto, sem gerar pedido.</p>
   <button type="button" disabled={!dados||carregando||Boolean(ocupado)||!linhas.length||linhasConferidas!==linhas.length||
     edicoesPendentes||linhas.some(i=>Boolean(rascunhos.get(i.chave)?.solicitacao_id))}
    onClick={()=>void enviarCategoria()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
    {ocupado==='enviar'?<Loader2 size={14} className="animate-spin"/>:<ShoppingCart size={14}/>}Enviar {nomes[categoria]} para Compras</button>
  </div>
  {linkPedido&&<div className="mt-3 text-xs font-semibold text-emerald-800"><CheckCircle2 size={14} className="mr-1 inline"/>Solicitação criada. <Link href="/compras/solicitacoes" className="underline">Abrir Central de Compras</Link></div>}
 </section>
}