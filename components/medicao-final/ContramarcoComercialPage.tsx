'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,FileText,Plus,Save,CheckCircle2,Search,X,Loader2} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {centavosCM,validarItensCM,totalCM,propostaProntaCM,posicaoDeOrigemCM,type PosicaoComercialCM,type ProdutoComercialCM,type OrcamentoCM} from '@/lib/contramarcoComercial'
import {gerarPdfComercialCM} from '@/lib/contramarcoComercialPdf'

type Permissoes={verOrcamento:boolean;verVenda:boolean;criar:boolean;editar:boolean;preco:boolean;vender:boolean;pdf:boolean;medir:boolean}
type Origem={id:string;numero:number|null;status:string;created_at:string}
type Form={id:string;origem_orcamento_id:string|null;origem_medicao_id:string|null;nome_obra:string;endereco:string;cidade:string;condicoes:string;itens:PosicaoComercialCM[]}
const dinheiro=(c:number)=> (c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const statusLabel={rascunho:'Rascunho',proposta:'Proposta emitida',vendido:'Venda registrada',cancelado:'Cancelado'}
const campo='mt-1 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base disabled:bg-slate-100'
const btn='min-h-11 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50'
const vazia=()=>({...posicaoDeOrigemCM({},false),ref:crypto.randomUUID(),quantidade:1,perfil_codigo:'CM060' as const})
type Escolha={ref:string;campo:'perfil_id'|'conexao_id'|'grapa_id';codigo:string}

export default function ContramarcoComercialPage({clienteId}:{clienteId:string}){
  const endpoint='/api/clientes/'+encodeURIComponent(clienteId)+'/contramarcos'
  const [cliente,setCliente]=useState('')
  const [cidade,setCidade]=useState('')
  const [permissoes,setPermissoes]=useState<Permissoes|null>(null)
  const [origens,setOrigens]=useState<Origem[]>([])
  const [lista,setLista]=useState<OrcamentoCM[]>([])
  const [form,setForm]=useState<Form|null>(null)
  const [registro,setRegistro]=useState<OrcamentoCM|null>(null)
  const [produtos,setProdutos]=useState<ProdutoComercialCM[]>([])
  const [precos,setPrecos]=useState<Record<string,string>>({})
  const [escolha,setEscolha]=useState<Escolha|null>(null)
  const [busca,setBusca]=useState('')
  const [resultados,setResultados]=useState<ProdutoComercialCM[]>([])
  const [buscando,setBuscando]=useState(false)
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [origemSelecionada,setOrigemSelecionada]=useState('')
  const [sujo,setSujo]=useState(false)
  const [cancelar,setCancelar]=useState(false)
  const [motivo,setMotivo]=useState('')
  const [confirmar,setConfirmar]=useState(false)
  const [medicaoParaVincular,setMedicaoParaVincular]=useState('')
  const [filtro,setFiltro]=useState<'todos'|'orcamentos'|'vendas'>('todos')
  const podeCriar=!!permissoes?.criar&&!!permissoes?.preco
  const editavel=!!form&&(registro?registro.status==='rascunho'&&!!permissoes?.editar&&!!permissoes?.preco:podeCriar)
  const medicao=!!form?.origem_medicao_id
  async function requisicao(path='',method='GET',body?:unknown){
    const token=await tokenAtual()
    if(!token)throw new Error('Sessão expirada. Entre novamente.')
    const r=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(j.error||'Operação não concluída.')
    return j
  }
  function atualizarLista(o:OrcamentoCM){setLista(v=>[o,...v.filter(x=>x.id!==o.id)])}
  function abrir(o:OrcamentoCM){
    setRegistro(o);setForm({...o,itens:o.itens.map(i=>({...i}))})
    setProdutos(o.itens.flatMap(i=>[i.materiais.perfil,i.materiais.conexao,i.materiais.grapa]).filter((x):x is ProdutoComercialCM=>!!x))
    setPrecos(Object.fromEntries(o.itens.map(i=>[i.ref,i.preco_unit_centavos==null?'':(i.preco_unit_centavos/100).toFixed(2)])))
    setSujo(false);setCancelar(false);setConfirmar(false);setMedicaoParaVincular('');setErro('');setMensagem('')
  }
  function iniciar(fonte?:{itens:PosicaoComercialCM[];nome_obra:string;endereco:string;cidade:string;produtos?:ProdutoComercialCM[]},orc?:string|null,med?:string|null,cidadePadrao=cidade){
    setRegistro(null);setForm({id:crypto.randomUUID(),origem_orcamento_id:orc||null,origem_medicao_id:med||null,nome_obra:fonte?.nome_obra||'',endereco:fonte?.endereco||'',cidade:fonte?.cidade||cidadePadrao,condicoes:'',itens:fonte?.itens.length?fonte.itens:[vazia()]})
    setProdutos(fonte?.produtos||[]);setPrecos({});setSujo(false);setConfirmar(false);setCancelar(false)
  }
  async function carregar(primeiro=false){
    setOcupado(true);setErro('')
    try{
      const params=primeiro?new URLSearchParams(window.location.search):new URLSearchParams()
      const med=params.get('medicao'),orc=params.get('orcamento')
      const d=await requisicao()
      setCliente(d.cliente.nome);setCidade(d.cliente.cidade||'');setPermissoes(d.permissoes);setLista(d.orcamentos);setOrigens(d.origens)
      if(primeiro&&(med||orc)){
        const direto=d.orcamentos.find((o:OrcamentoCM)=>o.status!=='cancelado'&&(med?o.origem_medicao_id===med:o.origem_orcamento_id===orc))
        if(direto)abrir(direto)
        else if(d.permissoes.criar&&d.permissoes.preco){
          const resposta=await requisicao('?'+(med?'medicao='+encodeURIComponent(med):'orcamento='+encodeURIComponent(orc!)))
          const fonte=resposta.fonte
          const associado=med&&fonte.origem_orcamento_id?d.orcamentos.find((o:OrcamentoCM)=>o.status!=='cancelado'&&o.origem_orcamento_id===fonte.origem_orcamento_id):null
          if(associado){
            abrir(associado)
            if(associado.status==='rascunho'&&!associado.origem_medicao_id)setMedicaoParaVincular(med!)
            else setMensagem('Já existe uma proposta ou venda para o orçamento de origem. As medidas aceitas permanecem preservadas; revise antes de uma nova venda.')
          }else iniciar(fonte,fonte.origem_orcamento_id||orc,med,d.cliente.cidade||'')
        }
      }
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar.')}
    finally{setOcupado(false)}
  }
  useEffect(()=>{void carregar(true)},[clienteId])
  useEffect(()=>{if(!sujo)return;const fn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn)},[sujo])
  function podeSair(){return !sujo||window.confirm('Descartar as alterações ainda não salvas?')}
  async function importar(){
    if(!origemSelecionada||!podeSair())return
    const existente=lista.find(o=>o.origem_orcamento_id===origemSelecionada&&o.status!=='cancelado')
    if(existente){abrir(existente);return}
    setOcupado(true);setErro('')
    try{const d=await requisicao('?orcamento='+encodeURIComponent(origemSelecionada));iniciar(d.fonte,origemSelecionada)}
    catch(e){setErro(e instanceof Error?e.message:'Falha na importação.')}
    finally{setOcupado(false)}
  }
  function alterar<K extends keyof Form>(k:K,v:Form[K]){setForm(f=>f?{...f,[k]:v}:f);setSujo(true);setMensagem('')}
  function item(ref:string,patch:Partial<PosicaoComercialCM>){setForm(f=>f?{...f,itens:f.itens.map(i=>i.ref===ref?{...i,...patch}:i)}:f);setSujo(true);setMensagem('')}
  function abrirProdutos(i:PosicaoComercialCM,k:Escolha['campo']){
    setBusca(k==='conexao_id'?'conex':k==='grapa_id'?'grapa':'');setResultados([]);setEscolha({ref:i.ref,campo:k,codigo:i.perfil_codigo})
  }
  useEffect(()=>{
    if(!escolha)return
    let ativo=true
    setBuscando(true);setResultados([])
    const timeout=setTimeout(()=>{
      const q=new URLSearchParams({categoria:escolha.campo==='perfil_id'?'perfil':'acessorio',codigo:escolha.codigo,busca})
      void requisicao('/produtos?'+q).then(d=>{if(ativo)setResultados(d.produtos||[])}).catch(e=>{if(ativo)setErro(e.message)}).finally(()=>{if(ativo)setBuscando(false)})
    },250)
    return()=>{ativo=false;clearTimeout(timeout)}
  },[escolha,busca])
  const itensComPreco=form?.itens.map(i=>({...i,preco_unit_centavos:centavosCM(precos[i.ref]||'')}))||[]
  let total=0
  try{total=totalCM(validarItensCM(itensComPreco,produtos))}catch{total=itensComPreco.reduce((n,i)=>n+(i.preco_unit_centavos||0)*(i.quantidade||0),0)}
  async function vincularMedicao(){
    if(!registro||!medicaoParaVincular||!editavel||ocupado||sujo)return
    if(!window.confirm('Substituir as posições do rascunho pelas medidas reais? Os preços precisarão ser conferidos novamente.'))return
    setOcupado(true);setErro('')
    try{
      const d=await requisicao('','PATCH',{id:registro.id,versao:registro.versao,acao:'vincular_medicao',medicao_id:medicaoParaVincular,confirmacao:true})
      abrir(d.orcamento);atualizarLista(d.orcamento);setMensagem('Medidas reais importadas no mesmo rascunho. Confira materiais e preços.')
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao vincular medição.')}
    finally{setOcupado(false)}
  }
  async function salvar(){
    if(!form||!editavel||ocupado)return
    setOcupado(true);setErro('');setMensagem('')
    try{
      for(const i of form.itens)if((precos[i.ref]||'').trim()&&centavosCM(precos[i.ref])===null)throw new Error('Use um preço válido, com até duas casas decimais.')
      validarItensCM(itensComPreco,produtos)
      const body={...form,itens:itensComPreco,...(registro?{acao:'editar',versao:registro.versao}:{})}
      const d=await requisicao('',registro?'PATCH':'POST',body);abrir(d.orcamento);atualizarLista(d.orcamento);setMensagem('Orçamento salvo.')
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.')}
    finally{setOcupado(false)}
  }
  async function acao(tipo:'emitir'|'vender'|'cancelar'){
    if(!registro||ocupado||sujo)return
    setOcupado(true);setErro('');setMensagem('')
    try{
      const d=await requisicao('','PATCH',{id:registro.id,versao:registro.versao,acao:tipo,confirmacao:confirmar,motivo})
      abrir(d.orcamento);atualizarLista(d.orcamento)
      setMensagem(tipo==='vender'?'Venda exclusiva registrada. Financeiro e produção ainda exigem integração própria.':tipo==='emitir'?'Proposta emitida. Você pode gerar o PDF.':'Registro cancelado e preservado no histórico.')
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao concluir.')}
    finally{setOcupado(false)}
  }
  return <main className="mx-auto w-full max-w-6xl space-y-4 px-3 py-5 sm:px-5">
    <header className="flex flex-wrap items-center gap-3"><Link href={'/clientes/'+clienteId} onClick={e=>{if(!podeSair())e.preventDefault()}} className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white"><ArrowLeft size={20}/></Link><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-emerald-700">Comercial · Contramarcos</p><h1 className="break-words text-xl font-black text-slate-900">{cliente||'Cliente 360'}</h1></div></header>
    {erro&&<p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    {mensagem&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
    {ocupado&&<p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={17}/> Processando...</p>}
    {!permissoes&&!ocupado&&<button className={btn} onClick={()=>void carregar(true)}>Tentar novamente</button>}
    {permissoes&&!form&&<>
      {podeCriar&&<section className="space-y-3 rounded-2xl border bg-white p-4"><h2 className="font-bold">Novo orçamento exclusivo</h2><button className={btn+' w-full bg-emerald-700 text-white'} onClick={()=>iniciar()}><Plus className="mr-1 inline" size={16}/>Cadastrar medidas manualmente</button>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><select className={campo} value={origemSelecionada} onChange={e=>setOrigemSelecionada(e.target.value)}><option value="">Escolher orçamento de esquadrias...</option>{origens.map(o=><option key={o.id} value={o.id}>#{o.numero||o.id.slice(0,8)} · {new Date(o.created_at).toLocaleDateString('pt-BR')} · {o.status}</option>)}</select><button className={btn} disabled={!origemSelecionada||ocupado} onClick={()=>void importar()}>Importar posições</button></div>
      <p className="text-xs text-slate-500">A importação cria um orçamento independente; não altera as esquadrias. Também é possível gerar a partir da Medição Final.</p></section>}
      <section className="space-y-3 rounded-2xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Orçamentos e vendas de contramarcos</h2><select aria-label="Filtrar registros" className="rounded-lg border px-2 py-2 text-sm" value={filtro} onChange={e=>setFiltro(e.target.value as typeof filtro)}><option value="todos">Todos</option><option value="orcamentos">Orçamentos</option><option value="vendas">Vendas</option></select></div>
      {lista.filter(o=>filtro==='todos'||(filtro==='vendas'?o.status==='vendido':o.status!=='vendido')).map(o=><button key={o.id} onClick={()=>abrir(o)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left"><span className="min-w-0"><b>CM #{o.numero} · {o.nome_obra}</b><span className="block text-xs text-slate-500">{statusLabel[o.status]} · {o.itens.length} posições</span></span><strong>{dinheiro(o.valor_centavos)}</strong></button>)}
      {!lista.length&&<p className="text-sm text-slate-500">Nenhum orçamento exclusivo cadastrado.</p>}</section>
    </>}
    {form&&<>
      <section className="space-y-3 rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{registro?'CM #'+registro.numero+' · '+statusLabel[registro.status]:'Novo orçamento de contramarcos'}</h2><button className={btn} onClick={()=>{if(podeSair()){setForm(null);setRegistro(null);setSujo(false);setErro('')}}}>Voltar à lista</button></div>
      {medicaoParaVincular&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><p>Este orçamento já existe. Aproveite a medição real sem criar outra proposta.</p><button disabled={!editavel||ocupado||sujo} className={btn+' mt-2 w-full bg-emerald-700 text-white'} onClick={()=>void vincularMedicao()}>Atualizar rascunho com medidas reais</button></div>}
      <p className="text-xs text-slate-500">{medicao?'Medidas reais importadas da Medição Final; alterações dimensionais devem ser feitas na origem.':form.origem_orcamento_id?'Medidas estimadas importadas de esquadrias; confira na obra antes de fabricar.':'Medidas preliminares digitadas manualmente; confira na obra antes de fabricar.'}</p>
      <fieldset disabled={!editavel||ocupado} className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Nome ou número da obra<input className={campo} value={form.nome_obra} maxLength={150} onChange={e=>alterar('nome_obra',e.target.value)}/></label><label className="text-xs font-bold">Cidade<input className={campo} value={form.cidade} maxLength={120} onChange={e=>alterar('cidade',e.target.value)}/></label><label className="text-xs font-bold sm:col-span-2">Endereço<input className={campo} value={form.endereco} maxLength={300} onChange={e=>alterar('endereco',e.target.value)}/></label><label className="text-xs font-bold sm:col-span-2">Condições comerciais (pagamento, prazo e validade)<textarea className={campo} value={form.condicoes} maxLength={2000} rows={3} onChange={e=>alterar('condicoes',e.target.value)}/></label></fieldset></section>
      {form.itens.map((i,index)=>{
        let calc
        try{calc=validarItensCM([itensComPreco[index]],produtos)[0]}catch{}
        return <section key={i.ref} className="min-w-0 space-y-3 rounded-2xl border bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-words font-bold">Posição {index+1} · {i.ambiente||i.tipologia||'Nova'}</h3>{editavel&&form.itens.length>1&&<button className={btn+' text-red-700'} onClick={()=>alterar('itens',form.itens.filter(v=>v.ref!==i.ref))}>Retirar</button>}</div>
          <fieldset disabled={!editavel||ocupado||medicao} className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Ambiente<input className={campo} value={i.ambiente} maxLength={150} onChange={e=>item(i.ref,{ambiente:e.target.value})}/></label><label className="text-xs font-bold">Tipologia<input className={campo} value={i.tipologia} maxLength={200} onChange={e=>item(i.ref,{tipologia:e.target.value})}/></label>
          {([['largura_mm','Largura do vão (mm)'],['altura_mm','Altura do vão (mm)'],['folga_l_mm','Folga total largura (mm)'],['folga_a_mm','Folga total altura (mm)'],['quantidade','Quantidade']] as const).map(([k,label])=><label key={k} className="text-xs font-bold">{label}<input className={campo} type="number" inputMode="numeric" min={k.startsWith('folga')?0:1} step={k==='quantidade'?1:0.1} value={i[k]} onChange={e=>item(i.ref,{[k]:Number(e.target.value)})}/></label>)}</fieldset>
          <fieldset disabled={!editavel||ocupado} className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Perfil técnico<select disabled={medicao} className={campo} value={i.perfil_codigo} onChange={e=>item(i.ref,{perfil_codigo:e.target.value as PosicaoComercialCM['perfil_codigo'],perfil_id:'',conexao_id:'',grapa_id:''})}><option value="CM060">CM060</option><option value="CM200">CM200</option></select></label><label className="text-xs font-bold">Preço de venda por contramarco (R$)<input className={campo} inputMode="decimal" value={precos[i.ref]||''} placeholder="0,00" onChange={e=>{setPrecos(v=>({...v,[i.ref]:e.target.value}));setSujo(true)}}/></label></fieldset>
          {calc&&!calc.receita_pendente?<div className="grid gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 sm:grid-cols-2"><b>Fabricação: {calc.fabricacao_l_mm} × {calc.fabricacao_a_mm} mm</b><span>{calc.metros_perfil.toLocaleString('pt-BR')} m de corte líquido · {calc.conexoes} conexões · {calc.grapas} grapas</span><span className="text-xs sm:col-span-2">Estimativa de consumo; não representa quantidade de barras, sobra ou custo de compra.</span></div>:<p className="text-xs text-amber-800">Confira as dimensões e a receita técnica. Tipologia sem receita não pode ser emitida.</p>}
          <div className="grid gap-2 sm:grid-cols-3">{([['perfil_id','Perfil'],['conexao_id','Conexão 90°'],['grapa_id','Grapa']] as const).map(([k,t])=>{const p=produtos.find(p=>p.id===i[k]);return <div key={k} className="min-w-0 rounded-xl border p-2"><p className="text-xs font-bold text-slate-600">{t}</p>{p?<div className="mt-1 flex items-center gap-2"><img src={p.foto_url} alt={p.nome} className="h-14 w-14 shrink-0 rounded border object-contain"/><span className="min-w-0 break-words text-xs">{p.codigo} · {p.nome}</span></div>:<p className="mt-2 text-xs text-amber-800">Produto com foto pendente</p>}{editavel&&<button className={btn+' mt-2 w-full text-xs'} disabled={ocupado} onClick={()=>abrirProdutos(i,k)}>Selecionar produto</button>}</div>})}</div>
          <p className="text-right text-sm font-bold">Subtotal: {dinheiro((centavosCM(precos[i.ref]||'')||0)*i.quantidade)}</p>
        </section>
      })}
      {editavel&&!medicao&&<button disabled={form.itens.length>=100||ocupado} className={btn+' w-full'} onClick={()=>alterar('itens',[...form.itens,vazia()])}><Plus size={16} className="inline"/> Adicionar posição</button>}
      <section className="space-y-3 rounded-2xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><b>Total comercial</b><strong className="text-xl">{dinheiro(total)}</strong></div>
      {editavel&&<button disabled={ocupado} className={btn+' w-full bg-blue-700 text-white'} onClick={()=>void salvar()}><Save size={16} className="inline"/> Salvar rascunho{sujo?' · alterações pendentes':''}</button>}
      {registro?.status==='rascunho'&&editavel&&<button disabled={ocupado||sujo} className={btn+' w-full bg-emerald-700 text-white'} onClick={()=>void acao('emitir')}>Emitir proposta</button>}
      {registro&&registro.status!=='rascunho'&&registro.status!=='cancelado'&&permissoes?.pdf&&<button className={btn+' w-full'} onClick={()=>gerarPdfComercialCM(cliente,registro)}><FileText size={16} className="inline"/> Gerar PDF comercial</button>}
      {registro?.status==='proposta'&&permissoes?.vender&&<div className="space-y-2 rounded-xl border border-emerald-200 p-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmar} onChange={e=>setConfirmar(e.target.checked)} className="mt-1"/>Confirmo o aceite do cliente para vender exclusivamente os contramarcos desta proposta.</label><button className={btn+' w-full bg-emerald-700 text-white'} disabled={!confirmar||ocupado||sujo} onClick={()=>void acao('vender')}><CheckCircle2 size={16} className="inline"/> Registrar venda exclusiva</button></div>}
      {registro&&registro.status!=='cancelado'&&(registro.status==='vendido'?permissoes?.vender:permissoes?.editar)&&<><button className={btn+' w-full text-red-700'} disabled={ocupado||sujo} onClick={()=>setCancelar(!cancelar)}>Cancelar registro</button>{cancelar&&<div className="space-y-2"><label className="text-xs font-bold">Motivo do cancelamento<textarea className={campo} value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={500}/></label><button disabled={motivo.trim().length<3||ocupado} className={btn+' w-full bg-red-700 text-white'} onClick={()=>void acao('cancelar')}>Confirmar cancelamento</button></div>}</>}
      <p className="text-xs text-slate-500">Registro comercial independente. Não gera contas a receber, ordem de produção ou venda de esquadrias automaticamente.</p></section>
    </>}
    {escolha&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2 sm:items-center"><section role="dialog" aria-modal="true" aria-label="Selecionar produto com foto" className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-2xl bg-white p-4"><div className="flex items-center justify-between"><b>Selecionar produto com foto</b><button className="min-h-11 min-w-11" onClick={()=>setEscolha(null)} aria-label="Fechar"><X size={20}/></button></div>{escolha.campo!=='perfil_id'&&<label className="text-xs font-bold"><Search size={15} className="inline"/> Buscar acessório<input className={campo} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome do produto"/></label>}<div className="min-h-0 flex-1 space-y-2 overflow-y-auto">{buscando?<p className="text-sm">Buscando...</p>:resultados.length?resultados.map(p=><button key={p.id} className="flex w-full items-center gap-3 rounded-xl border p-2 text-left" onClick={()=>{setProdutos(v=>[p,...v.filter(x=>x.id!==p.id)]);item(escolha.ref,{[escolha.campo]:p.id});setEscolha(null)}}><img className="h-16 w-16 shrink-0 rounded border object-contain" src={p.foto_url} alt={p.nome}/><span className="min-w-0 break-words text-sm">{p.codigo} · {p.nome}</span></button>):<p className="text-sm text-slate-500">Nenhum produto com imagem encontrado. Cadastre ou confira a foto no catálogo.</p>}</div></section></div>}
  </main>
}
