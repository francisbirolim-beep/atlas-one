'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, History, ImageOff, Loader2, Pencil, Plus, RefreshCw, Replace, Search, Trash2, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Material={
 id:string;item_ref?:string|null;produto_id?:string|null;categoria:string;codigo?:string|null;
 descricao:string;unidade:string;cor_ref?:string|null;quantidade_ajustada?:number|null;
 comprimento_corte_mm?:number|null;comprimento_barra_mm?:number|null;status_compra?:string|null;
 incluido_manual?:boolean|null;justificativa_ajuste?:string|null;wvetro_dados?:Record<string,any>|null
}
type Produto={id:string;codigo?:string|null;nome:string;categoria?:string|null;unidade?:string|null;foto_url?:string|null;tamanho_barra_mm?:number|null}
type Registro={id:string;acao:string;created_at:string;usuario_nome:string|null;justificativa:string;antes:any;depois:any}
type Acao='incluir'|'substituir'|'excluir'|'ajustar'
type Grupo='perfis'|'acessorios'|'vidros'|'servicos'|'variaveis'|'formulas'
type Formulario={produto_id:string;codigo:string;descricao:string;categoria:string;quantidade_ajustada:string;unidade:string;cor_ref:string;comprimento_corte_mm:string;comprimento_barra_mm:string;justificativa:string}
const grupos:{id:Grupo;nome:string}[]=[
 {id:'perfis',nome:'Perfis'},{id:'acessorios',nome:'Acessórios'},{id:'vidros',nome:'Vidros'},
 {id:'servicos',nome:'Serviços / Outros'},{id:'variaveis',nome:'Variáveis'},
 {id:'formulas',nome:'Fórmulas Padrão'}
]
const padrao:Formulario={produto_id:'',codigo:'',descricao:'',categoria:'perfil',quantidade_ajustada:'1',unidade:'UN',cor_ref:'',comprimento_corte_mm:'',comprimento_barra_mm:'',justificativa:''}
const nomeAcao:Record<Acao,string>={incluir:'Incluir material',substituir:'Substituir material',excluir:'Excluir material',ajustar:'Alterar quantidade / corte'}
const categoriaDoGrupo=(g:Grupo,cat:string)=>g==='perfis'?['perfil','contramarco'].includes(cat):g==='acessorios'?cat==='acessorio':g==='vidros'?cat==='vidro':g==='servicos'?!['perfil','contramarco','acessorio','vidro'].includes(cat):false
const n=(x:unknown)=>Number(x||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const url=(s:string)=>s.startsWith('http://')||s.startsWith('https://')?s:null
export default function VendaTipologiasMateriais({itens,materiais,pacoteId,vendaId,imagensProdutos,onAtualizar}:{
 itens:any[];materiais:Material[];pacoteId:string|null;vendaId:string;
 imagensProdutos:Record<string,{foto_url?:string|null}>;onAtualizar:()=>Promise<void>
}){
 const [aberta,setAberta]=useState<string|null>(null)
 const [grupo,setGrupo]=useState<Grupo>('perfis')
 const [imagens,setImagens]=useState<Record<string,string>>({})
 const [historico,setHistorico]=useState<Registro[]>([])
 const [mostrarHistorico,setMostrarHistorico]=useState(false)
 const [master,setMaster]=useState(false)
 const [carregando,setCarregando]=useState(false)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const [acao,setAcao]=useState<Acao|null>(null)
 const [materialEditando,setMaterialEditando]=useState<Material|null>(null)
 const [form,setForm]=useState<Formulario>(padrao)
 const [busca,setBusca]=useState('')
 const [resultados,setResultados]=useState<Produto[]>([])
 const [pesquisando,setPesquisando]=useState(false)
 const itensComRef=useMemo(()=>itens.map((item,i)=>({...item,ref:String(item.id||''),indice:i})),[itens])
 const dadosAtuais=itensComRef.find(i=>i.ref&&i.ref===aberta)
 const materiaisAtuais=useMemo(()=>materiais.filter(m=>m.item_ref&&m.item_ref===aberta),[materiais,aberta])
 const visiveis=materiaisAtuais.filter(m=>categoriaDoGrupo(grupo,m.categoria))
 useEffect(()=>{void usuarioAtual().then(u=>setMaster(u?.role==='master'))},[])
 useEffect(()=>{
  if(!aberta||!pacoteId)return
  let vivo=true
  setHistorico([]);setErro('');setMostrarHistorico(false)
  void(async()=>{
   setCarregando(true)
   try{
    const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
    const codigos=[...new Set(materiais.filter(m=>m.item_ref===aberta).map(m=>m.codigo||'').filter(Boolean))].slice(0,130)
    const headers={Authorization:'Bearer '+token}
    const chamadas=[fetch('/api/vendas/tipologias-materiais?vendaId='+encodeURIComponent(vendaId)+'&pacoteId='+encodeURIComponent(pacoteId)+'&itemRef='+encodeURIComponent(aberta),{headers,cache:'no-store'})]
    if(codigos.length)chamadas.push(fetch('/api/vendas/tipologias-materiais?modo=imagens&codigos='+encodeURIComponent(codigos.join('|')),{headers,cache:'no-store'}))
    const respostas=await Promise.all(chamadas)
    const dados=await Promise.all(respostas.map(r=>r.json()))
    if(!respostas[0].ok)throw Error(dados[0].error||'Histórico indisponível.')
    if(vivo){setHistorico(dados[0].historico||[]);setImagens({...imagens,...(dados[1]?.imagens||{})})}
   }catch(e){if(vivo)setErro(e instanceof Error?e.message:'Não foi possível carregar os detalhes.')}
   finally{if(vivo)setCarregando(false)}
  })()
  return()=>{vivo=false}
 },[aberta,pacoteId,vendaId,materiais.length])
 async function pesquisar(){
  if(busca.trim().length<2)return
  setPesquisando(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const r=await fetch('/api/vendas/tipologias-materiais?modo=catalogo&busca='+encodeURIComponent(busca.trim()),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json()
   if(!r.ok)throw Error(json.error||'Falha ao buscar produtos.')
   setResultados(json.produtos||[])
  }catch(e){setErro(e instanceof Error?e.message:'Falha no catálogo.')}
  finally{setPesquisando(false)}
 }
 function abrirEdicao(tipo:Acao,material:Material|null=null){
  setErro('');setBusca('');setResultados([])
  setMaterialEditando(material);setAcao(tipo)
  setForm({...padrao,produto_id:tipo==='substituir'?'':material?.produto_id||'',codigo:tipo==='substituir'?'':material?.codigo||'',descricao:tipo==='substituir'?'':material?.descricao||'',
   categoria:material?.categoria|| (grupo==='perfis'?'perfil':grupo==='acessorios'?'acessorio':grupo==='vidros'?'vidro':'outro'),
   quantidade_ajustada:String(material?.quantidade_ajustada||1),unidade:material?.unidade||'UN',
   cor_ref:material?.cor_ref||'',comprimento_corte_mm:material?.comprimento_corte_mm!=null?String(material.comprimento_corte_mm):'',
   comprimento_barra_mm:material?.comprimento_barra_mm!=null?String(material.comprimento_barra_mm):'',justificativa:''})
 }
 function escolherProduto(p:Produto){
  if(p.codigo&&!p.foto_url){setErro('Produto com código sem imagem técnica: cadastre a imagem antes de incluí-lo.');return}
  setForm(prev=>({...prev,produto_id:p.id,codigo:p.codigo||'',descricao:p.nome,unidade:p.unidade||prev.unidade,
    comprimento_barra_mm:p.tamanho_barra_mm?String(p.tamanho_barra_mm):prev.comprimento_barra_mm}))
  setBusca(p.codigo||p.nome);setResultados([]);setErro('')
 }
 async function salvar(){
  if(!acao||!aberta||!pacoteId||salvando)return
  if(form.justificativa.trim().length<5){setErro('Informe uma justificativa de pelo menos cinco caracteres.');return}
  if(acao!=='excluir'&&(!form.descricao.trim()||Number(form.quantidade_ajustada)<=0)){
   setErro('Informe a descrição e uma quantidade positiva.');return
  }
  if((acao==='substituir'||acao==='incluir')&&form.codigo&&!form.produto_id){
   setErro('Escolha o produto pelo catálogo. Não é permitido vincular um código sem seu cadastro.');return
  }
  const aviso='Confirmar '+nomeAcao[acao].toLowerCase()+' nesta tipologia? O orçamento vendido e o CMV original não serão recalculados. Listas de cotação e pedidos existentes deverão ser conferidos novamente.'
  if(!window.confirm(aviso))return
  setSalvando(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const novo={...form,produto_id:form.produto_id||null,
    quantidade_ajustada:Number(form.quantidade_ajustada),
    comprimento_corte_mm:form.comprimento_corte_mm.trim()?Number(form.comprimento_corte_mm):null,
    comprimento_barra_mm:form.comprimento_barra_mm.trim()?Number(form.comprimento_barra_mm):null}
   const r=await fetch('/api/vendas/tipologias-materiais',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,pacoteId,itemRef:aberta,acao,materialId:materialEditando?.id,novo,justificativa:form.justificativa})})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(json.error||'Falha ao alterar material.')
   setMensagem('Alteração salva com histórico. Confira Compras, lista de corte e PDFs antes de utilizar materiais.')
   setAcao(null);setMaterialEditando(null)
   await onAtualizar()
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setSalvando(false)}
 }
 const atualGrupo=grupo==='variaveis'?dadosAtuais?.variaveis||dadosAtuais?.wvetro_item?.Variaveis||{}:
  grupo==='formulas'?dadosAtuais?.wvetro_item?.Formulas||dadosAtuais?.wvetro_item?.Formula||{}:null
 return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
  <header className="border-b p-4"><h2 className="font-bold text-slate-900">Tipologias vendidas</h2><p className="mt-1 text-xs text-slate-500">Clique na linha para abrir a composição desta peça. Alterações técnicas ficam restritas à tipologia selecionada.</p></header>
  <div className="divide-y">
   {itensComRef.map((it,i)=>{
    const ref=it.ref
    const estaAberta=aberta===ref&&!!ref
    const linhas=materiais.filter(m=>m.item_ref===ref).length
    return <div key={ref||i}>
     <button type="button" onClick={()=>{setAberta(estaAberta?null:ref||null);setGrupo('perfis');setMensagem('');setAcao(null)}}
      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" aria-expanded={estaAberta}>
      <span className="flex min-w-0 items-center gap-3">
       {estaAberta?<ChevronDown className="shrink-0 text-blue-600" size={18}/>:<ChevronRight className="shrink-0 text-slate-500" size={18}/>}
       <span><b className="block text-sm text-slate-900">{String(i+1).padStart(2,'0')} · {it.ambiente||it.descricao||it.configuracao_nome||'Tipologia'}</b>
       <span className="mt-0.5 block text-xs text-slate-500">{it.descricao||it.tipo_esquadria||it.wvetro_item?.Modelo||'Peça sob medida'}</span></span>
      </span>
      <span className="flex flex-wrap gap-3 text-xs text-slate-500"><span>Qtd. {n(it.quantidade||1)}</span>
       <span>{it.largura_mm&&it.altura_mm?it.largura_mm+' × '+it.altura_mm+' mm':'Medida não informada'}</span>
       <span className="font-semibold">{linhas} materiais</span></span>
     </button>
     {estaAberta&&<div className="space-y-3 border-t bg-slate-50 p-3 md:p-4">
      {!pacoteId&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Sincronize o pacote técnico antes de editar os materiais.</p>}
      {!ref&&<p className="text-xs text-amber-800">Esta tipologia não possui identificador técnico; edição bloqueada para não misturar materiais.</p>}
      <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Componentes da tipologia">
       {grupos.map(g=><button key={g.id} type="button" onClick={()=>{setGrupo(g.id);setAcao(null)}} className={'rounded-lg px-3 py-2 text-xs font-bold '+(grupo===g.id?'bg-blue-700 text-white':'bg-white text-slate-600 hover:bg-blue-50')}>{g.nome}</button>)}
      </nav>
      {grupo==='variaveis'||grupo==='formulas'?<div className="rounded-lg border bg-white p-4">
       <b className="text-sm">{grupo==='variaveis'?'Variáveis da peça':'Fórmulas Padrão · referência técnica'}</b>
       {Object.keys(atualGrupo||{}).length?<pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(atualGrupo,null,2)}</pre>:<p className="mt-2 text-xs text-slate-500">Nenhuma informação estruturada desta seção foi importada do WVetro para a tipologia.</p>}
       <p className="mt-2 text-xs text-amber-700">As receitas e fórmulas globais continuam na Engenharia. Editar materiais desta obra não altera fórmulas de outras obras.</p>
      </div>:<>
       <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{visiveis.length} registro(s) · {grupo==='perfis'?'Perfil e contramarco':grupo==='servicos'?'Serviços e outros materiais':grupos.find(g=>g.id===grupo)?.nome}</span>
        {master&&pacoteId&&ref&&<button type="button" onClick={()=>abrirEdicao('incluir')} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"><Plus size={15}/> Incluir material</button>}
       </div>
       <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[750px] text-xs">
         <thead className="bg-slate-100 text-left uppercase text-slate-500"><tr><th className="p-2">Desenho</th><th className="p-2">Código / descrição</th><th className="p-2">Cor</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Corte</th><th className="p-2">Origem</th><th className="p-2 text-right">Ações</th></tr></thead>
         <tbody>{visiveis.map(m=>{
          const foto=(m.produto_id&&imagensProdutos[m.produto_id]?.foto_url)||imagens[(m.codigo||'').toUpperCase()]||null
          return <tr key={m.id} className="border-t align-middle">
           <td className="p-2">{foto&&url(foto)?<img src={foto} alt={'Desenho '+(m.codigo||m.descricao)} className="h-12 w-16 rounded border object-contain"/>:<span className="flex items-center gap-1 text-[10px] text-amber-700"><ImageOff size={13}/>{m.codigo?'Pendente':'—'}</span>}</td>
           <td className="max-w-[350px] p-2"><b className="font-mono">{m.codigo||'—'}</b><p className="mt-1 text-slate-600">{m.descricao}</p></td>
           <td className="p-2">{m.cor_ref||'—'}</td><td className="p-2 text-right">{n(m.quantidade_ajustada)} {m.unidade}</td>
           <td className="p-2 text-right">{m.comprimento_corte_mm!=null?n(m.comprimento_corte_mm)+' mm':'—'}</td>
           <td className="p-2 text-slate-500">{m.incluido_manual?'Ajuste Atlas':'WVetro / técnico'}</td>
           <td className="p-2"><div className="flex justify-end gap-1">{master&&<>
            <button title="Ajustar quantidade ou corte" aria-label="Ajustar material" onClick={()=>abrirEdicao('ajustar',m)} className="rounded border p-2 hover:bg-slate-50"><Pencil size={14}/></button>
            <button title="Substituir material" aria-label="Substituir material" onClick={()=>abrirEdicao('substituir',m)} className="rounded border p-2 hover:bg-slate-50"><Replace size={14}/></button>
            <button title="Excluir material" aria-label="Excluir material" onClick={()=>abrirEdicao('excluir',m)} className="rounded border p-2 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
           </>}</div></td>
          </tr>
         })}{!visiveis.length&&<tr><td colSpan={7} className="p-5 text-center text-slate-500">Esta tipologia não tem materiais cadastrados nesta categoria.</td></tr>}</tbody>
        </table>
       </div>
      </>}
      {master&&<div className="space-y-2">
       <button onClick={()=>setMostrarHistorico(x=>!x)} className="flex items-center gap-2 text-xs font-bold text-blue-700"><History size={15}/> {mostrarHistorico?'Ocultar':'Ver'} histórico de alterações ({historico.length})</button>
       {carregando&&<p className="text-xs text-slate-500">Conferindo histórico...</p>}
       {mostrarHistorico&&<div className="space-y-2 rounded-lg border bg-white p-3">{historico.map(h=><div key={h.id} className="border-b pb-2 text-xs">
        <b>{h.acao.toUpperCase()} · {h.usuario_nome||'Usuário'}</b><span className="ml-2 text-slate-500">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
        <p className="mt-1">{h.antes?.codigo||'—'} → {h.depois?.codigo||'Excluído'} · {h.justificativa}</p></div>)}{!historico.length&&<p className="text-xs text-slate-500">Nenhuma edição manual registrada nesta tipologia.</p>}</div>}
      </div>}
      {mensagem&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{mensagem}</p>}
      {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
     </div>}
    </div>
   })}
   {!itens.length&&<p className="p-5 text-sm text-slate-500">Este orçamento não possui tipologias estruturadas.</p>}
  </div>
  {acao&&aberta&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true">
   <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4"><h3 className="text-base font-bold">{nomeAcao[acao]} · {dadosAtuais?.ambiente||'Tipologia'}</h3><button aria-label="Fechar edição" disabled={salvando} onClick={()=>setAcao(null)}><X size={18}/></button></div>
    <div className="space-y-3 overflow-y-auto p-4 text-xs">
     {materialEditando&&<p className="rounded-lg bg-slate-50 p-3">Material original: <b>{materialEditando.codigo||'—'}</b> · {materialEditando.descricao}</p>}
     {acao!=='excluir'&&<>
      {acao!=='ajustar'&&<div><label className="block font-bold">Buscar no catálogo (código ou descrição)</label><div className="mt-1 flex gap-2">
       <input className="min-w-0 flex-1 rounded-lg border p-2" value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void pesquisar()}}} placeholder="Ex.: SU010, 30-023..."/>
       <button type="button" disabled={pesquisando||busca.length<2} onClick={()=>void pesquisar()} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">{pesquisando?<Loader2 size={14} className="animate-spin"/>:<Search size={14}/>} Buscar</button></div>
       {resultados.length>0&&<div className="mt-2 max-h-44 overflow-auto rounded-lg border">{resultados.map(p=><button type="button" key={p.id} onClick={()=>escolherProduto(p)} className="flex w-full items-center gap-2 border-b p-2 text-left hover:bg-blue-50">
        {p.foto_url?<img src={p.foto_url} alt={'Desenho '+p.codigo} className="h-10 w-10 object-contain"/>:<ImageOff size={20} className="text-amber-600"/>}
        <span><b>{p.codigo||'Sem código'}</b> · {p.nome}{p.codigo&&!p.foto_url?<span className="block text-amber-700">Imagem técnica pendente</span>:null}</span>
       </button>)}</div>}
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
       <label className="font-semibold">Categoria<select disabled={acao==='ajustar'} value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} className="mt-1 w-full rounded-lg border p-2"><option value="perfil">Perfil</option><option value="contramarco">Contramarco</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="outro">Serviço / Outro</option></select></label>
       <label className="font-semibold">Código<input readOnly value={form.codigo} className="mt-1 w-full rounded-lg border bg-slate-50 p-2" placeholder="Escolha no catálogo"/></label>
       <label className="sm:col-span-2 font-semibold">Descrição<input value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} className="mt-1 w-full rounded-lg border p-2" maxLength={500}/></label>
       <label className="font-semibold">Quantidade<input inputMode="decimal" value={form.quantidade_ajustada} onChange={e=>setForm({...form,quantidade_ajustada:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Unidade<input value={form.unidade} onChange={e=>setForm({...form,unidade:e.target.value})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Cor<input value={form.cor_ref} onChange={e=>setForm({...form,cor_ref:e.target.value})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Comprimento de corte (mm)<input inputMode="decimal" value={form.comprimento_corte_mm} onChange={e=>setForm({...form,comprimento_corte_mm:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Comprimento da barra (mm)<input inputMode="decimal" value={form.comprimento_barra_mm} onChange={e=>setForm({...form,comprimento_barra_mm:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
      </div>
     </>}
     <label className="block font-semibold">Justificativa obrigatória<textarea value={form.justificativa} onChange={e=>setForm({...form,justificativa:e.target.value})} className="mt-1 min-h-[75px] w-full rounded-lg border p-2" placeholder="Por que este material será alterado?"/></label>
     <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Ajuste nesta peça somente. O histórico e os custos originais do WVetro são preservados. Confira listas de compra, PDFs e corte antes da produção.</p>
     {erro&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}
    </div>
    <div className="flex justify-end gap-2 border-t p-4"><button disabled={salvando} onClick={()=>setAcao(null)} className="rounded-lg border px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={salvando} onClick={()=>void salvar()} className={'rounded-lg px-4 py-2 text-xs font-bold text-white '+(acao==='excluir'?'bg-red-700':'bg-blue-700')}>{salvando?'Salvando...':'Confirmar '+nomeAcao[acao].toLowerCase()}</button></div>
   </div>
  </div>}
 </section>
}
