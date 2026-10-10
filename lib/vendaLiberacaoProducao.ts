// Avaliação conservadora, somente leitura. O motor não modifica o banco.
type Medicao={id:string;status_operacional?:string|null}
type Ordem={id:string;tipo_producao?:string|null;origem?:string|null;bloqueada?:boolean|null;status?:string|null}
type Material={id:string;quantidade_ajustada?:number|null;quantidade_tecnica?:number|null;status_compra?:string|null}
type Separacao={material_id?:string|null;quantidade?:number|null;status?:string|null}
type CompraPacote={id:string;quantidade_ajustada?:number|null;status?:string|null}
type Necessidade={status?:string|null;recebido_em?:string|null;observacoes?:string|null}
type Dados={
  medicoes:Medicao[];medicoesComCardLiberado:string[];
  ordens:Ordem[];pacoteStatus?:string|null;pacoteOrigem?:string|null;
  materiais:Material[];separacoes:Separacao[];
  comprasPacote:CompraPacote[];necessidades:Necessidade[]
}
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0}
const normal=(v:unknown)=>String(v||'').trim().toLowerCase()
const recebido=(n:Necessidade)=>normal(n.status)==='recebido'||(Boolean(n.recebido_em)&&!['cancelado','necessidade','cotacao'].includes(normal(n.status)))
const candidato=(o:Ordem)=>o.tipo_producao==='esquadria'&&o.origem==='reconstrucao_wvetro'
  &&o.bloqueada===true&&o.status==='aguardando'

export function avaliarLiberacaoProducao(d:Dados){
  const pendencias:string[]=[]
  const add=(v:string)=>{if(!pendencias.includes(v))pendencias.push(v)}
  if(!d.medicoes.length)add('Não há Medição Final de tipologia vinculada ao orçamento.')
  const pendentesMedicao=d.medicoes.filter(m=>m.status_operacional!=='aprovado')
  if(pendentesMedicao.length)add('Existem '+pendentesMedicao.length+' Medição(ões) Finais sem aprovação.')
  if(d.medicoes.length&&d.medicoes.some(m=>m.status_operacional==='aprovado'&&!d.medicoesComCardLiberado.includes(m.id)))
    add('Existe Medição Final aprovada que ainda não foi liberada no Kanban de Produção.')
  if(d.pacoteStatus!=='calculado'||d.pacoteOrigem!=='medicao_final')add('O Plano de Corte final precisa estar calculado a partir da Medição Final aprovada.')
  if(!d.materiais.some(m=>num(m.quantidade_ajustada??m.quantidade_tecnica)>0))add('O pacote técnico ainda não possui materiais com quantidade válida.')

  const separados=new Map<string,number>()
  for(const s of d.separacoes){
    if(!s.material_id||!['separado','consumido'].includes(normal(s.status)))continue
    separados.set(s.material_id,(separados.get(s.material_id)||0)+Math.max(0,num(s.quantidade)))
  }
  let materiaisPendentes=0
  for(const m of d.materiais){
    const qtd=num(m.quantidade_ajustada??m.quantidade_tecnica)
    if(qtd<=0)continue
    const quantidadeSeparada=separados.get(m.id)||0
    if(normal(m.status_compra)!=='recebido'&&quantidadeSeparada+0.0001<qtd)materiaisPendentes++
  }
  if(materiaisPendentes)add(materiaisPendentes+' material(is) sem recebimento ou separação suficiente.')

  const mapaNecessidades=new Map<string,Necessidade[]>()
  for(const n of d.necessidades){
    const marcador=String(n.observacoes||'').match(/\[pacote_compra:([0-9a-f-]{36})\]/i)?.[1]
    if(!marcador)continue
    const chave=marcador.toLowerCase()
    const grupo=mapaNecessidades.get(chave)||[]
    grupo.push(n);mapaNecessidades.set(chave,grupo)
  }
  let comprasPendentes=0
  for(const c of d.comprasPacote){
    if(num(c.quantidade_ajustada)<=0||normal(c.status)==='cancelado')continue
    const grupo=mapaNecessidades.get(c.id.toLowerCase())||[]
    if(!grupo.length||grupo.some(n=>!recebido(n)))comprasPendentes++
  }
  if(comprasPendentes)add(comprasPendentes+' compra(s) do pacote técnico ainda sem recebimento confirmado.')

  const ordensRelevantes=d.ordens.filter(o=>o.tipo_producao==='esquadria'&&o.origem==='reconstrucao_wvetro'&&o.status!=='cancelada')
  const ordensElegiveis=ordensRelevantes.filter(candidato).map(o=>o.id)
  if(!ordensRelevantes.length)add('Não há ordens de esquadria preparadas pela reconstrução da venda.')
  if(ordensRelevantes.some(o=>o.bloqueada&&o.status!=='aguardando'))
    add('Há ordem bloqueada em situação diferente de aguardando; revisar manualmente.')
  const prontidao=pendencias.length===0
  return {
    prontidao,pendencias,ordensElegiveis:prontidao?ordensElegiveis:[],
    podeLiberar:prontidao&&ordensElegiveis.length>0,
    jaLiberadas:ordensRelevantes.filter(o=>o.bloqueada===false).length,
    totais:{medicoes:d.medicoes.length,materiais:d.materiais.length,materiaisPendentes,
      comprasPendentes,ordens:ordensRelevantes.length,ordensBloqueadas:ordensRelevantes.filter(o=>o.bloqueada).length}
  }
}
