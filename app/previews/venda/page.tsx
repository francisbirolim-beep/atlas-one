'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, MapPin, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'
import ReciboVendaPreview, { cents, valorEntrada, rotuloPagamento, type LinhaPagamento, type FormaPagamento, type StatusPagamento } from '@/components/previews/ReciboVendaPreview'

type Cliente={id:string;nome:string;apelido?:string|null;cpf_cnpj?:string|null;telefone?:string|null;whatsapp?:string|null;cidade?:string|null}
type Obra={id:string;nome:string;cidade?:string|null;bairro?:string|null;endereco?:string|null}
type Produto={id:string;codigo:string;nome:string;descricao:string;categoria:string;unidade:string;linha:string|null;fotoUrl:string|null;fotoCandidataUrl?:string|null;preco:number|null;precoPromocional:number|null}
type Linha={id:string;nome:string;ativa:boolean}
type Item={produto:Produto;quantidade:number}
type Categoria='todos'|'perfil'|'acessorio'|'vidro'|'pronto'|'outros'
type Etapa=1|2|3
type Modo='busca'|'cadastro'|'consumidor'
type CadastroTipo='simples'|'completo'
type Cadastro={nome:string;apelido:string;whatsapp:string;telefone:string;email:string;cidade:string;cpfCnpj:string;endereco:string;bairro:string;cep:string;dataNascimento:string;origem:string;observacoes:string}

const vazio:Cadastro={nome:'',apelido:'',whatsapp:'',telefone:'',email:'',cidade:'',cpfCnpj:'',endereco:'',bairro:'',cep:'',dataNascimento:'',origem:'outros',observacoes:''}
const categorias:{id:Categoria;nome:string}[]=[
  {id:'todos',nome:'Todos'},{id:'perfil',nome:'Perfis'},{id:'acessorio',nome:'Acessórios'},
  {id:'vidro',nome:'Vidros'},{id:'pronto',nome:'Produtos prontos'},{id:'outros',nome:'Outros'}
]
const origens=['indicacao','arquiteto','engenheiro','construtora','instagram','facebook','google','whatsapp','cliente_antigo','passou_na_frente','outros']
const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const preco=(p:Produto)=>p.precoPromocional!=null&&p.precoPromocional>0?p.precoPromocional:p.preco
const nomeInteiro=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length>=2

export default function PreviaVenda(){
  const [etapa,setEtapa]=useState<Etapa>(1)
  const [modo,setModo]=useState<Modo>('busca')
  const [tipoCadastro,setTipoCadastro]=useState<CadastroTipo>('simples')
  const [cadastro,setCadastro]=useState<Cadastro>(vazio)
  const [buscaCliente,setBuscaCliente]=useState('')
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [cliente,setCliente]=useState<Cliente|null>(null)
  const [obras,setObras]=useState<Obra[]>([])
  const [obraId,setObraId]=useState('')
  const [buscandoClientes,setBuscandoClientes]=useState(false)
  const [erroClientes,setErroClientes]=useState('')
  const [aviso,setAviso]=useState('')
  const [buscaProduto,setBuscaProduto]=useState('')
  const [categoria,setCategoria]=useState<Categoria>('todos')
  const [linha,setLinha]=useState('')
  const [linhas,setLinhas]=useState<Linha[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [buscandoProdutos,setBuscandoProdutos]=useState(false)
  const [erroProdutos,setErroProdutos]=useState('')
  const [itens,setItens]=useState<Item[]>([])
  const [tipoDesconto,setTipoDesconto]=useState<'sem'|'valor'|'percentual'>('sem')
  const [descontoEntrada,setDescontoEntrada]=useState('')
  const [tipoRecebimento,setTipoRecebimento]=useState<'agora'|'marcar'>('agora')
  const [pagamentos,setPagamentos]=useState<LinhaPagamento[]>([{id:1,forma:'pix',valor:''}])
  const proximoPagamentoId=useRef(1)
  const [nomeAssinatura,setNomeAssinatura]=useState('')
  const [reciboAberto,setReciboAberto]=useState(false)
  const [dataRecibo,setDataRecibo]=useState('')
  const [fotosLocais,setFotosLocais]=useState<Record<string,string>>({})
  const [fotosConfirmadas,setFotosConfirmadas]=useState<Record<string,boolean>>({})
  const fotosRef=useRef<Record<string,string>>({})
  const consultaClientesSeq=useRef(0)
  const consultaProdutosSeq=useRef(0)

  useEffect(()=>()=>{Object.values(fotosRef.current).forEach(url=>URL.revokeObjectURL(url))},[])
  function selecionarFoto(id:string,arquivo:File|null){
    const novas={...fotosRef.current}
    if(novas[id])URL.revokeObjectURL(novas[id])
    if(arquivo)novas[id]=URL.createObjectURL(arquivo)
    else delete novas[id]
    fotosRef.current=novas;setFotosLocais(novas)
  }
  function atualizarCadastro(k:keyof Cadastro,v:string){setCadastro(a=>({...a,[k]:v}));setAviso('')}
  function campo(k:keyof Cadastro,rotulo:string,placeholder=''){
    return <label key={k} className="block text-xs font-semibold text-slate-700">{rotulo}
      <input value={cadastro[k]} onChange={e=>atualizarCadastro(k,e.target.value)} placeholder={placeholder} className={input+' mt-1.5'}/>
    </label>
  }

  useEffect(()=>{
    if(etapa!==1||modo!=='busca'||cliente||buscaCliente.trim().length<2){
      consultaClientesSeq.current++;setClientes([]);setBuscandoClientes(false);return
    }
    const seq=++consultaClientesSeq.current
    const ctrl=new AbortController()
    setBuscandoClientes(true)
    const timer=setTimeout(()=>void (async()=>{
      try{
        const t=await tokenAtual();if(!t)throw Error('Sessão expirada.')
        const r=await fetch('/api/previews/comercial?tipo=clientes&q='+encodeURIComponent(buscaCliente.trim()),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao procurar cliente.')
        if(seq===consultaClientesSeq.current){setClientes(j.clientes||[]);setErroClientes('')}
      }catch(e){if((e as {name?:string})?.name!=='AbortError'&&seq===consultaClientesSeq.current)setErroClientes(e instanceof Error?e.message:'Falha ao pesquisar.')}
      finally{if(seq===consultaClientesSeq.current)setBuscandoClientes(false)}
    })(),220)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[etapa,modo,cliente,buscaCliente])

  useEffect(()=>{
    setObras([]);setObraId('')
    if(!cliente?.id||cliente.id.startsWith('previa:'))return
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const t=await tokenAtual();if(!t)return
        const r=await fetch('/api/previews/comercial?tipo=obras&clienteId='+encodeURIComponent(cliente.id),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(r.ok&&!ctrl.signal.aborted)setObras(j.obras||[])
      }catch{}
    })()
    return()=>ctrl.abort()
  },[cliente?.id])

  useEffect(()=>{
    if(etapa!==2){consultaProdutosSeq.current++;setBuscandoProdutos(false);return}
    const seq=++consultaProdutosSeq.current
    const ctrl=new AbortController()
    setBuscandoProdutos(true)
    const timer=setTimeout(()=>void (async()=>{
      try{
        const t=await tokenAtual();if(!t)throw Error('Sessão expirada.')
        const params=new URLSearchParams({tipo:'produtos',q:buscaProduto,categoria})
        if(linha)params.set('linhaId',linha)
        const r=await fetch('/api/previews/comercial?'+params.toString(),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao procurar produtos.')
        if(seq===consultaProdutosSeq.current){setProdutos(j.produtos||[]);setLinhas(j.linhas||[]);setErroProdutos('')}
      }catch(e){if((e as {name?:string})?.name!=='AbortError'&&seq===consultaProdutosSeq.current){setErroProdutos(e instanceof Error?e.message:'Falha ao pesquisar.');setProdutos([])}}
      finally{if(seq===consultaProdutosSeq.current)setBuscandoProdutos(false)}
    })(),buscaProduto?230:60)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[etapa,buscaProduto,categoria,linha])

  const nomeCliente=modo==='consumidor'?'Consumidor final':cliente?.nome||'Cliente não escolhido'
  const obra=obras.find(o=>o.id===obraId)
  // Valores em centavos para não somar frações de real com erro de arredondamento.
  const subtotalCent=useMemo(()=>itens.reduce((s,i)=>s+cents(preco(i.produto)||0)*i.quantidade,0),[itens])
  const brutoDesconto=cents(tipoDesconto==='percentual'?subtotalCent/100*valorEntrada(descontoEntrada)/100:tipoDesconto==='valor'?valorEntrada(descontoEntrada):0)
  const descontoInvalido=tipoDesconto==='percentual'?valorEntrada(descontoEntrada)>100:brutoDesconto>subtotalCent
  const descontoCent=tipoDesconto==='percentual'?Math.round(subtotalCent*valorEntrada(descontoEntrada)/100):brutoDesconto
  const totalLiquidoCent=Math.max(0,subtotalCent-descontoCent)
  const recebidoCent=tipoRecebimento==='marcar'?0:pagamentos.reduce((s,p)=>s+cents(valorEntrada(p.valor)),0)
  const saldoCent=Math.max(0,totalLiquidoCent-recebidoCent)
  const total=subtotalCent/100
  const totalLiquido=totalLiquidoCent/100
  const recebido=recebidoCent/100
  const saldo=saldoCent/100
  const podeMarcar=!!cliente&&(modo==='busca'||(modo==='cadastro'&&tipoCadastro==='completo'))
  const statusFinanceiro:StatusPagamento=tipoRecebimento==='marcar'?'marcada':saldoCent>0?'parcial':'quitada'
  const formasRecibo=tipoRecebimento==='marcar'?[]:pagamentos.filter(p=>cents(valorEntrada(p.valor))>0).map(p=>({forma:p.forma,valor:cents(valorEntrada(p.valor))/100}))

  const pendentes=itens.filter(i=>preco(i.produto)==null).length
  const unidades=itens.reduce((s,i)=>s+i.quantidade,0)

  function mudarModo(novo:Modo){
    setModo(novo);setCliente(null);setBuscaCliente('');setClientes([]);setObraId('');setAviso('')
  }
  function cadastrarEContinuar(){
    if(!nomeInteiro(cadastro.nome)){setAviso('Informe o nome e o sobrenome do cliente.');return}
    if(!cadastro.cidade.trim()){setAviso('Informe a cidade do cliente.');return}
    if(cadastro.whatsapp.replace(/\D/g,'').length<10){setAviso('Informe o WhatsApp com DDD.');return}
    if(tipoCadastro==='completo'&&(!cadastro.cpfCnpj.trim()||!cadastro.endereco.trim())){
      setAviso('No cadastro completo, informe também o CPF/CNPJ e o endereço.');return
    }
    setCliente({id:'previa:'+Date.now(),nome:cadastro.nome.trim(),cpf_cnpj:cadastro.cpfCnpj.trim(),whatsapp:cadastro.whatsapp.trim(),telefone:cadastro.telefone.trim(),cidade:cadastro.cidade.trim()})
    setAviso('');setEtapa(2)
  }
  function prosseguir(){
    if(modo==='busca'&&!cliente){setAviso('Localize o cliente ou escolha cadastro simples/completo.');return}
    if(modo==='cadastro'){cadastrarEContinuar();return}
    setAviso('');setEtapa(2)
  }
  function adicionar(p:Produto){
    setItens(a=>{const i=a.find(x=>x.produto.id===p.id);return i?a.map(x=>x.produto.id===p.id?{...x,quantidade:x.quantidade+1}:x):[...a,{produto:p,quantidade:1}]})
  }
  function quantidade(id:string,d:number){
    setItens(a=>a.map(i=>i.produto.id===id?{...i,quantidade:Math.max(0,i.quantidade+d)}:i).filter(i=>i.quantidade>0))
  }
  function revisar(){
    if(!itens.length){setAviso('Adicione pelo menos um produto para continuar.');return}
    if(pendentes>0){setAviso('Há itens sem preço cadastrado. Informe os preços no catálogo antes de finalizar uma venda.');return}
    if(descontoInvalido){setAviso('O desconto não pode ultrapassar o subtotal nem 100%.');return}
    if(totalLiquidoCent<=0){setAviso('O valor final da venda deve ser maior que zero.');return}
    if(tipoRecebimento==='marcar'){
      if(!podeMarcar){setAviso('Para deixar a venda marcada, escolha um cliente cadastrado ou faça o cadastro completo.');return}
    }else{
      if(recebidoCent<=0){setAviso('Informe o valor que será recebido, ou escolha deixar marcado no cliente.');return}
      if(recebidoCent>totalLiquidoCent){setAviso('A soma dos recebimentos supera o total com desconto.');return}
      if(saldoCent>0&&!podeMarcar){setAviso('Pagamento parcial exige cliente cadastrado ou cadastro completo para marcar o saldo.');return}
    }
    setAviso('');setEtapa(3)
  }
  function atualizarPagamento(id:number,parcial:Partial<LinhaPagamento>){
    setPagamentos(a=>a.map(p=>p.id===id?{...p,...parcial}:p))
    setAviso('')
  }
  function adicionarPagamento(){
    proximoPagamentoId.current+=1
    setPagamentos(a=>[...a,{id:proximoPagamentoId.current,forma:'pix',valor:''}])
  }
  function completarRestante(id:number){
    const outros=pagamentos.filter(p=>p.id!==id).reduce((s,p)=>s+cents(valorEntrada(p.valor)),0)
    atualizarPagamento(id,{valor:(Math.max(0,totalLiquidoCent-outros)/100).toFixed(2).replace('.',',')})
  }
  function simularFinalizacao(){
    setDataRecibo(new Date().toISOString())
    setReciboAberto(true)
  }
  function resetar(){setEtapa(1);setModo('busca');setCliente(null);setBuscaCliente('');setObraId('');setCadastro(vazio);setItens([]);setAviso('');setTipoRecebimento('agora');setTipoDesconto('sem');setDescontoEntrada('');setPagamentos([{id:1,forma:'pix',valor:''}]);setNomeAssinatura('');setReciboAberto(false)}

  return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-16 pt-5 text-slate-900 sm:px-6 lg:px-8">
   <div className="mx-auto max-w-[1420px] space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-xl border bg-white p-2.5 text-slate-600" aria-label="Voltar ao início"><ArrowLeft size={19}/></Link>
        <div><p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Atlas One / Comercial / Prévia</p>
          <h1 className="text-2xl font-black sm:text-3xl">Nova Venda</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Primeiro procure o cliente. Depois escolha a obra, os itens e o pagamento.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">PRÉVIA · SEM GRAVAR VENDAS</span>
        <Link href="/previews/consulta-preco" className="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold">Consulta de Preço</Link>
      </div>
    </header>
    <nav aria-label="Etapas da venda" className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-2 shadow-sm">
      {([{n:1,nome:'Cliente e obra'},{n:2,nome:'Produtos e pagamento'},{n:3,nome:'Revisão'}] as const).map(x=>
        <div key={x.n} className={'flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-[11px] font-bold sm:text-sm '+(etapa===x.n?'bg-blue-700 text-white':etapa>x.n?'bg-emerald-50 text-emerald-800':'text-slate-400')}>
          <span className={'grid h-6 w-6 shrink-0 place-items-center rounded-full '+(etapa===x.n?'bg-white/20':'bg-slate-100 text-slate-700')}>{etapa>x.n?<Check size={13}/>:x.n}</span>{x.nome}
        </div>)}
    </nav>
    {aviso&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{aviso}</p>}

    {etapa===1&&<>
      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-black"><UsersRound size={22} className="text-blue-700"/> Identificar cliente</h2>
            <p className="mt-1 text-xs text-slate-500">A venda abre diretamente nesta busca. Digite nome, sobrenome, documento ou WhatsApp.</p>
          </div>
          {modo!=='busca'&&<button type="button" onClick={()=>mudarModo('busca')} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">Voltar à busca</button>}
        </div>

        {modo==='busca'&&<div className="mt-4">
          {cliente?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div><b className="text-sm">{cliente.nome}</b><p className="mt-1 text-xs text-blue-700">{cliente.cpf_cnpj||cliente.whatsapp||cliente.telefone||'Sem documento'} · {cliente.cidade||'Cidade não informada'}</p></div>
            <button type="button" onClick={()=>{setCliente(null);setBuscaCliente('')}} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Trocar cliente</button>
          </div>:<>
            <div className="relative"><Search size={19} className="absolute left-3 top-3 text-slate-400"/><input autoFocus autoComplete="off" className={input+' pl-11 text-base'} placeholder="Buscar cliente por nome, CPF/CNPJ ou WhatsApp..." value={buscaCliente} onInput={e=>setBuscaCliente(e.currentTarget.value)} onCompositionUpdate={e=>setBuscaCliente(e.currentTarget.value)}/></div>
            {buscandoClientes&&<p className="mt-2 text-xs text-slate-500">Procurando clientes...</p>}
            {erroClientes&&<p role="alert" className="mt-2 text-xs text-red-700">{erroClientes}</p>}
            {!!clientes.length&&<div className="mt-2 max-h-64 overflow-y-auto rounded-xl border">{clientes.map(p=><button type="button" key={p.id} onClick={()=>{setCliente(p);setClientes([]);setAviso('')}} className="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-blue-50 last:border-0">
              <span><b className="block text-sm">{p.nome}</b><span className="text-xs text-slate-500">{p.cpf_cnpj||p.whatsapp||p.telefone||'Sem documento/telefone'}{p.cidade?' · '+p.cidade:''}</span></span><ChevronRight size={16}/>
            </button>)}</div>}
            {buscaCliente.trim().length>=2&&!buscandoClientes&&!clientes.length&&!erroClientes&&<p className="mt-3 text-xs text-slate-600">Cliente não encontrado? Você pode cadastrá-lo agora.</p>}
          </>}
          {!cliente&&<div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
            <button type="button" onClick={()=>{mudarModo('cadastro');setTipoCadastro('simples')}} className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left hover:border-blue-500"><UserPlus className="shrink-0 text-blue-700"/><span><b className="block text-sm">Deseja cadastrar o cliente?</b><span className="mt-1 block text-xs text-slate-600">Cadastro simples ou completo, aqui mesmo.</span></span></button>
            <button type="button" onClick={()=>mudarModo('consumidor')} className="flex items-start gap-3 rounded-xl border p-4 text-left hover:border-blue-500"><ShoppingBag className="shrink-0 text-emerald-700"/><span><b className="block text-sm">Venda avulsa ao consumidor</b><span className="mt-1 block text-xs text-slate-600">Sem identificação e sem obra vinculada.</span></span></button>
          </div>}
        </div>}

        {modo==='cadastro'&&<div className="mt-5 space-y-4">
          <h3 className="text-base font-black">Cadastrar novo cliente</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={tipoCadastro==='simples'} onClick={()=>setTipoCadastro('simples')} className={'rounded-xl border p-3 text-left text-xs font-bold '+(tipoCadastro==='simples'?'border-blue-600 bg-blue-50 text-blue-800':'border-slate-200')}>Cadastro simples<span className="mt-1 block font-normal text-slate-500">Nome e sobrenome, cidade, WhatsApp</span></button>
            <button type="button" aria-pressed={tipoCadastro==='completo'} onClick={()=>setTipoCadastro('completo')} className={'rounded-xl border p-3 text-left text-xs font-bold '+(tipoCadastro==='completo'?'border-blue-600 bg-blue-50 text-blue-800':'border-slate-200')}>Cadastro completo<span className="mt-1 block font-normal text-slate-500">Dados adicionais do cadastro Atlas</span></button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {campo('nome','Nome e sobrenome *','Nome completo')}
            {campo('cidade','Cidade *','Cidade do cliente')}
            {campo('whatsapp','WhatsApp com DDD *','(17) 99999-9999')}
          </div>
          {tipoCadastro==='completo'&&<div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <h4 className="mb-3 text-sm font-black">Dados adicionais do cadastro completo</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {campo('apelido','Apelido / nome fantasia')}
              {campo('cpfCnpj','CPF / CNPJ *')}
              {campo('telefone','Telefone alternativo')}
              {campo('email','E-mail')}
              {campo('endereco','Endereço *')}
              {campo('bairro','Bairro')}
              {campo('cep','CEP')}
              {campo('dataNascimento','Data de nascimento')}
              <label className="text-xs font-semibold text-slate-700">Origem do cliente<select value={cadastro.origem} className={input+' mt-1.5'} onChange={e=>atualizarCadastro('origem',e.target.value)}>{origens.map(o=><option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-700">Observações<textarea rows={2} className={input+' mt-1.5'} value={cadastro.observacoes} onChange={e=>atualizarCadastro('observacoes',e.target.value)}/></label>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Campos do cadastro completo existente. As regras definitivas de obrigatoriedade serão respeitadas na integração com o sistema.</p>
          </div>}
          <p className="text-[11px] font-semibold text-amber-700">Prévia: os dados não são gravados no cadastro real.</p>
          <button type="button" onClick={cadastrarEContinuar} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-extrabold text-white">Próximo: escolher itens <ArrowRight size={17}/></button>
        </div>}

        {modo==='consumidor'&&<div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="flex items-center gap-2 font-black text-emerald-900"><ShoppingBag size={20}/> Venda comum · Consumidor final</h3>
          <p className="mt-1 text-xs text-emerald-800">Sem cadastro nem vínculo de obra. Para ter histórico identificado, utilize o cadastro simples ou completo.</p>
          <button type="button" onClick={prosseguir} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">Próximo: escolher itens <ArrowRight size={16}/></button>
        </div>}
      </section>

      {modo==='busca'&&cliente&&<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 font-black"><MapPin size={19} className="text-blue-700"/> Vincular alguma obra?</h3>
        <p className="mt-1 text-xs text-slate-500">Opcional: a venda pode ficar apenas no cadastro do cliente.</p>
        <div className="mt-4 space-y-2">
          <label className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm '+(!obraId?'border-blue-500 bg-blue-50':'border-slate-200')}><input type="radio" name="obra" checked={!obraId} onChange={()=>setObraId('')}/> Venda vinculada ao cliente, sem obra</label>
          {obras.map(o=><label key={o.id} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm '+(obraId===o.id?'border-blue-500 bg-blue-50':'border-slate-200')}><input type="radio" name="obra" checked={obraId===o.id} onChange={()=>setObraId(o.id)}/><span><b>{o.nome}</b><span className="ml-2 text-xs text-slate-500">{o.cidade||''}</span></span></label>)}
          {!obras.length&&<p className="text-xs text-slate-500">Nenhuma obra vinculada disponível nesta prévia.</p>}
        </div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={prosseguir} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-extrabold text-white">Próximo: escolher itens <ArrowRight size={17}/></button></div>
      </section>}
    </>}

    {etapa===2&&<>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div><p className="text-[11px] font-bold text-blue-600">Atendimento</p><b className="text-sm text-blue-950">{nomeCliente}</b><p className="text-xs text-blue-800">{modo==='consumidor'?'Venda sem cadastro':obra?'Obra: '+obra.nome:'Venda no cadastro do cliente, sem obra'}</p></div>
        <button type="button" onClick={()=>{setAviso('');setEtapa(1)}} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold">Alterar cliente ou obra</button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><Search size={19} className="text-blue-700"/> Procurar itens</h2>
          <p className="mt-1 text-xs text-slate-500">Busca geral por código, nome ou descrição. Também é possível filtrar por tipo e por linha técnica.</p>
          <div className="relative mt-4"><Search size={18} className="absolute left-3 top-3 text-slate-400"/><input className={input+' pl-10'} value={buscaProduto} onInput={e=>setBuscaProduto(e.currentTarget.value)} onCompositionUpdate={e=>setBuscaProduto(e.currentTarget.value)} placeholder="Ex.: janela de correr duas folhas, roldana, SU 008..."/></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {categorias.map(cat=><button type="button" key={cat.id} aria-pressed={categoria===cat.id} onClick={()=>{setCategoria(cat.id);setLinha('')}} className={'rounded-xl border px-2 py-2.5 text-xs font-bold '+(categoria===cat.id?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-slate-50 text-slate-600')}>{cat.nome}</button>)}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1 text-xs font-bold text-slate-600">Filtrar por linha técnica<select className={input+' mt-1.5'} value={linha} onChange={e=>setLinha(e.target.value)}><option value="">Todas as linhas vinculadas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}{!l.ativa?' (histórica)':''}</option>)}</select></label>
            <button type="button" onClick={()=>{setBuscaProduto('');setCategoria('todos');setLinha('')}} className="rounded-xl border px-4 py-2.5 text-xs font-bold">Limpar filtros</button>
          </div>
          {buscandoProdutos&&<p className="mt-3 text-xs text-slate-500">Buscando no catálogo...</p>}
          {erroProdutos&&<p role="alert" className="mt-3 text-xs text-red-700">{erroProdutos}</p>}
          {!buscandoProdutos&&!erroProdutos&&!produtos.length&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Nenhum produto vinculado à seleção. Troque a linha, categoria ou busca.</p>}
          <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">{produtos.map(p=>
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <FotoProdutoPreview nome={p.nome} fotoUrl={p.fotoUrl} fotoCandidataUrl={p.fotoCandidataUrl} candidataConfirmada={!!fotosConfirmadas[p.id]} onConfirmarCandidata={confirmado=>setFotosConfirmadas(a=>({...a,[p.id]:confirmado}))} tamanho="pequeno" imagemLocal={fotosLocais[p.id]} onSelecionarImagem={arquivo=>selecionarFoto(p.id,arquivo)}/>
              <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{p.nome}</b><p className="mt-1 text-[11px] text-slate-500">{p.codigo||'Sem código'} · {p.unidade}{p.linha?' · '+p.linha:''}</p><p className={preco(p)!=null?'mt-1 text-sm font-extrabold text-blue-700':'mt-1 text-xs font-bold text-amber-700'}>{preco(p)!=null?moeda(preco(p)!):'Preço a cadastrar'}</p></div>
              <button type="button" onClick={()=>adicionar(p)} className="shrink-0 rounded-lg bg-blue-700 p-2.5 text-white" aria-label={'Adicionar '+p.nome}><Plus size={18}/></button>
            </div>)}
          </div>
          <p className="mt-3 text-[11px] text-amber-700">Fotos importadas vinculadas ao produto precisam de conferência antes de aparecer. Use “Conferir foto cadastrada” ou “Adicionar imagem correta”. Nenhuma imagem é salva na prévia.</p>
        </section>
        <aside className="rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <h3 className="flex items-center gap-2 font-black"><ShoppingCart size={19} className="text-blue-700"/> Itens da venda <span className="ml-auto rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{unidades}</span></h3>
          {!itens.length&&<div className="mt-4 grid min-h-32 place-items-center rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Escolha um item à esquerda para começar a venda.</div>}
          <div className="mt-3 space-y-3">{itens.map(i=><div key={i.produto.id} className="border-b pb-3 last:border-0">
            <div className="flex gap-2"><FotoProdutoPreview nome={i.produto.nome} fotoUrl={i.produto.fotoUrl} fotoCandidataUrl={i.produto.fotoCandidataUrl} candidataConfirmada={!!fotosConfirmadas[i.produto.id]} onConfirmarCandidata={confirmado=>setFotosConfirmadas(a=>({...a,[i.produto.id]:confirmado}))} tamanho="pequeno" imagemLocal={fotosLocais[i.produto.id]} onSelecionarImagem={arquivo=>selecionarFoto(i.produto.id,arquivo)}/>
              <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{i.produto.nome}</b><p className="mt-1 text-[11px] text-slate-500">{preco(i.produto)!=null?moeda(preco(i.produto)!):'Preço pendente'} /{i.produto.unidade}</p>
                <div className="mt-2 flex items-center gap-1"><button type="button" onClick={()=>quantidade(i.produto.id,-1)} className="rounded border p-1.5" aria-label="Diminuir quantidade"><Minus size={13}/></button><span className="min-w-7 text-center text-xs font-bold">{i.quantidade}</span><button type="button" onClick={()=>quantidade(i.produto.id,1)} className="rounded border p-1.5" aria-label="Aumentar quantidade"><Plus size={13}/></button><button type="button" onClick={()=>setItens(a=>a.filter(x=>x.produto.id!==i.produto.id))} className="ml-auto rounded p-1.5 text-red-600" aria-label="Remover produto"><Trash2 size={14}/></button></div>
              </div>
            </div>
          </div>)}</div>
          <div className="mt-4 border-t pt-4"><p className="flex justify-between text-xs text-slate-500"><span>Quantidade de unidades</span><b>{unidades}</b></p><div className="mt-2 flex justify-between"><b>Total conhecido</b><b className="text-xl text-blue-800">{moeda(total)}</b></div>{pendentes>0&&<p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{pendentes} produto(s) sem preço. O total não é definitivo.</p>}</div>
          <label className="mt-4 block text-xs font-bold text-slate-600">Forma de pagamento (prévia)
            <select className={input+' mt-1.5'} value={pagamento} onChange={e=>setPagamento(e.target.value)}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option>{modo!=='consumidor'&&<><option value="boleto">Boleto</option><option value="prazo">A prazo</option></>}</select>
          </label>
          <button type="button" onClick={revisar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white">Revisar venda <ArrowRight size={17}/></button>
        </aside>
      </div>
    </>}

    {etapa===3&&<section className="mx-auto max-w-3xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardCheck size={28}/></div>
      <h2 className="mt-3 text-center text-xl font-black">Revisão da venda</h2>
      <p className="mt-1 text-center text-xs text-slate-500">Confira a simulação antes de desenvolver a finalização real.</p>
      <div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p><span className="block text-xs text-slate-500">Cliente</span><b>{nomeCliente}</b></p>
        <p><span className="block text-xs text-slate-500">Vínculo</span><b>{modo==='consumidor'?'Venda avulsa':obra?'Obra: '+obra.nome:'Cadastro do cliente sem obra'}</b></p>
        <p><span className="block text-xs text-slate-500">Pagamento</span><b>{({pix:'PIX',dinheiro:'Dinheiro',debito:'Cartão de débito',credito:'Cartão de crédito',boleto:'Boleto',prazo:'A prazo'} as Record<string,string>)[pagamento]}</b></p>
        <p><span className="block text-xs text-slate-500">Produtos</span><b>{itens.length} item(ns) · {unidades} unidade(s)</b></p>
      </div>
      <div className="mt-5 space-y-3">{itens.map(i=><div key={i.produto.id} className="flex justify-between gap-3 border-b pb-3 text-sm"><span><b>{i.quantidade} × {i.produto.nome}</b><span className="block text-xs text-slate-500">{i.produto.codigo||'Sem código'}</span></span><b className="shrink-0">{preco(i.produto)!=null?moeda(preco(i.produto)!*i.quantidade):'A precificar'}</b></div>)}</div>
      <div className="mt-5 flex justify-between rounded-xl bg-blue-50 p-4"><b>Total conhecido</b><b className="text-2xl font-black text-blue-900">{moeda(total)}</b></div>
      {pendentes>0&&<p className="mt-3 text-xs text-amber-800">Existem itens sem preço, portanto este total não é definitivo.</p>}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><b>Esta é uma prévia:</b> nenhum cadastro, venda, pagamento, obra, estoque ou foto será gravado. O fluxo definitivo será implementado somente depois da sua aprovação.</div>
      <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={()=>{setAviso('');setEtapa(2)}} className="rounded-xl border px-4 py-3 text-xs font-bold">Voltar aos itens</button><button type="button" onClick={resetar} className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white">Nova simulação</button></div>
    </section>}
   </div>
  </main>
}
