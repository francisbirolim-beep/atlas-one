'use client'
import {useCallback,useMemo,useRef,useState} from 'react'
import {tokenAtual} from '@/lib/auth'
import {calcularComparativo,type ItemCotado,type ItemSolicitado} from '@/lib/comprasComparativoCotacoes'

type Fornecedor={id:string;nome:string;pedido_minimo:number|null}
type Produto={id:string;codigo:string|null;nome:string;categoria:string|null;foto_url:string|null}
type SolItem={id:string;descricao:string;quantidade_necessaria:number|null;unidade:string;produto_id:string|null;categoria:string;status:string}
type Resumo={subtotal:number;total:number|null;completa:boolean;faltando:string[];quantidadeDivergente:string[];descricao:string}
type Cotacao={
 id:string;fornecedor_id:string;fornecedor_nome:string;pedido_minimo:number;numero_proposta:string|null;
 data_proposta:string|null;status:string;selecionada:boolean;created_at:string;
 itens:ItemCotado[];arquivoUrl:string|null;
 condicoes:{frete:number|null;desconto:number;prazo_dias:number|null;forma_pagamento:string|null;validade:string|null};
 resumo:Resumo;observacoes:string|null
}
type LinhaEdit={id:string;usar:boolean;quantidade:string;preco:string}
type Props={solicitacaoId:string;fornecedores:Fornecedor[];produtos:Produto[];itens:SolItem[];podeEditar:boolean}
const dinheiro=(n:number|null)=>n==null?'Não comparável':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const numero=(v:string)=>v.trim()===''?null:Number(v)
const novo=(itens:SolItem[]):LinhaEdit[]=>itens.map(i=>({
 id:i.id,usar:true,quantidade:String(i.quantidade_necessaria??''),preco:''
}))
export default function CotacoesComparativo({solicitacaoId,fornecedores,produtos,itens,podeEditar}:Props){
 const [aberto,setAberto]=useState(false),[ocupado,setOcupado]=useState(false),[lendo,setLendo]=useState(false)
 const [erro,setErro]=useState(''),[mensagem,setMensagem]=useState('')
 const [cotacoes,setCotacoes]=useState<Cotacao[]>([]),[menorId,setMenorId]=useState<string|null>(null)
 const [fornecedorId,setFornecedorId]=useState(''),[numeroProposta,setNumeroProposta]=useState('')
 const [frete,setFrete]=useState(''),[desconto,setDesconto]=useState('0'),[prazo,setPrazo]=useState('')
 const [pagamento,setPagamento]=useState(''),[validade,setValidade]=useState(''),[dataProposta,setDataProposta]=useState('')
 const chaveEnvio=useRef<string|null>(null)
 const [obs,setObs]=useState(''),[arquivo,setArquivo]=useState<File|null>(null)
 const [linhas,setLinhas]=useState<LinhaEdit[]>(()=>novo(itens))
 const [avisoImportacao,setAvisoImportacao]=useState('')
 const solicitados:ItemSolicitado[]=useMemo(()=>itens.filter(i=>i.status==='ativo').map(i=>({
  id:i.id,descricao:i.descricao,quantidade_necessaria:i.quantidade_necessaria,unidade:i.unidade
 })),[itens])
 const prod=new Map(produtos.map(p=>[p.id,p]))
 const itensCotados=linhas.filter(x=>x.usar&&Number(x.quantidade)>0&&x.preco.trim()!=='')
  .map(x=>({item_id:x.id,quantidade:Number(x.quantidade),preco_unitario:Number(x.preco)}))
 const calculo=calcularComparativo(itensCotados,solicitados,{
  frete:numero(frete),desconto:Number(desconto||0),prazo_dias:numero(prazo),
  forma_pagamento:pagamento||null,validade:validade||null
 })
 const carregar=useCallback(async()=>{
  const token=await tokenAtual()
  const r=await fetch('/api/compras/cotacoes-comparativo?solicitacaoId='+encodeURIComponent(solicitacaoId),
   {headers:{Authorization:'Bearer '+token},cache:'no-store'})
  const j=await r.json()
  if(!r.ok)throw Error(j.error||'Não foi possível carregar o comparativo.')
  setCotacoes(j.cotacoes||[]);setMenorId(j.menorCustoComparavelId||null)
 },[solicitacaoId])
 async function alternar(){
  if(aberto){setAberto(false);return}
  setErro('');setAberto(true)
  try{setOcupado(true);await carregar()}catch(e){setErro(e instanceof Error?e.message:'Erro ao abrir cotações')}
  finally{setOcupado(false)}
 }
 function atualizar(id:string,campo:keyof LinhaEdit,valor:string|boolean){
  setLinhas(at=>at.map(x=>x.id===id?{...x,[campo]:valor}:x))
 }
 async function lerPdf(){
  if(!arquivo)return setErro('Escolha o arquivo PDF.')
  try{
   setLendo(true);setErro('');setAvisoImportacao('')
   const form=new FormData();form.append('tipo','cotacao');form.append('arquivo',arquivo)
   const token=await tokenAtual()
   const r=await fetch('/api/compras/importar-documento',{
    method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Falha ao interpretar o PDF.')
   const encontrados=new Map<string,number>()
   const ambiguos=new Set<string>()
   for(const x of j.itens||[]){
    const equivalentes=itens.filter(i=>x.produto?.id&&i.produto_id===x.produto.id)
    if(equivalentes.length!==1||x.preco_unitario==null||!Number.isFinite(x.preco_unitario))continue
    const id=equivalentes[0].id
    if(encontrados.has(id)){ambiguos.add(id);continue}
    encontrados.set(id,x.preco_unitario)
   }
   for(const id of ambiguos)encontrados.delete(id)
   setLinhas(at=>at.map(x=>encontrados.has(x.id)?{...x,preco:String(encontrados.get(x.id))}:x))
   const cond=j.condicoes
   if(cond?.frete!=null)setFrete(String(cond.frete))
   if(cond?.pagamento)setPagamento(cond.pagamento)
   setAvisoImportacao('PDF analisado: '+encontrados.size+' preço(s) sugerido(s). Confira quantidades, códigos, frete, impostos e condições. O original será anexado quando salvar.')
  }catch(e){setErro((e instanceof Error?e.message:'Falha na leitura')+' Você ainda pode informar os preços manualmente e anexar o PDF.')}
  finally{setLendo(false)}
 }
 async function salvar(){
  if(!fornecedorId)return setErro('Escolha o fornecedor.')
  if(!itensCotados.length)return setErro('Preencha quantidade e preço de pelo menos um item.')
  if(linhas.filter(l=>l.usar).some(x=>!x.quantidade.trim()||!x.preco.trim()||
   !Number.isFinite(Number(x.quantidade))||Number(x.quantidade)<=0||
   !Number.isFinite(Number(x.preco))||Number(x.preco)<0))
   return setErro('Preencha preços e quantidades válidos para todos os itens selecionados.')
  if(numero(frete)!=null&&numero(frete)!<0)return setErro('Frete inválido.')
  try{
   setErro('');setMensagem('');setOcupado(true)
   const payload={solicitacao_id:solicitacaoId,fornecedor_id:fornecedorId,
    numero_proposta:numeroProposta,data_proposta:dataProposta||null,
    frete:numero(frete),desconto:Number(desconto||0),prazo_dias:numero(prazo),
    forma_pagamento:pagamento,validade:validade||null,observacoes:obs,
    itens:itensCotados,chave_envio:(chaveEnvio.current||=crypto.randomUUID())}
   const form=new FormData();form.append('dados',JSON.stringify(payload))
   if(arquivo)form.append('arquivo',arquivo)
   const token=await tokenAtual()
   const r=await fetch('/api/compras/cotacoes-comparativo',{
    method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Não foi possível salvar a cotação.')
   chaveEnvio.current=null
   setMensagem('Cotação registrada e vinculada ao pedido. Não foi emitida compra ao fornecedor.')
   setFornecedorId('');setArquivo(null);setLinhas(novo(itens));setFrete('')
   setNumeroProposta('');setDesconto('0');setPrazo('');setPagamento('');setValidade('')
   setDataProposta('');setObs('');setAvisoImportacao('')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar a cotação')}
  finally{setOcupado(false)}
 }
 async function agir(c:Cotacao,acao:'selecionar'|'descartar'|'reabrir'){
  if(acao==='selecionar'&&!confirm('Marcar '+c.fornecedor_nome+' como cotação escolhida? Isso NÃO emite o pedido ao fornecedor.'))return
  try{
   setErro('');setOcupado(true)
   const token=await tokenAtual()
   const r=await fetch('/api/compras/cotacoes-comparativo',{
    method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({id:c.id,solicitacaoId,acao})})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Não foi possível atualizar.')
   setMensagem(j.aviso||'Cotação atualizada.');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao atualizar')}
  finally{setOcupado(false)}
 }
 return <div className="my-3 rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-xs">
  <button type="button" onClick={()=>void alternar()} className="flex w-full items-center justify-between gap-2 font-bold text-blue-800">
   <span>Comparar cotações de fornecedores (PDF / preços / frete / prazo)</span><span>{aberto?'Fechar':'Abrir'}</span>
  </button>
  {aberto&&<div className="mt-3 space-y-3">
   {ocupado&&<p role="status">Atualizando cotações...</p>}
   {erro&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{erro}</p>}
   {mensagem&&<p role="status" className="rounded border border-emerald-200 p-2 text-emerald-800">{mensagem}</p>}
   <p className="text-slate-600">Propostas incompletas ou sem frete ficam fora da classificação por menor custo. A escolha é manual.</p>
   <div className="overflow-auto rounded-lg border bg-white"><table className="w-full min-w-[560px] text-left">
    <thead className="bg-slate-100"><tr>{['Fornecedor','Preço dos itens','Frete / desconto','Total','Prazo / pagamento','Situação'].map(v=><th key={v} className="p-2">{v}</th>)}</tr></thead>
    <tbody>{cotacoes.map(c=><tr key={c.id} className="border-t align-top">
     <td className="p-2 font-semibold">{c.fornecedor_nome}{c.selecionada&&<p className="text-emerald-800">Cotação escolhida</p>}{c.id===menorId&&<p className="text-blue-700">Menor custo comparável</p>}
      <p className="font-normal text-slate-500">Proposta: {c.numero_proposta||'sem número'}</p>
      {c.arquivoUrl&&<a href={c.arquivoUrl} target="_blank" rel="noopener noreferrer" className="font-normal text-blue-700 underline">Ver PDF original</a>}</td>
     <td className="p-2">{dinheiro(c.resumo.subtotal)}<p className="text-slate-500">{c.itens.length}/{itens.length} materiais</p></td>
     <td className="p-2">{c.condicoes.frete==null?'Frete não informado':dinheiro(c.condicoes.frete)} / {dinheiro(c.condicoes.desconto)}</td>
     <td className="p-2 font-bold">{dinheiro(c.resumo.total)}<p className="font-normal text-amber-800">{!c.resumo.completa?c.resumo.descricao:''}</p>
      {c.pedido_minimo>0&&<p className="font-normal text-slate-500">Mínimo: {dinheiro(c.pedido_minimo)}</p>}</td>
     <td className="p-2">{c.condicoes.prazo_dias==null?'Prazo não informado':c.condicoes.prazo_dias+' dias'}
      <p className="text-slate-500">{c.condicoes.forma_pagamento||'Pagamento não informado'}</p>
      {c.condicoes.validade&&<p className="text-slate-500">Validade: {c.condicoes.validade}</p>}</td>
     <td className="space-y-1 p-2"><p>{c.status.replaceAll('_',' ')}</p>
      {podeEditar&&c.status!=='descartada'&&!c.selecionada&&<button type="button" disabled={ocupado||!c.resumo.completa} onClick={()=>void agir(c,'selecionar')} className="block text-blue-700 underline disabled:opacity-40">Escolher fornecedor</button>}
      {podeEditar&&c.status!=='descartada'&&<button type="button" disabled={ocupado} onClick={()=>void agir(c,'descartar')} className="block text-red-700 underline">Descartar</button>}
      {podeEditar&&c.status==='descartada'&&<button type="button" disabled={ocupado} onClick={()=>void agir(c,'reabrir')} className="block text-blue-700 underline">Reabrir</button>}</td>
    </tr>)}{!cotacoes.length&&<tr><td colSpan={6} className="p-3 text-slate-500">Nenhuma cotação cadastrada para esta solicitação.</td></tr>}</tbody>
   </table></div>
   {podeEditar&&<div className="space-y-3 rounded-lg border bg-white p-3">
    <h3 className="font-bold text-slate-800">Adicionar cotação e anexar PDF</h3>
    <label className="block font-semibold">Fornecedor<select value={fornecedorId} onChange={e=>setFornecedorId(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Selecione o fornecedor</option>{fornecedores.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
    <div className="flex flex-wrap gap-2"><label className="min-w-[185px] flex-1 font-semibold">Proposta em PDF<input type="file" accept=".pdf,application/pdf" onChange={e=>setArquivo(e.target.files?.[0]||null)} className="mt-1 block w-full text-xs"/></label>
     <button type="button" disabled={!arquivo||lendo||ocupado} onClick={()=>void lerPdf()} className="self-end rounded border border-blue-300 px-3 py-2 font-semibold text-blue-800 disabled:opacity-40">{lendo?'Analisando...':'Ler preços do PDF'}</button></div>
    {avisoImportacao&&<p className="text-blue-800">{avisoImportacao}</p>}
    <div className="overflow-auto rounded border"><table className="w-full min-w-[520px]">
     <thead className="bg-slate-100"><tr><th className="p-2">Incluir</th><th className="p-2">Produto e imagem</th><th className="p-2">Qtde. cotada</th><th className="p-2">Preço unitário R$</th></tr></thead>
     <tbody>{itens.filter(i=>i.status==='ativo').map(item=>{
      const linha=linhas.find(x=>x.id===item.id),p=item.produto_id?prod.get(item.produto_id):null
      if(!linha)return null
      return <tr key={item.id} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={linha.usar} onChange={e=>atualizar(item.id,'usar',e.target.checked)}/></td>
       <td className="p-2"><div className="flex items-center gap-2">{p?.foto_url?<img src={p.foto_url} alt={'Imagem '+p.nome} className="h-12 w-12 rounded border object-contain"/>:<span className="w-12 text-[10px] text-amber-700">Imagem pendente</span>}
        <span><b>{p?.codigo||'Código pendente'}</b> · {item.descricao}<small className="block text-slate-500">Pedido: {item.quantidade_necessaria??'a definir'} {item.unidade}</small></span></div></td>
       <td className="p-2"><input type="number" min="0.001" step="any" aria-label={'Quantidade '+item.descricao} value={linha.quantidade} onChange={e=>atualizar(item.id,'quantidade',e.target.value)} className="w-24 rounded border p-2"/></td>
       <td className="p-2"><input type="number" min="0" step="0.01" aria-label={'Preço '+item.descricao} value={linha.preco} onChange={e=>atualizar(item.id,'preco',e.target.value)} className="w-28 rounded border p-2"/></td>
      </tr>
     })}</tbody></table></div>
    <div className="grid gap-2 sm:grid-cols-3">
     <label>Nº da proposta<input value={numeroProposta} onChange={e=>setNumeroProposta(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
     <label>Data da cotação<input type="date" value={dataProposta} onChange={e=>setDataProposta(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
     <label>Validade<input type="date" value={validade} onChange={e=>setValidade(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
     <label>Frete R$ (obrigatório para comparar)<input type="number" min="0" step="0.01" placeholder="Informe 0 se frete grátis" value={frete} onChange={e=>setFrete(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
     <label>Desconto R$<input type="number" min="0" step="0.01" value={desconto} onChange={e=>setDesconto(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
     <label>Prazo de entrega (dias)<input type="number" min="0" step="1" value={prazo} onChange={e=>setPrazo(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
    </div>
    <label className="block">Condições de pagamento<input value={pagamento} onChange={e=>setPagamento(e.target.value)} placeholder="Ex.: 28/56 dias" className="mt-1 w-full rounded border p-2"/></label>
    <label className="block">Observações<textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} className="mt-1 w-full rounded border p-2"/></label>
    <p className="text-slate-600">Itens: {dinheiro(calculo.subtotal)} · Total: {dinheiro(calculo.total)} · {calculo.descricao}</p>
    <button type="button" disabled={ocupado||lendo} onClick={()=>void salvar()} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">Salvar cotação para comparar</button>
   </div>}
  </div>}
 </div>
}
