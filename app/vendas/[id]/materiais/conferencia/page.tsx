'use client'
import {useEffect,useMemo,useState} from 'react'
import {useParams,useSearchParams} from 'next/navigation'
import {Printer} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import type {ItemPreCompra,CategoriaPreCompra} from '@/lib/preparacaoCompraMateriaisServer'
type PreviaBarra={codigo:string;cor:string|null;quantidadeBarras:number;comprimentoBarraMm:number;quantidadePecas:number;tipologias:number}
type PreviaBarras={itens:PreviaBarra[];pendencias:string[];perdaCorteMm:number}
type Rascunho={chave_item:string;categoria:CategoriaPreCompra;origem:string;codigo:string;descricao:string;cor:string;medida:string;unidade:string;quantidade_necessaria:number;quantidade_estoque:number;quantidade_comprar:number;fonte_hash:string;estoque_conferido:boolean}
const titulo:Record<CategoriaPreCompra,string>={perfil:'Barras comerciais',acessorio:'Acessórios',vidro:'Vidros'}
const num=(v:unknown)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
export default function ConferenciaEstoquePage(){
 const params=useParams<{id:string}>()
 const q=useSearchParams()
 const vendaId=String(params?.id||'')
 const categoria:CategoriaPreCompra=q.get('categoria')==='acessorio'?'acessorio':q.get('categoria')==='vidro'?'vidro':'perfil'
 const perdaCorteMm=Number(q.get('perdaCorteMm')||0)
 const [itens,setItens]=useState<ItemPreCompra[]>([])
 const [previaBarras,setPreviaBarras]=useState<PreviaBarras>({itens:[],pendencias:[],perdaCorteMm:0})
 const [rascunhos,setRascunhos]=useState<Rascunho[]>([])
 const [fotosManuais,setFotosManuais]=useState<Record<string,string>>({})
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(true)
 useEffect(()=>{
  let ativo=true
  void(async()=>{
   try{
    const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
    const r=await fetch('/api/vendas/materiais/preparacao?vendaId='+encodeURIComponent(vendaId)+'&perdaCorteMm='+encodeURIComponent(String(perdaCorteMm)),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(j.error||'Conferência indisponível.')
    if(ativo){setItens(j.itens||[]);setRascunhos(j.rascunhos||[]);setPreviaBarras(j.previaBarras||{itens:[],pendencias:[],perdaCorteMm:0});setFotosManuais(Object.fromEntries(Object.entries(j.manuaisImagens||{}).map(([k,v]:[string,any])=>[k,v?.imagemUrl||''])))}
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Não foi possível carregar a conferência.')}
   finally{if(ativo)setCarregando(false)}
  })()
  return()=>{ativo=false}
 },[vendaId,perdaCorteMm])
 const lista=useMemo(()=>{
  const manuais=rascunhos.filter(r=>r.origem==='manual'&&r.categoria===categoria).map(r=>({
   chave:r.chave_item,categoria:r.categoria,codigo:r.codigo,descricao:r.descricao,cor:r.cor,medida:r.medida,
   unidade:r.unidade,necessidade:r.quantidade_necessaria,fonteHash:'manual',origem:'manual' as const,
   imagemUrl:fotosManuais[r.chave_item]||null,imagemPendente:r.categoria!=='vidro'&&!fotosManuais[r.chave_item],produtoId:null}))
  return [...itens.filter(i=>i.categoria===categoria),...manuais]
 },[itens,rascunhos,categoria,fotosManuais])
 const normalizar=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()
 const sugestaoPara=(codigo:string,cor:string)=>previaBarras.itens.filter(b=>normalizar(b.codigo)===normalizar(codigo)&&normalizar(b.cor)===normalizar(cor))
 const porChave=new Map(rascunhos.map(r=>[r.chave_item,r]))
 if(carregando)return <main className="folha">Carregando relação para conferência…</main>
 if(erro)return <main className="folha" role="alert">{erro}</main>
 return <main className="folha">
  <header><div><h1>ESQUADRIFÁCIO · ATLAS ONE</h1><h2>Conferência de estoque — {titulo[categoria]}</h2>
   <p>Venda: {vendaId} · Necessidade da obra preservada · {new Date().toLocaleString('pt-BR')}</p>
   {categoria==='perfil'&&<p>Prévia de barras por aproveitamento global com perda de serra de {num(previaBarras.perdaCorteMm)} mm/corte; conferir medidas e estoque antes de comprar.</p>}</div>
   <button type="button" onClick={()=>window.print()} className="no-print"><Printer size={15}/> Imprimir / Salvar PDF</button>
  </header>
  <section className="info"><p>Conferente: ___________________________________</p><p>Data: ____/____/______</p></section>
  <table><thead><tr><th>Imagem</th><th>Código</th><th>Descrição</th><th>Cor / medida</th><th>Necessidade</th>{categoria==='perfil'&&<th>Otimização global</th>}<th>Estoque</th><th>A comprar</th><th>Tem?</th></tr></thead>
   <tbody>{lista.map(i=>{
    const r=porChave.get(i.chave),conferido=Boolean(r?.estoque_conferido&&r.fonte_hash===i.fonteHash)
    return <tr key={i.chave}>
     <td>{i.imagemUrl?<img src={i.imagemUrl} alt={'Produto '+i.codigo} className="produto"/>:'Imagem pendente'}</td>
     <td><b>{i.codigo}</b></td><td>{i.descricao}</td>
     <td>{i.cor||'—'}{i.medida&&<p>{i.medida}</p>}</td>
     <td><b>{num(i.necessidade)}</b> {i.unidade}</td>
     {categoria==='perfil'&&<td>{sugestaoPara(i.codigo,i.cor).length
      ?sugestaoPara(i.codigo,i.cor).map(b=>num(b.quantidadeBarras)+' BR × '+num(b.comprimentoBarraMm)+' mm').join(' / ')
      :'Não calculado'}</td>}
     <td>{conferido?num(r?.quantidade_estoque):'________'}</td>
     <td>{conferido?num(r?.quantidade_comprar):'________'}</td>
     <td>□ Sim / □ Não</td>
    </tr>
   })}
   {!lista.length&&<tr><td colSpan={categoria==='perfil'?9:8}>Nenhum material desta categoria disponível para conferência.</td></tr>}</tbody>
  </table>
  <footer>{categoria==='perfil'&&previaBarras.pendencias.length>0&&<p><b>ATENÇÃO: {previaBarras.pendencias.length} pendência(s) no cálculo técnico de barras. Não liberar compra sem conferi-las.</b></p>}
   <p>Conferir barras inteiras, acessórios e vidros. Consulte separadamente a lista de cortes para verificar retalhos aproveitáveis.</p>
   <p>Após anotar as quantidades, registre a compra na aba Materiais. Alterações de compra não modificam tipologia, plano de corte ou estoque físico.</p></footer>
  <style jsx global>{'@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#e8ecf0;color:#172033;font:11px Arial,sans-serif}.folha{width:297mm;max-width:100%;min-height:210mm;margin:14px auto;background:#fff;padding:12mm}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #333;padding-bottom:9px}h1{font-size:17px;margin:0}h2{font-size:15px;margin:6px 0}p{margin:4px 0}.no-print{display:flex;gap:6px;align-items:center;border:1px solid #777;background:#fff;padding:8px;border-radius:6px}.info{display:flex;justify-content:space-between;padding:12px 0}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}td,th{padding:6px;border:1px solid #999;text-align:left;vertical-align:middle;overflow-wrap:anywhere}th{background:#eee}th:nth-child(1){width:63px}th:nth-child(2){width:90px}th:nth-child(5),th:nth-child(6),th:nth-child(7){width:88px}th:nth-child(8){width:95px}tr{break-inside:avoid}.produto{width:48px;height:48px;object-fit:contain}footer{margin-top:18px;border-top:1px solid #aaa;padding-top:8px;color:#555}@media print{body{background:white}.folha{width:auto;min-height:auto;padding:0;margin:0}.no-print{display:none}}'}</style>
 </main>
}