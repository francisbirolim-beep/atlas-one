'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ClipboardList, ImageOff, Loader2, PackageCheck, Plus, Search, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Produto = { id: string; codigo: string | null; nome: string; unidade: string | null; custo: number | null; foto_url: string | null }
type Cliente = { id: string; nome: string; cidade?: string | null }
type Obra = { id: string; nome: string; numero?: number | null }
type Local = { id: string; nome: string; codigo: string }
type DestinoProduto = 'estoque' | 'obra' | 'parcial'
type Item = {
  produto: Produto
  quantidade: string
  custoUnitario: string
  destino: DestinoProduto
  quantidadeObra: string
  cliente: Cliente | null
  obraId: string
}
type Historico = { id: string; fornecedor_nome: string; numero_romaneio: string; data_documento: string; criado_por_nome: string }
type HistoricoItem = { id: string; entrada_id: string; descricao: string; quantidade: number; unidade: string | null; produto?: { foto_url?: string | null; codigo?: string | null } | null }
type Consulta = (params: Record<string, string>) => Promise<any>

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const numeroBR = (texto: string) => { const s=texto.trim(); return Number(s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s) }
const moeda = (n: number | null) => n === null ? '' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})
const real = (n: number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dataHoje = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-') }

function Foto({ src, nome }: { src?: string | null; nome: string }) {
  return src
    ? <img src={src} alt={nome} loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border bg-white object-contain"/>
    : <span title="Imagem do produto não cadastrada" className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed bg-slate-50 text-[9px] text-slate-400"><ImageOff size={16}/>Sem foto</span>
}
function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{titulo}<div className="mt-1">{children}</div></label>
}

function ClienteObra({
  cliente, obraId, onCliente, onObra, consultar,
}: {
  cliente: Cliente | null; obraId: string
  onCliente: (cliente: Cliente | null) => void
  onObra: (obraId: string) => void; consultar: Consulta
}) {
  const [busca,setBusca] = useState(cliente?.nome || '')
  const [resultados,setResultados] = useState<Cliente[]>([])
  const [obras,setObras] = useState<Obra[]>([])
  const [erro,setErro] = useState('')
  useEffect(() => { if (cliente) setBusca(cliente.nome) },[cliente?.id,cliente?.nome])
  useEffect(() => {
    if (cliente || busca.trim().length < 3) { setResultados([]); return }
    let ativo=true
    const t=setTimeout(()=>{
      consultar({tipo:'clientes',q:busca}).then(r=>{if(ativo)setResultados(r.clientes || [])})
        .catch(()=>{if(ativo)setErro('Falha ao buscar cliente.')})
    },250)
    return ()=>{ativo=false;clearTimeout(t)}
  },[busca,cliente,consultar])
  useEffect(()=>{
    if(!cliente){setObras([]);return}
    let ativo=true
    consultar({tipo:'obras',clienteId:cliente.id})
      .then(r=>{if(ativo)setObras(r.obras || [])})
      .catch(()=>{if(ativo)setErro('Falha ao buscar obras.')})
    return ()=>{ativo=false}
  },[cliente,consultar])
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="relative">
      <label className="block text-xs font-medium text-slate-600">Cliente *</label>
      <input className={input+' mt-1'} autoComplete="off" placeholder="Digite 3 letras, como no Cliente 360..."
        value={cliente ? cliente.nome : busca}
        onChange={e=>{setBusca(e.target.value);onCliente(null);onObra('');setErro('')}}/>
      {!cliente && resultados.length>0 && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow-xl">
        {resultados.map(c=><button type="button" key={c.id} onClick={()=>{onCliente(c);setBusca(c.nome);setResultados([]);setErro('')}}
          className="block w-full border-b p-3 text-left text-sm hover:bg-blue-50">{c.nome}<span className="ml-2 text-xs text-slate-500">{c.cidade}</span></button>)}
      </div>}
    </div>
    <div>
      <label className="block text-xs font-medium text-slate-600">Obra do cliente *</label>
      <select className={input+' mt-1'} disabled={!cliente} value={obraId} onChange={e=>onObra(e.target.value)}>
        <option value="">Selecione a obra...</option>
        {obras.map(o=><option key={o.id} value={o.id}>{o.numero ? '#'+o.numero+' · ':''}{o.nome}</option>)}
      </select>
    </div>
    {erro && <p className="text-xs text-red-700 sm:col-span-2">{erro}</p>}
    {cliente && obras.length===0 && <p className="text-xs text-amber-700 sm:col-span-2">Nenhuma obra cadastrada para este cliente.</p>}
  </div>
}

export default function EntradaManualPage() {
  const [fornecedor,setFornecedor]=useState('')
  const [numeroRomaneio,setNumeroRomaneio]=useState('')
  const [dataDocumento,setDataDocumento]=useState(dataHoje)
  const [vencimento,setVencimento]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [clientePadrao,setClientePadrao]=useState<Cliente|null>(null)
  const [obraPadrao,setObraPadrao]=useState('')
  const [locais,setLocais]=useState<Local[]>([])
  const [localId,setLocalId]=useState('')
  const [produtoBusca,setProdutoBusca]=useState('')
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [itens,setItens]=useState<Item[]>([])
  const [salvando,setSalvando]=useState(false)
  const [permissao,setPermissao]=useState(false)
  const [consultando,setConsultando]=useState(true)
  const [erro,setErro]=useState('')
  const [sucesso,setSucesso]=useState<{ entradaId: string; contaPagarId?: string; valorTotal?: number; duplicado?: boolean }|null>(null)
  const [chaveIdempotencia,setChaveIdempotencia]=useState('')
  const [historico,setHistorico]=useState<Historico[]>([])
  const [historicoItens,setHistoricoItens]=useState<HistoricoItem[]>([])

  const consultar = useCallback<Consulta>(async params=>{
    const token=await tokenAtual()
    if(!token)throw new Error('Faça login novamente.')
    const resposta=await fetch('/api/compras/entrada-manual?'+new URLSearchParams(params),
      {headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
    const dados=await resposta.json().catch(()=>({}))
    if(!resposta.ok)throw new Error(dados.error || 'Falha na consulta.')
    return dados
  },[])
  useEffect(()=>{
    let ativo=true
    Promise.all([consultar({tipo:'permissoes'}),consultar({tipo:'locais'})])
      .then(([a,b])=>{
        if(!ativo)return
        setPermissao(Boolean(a.podeReceber));setLocais(b.locais || [])
        if(b.locais?.length===1)setLocalId(b.locais[0].id)
      }).catch(e=>{if(ativo)setErro(e.message)})
      .finally(()=>{if(ativo)setConsultando(false)})
    return ()=>{ativo=false}
  },[consultar])
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search)
    const clienteId=p.get('cliente') || '',obraId=p.get('obra') || ''
    if(!/^[0-9a-f-]{36}$/i.test(clienteId)||!/^[0-9a-f-]{36}$/i.test(obraId))return
    let ativo=true
    Promise.all([consultar({tipo:'clientePorId',clienteId}),consultar({tipo:'obras',clienteId})])
      .then(([a,b])=>{
        if(!ativo || !a.cliente || !(b.obras||[]).some((o:Obra)=>o.id===obraId))return
        setClientePadrao(a.cliente);setObraPadrao(obraId)
      }).catch(()=>{})
    return ()=>{ativo=false}
  },[consultar])
  useEffect(()=>{
    if(produtoBusca.trim().length<2){setProdutos([]);return}
    let ativo=true
    const t=setTimeout(()=>consultar({tipo:'produtos',q:produtoBusca})
      .then(r=>{if(ativo)setProdutos(r.produtos || [])})
      .catch(e=>{if(ativo)setErro(e.message)}),250)
    return ()=>{ativo=false;clearTimeout(t)}
  },[produtoBusca,consultar])
  useEffect(()=>{
    let ativo=true
    const filtro=obraPadrao?{tipo:'historico',obraId:obraPadrao}:{tipo:'historico',destino:'estoque'}
    consultar(filtro).then(r=>{if(ativo){setHistorico(r.entradas || []);setHistoricoItens(r.itens || [])}})
      .catch(()=>{if(ativo){setHistorico([]);setHistoricoItens([])}})
    return ()=>{ativo=false}
  },[obraPadrao,sucesso,consultar])

  function atualizarItem(index:number,campos:Partial<Item>){
    setItens(lista=>lista.map((i,n)=>n===index?{...i,...campos}:i))
    setErro('')
  }
  function adicionarProduto(p:Produto){
    setItens(lista=>{
      const index=lista.findIndex(i=>i.produto.id===p.id)
      if(index>=0)return lista.map((i,n)=>n===index?{...i,quantidade:String(numeroBR(i.quantidade)+1)}:i)
      return [...lista,{produto:p,quantidade:'1',custoUnitario:moeda(p.custo),
        destino:clientePadrao?'obra':'estoque',quantidadeObra:'',
        cliente:clientePadrao,obraId:obraPadrao}]
    })
    setProdutoBusca('');setProdutos([]);setErro('')
  }
  const requerEstoque=itens.some(i=>i.destino!=='obra')
  const total=useMemo(()=>itens.reduce((s,i)=>{
    const q=numeroBR(i.quantidade),c=numeroBR(i.custoUnitario)
    return s+(Number.isFinite(q)&&Number.isFinite(c)?q*c:0)
  },0),[itens])

  function limpar(){
    setFornecedor('');setNumeroRomaneio('');setDataDocumento(dataHoje());setVencimento('');setObservacoes('')
    setItens([]);setProdutoBusca('');setErro('');setSucesso(null);setChaveIdempotencia('')
  }
  async function salvar(){
    setErro('')
    if(!fornecedor.trim()||!numeroRomaneio.trim()||!dataDocumento)return setErro('Informe fornecedor, número e data do romaneio.')
    if(!itens.length)return setErro('Selecione ao menos um produto cadastrado.')
    if(requerEstoque&&!localId)return setErro('Escolha o Estoque Geral para os produtos destinados ao estoque.')
    const enviados=[]
    for(const [n,i] of itens.entries()){
      const q=numeroBR(i.quantidade),c=numeroBR(i.custoUnitario)
      if(!Number.isFinite(q)||q<=0||!Number.isFinite(c)||c<0||!i.custoUnitario.trim())
        return setErro(`Produto ${n+1}: informe quantidade e custo unitário.`)
      const destinos:{destino:'obra'|'estoque';quantidade:number;clienteId?:string;obraId?:string;localId?:string}[]=[]
      if(i.destino!=='estoque'){
        const qo=i.destino==='obra'?q:numeroBR(i.quantidadeObra)
        if(!i.cliente||!i.obraId)return setErro(`Produto ${n+1}: selecione o cliente e a obra.`)
        if(!Number.isFinite(qo)||qo<=0||(i.destino==='parcial'&&qo>=q))
          return setErro(`Produto ${n+1}: quantidade para obra deve ser maior que zero e menor que o total na divisão parcial.`)
        destinos.push({destino:'obra',quantidade:qo,clienteId:i.cliente.id,obraId:i.obraId})
      }
      if(i.destino!=='obra'){
        const quantidadeEstoque=i.destino==='estoque'?q:Math.round((q-numeroBR(i.quantidadeObra))*10000)/10000
        if(!Number.isFinite(quantidadeEstoque)||quantidadeEstoque<=0)return setErro(`Produto ${n+1}: confira a divisão do estoque.`)
        destinos.push({destino:'estoque',quantidade:quantidadeEstoque,localId})
      }
      if(Math.round(destinos.reduce((s,d)=>s+d.quantidade,0)*10000)!==Math.round(q*10000))
        return setErro(`Produto ${n+1}: a soma da obra e estoque precisa ser igual à quantidade recebida.`)
      enviados.push({produtoId:i.produto.id,quantidade:q,custoUnitario:c,destinos})
    }
    const chave=chaveIdempotencia || crypto.randomUUID()
    setChaveIdempotencia(chave);setSalvando(true)
    try{
      const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
      const r=await fetch('/api/compras/entrada-manual',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({fornecedor,numeroRomaneio,dataDocumento,vencimento:vencimento||null,
          observacoes,chaveIdempotencia:chave,itens:enviados}),
      })
      const dados=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(dados.error||'Falha ao registrar romaneio.')
      setSucesso(dados)
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.')}
    finally{setSalvando(false)}
  }

  if(consultando)return <div className="p-10 text-sm text-slate-500"><Loader2 size={17} className="mr-2 inline animate-spin"/>Verificando acesso...</div>
  return <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex gap-3">
        <Link href="/compras/entrada" className="mt-1 h-fit rounded-xl border bg-white p-2" aria-label="Voltar"><ArrowLeft size={20}/></Link>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Compras · Recebimento</p>
          <h1 className="text-2xl font-bold">Entrada Manual por Romaneio</h1>
          <p className="mt-1 text-sm text-slate-500">Produto cadastrado → quantidade → distribuição por produto → Contas a Pagar. Sem emitir nota fiscal.</p>
          <p className="mt-2 text-xs text-amber-700">Se chegar NF depois, confira a conciliação manualmente antes de lançar outra entrada física.</p>
        </div>
      </div>
      {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
      {!permissao?<div className="rounded-xl border bg-white p-5 text-sm">Sua conta não possui permissão para receber mercadorias.</div>:
       sucesso?<div className="rounded-2xl border bg-white p-6">
         <CheckCircle2 size={36} className="text-emerald-600"/>
         <h2 className="mt-3 text-xl font-semibold">Romaneio registrado</h2>
         <p className="mt-2 text-sm text-slate-600">Romaneio {numeroRomaneio} · {fornecedor}. {sucesso.duplicado?'Esta entrada já estava registrada: sem duplicidade.':'Distribuição por produto concluída, com registro financeiro vinculado.'}</p>
         {!sucesso.duplicado&&<p className="mt-2 text-sm">Valor do Contas a Pagar: <strong>{real(Number(sucesso.valorTotal||0))}</strong></p>}
         <div className="mt-4 flex flex-wrap gap-2">
           <Link href="/financeiro/contas-pagar" className="rounded-xl border px-4 py-2 text-sm font-semibold text-blue-700">Ver Contas a Pagar</Link>
           {obraPadrao&&<Link href={`/obras/${obraPadrao}`} className="rounded-xl border px-4 py-2 text-sm font-semibold text-blue-700">Ver obra</Link>}
           <button onClick={limpar} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Nova entrada</button>
         </div>
       </div>:<>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">1. Dados do romaneio e financeiro</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo titulo="Fornecedor *"><input className={input} value={fornecedor} maxLength={200} onChange={e=>setFornecedor(e.target.value)} placeholder="Fornecedor"/></Campo>
            <Campo titulo="Número do romaneio *"><input className={input} value={numeroRomaneio} maxLength={100} onChange={e=>setNumeroRomaneio(e.target.value)} placeholder="Nº ou referência"/></Campo>
            <Campo titulo="Data do romaneio *"><input className={input} type="date" value={dataDocumento} onChange={e=>setDataDocumento(e.target.value)}/></Campo>
            <Campo titulo="Vencimento (Contas a Pagar)"><input className={input} type="date" value={vencimento} onChange={e=>setVencimento(e.target.value)}/></Campo>
          </div>
          <div className="mt-4"><Campo titulo="Observações"><textarea className={input} rows={2} maxLength={2000} value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Romaneio, conferência ou avarias"/></Campo></div>
          <p className="mt-3 text-xs text-slate-600">Ao confirmar, uma conta será aberta pelo valor total. Sem vencimento, ficará como pendente de vencimento.</p>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">2. Buscar os produtos recebidos</h2>
          <p className="mt-1 text-xs text-slate-500">Pesquise por nome ou código, usando o cadastro existente. Perfis e acessórios exibem a imagem cadastrada ou aviso de ausência.</p>
          <div className="relative mt-4">
            <Search size={17} className="absolute left-3 top-3 text-slate-400"/>
            <input value={produtoBusca} onChange={e=>setProdutoBusca(e.target.value)} className={input+' pl-10'} placeholder="Digite o nome ou código do produto..."/>
            {produtos.length>0&&<div className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border bg-white shadow-xl">
              {produtos.map(p=><button type="button" key={p.id} onClick={()=>adicionarProduto(p)} className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-blue-50">
                <Foto src={p.foto_url} nome={p.nome}/><span className="flex-1"><strong className="block text-sm">{p.nome}</strong><span className="text-xs text-slate-500">{p.codigo||'Sem código'} · {p.unidade||'UN'}</span></span><Plus size={17}/></button>)}
            </div>}
          </div>
          {itens.length===0?<div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-slate-500"><ClipboardList size={25} className="mx-auto mb-2"/>Nenhum produto adicionado.</div>:
            <div className="mt-4 space-y-4">{itens.map((i,index)=>{
              const q=numeroBR(i.quantidade),qo=numeroBR(i.quantidadeObra)
              const estoque=i.destino==='estoque'?q:i.destino==='parcial'?Math.round((q-qo)*10000)/10000:0
              return <div key={i.produto.id} className="space-y-4 rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Foto src={i.produto.foto_url} nome={i.produto.nome}/>
                  <div className="min-w-[150px] flex-1"><strong className="block text-sm">{i.produto.nome}</strong>
                    <span className="text-xs text-slate-500">{i.produto.codigo||'Sem código'} · {i.produto.unidade||'UN'}</span></div>
                  <label className="text-xs text-slate-600">Quantidade recebida *<input className={input+' mt-1 w-36'} inputMode="decimal" value={i.quantidade} onChange={e=>atualizarItem(index,{quantidade:e.target.value})}/></label>
                  <label className="text-xs text-slate-600">Custo unitário (R$) *<input className={input+' mt-1 w-36'} inputMode="decimal" value={i.custoUnitario} onChange={e=>atualizarItem(index,{custoUnitario:e.target.value})}/></label>
                  <button type="button" title="Remover produto" onClick={()=>setItens(lista=>lista.filter((_,n)=>n!==index))} className="mt-4 rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={18}/></button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo titulo="Destino deste produto *">
                    <select className={input} value={i.destino} onChange={e=>atualizarItem(index,{destino:e.target.value as DestinoProduto})}>
                      <option value="estoque">Tudo para Estoque Geral</option>
                      <option value="obra">Tudo para Cliente / Obra</option>
                      <option value="parcial">Parcial: Cliente / Obra + Estoque</option>
                    </select>
                  </Campo>
                  {i.destino==='parcial'&&<Campo titulo="Quantidade para Cliente / Obra *">
                    <input className={input} inputMode="decimal" value={i.quantidadeObra} onChange={e=>atualizarItem(index,{quantidadeObra:e.target.value})} placeholder="Ex.: 4 de 10"/>
                  </Campo>}
                </div>
                {i.destino!=='estoque'&&<ClienteObra cliente={i.cliente} obraId={i.obraId}
                  onCliente={c=>atualizarItem(index,{cliente:c,obraId:''})}
                  onObra={obraId=>atualizarItem(index,{obraId})} consultar={consultar}/>}
                <p className="text-xs font-medium text-slate-600">
                  {i.destino==='obra'? `Para a obra: ${Number.isFinite(q)?q:'—'} ${i.produto.unidade||'UN'}`:
                   i.destino==='estoque'? `Para o estoque: ${Number.isFinite(q)?q:'—'} ${i.produto.unidade||'UN'}`:
                   `Para obra: ${Number.isFinite(qo)?qo:'—'} · Para estoque: ${Number.isFinite(estoque)?estoque:'—'} ${i.produto.unidade||'UN'}`}
                </p>
              </div>
            })}</div>}
          {requerEstoque&&<div className="mt-5 max-w-md"><Campo titulo="Local de Estoque Geral *">
            <select className={input} value={localId} onChange={e=>setLocalId(e.target.value)}>
              <option value="">Selecione o estoque...</option>{locais.map(l=><option key={l.id} value={l.id}>{l.nome} ({l.codigo})</option>)}
            </select>
          </Campo></div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div><p className="text-sm text-slate-600">{itens.length} produto(s) recebido(s) · Total para Contas a Pagar: <strong>{real(total)}</strong></p>
              <p className="text-xs text-slate-500">Cada item pode ter um destino diferente. A soma da divisão precisa fechar com o total recebido.</p></div>
            <button onClick={salvar} disabled={salvando||!itens.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {salvando?<Loader2 size={17} className="animate-spin"/>:<PackageCheck size={18}/>}
              {salvando?'Registrando...':'Confirmar entrada e Contas a Pagar'}
            </button>
          </div>
        </section>
      </>}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Histórico {obraPadrao?'da obra':'do Estoque Geral'}</h2>
        {!historico.length?<p className="mt-3 text-sm text-slate-500">Nenhum recebimento por romaneio neste destino.</p>:
          <div className="mt-4 space-y-3">{historico.map(h=><div key={h.id} className="rounded-xl border p-3">
            <strong className="text-sm">Romaneio {h.numero_romaneio} · {h.fornecedor_nome}</strong>
            <p className="text-xs text-slate-500">{new Date(h.data_documento+'T12:00:00').toLocaleDateString('pt-BR')} · {h.criado_por_nome}</p>
            <div className="mt-2 flex flex-wrap gap-2">{historicoItens.filter(i=>i.entrada_id===h.id).map(i=><div key={i.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
              <Foto src={i.produto?.foto_url} nome={i.descricao}/>{i.descricao} · <strong>{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade||'UN'}</strong>
            </div>)}</div>
          </div>)}</div>}
      </section>
    </div>
  </main>
}
