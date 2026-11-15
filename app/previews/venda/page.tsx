'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, MapPin, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { lerDadosEmpresa } from '@/lib/configGeral'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'
import ReciboVendaPreview, { cents, valorEntrada, rotuloPagamento, type LinhaPagamento, type FormaPagamento, type StatusPagamento, type EmpresaRecibo } from '@/components/previews/ReciboVendaPreview'

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
  const [empresa,setEmpresa]=useState<EmpresaRecibo|null>(null)
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
  const [precoFiltro,setPrecoFiltro]=useState<'todos'|'com'|'sem'>('todos')
  const [linhas,setLinhas]=useState<Linha[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [buscandoProdutos,setBuscandoProdutos]=useState(false)
  const [erroProdutos,setErroProdutos]=useState('')
  const [itens,setItens]=useState<Item[]>([])
  const [quantidadeDigitada,setQuantidadeDigitada]=useState<Record<string,string>>({})
  const [tipoDesconto,setTipoDesconto]=useState<'sem'|'valor'|'percentual'>('sem')
  const [descontoEntrada,setDescontoEntrada]=useState('')
  const [tipoRecebimento,setTipoRecebimento]=useState<'agora'|'marcar'>('agora')
  const [pagamentos,setPagamentos]=useState<LinhaPagamento[]>([{id:1,forma:'pix',valor:''}])
  const proximoPagamentoId=useRef(1)
  const [nomeAssinatura,setNomeAssinatura]=useState('')
  const [reciboAberto,setReciboAberto]=useState(false)
  const [dataRecibo,setDataRecibo]=useState('')
  const [fotosLocais,setFotosLocais]=useState<Record<string,string>>({})
  const [fotosOcultas,setFotosOcultas]=useState<Record<string,boolean>>({})
  const fotosRef=useRef<Record<string,string>>({})
  const consultaClientesSeq=useRef(0)
  const consultaProdutosSeq=useRef(0)

  useEffect(()=>()=>{Object.values(fotosRef.current).forEach(url=>URL.revokeObjectURL(url))},[])
  useEffect(()=>{let vivo=true;void lerDadosEmpresa().then(d=>{if(vivo)setEmpresa(d||null)}).catch(()=>{});return()=>{vivo=false}},[])
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
        const params=new URLSearchParams({tipo:'produtos',q:buscaProduto,categoria,precoFiltro})
        if(linha)params.set('linhaId',linha)
        const r=await fetch('/api/previews/comercial?'+params.toString(),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao procurar produtos.')
        if(seq===consultaProdutosSeq.current){setProdutos(j.produtos||[]);setLinhas(j.linhas||[]);setErroProdutos('')}
      }catch(e){if((e as {name?:string})?.name!=='AbortError'&&seq===consultaProdutosSeq.current){setErroProdutos(e instanceof Error?e.message:'Falha ao pesquisar.');setProdutos([])}}
      finally{if(seq===consultaProdutosSeq.current)setBuscandoProdutos(false)}
    })(),buscaProduto?230:60)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[etapa,buscaProduto,categoria,linha,precoFiltro])

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
  function digitarQuantidade(id:string,valor:string){
    // Permite escrever diretamente 10, 25, 100 etc., sem perder o texto durante a digitação.
    if(!/^\d{0,5}$/.test(valor))return
    setQuantidadeDigitada(a=>({...a,[id]:valor}))
    const qtd=Number(valor)
    if(valor!=='' && Number.isInteger(qtd)&&qtd>=1&&qtd<=99999)
      setItens(a=>a.map(i=>i.produto.id===id?{...i,quantidade:qtd}:i))
  }
  function confirmarQuantidade(id:string){
    setQuantidadeDigitada(a=>{const b={...a};delete b[id];return b})
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
  function resetar(){setEtapa(1);setModo('busca');setCliente(null);setBuscaCliente('');setObraId('');setCadastro(vazio);setItens([]);setQuantidadeDigitada({});setAviso('');setTipoRecebimento('agora');setTipoDesconto('sem');setDescontoEntrada('');setPagamentos([{id:1,forma:'pix',valor:''}]);setNomeAssinatura('');setReciboAberto(false)}

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
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-xs font-bold text-slate-600">Filtrar por linha técnica
              <select className={input+' mt-1.5'} value={linha} onChange={e=>setLinha(e.target.value)}><option value="">Todas as linhas vinculadas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}{!l.ativa?' (histórica)':''}</option>)}</select>
            </label>
            <label className="block text-xs font-bold text-slate-600">Filtrar por preço
              <select className={input+' mt-1.5'} value={precoFiltro} onChange={e=>setPrecoFiltro(e.target.value as 'todos'|'com'|'sem')}><option value="todos">Todos os preços</option><option value="com">Com preço</option><option value="sem">Sem preço</option></select>
            </label>
            <button type="button" onClick={()=>{setBuscaProduto('');setCategoria('todos');setLinha('');setPrecoFiltro('todos')}} className="rounded-xl border px-4 py-2.5 text-xs font-bold">Limpar filtros</button>
          </div>
          {buscandoProdutos&&<p className="mt-3 text-xs text-slate-500">Buscando no catálogo...</p>}
          {erroProdutos&&<p role="alert" className="mt-3 text-xs text-red-700">{erroProdutos}</p>}
          {!buscandoProdutos&&!erroProdutos&&!produtos.length&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Nenhum produto vinculado à seleção. Troque a linha, categoria ou busca.</p>}
          <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">{produtos.map(p=>
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <FotoProdutoPreview nome={p.nome} fotoUrl={p.fotoUrl} fotoCandidataUrl={p.fotoCandidataUrl} oculta={!!fotosOcultas[p.id]} onOcultarFoto={valor=>setFotosOcultas(a=>({...a,[p.id]:valor}))} tamanho="pequeno" imagemLocal={fotosLocais[p.id]} onSelecionarImagem={arquivo=>selecionarFoto(p.id,arquivo)}/>
              <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{p.nome}</b><p className="mt-1 text-[11px] text-slate-500">{p.codigo||'Sem código'} · {p.unidade}{p.linha?' · '+p.linha:''}</p><p className={preco(p)!=null?'mt-1 text-sm font-extrabold text-blue-700':'mt-1 text-xs font-bold text-amber-700'}>{preco(p)!=null?moeda(preco(p)!):'Preço a cadastrar'}</p></div>
              <button type="button" onClick={()=>adicionar(p)} className="shrink-0 rounded-lg bg-blue-700 p-2.5 text-white" aria-label={'Adicionar '+p.nome}><Plus size={18}/></button>
            </div>)}
          </div>
          <p className="mt-3 text-[11px] text-amber-700">Todas as imagens cadastradas aparecem automaticamente, inclusive as de perfis e acessórios. Se alguma estiver incorreta, use “Trocar imagem” ou “Remover imagem” nesta prévia, sem modificar o banco.</p>
        </section>
        <aside className="rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <h3 className="flex items-center gap-2 font-black"><ShoppingCart size={19} className="text-blue-700"/> Itens da venda <span className="ml-auto rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{unidades}</span></h3>
          {!itens.length&&<div className="mt-4 grid min-h-32 place-items-center rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Escolha um item à esquerda para começar a venda.</div>}
          <div className="mt-3 space-y-3">{itens.map(i=><div key={i.produto.id} className="border-b pb-3 last:border-0">
            <div className="flex gap-2"><FotoProdutoPreview nome={i.produto.nome} fotoUrl={i.produto.fotoUrl} fotoCandidataUrl={i.produto.fotoCandidataUrl} oculta={!!fotosOcultas[i.produto.id]} onOcultarFoto={valor=>setFotosOcultas(a=>({...a,[i.produto.id]:valor}))} tamanho="pequeno" imagemLocal={fotosLocais[i.produto.id]} onSelecionarImagem={arquivo=>selecionarFoto(i.produto.id,arquivo)}/>
              <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{i.produto.nome}</b><p className="mt-1 text-[11px] text-slate-500">{preco(i.produto)!=null?moeda(preco(i.produto)!):'Preço pendente'} /{i.produto.unidade}</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-600" htmlFor={'qtd-'+i.produto.id}>Qtd.</label>
                  <input id={'qtd-'+i.produto.id} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-bold tabular-nums focus:border-blue-600 focus:outline-none" inputMode="numeric" pattern="[0-9]*" aria-label={'Quantidade de '+i.produto.nome}
                    value={quantidadeDigitada[i.produto.id]??String(i.quantidade)}
                    onChange={e=>digitarQuantidade(i.produto.id,e.target.value)}
                    onBlur={()=>confirmarQuantidade(i.produto.id)}
                    onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} />
                  <button type="button" onClick={()=>{setItens(a=>a.filter(x=>x.produto.id!==i.produto.id));confirmarQuantidade(i.produto.id)}} className="ml-auto rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Remover produto"><Trash2 size={15}/></button>
                </div>
              </div>
            </div>
          </div>)}</div>
          <div className="mt-4 space-y-4 border-t pt-4">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500"><span>Quantidade de unidades</span><b>{unidades}</b></div>
              <div className="flex justify-between"><span>Subtotal</span><b>{moeda(total)}</b></div>
              {pendentes>0&&<p className="rounded-lg bg-amber-50 p-2 font-semibold text-amber-800">{pendentes} item(ns) sem preço cadastrado. É preciso precificar para simular a finalização.</p>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-xs font-black">Desconto na venda</h4>
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <select className={input+' text-xs'} aria-label="Tipo de desconto" value={tipoDesconto} onChange={e=>{setTipoDesconto(e.target.value as 'sem'|'valor'|'percentual');setAviso('')}}>
                  <option value="sem">Sem desconto</option><option value="valor">Desconto R$</option><option value="percentual">Desconto %</option>
                </select>
                <input className={input+' text-xs'} disabled={tipoDesconto==='sem'} inputMode="decimal" aria-label="Valor do desconto"
                  placeholder={tipoDesconto==='percentual'?'Ex.: 10':'Ex.: 25,00'} value={descontoEntrada}
                  onChange={e=>{setDescontoEntrada(e.target.value);setAviso('')}}/>
              </div>
              {descontoInvalido&&<p className="mt-2 text-xs font-bold text-red-700">Desconto superior ao valor permitido.</p>}
              <div className="mt-3 flex justify-between text-xs text-slate-600"><span>Desconto aplicado</span><b>- {moeda(Math.max(0,descontoCent)/100)}</b></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-sm font-black text-blue-800"><span>Total final</span><span>{moeda(totalLiquido)}</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-black">Recebimento da venda</h4>
              <p className="mt-1 text-[11px] text-slate-500">É possível receber em várias formas ou deixar marcado no cliente/obra.</p>
              <div className="mt-3 grid gap-2">
                <label className={'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs font-bold '+(tipoRecebimento==='agora'?'border-blue-600 bg-blue-50':'border-slate-200')}>
                  <input type="radio" checked={tipoRecebimento==='agora'} onChange={()=>{setTipoRecebimento('agora');setAviso('')}} name="quitacao-preview"/> Receber agora (PIX, cartão, dinheiro...)
                </label>
                {podeMarcar&&<label className={'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs font-bold '+(tipoRecebimento==='marcar'?'border-blue-600 bg-blue-50':'border-slate-200')}>
                  <input type="radio" checked={tipoRecebimento==='marcar'} onChange={()=>{setTipoRecebimento('marcar');setAviso('')}} name="quitacao-preview"/> Deixar tudo marcado {obra?'na obra':'no cliente'}
                </label>}
                {!podeMarcar&&<p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">Para deixar marcado ou receber apenas uma parte, é necessário cliente cadastrado ou cadastro completo. Venda avulsa e cadastro simples exigem quitação integral.</p>}
              </div>
              {tipoRecebimento==='agora'&&<div className="mt-3 space-y-3">
                {pagamentos.map((pg,i)=><div key={pg.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-2 flex items-center justify-between"><b className="text-[11px]">Forma de pagamento {i+1}</b>{pagamentos.length>1&&<button type="button" aria-label={'Remover pagamento '+(i+1)} onClick={()=>setPagamentos(a=>a.filter(x=>x.id!==pg.id))} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className={input+' min-w-0 text-xs'} aria-label={'Meio de pagamento '+(i+1)} value={pg.forma} onChange={e=>atualizarPagamento(pg.id,{forma:e.target.value as FormaPagamento})}>
                      {(Object.keys(rotuloPagamento) as FormaPagamento[]).map(forma=><option value={forma} key={forma}>{rotuloPagamento[forma]}</option>)}
                    </select>
                    <input className={input+' min-w-0 text-xs'} aria-label={'Valor do pagamento '+(i+1)} inputMode="decimal" placeholder="R$ 0,00" value={pg.valor} onChange={e=>atualizarPagamento(pg.id,{valor:e.target.value})}/>
                  </div>
                  <button type="button" className="mt-2 text-[11px] font-bold text-blue-700 hover:underline" onClick={()=>completarRestante(pg.id)}>Preencher valor restante ({moeda(Math.max(0,totalLiquidoCent-pagamentos.filter(p=>p.id!==pg.id).reduce((s,p)=>s+cents(valorEntrada(p.valor)),0))/100)})</button>
                </div>)}
                <button type="button" onClick={adicionarPagamento} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700"><Plus size={15}/> Adicionar outra forma de pagamento</button>
              </div>}
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-xs">
              <div className="flex justify-between"><span>Recebido {tipoRecebimento==='agora'?'(simulação)':''}</span><b>{moeda(recebido)}</b></div>
              <div className="mt-1 flex justify-between"><span>Saldo a receber</span><b className={saldoCent>0?'text-amber-700':'text-emerald-700'}>{moeda(saldo)}</b></div>
              {tipoRecebimento==='agora'&&recebidoCent>totalLiquidoCent&&<p className="mt-2 font-bold text-red-700">A soma dos pagamentos ultrapassa o total da venda.</p>}
              {podeMarcar&&saldoCent>0&&<p className="mt-2 text-[11px] text-slate-600">O saldo ficará marcado {obra?'na obra '+obra.nome:'no cadastro de '+nomeCliente}.</p>}
            </div>
            {modo==='consumidor'&&<label className="block text-xs font-semibold text-slate-600">Nome para assinatura do consumidor (opcional)<input className={input+' mt-1.5'} value={nomeAssinatura} onChange={e=>setNomeAssinatura(e.target.value)} placeholder="Nome a imprimir abaixo da assinatura"/></label>}
            <button type="button" onClick={revisar} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white">Revisar venda <ArrowRight size={17}/></button>
          </div>
        </aside>
      </div>
    </>}

    {etapa===3&&<section className="mx-auto max-w-3xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardCheck size={28}/></div>
      <h2 className="mt-3 text-center text-xl font-black">Revisão e finalização da venda</h2>
      <p className="mt-1 text-center text-xs text-slate-500">Veja os produtos, o desconto, cada recebimento e onde ficará marcado o saldo.</p>
      <div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p><span className="block text-xs text-slate-500">Cliente</span><b>{nomeCliente}</b></p>
        <p><span className="block text-xs text-slate-500">Vínculo da venda</span><b>{modo==='consumidor'?'Consumidor final · sem obra':obra?'Obra: '+obra.nome:'Cadastro do cliente · sem obra'}</b></p>
        <p><span className="block text-xs text-slate-500">Situação prevista</span><b>{statusFinanceiro==='quitada'?'Recebida integralmente':statusFinanceiro==='parcial'?'Recebimento parcial':'Marcada para receber depois'}</b></p>
        <p><span className="block text-xs text-slate-500">Itens / unidades</span><b>{itens.length} produto(s) · {unidades} unidade(s)</b></p>
      </div>
      <h3 className="mb-3 mt-6 text-sm font-black">Descrição dos itens</h3>
      <div className="space-y-3">{itens.map(i=><div key={i.produto.id} className="flex justify-between gap-3 border-b pb-3 text-sm">
        <span><b>{i.quantidade} × {i.produto.nome}</b><span className="block text-xs text-slate-500">{i.produto.codigo||'Sem código'} · {i.produto.unidade}</span>{i.produto.descricao&&<span className="mt-1 block text-xs text-slate-500">{i.produto.descricao}</span>}</span>
        <b className="shrink-0">{moeda((preco(i.produto)||0)*i.quantidade)}</b>
      </div>)}</div>
      <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><b>{moeda(total)}</b></div>
        <div className="mt-2 flex justify-between"><span>Desconto {tipoDesconto==='percentual'?'('+valorEntrada(descontoEntrada)+'%)':tipoDesconto==='valor'?'(R$)':''}</span><b>- {moeda(descontoCent/100)}</b></div>
        <div className="mt-3 flex justify-between border-t border-blue-200 pt-3 text-lg font-black text-blue-900"><span>Total da venda</span><span>{moeda(totalLiquido)}</span></div>
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
        <h3 className="font-black">Pagamento e saldo</h3>
        {formasRecibo.length?formasRecibo.map((f,i)=><div key={i} className="mt-2 flex justify-between text-xs"><span>{rotuloPagamento[f.forma]}</span><b>{moeda(f.valor)}</b></div>):<p className="mt-2 text-xs text-slate-500">Sem recebimento: venda marcada para o cliente/obra.</p>}
        <div className="mt-3 flex justify-between border-t pt-3"><span>Valor recebido (simulação)</span><b>{moeda(recebido)}</b></div>
        <div className="mt-2 flex justify-between"><span>Saldo a receber</span><b className={saldo>0?'text-amber-700':'text-emerald-700'}>{moeda(saldo)}</b></div>
        {saldo>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Este saldo ficará marcado {obra?'na obra '+obra.nome:'no cadastro do cliente '+nomeCliente}. Nenhum título financeiro será criado na prévia.</p>}
      </div>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <b>Simulação apenas:</b> “Finalizar venda” abrirá um recibo para conferência, impressão ou PDF, com os itens, os pagamentos e o espaço de assinatura. Não cria venda, baixa financeira, cadastro, débito, recibo fiscal ou movimentação de estoque.
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={()=>{setAviso('');setEtapa(2)}} className="rounded-xl border px-4 py-3 text-xs font-bold">Voltar e ajustar pagamento</button>
        <button type="button" onClick={simularFinalizacao} className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-extrabold text-white">Finalizar venda (simulação) · Ver recibo</button>
      </div>
    </section>}
   </div>
   <ReciboVendaPreview
     aberto={reciboAberto}
     empresa={empresa}
     fechar={()=>setReciboAberto(false)}
     nomeCliente={nomeCliente}
     nomeAssinatura={modo==='consumidor'?(nomeAssinatura.trim()||'Consumidor final — preencher na assinatura'):nomeCliente}
     documento={cliente?.cpf_cnpj||null}
     cidade={cliente?.cidade||null}
     obra={obra?.nome||null}
     tipoDestino={modo==='consumidor'?'consumidor':obra?'obra':'cliente'}
     dataHora={dataRecibo}
     itens={itens}
     subtotal={total}
     desconto={descontoCent/100}
     total={totalLiquido}
     recebido={recebido}
     saldo={saldo}
     status={statusFinanceiro}
     formas={formasRecibo}
   />
  </main>
}
