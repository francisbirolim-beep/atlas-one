'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Filter, MapPinned, MapPin, Navigation, Search, SlidersHorizontal, Users, X, ZoomIn } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { carregarMapaGeral, type RegistroMapaGeral } from '@/lib/mapaGeral'
import { usuarioAtual } from '@/lib/auth'

type Etapa = 'prospeccao' | 'orcamento' | 'venda' | 'producao' | 'concluida' | 'perdida'
type TipoEvento = Etapa | 'visita'
type Evento = { tipo: TipoEvento; data: string }
type Obra = RegistroMapaGeral
type Ponto = RegistroMapaGeral & { lat: number; lng: number }

const etapas: { id: Etapa; nome: string; icone: string; cor: string; fundo: string }[] = [
  { id: 'prospeccao', nome: 'Prospecções', icone: '◎', cor: '#2563eb', fundo: '#eff6ff' },
  { id: 'orcamento', nome: 'Orçamentos', icone: '▤', cor: '#e6a500', fundo: '#fff8e1' },
  { id: 'venda', nome: 'Vendas fechadas', icone: '✓', cor: '#16a34a', fundo: '#f0fdf4' },
  { id: 'producao', nome: 'Em produção', icone: '⚙', cor: '#9333ea', fundo: '#faf5ff' },
  { id: 'concluida', nome: 'Concluídas', icone: '⚑', cor: '#0891b2', fundo: '#ecfeff' },
  { id: 'perdida', nome: 'Perdidas', icone: '×', cor: '#64748b', fundo: '#f1f5f9' },
]
const corEtapa = (id: Etapa) => etapas.find(e => e.id === id) || etapas[0]
const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
function avancar(data: string, dias: number) {
  const v = new Date(data + 'T12:00:00Z')
  v.setUTCDate(v.getUTCDate() + dias)
  return v.toISOString().slice(0, 10)
}
type Periodo = 'todos' | '30d' | '90d' | 'mes' | 'intervalo'
function intervalo(periodo: Periodo, mes: string, inicio: string, fim: string) {
  if (periodo==='todos') return ['', '']
  if (periodo==='mes') {
    const [ano, m] = mes.split('-').map(Number)
    const ultimo = new Date(Date.UTC(ano,m,0)).getUTCDate()
    return [mes+'-01', mes+'-'+String(ultimo).padStart(2,'0')]
  }
  if (periodo==='intervalo') return [inicio, fim]
  const hoje = new Date().toISOString().slice(0,10)
  return [avancar(hoje,periodo==='30d'?-30:-90), hoje]
}
function nomeMes(ym: string) {
  const [ano, m] = ym.split('-').map(Number)
  return meses[(m||1)-1] + '/' + ano
}
function temEventoNoPeriodo(o:Obra, desde: string, ate: string) {
  return o.eventos.some(e => (!desde || e.data >= desde) && (!ate || e.data <= ate))
}
function formatarData(d:string) {
  const [y,m,dia] = d.split('-')
  return dia+'/'+m+'/'+y
}

function MapaDemo({ pontos, selecionado, escolher }:{pontos:Ponto[];selecionado:string|null;escolher:(id:string)=>void}) {
  const divRef=useRef<HTMLDivElement>(null)
  const [erro,setErro]=useState(false)
  useEffect(()=>{
    if (!divRef.current || pontos.length===0) return
    let alive=true
    let mapa: import('leaflet').Map | null=null
    async function iniciar(){
      const L=await import('leaflet')
      if(!alive || !divRef.current)return
      mapa=L.map(divRef.current,{zoomControl:false,scrollWheelZoom:true,minZoom:6,maxZoom:19})
      L.control.zoom({position:'topleft'}).addTo(mapa)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        maxZoom:19,
      }).addTo(mapa)
      pontos.forEach(p=>{
        const etapa=corEtapa(p.etapa)
        const ativo=p.id===selecionado
        const html='<div style="width:'+(ativo?40:32)+'px;height:'+(ativo?40:32)+'px;background:'+etapa.cor+';display:grid;place-items:center;border-radius:50% 50% 50% 3px;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 9px #11182770"><span style="transform:rotate(45deg);color:white;font-size:18px;font-weight:900">'+etapa.icone+'</span></div>'
        const icon=L.divIcon({html,className:'',iconSize:[ativo?40:32,ativo?40:32],iconAnchor:[16,29]})
        L.marker([p.lat,p.lng],{icon,title:p.nome}).on('click',()=>escolher(p.id)).addTo(mapa!)
      })
      const limites=L.latLngBounds(pontos.map(p=>[p.lat,p.lng] as [number,number]))
      if(pontos.length===1)mapa.setView(limites.getCenter(),15)
      else mapa.fitBounds(limites,{padding:[40,40],maxZoom:14})
      setErro(false)
      window.setTimeout(()=>{if(alive)mapa?.invalidateSize()},100)
    }
    void iniciar().catch(()=>{if(alive)setErro(true)})
    return()=>{alive=false;if(mapa)mapa.remove()}
  },[pontos,selecionado,escolher])
  if(!pontos.length)return <div className="grid h-[450px] place-items-center bg-slate-100 p-8 text-center text-sm text-slate-500">Nenhum ponto corresponde aos filtros selecionados.</div>
  return <div className="relative h-[450px] overflow-hidden rounded-xl bg-slate-100 md:h-[570px]">
    <div ref={divRef} className="absolute inset-0"/>
    {erro && <p className="absolute left-4 top-4 z-10 rounded-lg bg-white px-3 py-2 text-sm text-red-700">O mapa não carregou. Verifique a conexão.</p>}
    <div className="pointer-events-none absolute bottom-6 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow">Pinos com GPS cadastrado no Atlas · confira a precisão da localização</div>
  </div>
}

export default function MapaGeralPage(){
  const [registros,setRegistros] = useState<Obra[]>([])
  const [avisos,setAvisos] = useState<string[]>([])
  const [carregando,setCarregando] = useState(true)
  const [erroCarregamento,setErroCarregamento] = useState('')
  const [acessoPermitido,setAcessoPermitido] = useState<boolean|null>(null)
  const [atualizacao,setAtualizacao] = useState(0)
  useEffect(()=>{
    let ativo=true
    setCarregando(true)
    void (async()=>{
      try {
        const usuario=await usuarioAtual()
        if(!ativo)return
        // Inicialmente só o Master pode consultar o cruzamento entre áreas.
        // Uma futura liberação dependerá de permissões específicas.
        if(!usuario || usuario.role !== 'master'){
          setAcessoPermitido(false)
          setCarregando(false)
          return
        }
        setAcessoPermitido(true)
        const resultado=await carregarMapaGeral()
        if(!ativo)return
        setRegistros(resultado.registros)
        setAvisos(resultado.avisos)
        setErroCarregamento('')
      } catch(e) {
        if(ativo)setErroCarregamento(e instanceof Error ? e.message : 'Não foi possível carregar o mapa geral.')
      }finally{if(ativo)setCarregando(false)}
    })()
    return()=>{ativo=false}
  },[atualizacao])
  const [cidade,setCidade]=useState('')
  const [bairro,setBairro]=useState('')
  const [vendedor,setVendedor]=useState('')
  const [etapa,setEtapa]=useState<Etapa|''>('')
  const [periodo,setPeriodo]=useState<Periodo>('todos')
  const [mes,setMes]=useState(()=>new Date().toISOString().slice(0,7))
  const [inicio,setInicio]=useState(()=>avancar(new Date().toISOString().slice(0,10),-90))
  const [fim,setFim]=useState(()=>new Date().toISOString().slice(0,10))
  const [busca,setBusca]=useState('')
  const [selecionado,setSelecionado]=useState<string|null>(null)
  const [painelFiltros,setPainelFiltros]=useState(false)
  const [mostrarLista,setMostrarLista]=useState(false)
  const [painelAberto,setPainelAberto]=useState(true)
  const [ativoSomente,setAtivoSomente]=useState(false)
  const [desde,ate]=intervalo(periodo,mes,inicio,fim)
  const cidades=useMemo(()=>[...new Set(registros.map(o=>o.cidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[registros])
  const bairros=useMemo(()=>[...new Set(registros.filter(o=>!cidade||o.cidade===cidade).map(o=>o.bairro).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[registros,cidade])
  const vendedores=useMemo(()=>[...new Set(registros.map(o=>o.vendedor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[registros])
  const conjunto=useMemo(()=>registros.filter(o=>{
    if(cidade&&o.cidade!==cidade)return false
    if(bairro&&o.bairro!==bairro)return false
    if(vendedor&&o.vendedor!==vendedor)return false
    if(etapa&&o.etapa!==etapa)return false
    if(ativoSomente&&o.etapa==='perdida')return false
    if(busca.trim()&&!([o.nome,o.cliente,o.cidade,o.bairro,o.id].join(' ').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))))return false
    return true
  }),[registros,cidade,bairro,vendedor,etapa,busca,ativoSomente])
  const pontos=useMemo(()=>conjunto.filter(o=>(!desde&&!ate)||temEventoNoPeriodo(o,desde,ate)),[conjunto,desde,ate])
  const pontosMapa=useMemo(()=>pontos.filter((o):o is Ponto=>o.lat!==null&&o.lng!==null),[pontos])
  const semGPS=pontos.length-pontosMapa.length
  const ficha=pontos.find(p=>p.id===selecionado) || pontos[0] || null
  const kpis=useMemo(()=>{
    const totais:Record<TipoEvento,number>={prospeccao:0,visita:0,orcamento:0,venda:0,producao:0,concluida:0,perdida:0}
    pontos.forEach(o=>o.eventos.forEach(e=>{if((!desde||e.data>=desde)&&(!ate||e.data<=ate))totais[e.tipo]++}))
    // Sem data de transição validada, produção/conclusão/perda são situação ATUAL,
    // e não movimentos atribuídos artificialmente ao mês selecionado.
    totais.producao=pontos.filter(o=>o.etapa==='producao').length
    totais.concluida=pontos.filter(o=>o.etapa==='concluida').length
    totais.perdida=pontos.filter(o=>o.etapa==='perdida').length
    return totais
  },[pontos,desde,ate])
  const tendencia=useMemo(()=>Array.from({length:6},(_,i)=>{
    const agora=new Date()
    const data=new Date(agora.getFullYear(),agora.getMonth()-(5-i),1)
    const ym=data.getFullYear()+'-'+String(data.getMonth()+1).padStart(2,'0')
    const base=conjunto.flatMap(o=>o.eventos.filter(e=>e.data.startsWith(ym)))
    return {ym,visitas:base.filter(e=>e.tipo==='visita').length,orcamentos:base.filter(e=>e.tipo==='orcamento').length,vendas:base.filter(e=>e.tipo==='venda').length}
  }),[conjunto])
  function limpar(){
    setCidade('');setBairro('');setVendedor('');setEtapa('');setPeriodo('todos');setBusca('');setAtivoSomente(false);setPainelFiltros(false)
  }
  const selectClass='min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500'
  const labelClass='mb-1.5 block text-[11px] font-semibold text-slate-500'
  const cards=[
    {nome:'Prospecções',valor:kpis.prospeccao,icone:'◎',cor:'#2563eb',fundo:'#eff6ff',borda:'#bfdbfe'},
    {nome:'Visitas registradas',valor:kpis.visita,icone:'◉',cor:'#0f766e',fundo:'#f0fdfa',borda:'#99f6e4'},
    {nome:'Orçamentos',valor:kpis.orcamento,icone:'▤',cor:'#b45309',fundo:'#fffbeb',borda:'#fde68a'},
    {nome:'Vendas fechadas',valor:kpis.venda,icone:'✓',cor:'#15803d',fundo:'#f0fdf4',borda:'#bbf7d0'},
    {nome:'Em produção',valor:kpis.producao,icone:'⚙',cor:'#7e22ce',fundo:'#faf5ff',borda:'#e9d5ff'},
    {nome:'Concluídas',valor:kpis.concluida,icone:'⚑',cor:'#0891b2',fundo:'#ecfeff',borda:'#a5f3fc'},
    {nome:'Perdidas',valor:kpis.perdida,icone:'×',cor:'#475569',fundo:'#f1f5f9',borda:'#cbd5e1'},
  ]
  return <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
    <main className="mx-auto max-w-[1700px] space-y-4 p-3 sm:p-5 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow"><MapPinned size={25}/></span>
          <div><h1 className="text-xl font-black tracking-tight sm:text-3xl">Atlas One — Mapa Geral</h1><p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Prospecções, visitas, orçamentos e obras em um único mapa</p></div>
        </div>
        <div className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800">MAPA REAL · ACESSO MASTER</div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <p><b>{carregando?'Carregando dados do Atlas...':'Dados do Atlas One:'}</b> {pontos.length} registro(s) no período, {pontosMapa.length} com GPS. Indicadores usam somente eventos e situações já registrados.</p>
        <button type="button" onClick={()=>setAtualizacao(v=>v+1)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-bold" disabled={carregando}>{carregando?'Carregando...':'Atualizar dados'}</button>
        <button type="button" onClick={limpar} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-bold">Limpar tudo</button>
      </div>

      {acessoPermitido===false && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">A consulta integrada do Mapa Geral está liberada inicialmente apenas para o usuário Master.</div>}
      {erroCarregamento && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{erroCarregamento}</div>}
      {avisos.map((aviso,i)=><p role="alert" key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{aviso}</p>)}
      {acessoPermitido!==false && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-extrabold"><SlidersHorizontal size={17} className="text-blue-600"/> Filtros do mapa</h2>
          <button type="button" onClick={()=>setPainelFiltros(!painelFiltros)} className="rounded-lg border px-3 py-1.5 text-xs font-bold lg:hidden">{painelFiltros?'Recolher':'Mostrar filtros'}</button>
        </div>
        <div className={(painelFiltros?'grid':'hidden')+' gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-5'}>
          <div><label className={labelClass}>Cidade</label><select className={selectClass} value={cidade} onChange={e=>{setCidade(e.target.value);setBairro('')}}><option value="">Todas as cidades</option>{cidades.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className={labelClass}>Bairro</label><select className={selectClass} value={bairro} onChange={e=>setBairro(e.target.value)}><option value="">Todos os bairros</option>{bairros.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
          <div><label className={labelClass}>Responsável</label><select className={selectClass} value={vendedor} onChange={e=>setVendedor(e.target.value)}><option value="">Todos os vendedores</option>{vendedores.map(v=><option key={v}>{v}</option>)}</select></div>
          <div><label className={labelClass}>Situação atual</label><select className={selectClass} value={etapa} onChange={e=>setEtapa(e.target.value as Etapa|'')}><option value="">Todas as etapas</option>{etapas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
          <div><label className={labelClass}>Buscar obra / cliente</label><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className={selectClass+' pl-9'} placeholder="Nome, bairro, código..." value={busca} onChange={e=>setBusca(e.target.value)}/></div></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <CalendarDays size={17} className="text-blue-600"/>
          <span className="mr-1 text-xs font-bold">Período:</span>
          {([['todos','Todo o histórico'],['30d','30 dias'],['90d','90 dias'],['mes','Por mês'],['intervalo','Datas personalizadas']] as const).map(([id,nome])=>
            <button key={id} type="button" onClick={()=>setPeriodo(id)} className={'rounded-lg border px-3 py-2 text-xs font-semibold transition '+(periodo===id?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white text-slate-600 hover:border-blue-300')}>{nome}</button>
          )}
          {periodo==='mes'&&<input aria-label="Selecionar mês" type="month" value={mes} onChange={e=>setMes(e.target.value)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-bold"/>}
          {periodo==='intervalo'&&<div className="flex flex-wrap gap-2"><input aria-label="Data inicial" type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs"/><span className="self-center text-xs text-slate-500">até</span><input aria-label="Data final" type="date" value={fim} onChange={e=>setFim(e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs"/></div>}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={ativoSomente} onChange={e=>setAtivoSomente(e.target.checked)}/> Ocultar perdidas</label>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {periodo==='todos'?'Exibindo todos os eventos do conjunto de demonstração':'Mostrando eventos ocorridos de '+formatarData(desde)+' a '+formatarData(ate)}. Prospecções, visitas, orçamentos e vendas contam eventos datados; produção, concluídas e perdidas contam a situação atual dos registros filtrados. A cor dos pinos mostra a situação atual.
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
        {cards.map(c=><div key={c.nome} className="rounded-xl border px-3 py-3 shadow-sm" style={{backgroundColor:c.fundo,borderColor:c.borda}}>
          <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-700">{c.nome}</span><span className="text-lg font-black" style={{color:c.cor}}>{c.icone}</span></div>
          <p className="mt-1 text-2xl font-black" style={{color:c.cor}}>{c.valor}</p>
        </div>)}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-base font-extrabold">Mapa de oportunidades e obras</h2><p className="text-xs text-slate-500">{pontosMapa.length} ponto(s) com GPS · {semGPS} registro(s) sem GPS na lista · clique no pino para abrir detalhes</p></div>
            <button type="button" onClick={()=>setMostrarLista(!mostrarLista)} className="rounded-lg border px-3 py-2 text-xs font-bold"><Filter size={13} className="mr-1 inline"/>{mostrarLista?'Ver mapa':'Ver lista'}</button>
          </div>
          {mostrarLista?<div className="h-[450px] space-y-2 overflow-y-auto md:h-[570px]">{pontos.map(p=><button key={p.id} type="button" onClick={()=>{setSelecionado(p.id);setPainelAberto(true)}} className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left hover:border-blue-400"><span className="grid h-9 w-9 place-items-center rounded-full text-lg font-black text-white" style={{backgroundColor:corEtapa(p.etapa).cor}}>{corEtapa(p.etapa).icone}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{p.nome}</b><span className="text-xs text-slate-500">{p.bairro} · {p.cidade}{p.lat===null?" · Sem GPS":""}</span></span><span className="text-[11px] font-semibold text-slate-500">{corEtapa(p.etapa).nome}</span></button>)}</div>:
            <MapaDemo pontos={pontosMapa} selecionado={ficha?.id||null} escolher={id=>{setSelecionado(id);setPainelAberto(true)}}/>
          }
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {etapas.map(e=><button key={e.id} type="button" onClick={()=>setEtapa(etapa===e.id?'':e.id)} className={'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold '+(etapa===e.id?'bg-slate-100 ring-1 ring-slate-400':'')}><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:e.cor}}/>{e.nome}</button>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {ficha&&painelAberto?<div>
            <div className="flex items-center justify-between"><span className="rounded-lg px-2 py-1 text-xs font-extrabold" style={{background:corEtapa(ficha.etapa).fundo,color:corEtapa(ficha.etapa).cor}}>{corEtapa(ficha.etapa).icone} {corEtapa(ficha.etapa).nome}</span><button type="button" onClick={()=>setPainelAberto(false)} title="Fechar detalhes" className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div>
            <h3 className="mt-3 text-lg font-black">{ficha.nome}</h3><p className="text-xs text-slate-500">{ficha.cliente}</p>
            <div className="mt-4 space-y-3 border-y py-4 text-sm">
              <p className="flex gap-2"><MapPin size={16} className="shrink-0 text-slate-500"/><span><b>Localização da obra</b><br/>{ficha.endereco ? ficha.endereco + (ficha.numero ? ", "+ficha.numero:"")+" · ":""}{ficha.bairro}, {ficha.cidade}</span></p>
              <p className="flex gap-2"><Users size={16} className="shrink-0 text-slate-500"/><span><b>Responsável</b><br/>{ficha.vendedor}</span></p>
              <p className="flex gap-2"><ClipboardList size={16} className="shrink-0 text-slate-500"/><span><b>Referência no Atlas</b><br/>{ficha.id.split(":").slice(1).join(":")}</span></p>
            </div>
            <h4 className="mt-4 text-sm font-extrabold">Histórico de etapas</h4>
            <div className="mt-3 space-y-3">
              {ficha.eventos.map((e,i)=><div key={i} className="flex items-center gap-3 text-xs"><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700"><CheckCircle2 size={14}/></span><div><p className="font-bold">{e.tipo==='visita'?'Visita realizada':corEtapa(e.tipo).nome}</p><p className="text-slate-500">{formatarData(e.data)}</p></div></div>)}
            </div>
            <Link href={ficha.href} className="mt-5 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white">Abrir ficha no Atlas</Link>
            <button type="button" onClick={()=>setMostrarLista(true)} className="mt-2 w-full rounded-xl border border-blue-200 px-4 py-3 text-xs font-bold text-blue-700">Ver registros filtrados</button>
            <p className="mt-2 text-center text-[11px] text-slate-400">Endereços e coordenadas são exibidos somente quando cadastrados ou confirmados.</p>
          </div>:<div className="grid min-h-64 place-items-center text-center"><div><MapPin size={34} className="mx-auto text-blue-600"/><p className="mt-3 text-sm font-bold">Selecione um pino</p><p className="mt-2 text-xs text-slate-500">Veja situação e histórico da obra.</p><button type="button" onClick={()=>setPainelAberto(true)} className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Exibir detalhes</button></div></div>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-extrabold">Comparativo mensal</h2><p className="text-xs text-slate-500">Clique em um mês para filtrar mapa e indicadores acima.</p></div>
          <p className="text-[11px] text-slate-500">Eventos reais registrados no Atlas</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {tendencia.map(t=><button type="button" key={t.ym} onClick={()=>{setPeriodo('mes');setMes(t.ym)}} className={'rounded-xl border p-3 text-left transition hover:border-blue-400 '+(periodo==='mes'&&mes===t.ym?'border-blue-500 bg-blue-50':'border-slate-200')}>
            <b className="text-xs">{nomeMes(t.ym)}</b><div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span>Visitas</span><b>{t.visitas}</b></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{width:Math.min(100,t.visitas*9)+'%'}}/></div>
              <div className="flex justify-between"><span>Orçamentos</span><b>{t.orcamentos}</b></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{width:Math.min(100,t.orcamentos*9)+'%'}}/></div>
              <div className="flex justify-between"><span>Vendas</span><b>{t.vendas}</b></div>
            </div>
          </button>)}
        </div>
      </section>
      </>}
      <p className="pb-5 text-center text-[11px] text-slate-500">Leitura dos registros existentes, sem alterações em obras ou orçamentos. Visitas contabilizadas pelas interações de prospecção. A união de registros usa o ID da obra, sem misturar obras diferentes do mesmo cliente. Pontos sem GPS aparecem somente na lista.</p>
    </main>
  </div>
}
