'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,Boxes,CheckCircle2,ClipboardCheck,RefreshCcw,PackageCheck,Factory,AlertTriangle} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Nota={id:string;nfId:string|null;nfNumero:string;fornecedorId:string|null;fornecedor:string;recebimentoEm:string|null;produtoId:string|null;produtoNome:string;fotoUrl:string|null;unidade:string;contabilizado:number;alocado:number;disponivel:number}
type Linha={id:string;carrinhoId:string;fornecedorId:string|null;fornecedor:string;descricao:string;produtoId:string|null;produtoNome:string|null;fotoUrl:string|null;unidade:string;cliente:string|null;obra:string|null;destino:string;status:string;quantidadeObra:number;quantidadeEstoque:number;recebidoObra:number;recebidoEstoque:number;statusCarrinho:string}
type Historico={id:string;recebimento_item_id:string;carrinho_item_id:string;quantidade_obra:number;quantidade_estoque:number;criado_em:string}
type Retorno={notas:Nota[];linhas:Linha[];historico:Historico[];acessos:{receber:boolean;conferir:boolean};aviso:string}
const num=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:3})
const data=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'—'
export default function RecebimentoIntegrado(){
 const [dados,setDados]=useState<Retorno|null>(null),[loading,setLoading]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('')
 const [notaId,setNotaId]=useState(''),[linhaId,setLinhaId]=useState(''),[obra,setObra]=useState('0'),[estoque,setEstoque]=useState('0')
 const carregar=useCallback(async()=>{
  try{setErro('');const token=await tokenAtual();if(!token)throw Error('Entre no Atlas para consultar as compras.')
   const r=await fetch('/api/compras/recebimento-integrado',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json().catch(()=>({}));if(!r.ok)throw Error(json.error||'Falha ao consultar a conferência')
   setDados(json)
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao consultar')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void carregar()},[carregar])
 const nota=useMemo(()=>dados?.notas.find(n=>n.id===notaId)||null,[dados,notaId])
 const elegiveis=useMemo(()=>dados?.linhas.filter(l=>!!nota&&l.produtoId===nota.produtoId&&l.fornecedorId===nota.fornecedorId&&l.status==='ativo'&&
   l.quantidadeObra-l.recebidoObra+l.quantidadeEstoque-l.recebidoEstoque>0.000001)||[],[dados,nota])
 const linha=elegiveis.find(l=>l.id===linhaId)||null
 const qtdObra=Number(obra),qtdEstoque=Number(estoque)
 const total=qtdObra+qtdEstoque
 const valido=!!nota&&!!linha&&dados?.acessos.receber&&[qtdObra,qtdEstoque].every(Number.isFinite)&&qtdObra>=0&&qtdEstoque>=0&&total>0&&total<=nota.disponivel+0.000001&&
  qtdObra<=linha.quantidadeObra-linha.recebidoObra+0.000001&&qtdEstoque<=linha.quantidadeEstoque-linha.recebidoEstoque+0.000001
 async function gravar(){if(!valido||!nota||!linha)return
  try{setSalvando(true);setErro('');setMensagem('');const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/compras/recebimento-integrado',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({recebimentoItemId:nota.id,carrinhoItemId:linha.id,quantidadeObra:qtdObra,quantidadeEstoque:qtdEstoque})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Não foi possível gravar o destino')
   setMensagem('Destinação registrada com histórico. NF e estoque físico não foram lançados novamente.');setObra('0');setEstoque('0');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar')}finally{setSalvando(false)}
 }
 return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 md:px-7"><div className="mx-auto max-w-6xl space-y-5">
  <header><Link href="/compras/solicitacoes" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft size={16}/> Voltar aos pedidos de compra</Link><h1 className="text-2xl font-black">Recebimento integrado às compras</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Depois da conferência física da NF, distribua as peças já recebidas entre cada obra e o estoque geral. Não há segunda entrada de mercadoria.</p></header>
  <div className="grid gap-3 sm:grid-cols-3">{[
    {t:'1. Conferência da NF',d:'Quantidade real, avarias e entrada física',ic:ClipboardCheck},
    {t:'2. Destino do material',d:'Obra e estoque conforme o pedido',ic:Boxes},
    {t:'3. Andamento da compra',d:'Parcial, total e aviso para a obra',ic:PackageCheck},
  ].map(x=><div key={x.t} className="rounded-xl border bg-white p-4"><x.ic size={20} className="mb-2 text-blue-700"/><h2 className="font-bold">{x.t}</h2><p className="mt-1 text-xs text-slate-600">{x.d}</p></div>)}</div>
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><b>Proteção:</b> o estoque físico só é movimentado na conferência da nota fiscal. Esta tela registra vínculo e status. Não libera produção automaticamente.</div>
  {!!erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
  {!!mensagem&&<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{mensagem}</p>}
  <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Destinar mercadoria recebida</h2><button onClick={()=>{setLoading(true);void carregar()}} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><RefreshCcw size={14}/> Atualizar</button></div>
   {loading&&<p className="text-sm text-slate-500">Consultando as notas conferidas...</p>}
   {!loading&&<div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3">
    <label className="block text-xs font-semibold">1. Escolher item de NF já recebido fisicamente<select aria-label="Nota e material recebido" className="mt-1 w-full rounded-lg border p-3 text-sm" value={notaId} onChange={e=>{setNotaId(e.target.value);setLinhaId('');setObra('0');setEstoque('0')}}><option value="">Selecionar nota e material</option>{(dados?.notas||[]).map(n=><option value={n.id} key={n.id} disabled={n.disponivel<=0}>NF {n.nfNumero} · {n.fornecedor} · {n.produtoNome} · {num(n.disponivel)} {n.unidade} disponível</option>)}</select></label>
    {nota&&<div className="flex items-center gap-3 rounded-xl border p-3">{nota.fotoUrl?<img src={nota.fotoUrl} alt={nota.produtoNome} className="h-20 w-20 rounded-lg border object-contain"/>:<div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed p-2 text-center text-[10px] text-slate-500">Imagem do produto pendente</div>}<div className="text-xs"><b className="text-sm">{nota.produtoNome}</b><p>Fornecedor: {nota.fornecedor}</p><p>Conferido em {data(nota.recebimentoEm)}</p><p className="mt-2 font-semibold text-blue-700">Recebido útil: {num(nota.contabilizado)} · Já distribuído: {num(nota.alocado)} · Disponível: {num(nota.disponivel)} {nota.unidade}</p><Link className="mt-2 inline-block text-blue-700 underline" href={`/compras/recebimentos/${nota.nfId}`}>Ver conferência da NF</Link></div></div>}
   </div><div className="space-y-3"><label className="block text-xs font-semibold">2. Escolher pedido do mesmo fornecedor e produto<select aria-label="Pedido para distribuir material" className="mt-1 w-full rounded-lg border p-3 text-sm" value={linhaId} onChange={e=>{setLinhaId(e.target.value);setObra('0');setEstoque('0')}}><option value="">Selecionar item do pedido</option>{elegiveis.map(l=><option value={l.id} key={l.id}>{l.descricao} · {l.cliente?`${l.cliente} / ${l.obra}`:'Estoque'} · falta {num(l.quantidadeObra-l.recebidoObra+l.quantidadeEstoque-l.recebidoEstoque)} {l.unidade}</option>)}</select></label>
    {nota&&!elegiveis.length&&<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Não há carrinho comprado correspondente ao produto e fornecedor desta nota. Confira o código do produto e o fornecedor antes de vincular.</p>}
    {linha&&<div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs"><div><p className="font-semibold"><Factory size={14} className="mr-1 inline"/> {linha.cliente?`${linha.cliente} · ${linha.obra}`:'Estoque'}</p><p>Obra pendente: {num(linha.quantidadeObra-linha.recebidoObra)}</p><p>Estoque pendente: {num(linha.quantidadeEstoque-linha.recebidoEstoque)}</p></div><div><p className="font-semibold">Pedido: {linha.statusCarrinho.replaceAll('_',' ')}</p><p>Obra recebida: {num(linha.recebidoObra)}</p><p>Estoque recebido: {num(linha.recebidoEstoque)}</p></div></div>}
   </div></div>}
   {!!linha&&<div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">3. Destinar à obra<input type="number" min="0" step="any" className="mt-1 w-full rounded-lg border p-3 text-sm" value={obra} onChange={e=>setObra(e.target.value)}/><span className="mt-1 block text-slate-500">Máximo pendente: {num(linha.quantidadeObra-linha.recebidoObra)}</span></label><label className="text-xs font-semibold">4. Destinar ao estoque<input type="number" min="0" step="any" className="mt-1 w-full rounded-lg border p-3 text-sm" value={estoque} onChange={e=>setEstoque(e.target.value)}/><span className="mt-1 block text-slate-500">Máximo pendente: {num(linha.quantidadeEstoque-linha.recebidoEstoque)}</span></label></div>}
   {linha&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm"><b>Destinação:</b> {num(Number.isFinite(total)?total:0)} {nota?.unidade} {valido?<span className="ml-2 text-emerald-700"><CheckCircle2 size={15} className="inline"/> Quantidades válidas</span>:<span className="ml-2 text-amber-700"><AlertTriangle size={15} className="inline"/> Confira quantidades e saldo físico</span>}</div><button disabled={!valido||salvando} onClick={()=>void gravar()} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{salvando?'Registrando...':'Confirmar destino e atualizar pedido'}</button></div>}
   {!loading&&!dados?.notas.length&&<div className="rounded-xl border border-dashed p-6 text-sm text-slate-600">Ainda não há materiais de NF conferidos com entrada física registrada. Primeiro utilize a tela de <Link href="/compras/entrada" className="font-semibold text-blue-700 underline">Entrada de Nota Fiscal</Link> e conclua a conferência.</div>}
  </section>
  <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-1 text-lg font-bold">Histórico das destinações</h2><p className="mb-3 text-xs text-slate-500">Lançamentos imutáveis, com referência à conferência física e ao pedido do fornecedor.</p>
   <div className="space-y-2">{(dados?.historico||[]).slice(0,100).map(h=>{const linha=dados?.linhas.find(x=>x.id===h.carrinho_item_id),nota=dados?.notas.find(x=>x.id===h.recebimento_item_id);return <div key={h.id} className="rounded-lg border p-3 text-xs"><strong>{linha?.descricao||'Material'} · NF {nota?.nfNumero||'—'}</strong><p>{linha?.cliente?`${linha.cliente} / ${linha.obra}`:'Estoque'} · Obra: {num(Number(h.quantidade_obra))} · Estoque: {num(Number(h.quantidade_estoque))} · {data(h.criado_em)}</p></div>})}{!dados?.historico.length&&<p className="text-sm text-slate-500">Ainda não há destinações vinculadas nesta etapa.</p>}</div>
  </section>
 </div></main>
}
