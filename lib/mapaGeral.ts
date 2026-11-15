import { supabase } from '@/lib/supabase'
import { coordenadasEmTexto, localizacaoRegistradaNaObra } from '@/lib/enderecoObra'

// Fontes já existentes no Atlas One. Nenhum ponto é geocodificado por suposição:
// só usamos GPS registrado na prospecção ou confirmado na própria obra.
export type EtapaMapaGeral = 'prospeccao' | 'orcamento' | 'venda' | 'producao' | 'concluida' | 'perdida'
export type TipoEventoMapaGeral = EtapaMapaGeral | 'visita'
export type EventoMapaGeral = { tipo: TipoEventoMapaGeral; data: string }
export type RegistroMapaGeral = {
  id: string
  nome: string
  cliente: string
  cidade: string
  bairro: string
  vendedor: string
  etapa: EtapaMapaGeral
  lat: number | null
  lng: number | null
  eventos: EventoMapaGeral[]
  href: string
  endereco?: string
  numero?: string | null
  origem: 'obra' | 'prospeccao' | 'orcamento'
}
export type RetornoMapaGeral = { registros: RegistroMapaGeral[]; avisos: string[] }

type ProspeccaoDB = {
  id: string
  obra_id?: string | null
  cliente_id?: string | null
  nome_cliente: string
  nome_obra?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  latitude?: number | null
  longitude?: number | null
  responsavel_nome?: string | null
  status: string
  created_at: string
}
type ObraDB = {
  id: string
  cliente_id?: string | null
  nome: string
  status: string
  bairro?: string | null
  cidade?: string | null
  endereco?: string | null
  numero_endereco?: string | null
  observacoes?: string | null
  criado_por_nome?: string | null
  created_at?: string | null
  clientes?: { id: string; nome?: string | null } | { id: string; nome?: string | null }[] | null
}
type OrcamentoDB = {
  id: string
  obra_id?: string | null
  cliente_id?: string | null
  cliente_nome?: string | null
  cidade?: string | null
  status?: string | null
  data_venda?: string | null
  numero?: number | null
  criado_por_nome?: string | null
  created_at?: string | null
}
type InteracaoDB = {
  prospeccao_id: string
  tipo: string
  created_at?: string | null
}
const DIA=/^\d{4}-\d{2}-\d{2}$/

function diaValido(valor?: string | null): string | null {
  const d = valor?.slice(0,10) || ''
  if (!DIA.test(d) || !Number.isFinite(Date.parse(d + 'T12:00:00Z'))) return null
  return d
}

function coordenadas(latitude: unknown, longitude: unknown): {lat:number;lng:number} | null {
  if (latitude == null || longitude == null) return null
  const lat = Number(latitude), lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return null
  return { lat, lng }
}
function gpsDaObra(observacoes?:string|null) {
  const coordenada = localizacaoRegistradaNaObra(observacoes)
  const valor = coordenadasEmTexto(coordenada)
  if (!valor) return null
  const [lat,lng] = valor.split(',').map(Number)
  return coordenadas(lat,lng)
}
function nomeClienteObra(obra:ObraDB) {
  if (Array.isArray(obra.clientes)) return obra.clientes[0]?.nome || ''
  return obra.clientes?.nome || ''
}
async function lerTabela<T>(tabela: string, campos: string): Promise<T[]> {
  const resultado:T[] = []
  const tamanho=500
  // Paginação estável; falha explicitamente em vez de apresentar um total parcial.
  for (let inicio=0;inicio<10000;inicio+=tamanho) {
    const { data, error } = await supabase.from(tabela).select(campos).order('id',{ascending:true}).range(inicio,inicio+tamanho-1)
    if (error) throw new Error(tabela + ': ' + error.message)
    const pagina=(data||[]) as T[]
    resultado.push(...pagina)
    if(pagina.length<tamanho) return resultado
  }
  throw new Error('Limite de consulta excedido para '+tabela+'. Refine ou amplie a paginação antes de usar os totais.')
}
function adicionarEvento(registro: RegistroMapaGeral, tipo: TipoEventoMapaGeral, data?:string|null) {
  const dia=diaValido(data)
  if(dia) registro.eventos.push({tipo,data:dia})
}

/** Consulta somente dados visíveis à sessão via RLS. Não insere nem modifica registros. */
export async function carregarMapaGeral(): Promise<RetornoMapaGeral> {
  const avisos: string[]=[]
  const [obrasR,prosR,orcR,interR]=await Promise.allSettled([
    lerTabela<ObraDB>('obras','id,cliente_id,nome,status,bairro,cidade,endereco,numero_endereco,observacoes,criado_por_nome,clientes(id,nome)'),
    lerTabela<ProspeccaoDB>('prospeccoes','id,obra_id,cliente_id,nome_cliente,nome_obra,cidade,bairro,endereco,latitude,longitude,responsavel_nome,status,created_at'),
    lerTabela<OrcamentoDB>('orcamentos','id,obra_id,cliente_id,cliente_nome,cidade,status,data_venda,numero,criado_por_nome,created_at'),
    lerTabela<InteracaoDB>('prospeccao_interacoes','id,prospeccao_id,tipo,created_at'),
  ])
  // Erro de uma fonte não faz as outras desaparecerem nem vira um falso zero.
  const obter=<T>(r:PromiseSettledResult<T[]>,nome:string):T[]=>{
    if(r.status==='fulfilled')return r.value
    avisos.push('Não foi possível carregar '+nome+'. Os indicadores podem estar incompletos.')
    return []
  }
  const obras=obter(obrasR,'obras'),prospeccoes=obter(prosR,'prospecções'),
    orcamentos=obter(orcR,'orçamentos'),interacoes=obter(interR,'visitas')
  const porObra=new Map<string,RegistroMapaGeral>()
  const porProspeccao=new Map<string,RegistroMapaGeral>()
  const registros:RegistroMapaGeral[]=[]
  const obraOrigem=new Map<string,ObraDB>()
  for(const obra of obras){
    const gps=gpsDaObra(obra.observacoes)
    const etapa:EtapaMapaGeral=obra.status==='concluida'?'concluida'
      :['producao','instalacao'].includes(obra.status)?'producao'
      :['orcamento','medicao','engenharia','compras'].includes(obra.status)?'orcamento':'prospeccao'
    const r:RegistroMapaGeral={
      id:'obra:'+obra.id,nome:obra.nome||'Obra sem nome',cliente:nomeClienteObra(obra),
      cidade:obra.cidade||'',bairro:obra.bairro||'',vendedor:obra.criado_por_nome||'',
      etapa,lat:gps?.lat??null,lng:gps?.lng??null,eventos:[],
      href:'/obras/'+encodeURIComponent(obra.id),endereco:obra.endereco||'',numero:obra.numero_endereco||null,origem:'obra'
    }
    registros.push(r);porObra.set(obra.id,r);obraOrigem.set(obra.id,obra)
  }

  for(const pros of prospeccoes){
    const linked=pros.obra_id?porObra.get(pros.obra_id):undefined
    const gps=coordenadas(pros.latitude,pros.longitude)
    const r=linked||{
      id:'prospeccao:'+pros.id,nome:pros.nome_obra||pros.nome_cliente||'Oportunidade',
      cliente:pros.nome_cliente||'',cidade:pros.cidade||'',bairro:pros.bairro||'',
      vendedor:pros.responsavel_nome||'',etapa:pros.status==='sem_interesse'?'perdida' as const:'prospeccao' as const,
      lat:gps?.lat??null,lng:gps?.lng??null,eventos:[],
      href:'/prospeccao/'+encodeURIComponent(pros.id),endereco:pros.endereco||'',origem:'prospeccao' as const,
    }
    if(!linked)registros.push(r)
    if(linked){
      // O ponto verificado da obra prevalece sobre GPS de prospecção.
      if(linked.lat==null&&gps){linked.lat=gps.lat;linked.lng=gps.lng}
      if(!linked.bairro&&pros.bairro)linked.bairro=pros.bairro
      if(!linked.cidade&&pros.cidade)linked.cidade=pros.cidade
      if(!linked.cliente&&pros.nome_cliente)linked.cliente=pros.nome_cliente
      if(!linked.vendedor&&pros.responsavel_nome)linked.vendedor=pros.responsavel_nome
    }
    porProspeccao.set(pros.id,r)
    adicionarEvento(r,'prospeccao',pros.created_at)
    if(pros.status==='sem_interesse'&&r.etapa==='prospeccao')r.etapa='perdida'
  }

  for(const inter of interacoes){
    if(inter.tipo!=='visita')continue
    const registro=porProspeccao.get(inter.prospeccao_id)
    if(registro)adicionarEvento(registro,'visita',inter.created_at)
  }

  const orcamentosPorObra=new Map<string,OrcamentoDB[]>()
  for(const orc of orcamentos){
    const linked=orc.obra_id?porObra.get(orc.obra_id):undefined
    const r=linked||{
      id:'orcamento:'+orc.id,nome:'Orçamento '+(orc.numero||orc.id.slice(0,8)),
      cliente:orc.cliente_nome||'',cidade:orc.cidade||'',bairro:'',vendedor:orc.criado_por_nome||'',
      etapa:'orcamento' as const,lat:null,lng:null,eventos:[],
      href:'/kanban/comercial?orcamento='+encodeURIComponent(orc.id),origem:'orcamento' as const,
    }
    if(!linked)registros.push(r)
    if(linked){
      if(!linked.vendedor&&orc.criado_por_nome)linked.vendedor=orc.criado_por_nome
      if(!linked.cliente&&orc.cliente_nome)linked.cliente=orc.cliente_nome
      const grupo=orcamentosPorObra.get(orc.obra_id!)||[]
      grupo.push(orc);orcamentosPorObra.set(orc.obra_id!,grupo)
    }else{
      if(orc.status==='recusado')r.etapa='perdida'
      if(orc.status==='convertido'||orc.data_venda)r.etapa='venda'
    }
    adicionarEvento(r,'orcamento',orc.created_at)
    // data_venda é a data confirmada, não a data de atualização do registro.
    if(orc.data_venda)adicionarEvento(r,'venda',orc.data_venda)
  }

  for(const [obraId, grupo] of orcamentosPorObra){
    const r=porObra.get(obraId)
    if(!r)continue
    const obra=obraOrigem.get(obraId)
    const statusObra=obra?.status||''
    if(statusObra==='concluida'){r.etapa='concluida';continue}
    if(['producao','instalacao'].includes(statusObra)){r.etapa='producao';continue}
    if(grupo.some(orc=>orc.status==='convertido'||!!orc.data_venda)){r.etapa='venda';continue}
    if(grupo.every(orc=>orc.status==='recusado')){r.etapa='perdida';continue}
    r.etapa='orcamento'
  }
  return {registros:registros.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),avisos}
}
