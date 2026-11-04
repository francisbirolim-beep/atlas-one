'use client'

import {useState} from 'react'
import {AlertTriangle,ImageOff,Loader2,Search,X} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import type {MaterialResumoTipologia} from '@/lib/materiaisTipologiasResumo'

export type AcaoMaterial='ajustar'|'substituir'|'excluir'
type Produto={id:string;codigo?:string|null;nome:string;categoria?:string|null;unidade?:string|null;foto_url?:string|null;tamanho_barra_mm?:number|null}
type Form={produto_id:string;codigo:string;descricao:string;categoria:string;quantidade:string;unidade:string;cor:string;corte:string;barra:string;justificativa:string}
const rotulos:Record<AcaoMaterial,string>={ajustar:'Editar material',substituir:'Substituir material',excluir:'Excluir material'}
const foto=(url?:string|null)=>typeof url==='string'&&/^https:\/\//i.test(url)?url:null
const numero=(v:string)=>Number(v.trim().replace(',','.'))

export default function VendaMaterialEdicaoRapida({acao,material,pacoteId,vendaId,nomeTipologia,imagemAtual,onCancelar,onSalvo}:{
 acao:AcaoMaterial;material:MaterialResumoTipologia;pacoteId:string;vendaId:string;
 nomeTipologia:string;imagemAtual?:string|null;onCancelar:()=>void;onSalvo:()=>Promise<void>|void
}){
 const [form,setForm]=useState<Form>({
  produto_id:acao==='substituir'?'':material.produto_id||'',
  codigo:acao==='substituir'?'':material.codigo||'',
  descricao:acao==='substituir'?'':material.descricao,
  categoria:material.categoria,
  quantidade:String(material.quantidade_ajustada??material.quantidade_tecnica??1),
  unidade:material.unidade||'UN',
  cor:material.cor_ref||'',
  corte:material.comprimento_corte_mm!=null?String(material.comprimento_corte_mm):'',
  barra:material.comprimento_barra_mm!=null?String(material.comprimento_barra_mm):'',
  justificativa:'',
 })
 const [busca,setBusca]=useState('')
 const [produtos,setProdutos]=useState<Produto[]>([])
 const [pesquisando,setPesquisando]=useState(false)
 const [escolhido,setEscolhido]=useState<Produto|null>(null)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [gravado,setGravado]=useState(false)

 const atualizar=(chave:keyof Form,valor:string)=>setForm(prev=>({...prev,[chave]:valor}))
 async function pesquisar(){
  if(busca.trim().length<2)return
  setPesquisando(true);setErro('')
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sessão expirada. Entre novamente.')
   const resp=await fetch('/api/vendas/tipologias-materiais?modo=catalogo&busca='+encodeURIComponent(busca.trim()),{
    headers:{Authorization:'Bearer '+token},cache:'no-store',
   })
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw Error(json.error||'Não foi possível consultar o catálogo.')
   setProdutos(json.produtos||[])
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível pesquisar produtos.')}
  finally{setPesquisando(false)}
 }
 function selecionar(p:Produto){
  if(['perfil','contramarco','acessorio'].includes(form.categoria)&&!foto(p.foto_url)){
   setErro('Este perfil ou acessório não possui imagem cadastrada. Inclua o desenho/foto técnica no catálogo antes de substituir.')
   return
  }
  setEscolhido(p)
  setForm(prev=>({...prev,produto_id:p.id,codigo:p.codigo||'',descricao:p.nome,
   unidade:p.unidade||prev.unidade,barra:p.tamanho_barra_mm?String(p.tamanho_barra_mm):prev.barra}))
  setBusca(p.codigo||p.nome);setProdutos([]);setErro('')
 }
 async function confirmar(){
  if(salvando||gravado)return
  if(!material.item_ref||!pacoteId){setErro('Este material não tem vínculo válido com uma tipologia. Corrija o cadastro antes de editar.');return}
  if(form.justificativa.trim().length<5){setErro('Informe uma justificativa de pelo menos 5 caracteres.');return}
  if(acao!=='excluir'){
   const quantidade=numero(form.quantidade),corte=form.corte?numero(form.corte):null,barra=form.barra?numero(form.barra):null
   if(!form.descricao.trim()||!form.unidade.trim()||!Number.isFinite(quantidade)||quantidade<=0||quantidade>1000000||
    (corte!==null&&(!Number.isFinite(corte)||corte<0||corte>30000))||
    (barra!==null&&(!Number.isFinite(barra)||barra<0||barra>30000))){
    setErro('Confira descrição, unidade, quantidade positiva e comprimentos entre 0 e 30.000 mm.')
    return
   }
   if(acao==='substituir'&&(!escolhido||!form.produto_id||!form.codigo)){
    setErro('Selecione o novo produto com código e imagem no catálogo.')
    return
   }
  }
  const aviso=acao==='excluir'
   ?'Excluir este material somente da tipologia '+nomeTipologia+'? O histórico será preservado.'
   :'Confirmar '+rotulos[acao].toLowerCase()+' na tipologia '+nomeTipologia+'? A composição perderá a aprovação anterior e precisará de nova conferência antes de cotar.'
  if(!window.confirm(aviso))return
  setSalvando(true);setErro('')
  let persistiu=false
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sessão expirada. Entre novamente.')
   const novo={
    produto_id:form.produto_id||null,codigo:form.codigo||null,descricao:form.descricao.trim(),
    categoria:form.categoria,quantidade_ajustada:numero(form.quantidade),
    unidade:form.unidade.trim(),cor_ref:form.cor.trim()||null,
    comprimento_corte_mm:form.corte.trim()?numero(form.corte):null,
    comprimento_barra_mm:form.barra.trim()?numero(form.barra):null,
   }
   const resp=await fetch('/api/vendas/tipologias-materiais',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,pacoteId,itemRef:material.item_ref,acao,
     materialId:material.id,novo,justificativa:form.justificativa.trim()}),
   })
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw Error(json.error||'Não foi possível salvar a alteração.')
   persistiu=true
   setGravado(true)
   await onSalvo()
  }catch(e){
   setErro(persistiu?'Material alterado, mas não foi possível atualizar a lista. Atualize a composição.':
    e instanceof Error?e.message:'Falha ao salvar alteração.')
  }finally{setSalvando(false)}
 }
 const imagemSelecionada=acao==='substituir'?foto(escolhido?.foto_url):foto(imagemAtual)
 return <div role="dialog" aria-modal="true" aria-labelledby="editar-material-titulo"
  className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/65 p-3">
  <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="flex items-center justify-between border-b p-4">
    <div><h2 id="editar-material-titulo" className="text-base font-bold text-slate-900">{rotulos[acao]}</h2>
     <p className="mt-1 text-xs text-slate-500">{nomeTipologia} · {material.codigo||material.descricao}</p></div>
    <button type="button" onClick={onCancelar} disabled={salvando} aria-label="Fechar"
     className="rounded-lg border p-2 disabled:opacity-50"><X size={18}/></button>
   </header>
   <div className="space-y-4 overflow-y-auto p-4 text-xs">
    <div className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3">
     <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border bg-white">
      {imagemSelecionada?<img src={imagemSelecionada} alt={'Imagem técnica '+(form.codigo||material.codigo||'do material')} className="h-14 w-14 object-contain"/>:
       <span className="flex flex-col items-center text-center text-[10px] text-amber-700"><ImageOff size={18}/>Imagem pendente</span>}
     </div>
     <div><b>{material.codigo||'Sem código'} · {material.descricao}</b>
      <p className="mt-1 text-slate-600">Quantidade atual: {material.quantidade_ajustada??material.quantidade_tecnica??0} {material.unidade} · Cor: {material.cor_ref||'—'}</p>
      <p className="mt-1 text-slate-600">A alteração será feita apenas neste registro, mantendo as demais tipologias intactas.</p></div>
    </div>
    {acao==='excluir'?<p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
      O material será retirado da composição ativa desta tipologia. O histórico será mantido.
      A compra ou a produção já iniciada poderá impedir a exclusão.</p>:<>
     {acao==='substituir'&&<>
      <label className="block font-semibold">Categoria do novo produto
       <select value={form.categoria} onChange={e=>{atualizar('categoria',e.target.value);setEscolhido(null);setForm(prev=>({...prev,produto_id:'',codigo:'',descricao:''}));setBusca('');setProdutos([])}}
        className="mt-1 w-full rounded-lg border p-2">
        <option value="perfil">Perfil</option><option value="contramarco">Contramarco</option>
        <option value="acessorio">Acessório</option><option value="vidro">Vidro</option>
        <option value="outro">Outros</option>
       </select>
      </label>
      <label className="block font-semibold">Buscar novo produto (código ou descrição)
       <div className="mt-1 flex gap-2">
        <input value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void pesquisar()}}}
         placeholder="Digite o código ou nome" className="min-w-0 flex-1 rounded-lg border p-2"/>
        <button type="button" disabled={pesquisando||busca.trim().length<2} onClick={()=>void pesquisar()}
         className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white disabled:opacity-50">
         {pesquisando?<Loader2 size={14} className="animate-spin"/>:<Search size={14}/>} Buscar
        </button>
       </div>
      </label>
      {!!produtos.length&&<div className="max-h-48 overflow-y-auto rounded-lg border">
       {produtos.map(p=><button type="button" key={p.id} onClick={()=>selecionar(p)}
         className="flex w-full items-center gap-3 border-b p-2 text-left hover:bg-blue-50">
         {foto(p.foto_url)?<img src={p.foto_url!} alt={'Imagem '+(p.codigo||p.nome)} className="h-12 w-12 object-contain"/>:
          <span className="flex h-12 w-12 items-center justify-center text-amber-600"><ImageOff size={20}/></span>}
         <span><b>{p.codigo||'Sem código'} · {p.nome}</b>
          {!foto(p.foto_url)&&<span className="block text-amber-700">Imagem técnica pendente</span>}</span>
        </button>)}
      </div>}
     </>}
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-semibold">Código do produto
       <input value={form.codigo} readOnly className="mt-1 w-full rounded-lg border bg-slate-50 p-2"/>
      </label>
      <label className="font-semibold">Categoria
       <input value={form.categoria} readOnly className="mt-1 w-full rounded-lg border bg-slate-50 p-2"/>
      </label>
      <label className="font-semibold sm:col-span-2">Descrição
       <input value={form.descricao} maxLength={500} onChange={e=>atualizar('descricao',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
      <label className="font-semibold">Quantidade
       <input type="text" inputMode="decimal" value={form.quantidade} onChange={e=>atualizar('quantidade',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
      <label className="font-semibold">Unidade
       <input value={form.unidade} maxLength={30} onChange={e=>atualizar('unidade',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
      <label className="font-semibold">Cor / acabamento
       <input value={form.cor} maxLength={100} onChange={e=>atualizar('cor',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
      <label className="font-semibold">Comprimento de corte (mm)
       <input type="text" inputMode="decimal" value={form.corte} onChange={e=>atualizar('corte',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
      <label className="font-semibold">Comprimento da barra (mm)
       <input type="text" inputMode="decimal" value={form.barra} onChange={e=>atualizar('barra',e.target.value)}
        className="mt-1 w-full rounded-lg border p-2"/>
      </label>
     </div>
    </>}
    <label className="block font-semibold">Justificativa obrigatória
     <textarea value={form.justificativa} onChange={e=>atualizar('justificativa',e.target.value)}
      placeholder="Informe por que este material está sendo alterado" rows={3} maxLength={1000}
      className="mt-1 w-full rounded-lg border p-2"/>
    </label>
    <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
     <AlertTriangle size={16} className="shrink-0"/>Compras, reservas de estoque ou ordens de produção já avançadas impedem alterações incompatíveis.
     Após salvar, a tipologia deverá ser conferida e aprovada novamente.</p>
    {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{erro}</p>}
   </div>
   <footer className="flex justify-end gap-2 border-t p-4">
    <button type="button" disabled={salvando} onClick={onCancelar} className="rounded-lg border px-4 py-2 text-xs font-bold disabled:opacity-50">Cancelar</button>
    <button type="button" disabled={salvando||gravado} onClick={()=>void confirmar()}
     className={'inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40 '+(acao==='excluir'?'bg-red-700':'bg-blue-700')}>
     {salvando?<Loader2 size={14} className="animate-spin"/>:null}{salvando?'Salvando...':'Confirmar '+rotulos[acao].toLowerCase()}
    </button>
   </footer>
  </div>
 </div>
}
