/**
 * Agrupamento de negociações no CRM, sem alterar orçamentos nem o Kanban.
 * Sugestões conservadoras: decisões incertas permanecem separadas para revisão.
 * Não somar valores das versões de uma mesma oportunidade.
 */
export interface OrcamentoOportunidade {
  id: string
  numero?: number | null
  cliente_id?: string | null
  cliente_nome?: string | null
  obra_id?: string | null
  cidade?: string | null
  origem?: string | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
  status?: string | null
  valor_estimado?: number | null
  temperatura?: string | null
  itens?: unknown
  tipo_esquadria?: string | null
  descricao_livre?: string | null
  revisao_grupo_id?: string | null
  revisao_origem_id?: string | null
}
export type VinculoConfirmado = {orcamento_id: string; ancora_orcamento_id: string}
export type Avaliacao = 'revisao_confirmada'|'escopo_equivalente'|'escopo_ampliado'|'oportunidade_distinta'|'revisar_escopo'|'obra_nao_identificada'|'vinculo_manual'|'nova_manual'
export type GrupoOportunidade = {
  id: string
  clienteId: string|null
  obraId: string|null
  cliente: string
  orcamentos: OrcamentoOportunidade[]
  tipo: Avaliacao
  pendenteRevisao: boolean
  tipologias: string[]
  valorReferencia: number|null
  status: 'ganho'|'perdido'|'enviado'|'rascunho'
  origem: string|null
  responsavel: string|null
}
export type AnaliseOportunidades = {grupos:GrupoOportunidade[]; sugestoes:{orcamentoId:string;ancoraId:string;motivo:string}[]}

export function normalizar(texto:unknown):string {
  return String(texto??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}
function nomeTipo(item:Record<string,unknown>):string {
  const s = normalizar(item.tipo_esquadria || item.tipologia_id || item.produto_nome || item.descricao || item.tipo_outro_texto || '')
  if (/portao|ripado/.test(s)) return 'portao ripado'
  if (/janela|vitro/.test(s)) return 'janela'
  if (/porta/.test(s)) return 'porta'
  if (/maxi ar|maxim ar/.test(s)) return 'maxi ar'
  if (/guarda corpo/.test(s)) return 'guarda corpo'
  return s
}
function produtoChave(item:Record<string,unknown>):string {
  const tipo=nomeTipo(item)
  if(!tipo)return ''
  return tipo+'|'+normalizar(item.ambiente || '')
}
function produtos(o:OrcamentoOportunidade):Map<string,number> {
  const mapa=new Map<string,number>()
  const itens=Array.isArray(o.itens)?o.itens:[]
  for(const raw of itens){
    if(!raw || typeof raw!=='object')continue
    const i=raw as Record<string,unknown>
    if(i.item_tipo && !['esquadria','tipologia'].includes(normalizar(i.item_tipo)))continue
    const chave=produtoChave(i)
    if(!chave)continue
    const qtd=Math.max(1,Math.min(1000,Number(i.quantidade)||1))
    mapa.set(chave,(mapa.get(chave)||0)+qtd)
  }
  if(!mapa.size){
    const tipo=nomeTipo({tipo_esquadria:o.tipo_esquadria||'',descricao:o.descricao_livre||''})
    if(tipo)mapa.set(tipo+'|',1)
  }
  return mapa
}
export function tipologias(o:OrcamentoOportunidade):string[] {
  return [...new Set([...produtos(o).keys()].map(c=>c.split('|')[0]))]
}
function avaliacaoEscopo(a:OrcamentoOportunidade,b:OrcamentoOportunidade):{tipo:Avaliacao;sim:number} {
  const x=produtos(a),y=produtos(b)
  if(!x.size||!y.size)return {tipo:'revisar_escopo',sim:0}
  const xa=[...x.keys()],yb=[...y.keys()]
  const xs=new Set(xa.map(k=>k.split('|')[0])),ys=new Set(yb.map(k=>k.split('|')[0]))
  if(![...xs].some(t=>ys.has(t)))return {tipo:'oportunidade_distinta',sim:0}
  // Ignorar cor, linha e contramarco; as quantidades e ambientes caracterizam o escopo.
  const keys=new Set([...x.keys(),...y.keys()])
  let comum=0,total=0
  for(const k of keys){
    const c=Math.min(x.get(k)||0,y.get(k)||0),m=Math.max(x.get(k)||0,y.get(k)||0)
    comum+=c;total+=m
  }
  const sim=comum/Math.max(1,total)
  // Sem ambiente discriminado, uma única tipologia é sinal fraco: revisão humana.
  const discriminado=[...keys].some(k=>k.split('|')[1])
  const unicos=(o:OrcamentoOportunidade)=>{
    const i=Array.isArray(o.itens)&&o.itens.length===1?o.itens[0] as Record<string,unknown>:null
    return i&&Number(i.largura_mm)>0&&Number(i.altura_mm)>0
      ? {largura:Number(i.largura_mm),altura:Number(i.altura_mm),qtd:Number(i.quantidade)||1}:null
  }
  const um=unicos(a),dois=unicos(b)
  const mesmasMedidas=Boolean(um&&dois&&um.qtd===dois.qtd
    &&Math.abs(um.largura-dois.largura)<=50&&Math.abs(um.altura-dois.altura)<=50)
  if(sim>=0.9 && (discriminado || (xa.length>=2&&yb.length>=2) || mesmasMedidas))return {tipo:'escopo_equivalente',sim}
  if(sim>=0.75 && discriminado)return {tipo:'escopo_ampliado',sim}
  return {tipo:'revisar_escopo',sim}
}
function statusGrupo(os:OrcamentoOportunidade[]):GrupoOportunidade['status'] {
  const ss=os.map(o=>normalizar(o.status))
  if(ss.some(s=>s==='vendido'))return 'ganho'
  if(ss.some(s=>['enviado','aprovado','convertido'].includes(s)))return 'enviado'
  if(ss.every(s=>s==='recusado'))return 'perdido'
  return 'rascunho'
}
function ordenar(a:OrcamentoOportunidade,b:OrcamentoOportunidade){
  return a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)
}
function mesmaObra(a:OrcamentoOportunidade,b:OrcamentoOportunidade):boolean {
  return Boolean(a.cliente_id&&b.cliente_id&&a.cliente_id===b.cliente_id&&a.obra_id&&b.obra_id&&a.obra_id===b.obra_id)
}
export function agruparOportunidades(orcamentos:OrcamentoOportunidade[],confirmados:VinculoConfirmado[]=[]):AnaliseOportunidades {
  const lista=[...orcamentos].sort(ordenar)
  const porId=new Map(lista.map(o=>[o.id,o]))
  const vinculos=new Map(confirmados.map(v=>[v.orcamento_id,v.ancora_orcamento_id]))
  const raiz=new Map<string,string>()
  const classificacao=new Map<string,Avaliacao>()
  const sugestoes:AnaliseOportunidades['sugestoes']=[]
  for(const o of lista){
    const escolhido=vinculos.get(o.id)
    // Um vínculo manual prevalece, mas não permite misturar clientes/obras distintos.
    if(escolhido&&porId.has(escolhido)){
      const base=porId.get(escolhido)!
      if(escolhido===o.id || mesmaObra(o,base)){
        raiz.set(o.id,escolhido===o.id?o.id:(raiz.get(base.id)||base.id))
        classificacao.set(o.id,escolhido===o.id?'nova_manual':'vinculo_manual')
        continue
      }
    }
    if(o.revisao_grupo_id){
      const par=lista.find(x=>x.id!==o.id&&x.revisao_grupo_id===o.revisao_grupo_id&&raiz.has(x.id)
        &&(mesmaObra(o,x)||Boolean(o.cliente_id&&o.cliente_id===x.cliente_id&&!o.obra_id&&!x.obra_id)))
      if(par){raiz.set(o.id,raiz.get(par.id)!);classificacao.set(o.id,'revisao_confirmada');continue}
    }
    if(!o.cliente_id||!o.obra_id){
      raiz.set(o.id,o.id);classificacao.set(o.id,'obra_nao_identificada')
      continue
    }
    const bases=lista.filter(p=>raiz.has(p.id)&&raiz.get(p.id)===p.id&&mesmaObra(o,p))
    const candidatos=bases.map(p=>({p,...avaliacaoEscopo(o,p)}))
    const fortes=candidatos.filter(c=>c.tipo==='escopo_equivalente'||c.tipo==='escopo_ampliado')
    if(fortes.length===1) {
      raiz.set(o.id,fortes[0].p.id);classificacao.set(o.id,fortes[0].tipo);continue
    }
    raiz.set(o.id,o.id)
    const revisar=fortes.length>1 || candidatos.some(c=>c.tipo==='revisar_escopo')
    classificacao.set(o.id,revisar?'revisar_escopo':'oportunidade_distinta')
    if(revisar){
      const melhor=[...candidatos].sort((a,b)=>b.sim-a.sim)[0]
      if(melhor)sugestoes.push({orcamentoId:o.id,ancoraId:melhor.p.id,motivo:fortes.length>1?'Mais de uma oportunidade semelhante':'Escopo parcialmente semelhante; confirmar se é revisão ou negócio independente'})
    }
  }
  const buckets=new Map<string,OrcamentoOportunidade[]>()
  for(const o of lista){const k=raiz.get(o.id)||o.id;buckets.set(k,[...(buckets.get(k)||[]),o])}
  const grupos=[...buckets.entries()].map(([id,os])=>{
    const ordenados=[...os].sort(ordenar),principal=ordenados[0],ultimo=ordenados[ordenados.length-1]
    const aprovado=[...ordenados].reverse().find(o=>normalizar(o.status)==='vendido')
    const referente=aprovado||ultimo
    return {
      id,clienteId:principal.cliente_id||null,obraId:principal.obra_id||null,
      cliente:principal.cliente_nome||'Cliente não identificado',orcamentos:ordenados,
      tipo:classificacao.get(id)||'oportunidade_distinta',
      pendenteRevisao:ordenados.some(o=>['revisar_escopo','obra_nao_identificada'].includes(classificacao.get(o.id)||'')),
      tipologias:[...new Set(ordenados.flatMap(tipologias))],
      valorReferencia:referente.valor_estimado==null?null:Number(referente.valor_estimado),
      status:statusGrupo(ordenados),origem:principal.origem||null,responsavel:principal.criado_por_nome||null,
    } as GrupoOportunidade
  })
  return {grupos:grupos.sort((a,b)=>b.orcamentos[b.orcamentos.length-1].created_at.localeCompare(a.orcamentos[a.orcamentos.length-1].created_at)),sugestoes}
}