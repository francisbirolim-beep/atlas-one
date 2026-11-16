'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, DraftingCompass, FileText, Layers3, Plus, Search, Trash2 } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa } from '@/lib/configGeral'
import { type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import type { EmpresaRecibo } from '@/components/previews/ReciboVendaPreview'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'
import FotoTipologiaPreview from '@/components/previews/FotoTipologiaPreview'
import VariaveisTipologiaPreview, { type CatalogoEngenharia } from '@/components/previews/VariaveisTipologiaPreview'
import OrcamentoDocumentoPreview, { type OrcamentoDocumento, type ProdutoDocumento, type TipologiaDocumento } from '@/components/previews/OrcamentoDocumentoPreview'
import { type DadosPrecosAluminio, type SimulacaoPrecoAluminio, lerSimulacaoPreco, precoCorEfetivo } from '@/lib/previews/precificacaoAluminio'

type TipologiaCatalogo=Tipologia & {foto_url?:string|null;linhaIds:string[]}
type Vidro={id:string;descricao:string;produtoAtlasId:string|null;referenciaNaoPrecificada:boolean}
type Produto={id:string;codigo:string;nome:string;descricao:string;unidade:string;categoria:string;linha:string|null;fotoUrl:string|null;fotoCandidataUrl?:string|null;preco:number|null;precoPromocional:number|null}
type Item={produto:Produto;quantidade:number}
type Medida={id:string;tipologia:TipologiaCatalogo;largura:number;altura:number;cor:string;corId:string;linha:string;vidro:string;vidroId:string;contramarco:string;quantidade:number;variaveis:{nome:string;valor:string}[];pendentes:number}
const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const moeda=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const valorUnitario=(p:Produto)=>p.precoPromocional!=null&&p.precoPromocional>0?p.precoPromocional:p.preco
const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const numero=(s:string)=>Number(String(s).trim().replace(',','.'))||0
const novoId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)
const categorias=[['todos','Todos'],['perfil','Perfis'],['acessorio','Acessórios'],['vidro','Vidros'],['pronto','Produtos prontos'],['outros','Outros']] as const

export default function ConfiguradorOrcamentoSobMedida(){
  const [cliente,setCliente]=useState('')
  const [empresa,setEmpresa]=useState<EmpresaRecibo|null>(null)
  const [tipologias,setTipologias]=useState<TipologiaCatalogo[]>([])
  const [carregandoTipologias,setCarregandoTipologias]=useState(true)
  const [linhasTecnicas,setLinhasTecnicas]=useState<LinhaTecnica[]>([])
  const [erroReferencias,setErroReferencias]=useState('')
  const [vidros,setVidros]=useState<Vidro[]>([])
  const [etapa,setEtapa]=useState<1|2|3>(1)
  const [largura,setLargura]=useState('')
  const [altura,setAltura]=useState('')
  const [corId,setCorId]=useState('')
  const [coresDados,setCoresDados]=useState<DadosPrecosAluminio|null>(null)
  const [coresErro,setCoresErro]=useState('')
  const [ajustesPrecos,setAjustesPrecos]=useState<SimulacaoPrecoAluminio>({})
  const [mostrarPendencias,setMostrarPendencias]=useState(false)
  const [quantidade,setQuantidade]=useState('1')
  const [buscaTipologia,setBuscaTipologia]=useState('')
  const [filtroLinhaTipologia,setFiltroLinhaTipologia]=useState('')
  const [tipologiaId,setTipologiaId]=useState('')
  const [vidroId,setVidroId]=useState('')
  const [contramarco,setContramarco]=useState('')
  const [catalogo,setCatalogo]=useState<CatalogoEngenharia|null>(null)
  const [variaveisCarregando,setVariaveisCarregando]=useState(false)
  const [erroVariaveis,setErroVariaveis]=useState('')
  const [valores,setValores]=useState<Record<string,string>>({})
  const [medidas,setMedidas]=useState<Medida[]>([])
  const [mostrarProdutos,setMostrarProdutos]=useState(false)
  const [buscaProduto,setBuscaProduto]=useState('')
  const [categoria,setCategoria]=useState('todos')
  const [linhaProduto,setLinhaProduto]=useState('')
  const [linhasProdutos,setLinhasProdutos]=useState<{id:string;nome:string}[]>([])
  const [filtroPreco,setFiltroPreco]=useState('todos')
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [itens,setItens]=useState<Item[]>([])
  const [erroProdutos,setErroProdutos]=useState('')
  const [aviso,setAviso]=useState('')
  const [revisao,setRevisao]=useState(false)
  const [descontoTipo,setDescontoTipo]=useState('sem')
  const [desconto,setDesconto]=useState('')
  const [condicoes,setCondicoes]=useState<{id:number;forma:string;valor:string}[]>([{id:1,forma:'PIX',valor:''}])
  const proximaCondicao=useRef(1)
  const [validade,setValidade]=useState('')
  const [documento,setDocumento]=useState<OrcamentoDocumento|null>(null)

  useEffect(()=>{
    let ativo=true
    const ctrl=new AbortController()
    void (async()=>{
      try {
        const token=await tokenAtual()
        if(!token)throw Error('Faça login no Atlas One para consultar as tipologias.')
        const resp=await fetch('/api/previews/engenharia?tipo=tipologias',{
          headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'
        })
        const dados=await resp.json()
        if(!resp.ok)throw Error(dados.error||'Não foi possível carregar as tipologias.')
        if(ativo&&!ctrl.signal.aborted){
          setTipologias(dados.tipologias||[])
          setLinhasTecnicas(dados.linhas||[])
          setErroReferencias('')
        }
      }catch(e){
        if(ativo&&!ctrl.signal.aborted)setErroReferencias(e instanceof Error?e.message:'Erro ao carregar tipologias.')
      }finally{if(ativo&&!ctrl.signal.aborted)setCarregandoTipologias(false)}
    })()
    void lerDadosEmpresa().then(d=>{if(ativo)setEmpresa(d||null)}).catch(()=>{})
    return()=>{ativo=false;ctrl.abort()}
  },[])
  useEffect(()=>{
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const usuario=await usuarioAtual()
        const token=await tokenAtual()
        if(!usuario||!token)throw Error('Faça login para consultar as cores.')
        const r=await fetch('/api/previews/preco-aluminio',{
          headers:{Authorization:'Bearer '+token},cache:'no-store',signal:ctrl.signal
        })
        const data=await r.json()
        if(!r.ok)throw Error(data.error||'Não foi possível consultar a tabela de cores.')
        if(!ctrl.signal.aborted){
          setCoresDados({natural:data.natural??null,cores:data.cores||[]})
          if(usuario.role==='master')setAjustesPrecos(lerSimulacaoPreco(usuario.id))
          setCoresErro('')
        }
      }catch(e){if(!ctrl.signal.aborted)setCoresErro(e instanceof Error?e.message:'Erro na tabela de cores.')}
    })()
    return()=>ctrl.abort()
  },[])
  useEffect(()=>{
    const ctrl=new AbortController()
    void (async()=>{
      try{
        const token=await tokenAtual();if(!token)return
        const r=await fetch('/api/previews/engenharia?tipo=vidros',{headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'})
        const data=await r.json()
        if(!r.ok)throw Error(data.error||'Vidros indisponíveis.')
        if(!ctrl.signal.aborted)setVidros(data.vidros||[])
      }catch(e){if(!ctrl.signal.aborted)setErroReferencias(e instanceof Error?e.message:'Erro ao consultar vidros.')}
    })()
    return()=>ctrl.abort()
  },[])
  useEffect(()=>{
    if(!tipologiaId){setCatalogo(null);return}
    const ctrl=new AbortController()
    setVariaveisCarregando(true);setErroVariaveis('')
    void (async()=>{
      try{
        const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
        const r=await fetch('/api/previews/engenharia?tipo=variaveis&tipologiaId='+encodeURIComponent(tipologiaId),{headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'})
        const data=await r.json();if(!r.ok)throw Error(data.error||'Falha nas variáveis.')
        if(!ctrl.signal.aborted)setCatalogo({variaveis:data.variaveis||[],vinculadas:data.vinculadas||[]})
      }catch(e){if(!ctrl.signal.aborted){setErroVariaveis(e instanceof Error?e.message:'Erro no catálogo técnico.');setCatalogo(null)}}
      finally{if(!ctrl.signal.aborted)setVariaveisCarregando(false)}
    })()
    return()=>ctrl.abort()
  },[tipologiaId])
  useEffect(()=>{
    if(!mostrarProdutos)return
    const ctrl=new AbortController()
    const timer=setTimeout(()=>void (async()=>{
      try{
        const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
        const params=new URLSearchParams({tipo:'produtos',q:buscaProduto,categoria,precoFiltro:filtroPreco})
        if(linhaProduto)params.set('linhaId',linhaProduto)
        const r=await fetch('/api/previews/comercial?'+params.toString(),{headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'})
        const data=await r.json();if(!r.ok)throw Error(data.error||'Catálogo indisponível.')
        if(!ctrl.signal.aborted){setProdutos(data.produtos||[]);setLinhasProdutos(data.linhas||[]);setErroProdutos('')}
      }catch(e){if(!ctrl.signal.aborted){setErroProdutos(e instanceof Error?e.message:'Erro ao buscar produtos.');setProdutos([])}}
    })(),buscaProduto?220:60)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[mostrarProdutos,buscaProduto,categoria,linhaProduto,filtroPreco])

  const corSelecionada=coresDados?.cores.find(c=>c.id===corId)
  const cor=corSelecionada?.nome||''
  const precoCor=corSelecionada&&coresDados?precoCorEfetivo(corSelecionada,coresDados,ajustesPrecos):null
  const tipologia=tipologias.find(t=>t.id===tipologiaId)
  const linhasVinculadas=tipologia?linhasTecnicas.filter(l=>tipologia.linhaIds.includes(l.id)):[]
  // A busca textual e a linha superior trabalham no mesmo conjunto de vínculos reais.
  const todasFiltradas=tipologias
    .filter(t=>normalizar(t.label+' '+t.chave).includes(normalizar(buscaTipologia.trim())))
    .filter(t=>!filtroLinhaTipologia||t.linhaIds.includes(filtroLinhaTipologia))
  const tipologiasFiltradas=todasFiltradas.slice(0,140)
  const linhaSelecionada=linhasTecnicas.find(l=>l.id===filtroLinhaTipologia)
  const vidroSelecionado=vidros.find(v=>v.id===vidroId)
  const folhas=tipologia?.label.match(/\b0?(\d{1,2})\s*folhas?\b/i)?.[1]||null
  const subtotal=itens.reduce((s,i)=>s+(valorUnitario(i.produto)||0)*i.quantidade,0)
  const pendentesPreco=itens.filter(i=>valorUnitario(i.produto)==null).length
  const descontoBruto=descontoTipo==='percentual'?subtotal*numero(desconto)/100:descontoTipo==='valor'?numero(desconto):0
  const descontoInvalido=descontoTipo==='percentual'?numero(desconto)>100:descontoBruto>subtotal
  const descontoValor=Math.max(0,Math.min(subtotal,descontoBruto))
  const totalProdutos=Math.max(0,subtotal-descontoValor)
  const pendencias=[
    ...itens.filter(i=>(valorUnitario(i.produto)??0)<=0)
      .map(i=>({id:'produto:'+i.produto.id,tipo:'Produto sem preço',
        titulo:i.produto.codigo+' · '+i.produto.nome,
        detalhe:'Preço unitário não cadastrado; informe o valor no cadastro do produto.'})),
    ...medidas.flatMap(m=>{
      const c=coresDados?.cores.find(x=>x.id===m.corId)
      const semCor=!c||!coresDados||precoCorEfetivo(c,coresDados,ajustesPrecos)==null
      return [
        ...(semCor?[{id:'cor:'+m.id,tipo:'Cor/alumínio sem preço',
          titulo:m.cor||'Cor não cadastrada',
          detalhe:'Tipologia '+m.tipologia.label+': confira preço Natural e adicional/valor da cor.'}]:[]),
        ...(!m.vidroId?[{id:'vidro:'+m.id,tipo:'Vidro a definir',
          titulo:m.tipologia.label,detalhe:'O vidro e sua precificação técnica ainda precisam ser especificados.'}]:[]),
        {id:'tecnica:'+m.id,tipo:'Composição técnica pendente',
          titulo:m.tipologia.label+' · '+m.largura+' × '+m.altura+' mm',
          detalhe:'A composição de perfis e acessórios e a fórmula completa de custo ainda não estão validadas. Não é possível apontar os acessórios individuais sem a receita técnica cadastrada.'},
        ...(m.pendentes>0?[{id:'variaveis:'+m.id,tipo:'Variáveis obrigatórias pendentes',
          titulo:m.tipologia.label,detalhe:m.pendentes+' variável(is) obrigatória(s) sem seleção.'}]:[]),
      ]
    }),
  ]
  const temPendencias=pendencias.length>0
  // As variáveis vêm do vínculo no cadastro da tipologia; não são criadas no orçamento.
  const variaveisDisponiveis=useMemo(()=>
    (catalogo?.vinculadas||[]).map(v=>{
      const variavel=catalogo?.variaveis.find(x=>x.id===v.variavelId)
      return variavel&&variavel.chave!=='folhas'?{id:'atlas:'+variavel.id,nome:variavel.label,obrigatoria:v.obrigatorio}:null
    }).filter((v):v is {id:string;nome:string;obrigatoria:boolean}=>v!==null),[catalogo])

  function avancarMedidas(){
    if(!corId||!corSelecionada){setAviso('Selecione uma cor cadastrada para a esquadria.');return}
    if(!(numero(largura)>0&&numero(altura)>0)){setAviso('Informe largura e altura válidas em milímetros.');return}
    if(!Number.isInteger(Number(quantidade))||Number(quantidade)<1){setAviso('Informe a quantidade.');return}
    setEtapa(2);setAviso('')
  }
  function escolherTipologia(id:string){
    setTipologiaId(id);setValores({});setAviso('')
  }
  function avancarVariaveis(){
    if(!tipologia){setAviso('Escolha uma tipologia nos resultados da pesquisa.');return}
    if(!filtroLinhaTipologia){setAviso('Selecione a linha técnica no filtro superior.');return}
    if(!tipologia.linhaIds.includes(filtroLinhaTipologia)){
      setAviso('A tipologia escolhida não está vinculada à linha selecionada.');return
    }
    if(contramarco!=='com'&&contramarco!=='sem'){
      setAviso('Informe se a tipologia é com ou sem contramarco.');return
    }
    setEtapa(3);setAviso('')
  }
  function incluirTipologia(){
    if(!tipologia)return
    if(!corId||!corSelecionada){setAviso('Escolha uma cor cadastrada.');setEtapa(1);return}
    const escolhas=variaveisDisponiveis.filter(v=>String(valores[v.id]||'').trim()).map(v=>({nome:v.nome,valor:valores[v.id]}))
    const pendentes=variaveisDisponiveis.filter(v=>v.obrigatoria&&!String(valores[v.id]||'').trim()).length
    setMedidas(a=>[...a,{
      id:novoId(),tipologia,largura:numero(largura),altura:numero(altura),cor,corId,linha:linhaSelecionada?.nome||'',
      vidro:vidroSelecionado?.descricao||'',vidroId,contramarco,quantidade:Number(quantidade),
      variaveis:escolhas,pendentes
    }])
    setEtapa(1);setLargura('');setAltura('');setCorId('');setQuantidade('1');setTipologiaId('');setVidroId('');setContramarco('');setBuscaTipologia('');setValores({})
    setAviso('Tipologia adicionada. Configure outra ou revise o orçamento.')
  }
  function adicionarProduto(p:Produto){
    setItens(a=>{const i=a.find(x=>x.produto.id===p.id);return i?a.map(x=>x.produto.id===p.id?{...x,quantidade:x.quantidade+1}:x):[...a,{produto:p,quantidade:1}]})
  }
  function alterarQtd(id:string,n:number){if(!Number.isInteger(n)||n<1||n>99999)return;setItens(a=>a.map(x=>x.produto.id===id?{...x,quantidade:n}:x))}
  function gerar(rascunho=false){
    if(temPendencias&&!rascunho){setMostrarPendencias(true);setAviso('Existem preços ou fórmulas técnicas pendentes. Confira a relação antes de finalizar o orçamento.');return}
    if(descontoInvalido){setAviso('Corrija o desconto.');return}
    const ts:TipologiaDocumento[]=medidas.map(m=>({
      id:m.id,nome:m.tipologia.label,linha:m.linha,largura:String(m.largura),altura:String(m.altura),quantidade:m.quantidade,
      cor:m.cor,vidro:m.vidro,contramarco:m.contramarco==='com'?'Com contramarco':m.contramarco==='sem'?'Sem contramarco':'A definir',variaveis:m.variaveis,imagem:m.tipologia.foto_url||null
    }))
    const ps:ProdutoDocumento[]=itens.map(i=>({
      id:i.produto.id,codigo:i.produto.codigo,nome:i.produto.nome,descricao:i.produto.descricao,unidade:i.produto.unidade,
      quantidade:i.quantidade,preco:valorUnitario(i.produto),imagem:i.produto.fotoUrl||i.produto.fotoCandidataUrl||null
    }))
    setDocumento({cliente,empresa,tipologias:ts,produtos:ps,subtotal,desconto:descontoValor,totalProdutos,
      temPendencias,condicoes:condicoes.map(c=>({forma:c.forma,valor:c.valor})),
      validadeDias:validade,data:new Date().toLocaleDateString('pt-BR')})
  }

  return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-14 pt-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-[1300px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">
        <Link href="/previews/orcamento" aria-label="Voltar aos tipos de orçamento" className="rounded-xl border bg-white p-2.5"><ArrowLeft size={19}/></Link>
        <div><p className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">Atlas One / Comercial / Prévia</p>
          <h1 className="text-2xl font-black sm:text-3xl">Orçamento sob medida</h1>
          <p className="text-sm text-slate-500">Configurar medidas, tipologia, linha, vidro e variáveis técnicas.</p></div></div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">PRÉVIA · SEM GRAVAÇÃO NO ATLAS OFICIAL</span>
      </header>
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><label className="text-xs font-bold text-slate-600">Cliente / responsável<input className={input+' mt-1'} placeholder="Cliente do orçamento" value={cliente} onChange={e=>setCliente(e.target.value)}/></label></section>
      {!revisao&&<div className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-2">
        {([{n:1,label:'1 · Medidas'},{n:2,label:'2 · Tipologia e linha'},{n:3,label:'3 · Variáveis'}] as const).map(v=><button key={v.n} type="button" onClick={()=>setEtapa(v.n)} disabled={v.n===2&&!(numero(largura)>0&&numero(altura)>0)||v.n===3&&!tipologiaId} className={'rounded-xl px-2 py-3 text-xs font-bold disabled:opacity-40 '+(etapa===v.n?'bg-indigo-700 text-white':'bg-white text-slate-600')}>{v.label}</button>)}
      </div>}
      {aviso&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{aviso}</p>}

      {!revisao&&etapa===1&&<section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black"><DraftingCompass size={21} className="text-indigo-700"/> 1. Medidas, cor e quantidade</h2>
        <p className="mt-1 text-xs text-slate-500">Informe primeiro as medidas. A sugestão de linha virá do cadastro de vínculos da tipologia; regras futuras avaliarão limites dimensionais.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold">Largura (mm) *<input className={input+' mt-1'} type="number" min="1" placeholder="Ex.: 1200" value={largura} onChange={e=>setLargura(e.target.value)}/></label>
          <label className="text-xs font-bold">Altura (mm) *<input className={input+' mt-1'} type="number" min="1" placeholder="Ex.: 1000" value={altura} onChange={e=>setAltura(e.target.value)}/></label>
          <div className="space-y-1">
            <label className="block text-xs font-bold">Cor / acabamento * (cadastro existente)
              <select className={input+' mt-1'} value={corId} onChange={e=>setCorId(e.target.value)} required>
                <option value="">Selecione uma cor cadastrada</option>
                {(coresDados?.cores||[]).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            {corSelecionada&&<p className={'text-[11px] font-semibold '+(precoCor==null?'text-amber-800':'text-slate-600')}>
              Preço de referência do alumínio: {precoCor!=null?moeda(precoCor)+'/kg':'Sem preço cadastrado'}
            </p>}
            {coresErro&&<p role="alert" className="text-xs text-red-700">{coresErro}</p>}
            <Link href="/previews/cadastros/preco-aluminio" className="inline-block text-[11px] font-bold text-indigo-700 underline">Consultar tabela de preços por cor (Master)</Link>
          </div>
          <label className="text-xs font-bold">Quantidade<input className={input+' mt-1'} type="number" min="1" value={quantidade} onChange={e=>setQuantidade(e.target.value)}/></label>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={avancarMedidas} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white">Próximo: tipologia <ArrowRight size={17}/></button></div>
      </section>}
      {!revisao&&etapa===2&&<section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black"><Layers3 size={21} className="text-indigo-700"/> 2. Tipologia, linha técnica e vidro</h2>
        <p className="mt-1 text-xs text-slate-500">{largura} × {altura} mm · Cor {cor||'A definir'}. O número de folhas já é definido pelo cadastro da tipologia.</p>
        {erroReferencias&&<p role="alert" className="mt-2 text-xs text-red-700">{erroReferencias}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold">Pesquisar tipologia
            <input className={input+' mt-1'} value={buscaTipologia}
              onChange={e=>{setBuscaTipologia(e.target.value);setTipologiaId('');setValores({})}}
              placeholder="Digite janela, correr, duas folhas..." autoComplete="off"/>
          </label>
          <label className="text-xs font-bold">Filtrar por linha técnica
            <select className={input+' mt-1'} value={filtroLinhaTipologia}
              onChange={e=>{setFiltroLinhaTipologia(e.target.value);setTipologiaId('');setValores({})}}>
              <option value="">Todas as linhas</option>
              {linhasTecnicas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black">Escolha a tipologia pelas fotos</h3>
            <span className="text-xs text-slate-500" aria-live="polite">
              {carregandoTipologias?'Carregando tipologias...':todasFiltradas.length+' modelo(s) encontrado(s)'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">A pesquisa mostra os modelos correspondentes enquanto você digita. O filtro superior define a linha que será usada no orçamento.</p>
          {!carregandoTipologias&&!erroReferencias&&tipologiasFiltradas.length===0&&
            <p className="mt-3 rounded-xl border border-dashed p-4 text-xs text-slate-600">Nenhuma tipologia cadastrada combina com essa busca e linha. Tente outro termo ou selecione outra linha.</p>}
          <div className="mt-3 grid max-h-[480px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {tipologiasFiltradas.map(t=><button type="button" key={t.id}
              aria-pressed={tipologiaId===t.id} aria-label={'Selecionar tipologia '+t.label}
              onClick={()=>escolherTipologia(t.id)}
              className={'flex min-w-0 items-center gap-3 rounded-xl border-2 p-2.5 text-left transition hover:border-indigo-400 hover:bg-indigo-50 '+(tipologiaId===t.id?'border-indigo-600 bg-indigo-50':'border-slate-200 bg-white')}>
              <FotoTipologiaPreview fotoUrl={t.foto_url} nome={t.label}/>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold leading-snug text-slate-900">{t.label}</span>
                <span className="mt-1 block text-[11px] text-slate-500">{(t.linhaIds||[]).map(id=>linhasTecnicas.find(l=>l.id===id)?.nome).filter(Boolean).join(' · ')||'Linha não vinculada'}</span>
                {tipologiaId===t.id&&<span className="mt-2 block text-[11px] font-bold text-indigo-700">Modelo selecionado</span>}
              </span>
            </button>)}
          </div>
        </div>
        {tipologia&&<div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <FotoTipologiaPreview fotoUrl={tipologia.foto_url} nome={tipologia.label} tamanho="detalhe"/>
          <div className="min-w-0 flex-1 text-xs text-indigo-950">
            <b className="block text-sm">{tipologia.label}</b>
            <p className="mt-1">Folhas: {folhas?folhas+' (definido pela tipologia)':'conforme cadastro técnico'}</p>
            <p className="mt-1"><b>Linha:</b> {linhaSelecionada?.nome||'Selecione no filtro superior'}</p>
            <p className="mt-2 text-[11px]">Foto associada diretamente a esta tipologia no cadastro. Nenhuma imagem foi gerada.</p>
          </div>
        </div>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold">Vidro / espelho e espessura
            <select className={input+' mt-1'} value={vidroId} onChange={e=>setVidroId(e.target.value)}>
              <option value="">A definir / sem vidro</option>
              {vidros.map(v=><option key={v.id} value={v.id}>{v.descricao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Contramarco
            <select className={input+' mt-1'} value={contramarco} onChange={e=>setContramarco(e.target.value)}>
              <option value="" disabled>Escolha com ou sem contramarco</option>
              <option value="com">Com contramarco</option>
              <option value="sem">Sem contramarco</option>
            </select>
          </label>
        </div>
        {tipologia&&<p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          {linhasVinculadas.length?String(linhasVinculadas.length)+' linha(s) cadastrada(s) para esta tipologia. A linha definida no filtro superior será usada em todo o orçamento.':'Esta tipologia não tem linha cadastrada. Ela precisa ser vinculada na engenharia antes de selecionar uma linha.'}
          As regras de limite dimensional serão configuradas posteriormente.
        </p>}
        {vidroSelecionado&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Referência real W.Vetro: {vidroSelecionado.descricao}. {vidroSelecionado.referenciaNaoPrecificada?'Sem vínculo comercial e sem preço técnico cadastrado.':'Vínculo comercial encontrado; cálculo técnico ainda pendente.'}</p>}
        <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={()=>setEtapa(1)} className="rounded-xl border px-4 py-3 text-sm font-bold">Voltar às medidas</button><button type="button" onClick={avancarVariaveis} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white">Próximo: variáveis <ArrowRight size={17}/></button></div>
      </section>}
      {!revisao&&etapa===3&&tipologia&&<section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-xl bg-indigo-50 p-3 text-xs"><b>{tipologia.label}</b> · {largura} × {altura} mm · {linhaSelecionada?.nome||'Linha a definir'} · {cor||'Cor a definir'}</div>
        <VariaveisTipologiaPreview key={tipologia.id} tipologiaId={tipologia.id} tipologiaNome={tipologia.label}
          master={false} catalogo={catalogo} rascunhos={[]} onChangeRascunhos={()=>{}}
          selecoes={valores} onChangeSelecoes={setValores} carregando={variaveisCarregando} erro={erroVariaveis}/>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><b>Formulação posterior:</b> custos, composição, perdas, cortes e margem própria da tipologia ainda dependem de regras técnicas validadas. A margem unitária não será aplicada automaticamente.</p>
        <div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" onClick={()=>setEtapa(2)} className="rounded-xl border px-4 py-3 text-sm font-bold">Voltar à tipologia</button><button type="button" onClick={incluirTipologia} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white"><Plus size={17}/> Adicionar tipologia configurada</button></div>
      </section>}
      {!revisao&&!!medidas.length&&<section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black">Tipologias adicionadas ({medidas.length})</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{medidas.map(m=><div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border bg-slate-50 p-3">
          <div><b className="text-sm">{m.quantidade} × {m.tipologia.label}</b><p className="mt-1 text-xs text-slate-500">{m.largura} × {m.altura} mm · {m.linha||'Linha a definir'} · {m.cor||'Cor a definir'}</p>
            {m.variaveis.length>0&&<p className="mt-1 text-[11px] text-slate-600">{m.variaveis.map(v=>v.nome+': '+v.valor).join(' · ')}</p>}
            {m.pendentes>0&&<p className="mt-1 text-[11px] text-amber-700">{m.pendentes} variável(is) obrigatória(s) pendente(s)</p>}
            <p className="mt-2 text-xs font-bold text-amber-800">Custo e preço: aguardando fórmula técnica</p>
          </div><button type="button" aria-label="Remover tipologia" onClick={()=>setMedidas(a=>a.filter(x=>x.id!==m.id))} className="rounded-lg border p-2 text-red-700"><Trash2 size={15}/></button>
        </div>)}</div>
      </section>}
      {!revisao&&<section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-black">Produtos adicionais ao orçamento</h2><p className="mt-1 text-xs text-slate-500">O catálogo fica fechado até você escolher adicionar perfis, acessórios ou produtos prontos.</p></div>
          <button type="button" onClick={()=>setMostrarProdutos(v=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700">{mostrarProdutos?'Fechar catálogo':'Adicionar produto ao orçamento'} {mostrarProdutos?<ChevronDown size={15}/>:<Plus size={15}/>}</button>
        </div>
        {!!itens.length&&<p className="mt-3 text-xs font-semibold">{itens.length} produto(s) adicionados · Subtotal conhecido: {moeda(subtotal)}.</p>}
      </section>}
      {!revisao&&mostrarProdutos&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black"><Search size={18}/> Pesquisar produtos adicionais</h2>
          <input className={input+' mt-3'} placeholder="Código, nome ou descrição..." value={buscaProduto} onChange={e=>setBuscaProduto(e.target.value)}/>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{categorias.map(c=><button type="button" key={c[0]} onClick={()=>{setCategoria(c[0]);setLinhaProduto('')}} className={'rounded-lg border p-2 text-xs font-bold '+(categoria===c[0]?'bg-blue-700 text-white':'bg-slate-50')}>{c[1]}</button>)}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold">Linha técnica<select className={input+' mt-1'} value={linhaProduto} onChange={e=>setLinhaProduto(e.target.value)}><option value="">Todas as linhas</option>{linhasProdutos.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
            <label className="text-xs font-bold">Preço<select className={input+' mt-1'} value={filtroPreco} onChange={e=>setFiltroPreco(e.target.value)}><option value="todos">Todos</option><option value="com">Com preço</option><option value="sem">Sem preço</option></select></label></div>
          {erroProdutos&&<p role="alert" className="mt-2 text-xs text-red-700">{erroProdutos}</p>}
          <div className="mt-3 max-h-[510px] space-y-2 overflow-y-auto">{produtos.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
            <FotoProdutoPreview nome={p.nome} fotoUrl={p.fotoUrl} fotoCandidataUrl={p.fotoCandidataUrl} tamanho="pequeno"/>
            <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{p.nome}</b><p className="text-[11px] text-slate-500">{p.codigo} · {p.unidade}</p><b className="mt-1 block text-xs text-blue-700">{valorUnitario(p)!=null?moeda(valorUnitario(p)!):'Preço a cadastrar'}</b></div>
            <button type="button" aria-label={'Adicionar '+p.nome} onClick={()=>adicionarProduto(p)} className="rounded-lg bg-blue-700 p-2 text-white"><Plus size={17}/></button>
          </div>)}</div>
          {!erroProdutos&&!produtos.length&&<p className="mt-3 text-xs text-slate-500">Nenhum produto cadastrado encontrado com estes filtros.</p>}
        </section>
        <aside className="rounded-2xl border bg-white p-4 shadow-sm"><h3 className="text-sm font-black">Itens avulsos adicionados</h3>
          {itens.map(i=><div key={i.produto.id} className="mt-3 border-b pb-3"><b className="text-xs">{i.produto.nome}</b><p className="text-xs text-slate-600">{valorUnitario(i.produto)!=null?moeda(valorUnitario(i.produto)!):'Preço pendente'}</p><div className="mt-2 flex items-center gap-2"><label className="text-xs">Qtd.</label><input type="number" min="1" className="w-20 rounded-lg border p-1.5 text-center text-xs" value={i.quantidade} onChange={e=>alterarQtd(i.produto.id,Number(e.target.value))}/><button type="button" aria-label="Remover item" onClick={()=>setItens(a=>a.filter(x=>x.produto.id!==i.produto.id))} className="ml-auto text-red-700"><Trash2 size={15}/></button></div></div>)}
          <div className="mt-3 flex justify-between text-xs font-bold"><span>Subtotal conhecido</span><span>{moeda(subtotal)}</span></div>
          <button type="button" onClick={()=>setMostrarProdutos(false)} className="mt-3 w-full rounded-lg border py-2 text-xs font-bold">Concluir inclusão de produtos</button>
        </aside>
      </div>}
      {!revisao&&<div className="flex justify-end"><button type="button" onClick={()=>{if(!medidas.length){setAviso('Adicione pelo menos uma tipologia sob medida.');return}setRevisao(true);setAviso('')}} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white">Revisar orçamento <ArrowRight size={17}/></button></div>}
      {revisao&&<section className="mx-auto max-w-4xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        <h2 className="flex items-center justify-center gap-2 text-xl font-black"><Check size={22} className="text-emerald-700"/> Revisão da proposta — Simulação</h2>
        <p className="mt-2 text-center text-xs text-slate-500">Cliente: {cliente||'A identificar'}. Nenhum orçamento, pedido, pagamento ou custo técnico será gravado.</p>
        {medidas.map(m=><div key={m.id} className="mt-4 flex justify-between gap-3 border-b pb-3 text-xs"><div><b>{m.quantidade} × {m.tipologia.label}</b><p className="mt-1 text-slate-500">{m.largura} × {m.altura} mm · {m.linha||'Linha pendente'} · {m.vidro||'Vidro pendente'}</p><p className="text-slate-500">{m.variaveis.map(v=>v.nome+': '+v.valor).join(' · ')||'Variáveis ainda não escolhidas'}</p></div><b className="text-amber-800">A precificar</b></div>)}
        {itens.map(i=><div key={i.produto.id} className="mt-3 flex justify-between border-b pb-2 text-xs"><span>{i.quantidade} × {i.produto.nome}</span><b>{valorUnitario(i.produto)!=null?moeda(valorUnitario(i.produto)!*i.quantidade):'A precificar'}</b></div>)}
        {temPendencias&&<section className="mt-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <button type="button" onClick={()=>setMostrarPendencias(v=>!v)}
            className="flex w-full items-center justify-between gap-3 text-left">
            <span><b className="block text-sm text-amber-950">Atenção: {pendencias.length} pendência(s) impedem o orçamento definitivo</b>
              <span className="mt-1 block text-xs text-amber-800">Clique para ver qual produto, cor ou tipologia está sem preço ou composição.</span></span>
            <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800">{mostrarPendencias?'Ocultar detalhes':'Ver pendências'}</span>
          </button>
          {mostrarPendencias&&<div className="mt-4 space-y-2 border-t border-amber-200 pt-3">
            {pendencias.map(p=><div key={p.id} className="rounded-lg border border-amber-200 bg-white p-3">
              <b className="block text-xs text-amber-900">{p.tipo}</b>
              <p className="mt-1 text-sm font-bold text-slate-800">{p.titulo}</p>
              <p className="mt-1 text-xs text-slate-600">{p.detalhe}</p>
            </div>)}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-3">
                <Link href="/previews/cadastros/preco-aluminio" className="text-xs font-bold text-indigo-700 underline">Ver preços do alumínio e das cores</Link>
                <Link href="/cadastro/produtos" className="text-xs font-bold text-indigo-700 underline">Ver cadastro de produtos</Link>
              </div>
              <button type="button" onClick={()=>gerar(true)} disabled={descontoInvalido}
                className="rounded-lg border border-amber-400 bg-white px-4 py-2.5 text-xs font-bold text-amber-950 disabled:opacity-40">
                Gerar apenas rascunho em PDF (com pendências)
              </button>
            </div>
          </div>}
        </section>}
        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-xs"><div className="flex justify-between"><span>Subtotal conhecido dos produtos</span><b>{moeda(subtotal)}</b></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="font-bold">Tipo de desconto<select className={input+' mt-1'} value={descontoTipo} onChange={e=>setDescontoTipo(e.target.value)}><option value="sem">Sem desconto</option><option value="valor">Valor (R$)</option><option value="percentual">Percentual (%)</option></select></label>
            <label className="font-bold">Desconto<input className={input+' mt-1'} inputMode="decimal" value={desconto} disabled={descontoTipo==='sem'} onChange={e=>setDesconto(e.target.value)} placeholder="Valor ou %"/></label></div>
          {descontoInvalido&&<p className="mt-2 text-red-700">O desconto excede o limite permitido.</p>}
          <div className="mt-2 flex justify-between"><span>Subtotal ajustado dos produtos</span><b>{moeda(totalProdutos)}</b></div>
          <p className="mt-2 font-bold text-amber-800">O total geral permanece pendente de fórmulas técnicas e preços necessários. {pendencias.length} pendência(s) identificadas; consulte os detalhes acima.</p>
        </div>
        <div className="mt-4 rounded-xl border p-4"><h3 className="text-sm font-black">Condições de pagamento propostas</h3>
          {condicoes.map(c=><div key={c.id} className="mt-2 flex flex-wrap gap-2"><select className={input+' flex-1'} value={c.forma} onChange={e=>setCondicoes(a=>a.map(x=>x.id===c.id?{...x,forma:e.target.value}:x))}>{['PIX','Dinheiro','Cartão de débito','Cartão de crédito','Transferência','Boleto'].map(x=><option key={x}>{x}</option>)}</select><input className={input+' flex-1'} value={c.valor} onChange={e=>setCondicoes(a=>a.map(x=>x.id===c.id?{...x,valor:e.target.value}:x))} placeholder="Condição ou valor"/>{condicoes.length>1&&<button type="button" onClick={()=>setCondicoes(a=>a.filter(x=>x.id!==c.id))} className="text-red-700"><Trash2 size={16}/></button>}</div>)}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>{proximaCondicao.current++;setCondicoes(a=>[...a,{id:proximaCondicao.current,forma:'PIX',valor:''}])}} className="rounded-lg border px-3 py-2 text-xs font-bold">+ Outra condição</button><label className="text-xs font-bold">Validade (dias)<input className={input+' mt-1 w-36'} type="number" min="1" value={validade} onChange={e=>setValidade(e.target.value)} placeholder="A definir"/></label></div>
        </div>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">A margem unitária não entra na fórmula da tipologia. O documento é apenas uma simulação; não será enviado, faturado nem gravado.</p>
        <div className="mt-4 flex flex-wrap justify-between gap-3"><button type="button" onClick={()=>setRevisao(false)} className="rounded-xl border px-4 py-3 text-xs font-bold">Voltar e ajustar</button><button type="button" onClick={()=>gerar()} disabled={descontoInvalido} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"><FileText size={16}/> Gerar PDF do orçamento (prévia)</button></div>
      </section>}
    </div>
    {documento&&<OrcamentoDocumentoPreview dados={documento} fechar={()=>setDocumento(null)}/>}
  </main>
}
