// Conferência determinística entre lista técnica aprovada e proposta do fornecedor.
// A IA extrai candidatos; preços e correspondências só são aceitos após validação.
export type SolicitadoCotacao = {
  material_id: string
  codigo?: string | null
  descricao: string
  quantidade_cotar: number
  unidade: string
  comprimento_corte_mm?: number | null
}
export type ExtraidoCotacao = {
  material_id?: string | null
  codigo?: string | null
  descricao?: string | null
  quantidade?: number | null
  unidade?: string | null
  valor_unitario?: number | null
  comprimento_corte_mm?: number | null
  [key:string]: unknown
}
type Conferencia = {
  material_id: string
  codigo: string | null
  descricao: string
  quantidade_solicitada: number
  quantidade_proposta: number | null
  unidade: string
  preco_unitario: number | null
  subtotal: number | null
  situacao: 'conforme'|'codigo_divergente'|'quantidade_divergente'|'unidade_divergente'|'sem_preco'|'ausente'|'ambiguo'
  observacao: string
}
export const normalizarCodigo = (x:unknown)=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'')
const normalizarUnidade=(s:unknown)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,'').replace(/^(UNID|UNIDADE|PECA|PC)$/,'UN')
const numero=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null
const aprox=(a:number,b:number)=>Math.abs(a-b)<0.001

export function conferirProposta(itens: SolicitadoCotacao[], extraidos: ExtraidoCotacao[]) {
  const utilizados = new Set<number>()
  const linhas: Conferencia[] = itens.map(item=>{
    const codigo=normalizarCodigo(item.codigo)
    const candidatos=extraidos.map((x,i)=>({x,i})).filter(({x,i})=>{
      if(utilizados.has(i))return false
      const cod=normalizarCodigo(x.codigo)
      return (x.material_id && x.material_id===item.material_id)
        || (codigo && cod===codigo)
    })
    const comCodigo=candidatos.filter(({x})=>codigo && normalizarCodigo(x.codigo)===codigo)
    const corte=numero(item.comprimento_corte_mm)
    const cortesCompativeis=(comCodigo.length?comCodigo:candidatos).filter(({x})=>{
      const c=numero(x.comprimento_corte_mm)
      return corte===null || c===null || aprox(corte,c)
    })
    if(!cortesCompativeis.length){
      const divergente=candidatos.some(({x})=>x.material_id===item.material_id)
      return {material_id:item.material_id,codigo:item.codigo||null,descricao:item.descricao,
        quantidade_solicitada:Number(item.quantidade_cotar||0),quantidade_proposta:null,
        unidade:item.unidade,preco_unitario:null,subtotal:null,
        situacao:divergente?'codigo_divergente':'ausente',
        observacao:divergente?'O código informado pelo fornecedor não confere com a lista validada.':'Não localizado na proposta.'
      } as Conferencia
    }
    if(cortesCompativeis.length>1){
      return {material_id:item.material_id,codigo:item.codigo||null,descricao:item.descricao,
        quantidade_solicitada:Number(item.quantidade_cotar||0),quantidade_proposta:null,
        unidade:item.unidade,preco_unitario:null,subtotal:null,situacao:'ambiguo',
        observacao:'Mais de uma correspondência possível; conferir código e comprimento de corte.'
      } as Conferencia
    }
    const {x,i}=cortesCompativeis[0]
    utilizados.add(i)
    const q=numero(x.quantidade),preco=numero(x.valor_unitario)
    const status:Conferencia['situacao'] =
      codigo && normalizarCodigo(x.codigo)!==codigo ? 'codigo_divergente' :
      normalizarUnidade(x.unidade||item.unidade)!==normalizarUnidade(item.unidade) ? 'unidade_divergente' :
      q===null || !aprox(q,Number(item.quantidade_cotar||0)) ? 'quantidade_divergente' :
      preco===null ? 'sem_preco' : 'conforme'
    const labels:Record<Conferencia['situacao'],string>={
      conforme:'Código, quantidade e valor conferidos.',
      codigo_divergente:'Código divergente da lista solicitada.',
      unidade_divergente:'Unidade divergente da lista solicitada.',
      quantidade_divergente:'Quantidade diferente ou não identificada.',
      sem_preco:'Valor unitário ausente ou não comprovado.',
      ausente:'Item ausente.',ambiguo:'Correspondência ambígua.'
    }
    return {material_id:item.material_id,codigo:item.codigo||null,descricao:item.descricao,
      quantidade_solicitada:Number(item.quantidade_cotar||0),quantidade_proposta:q,
      unidade:item.unidade,preco_unitario:preco,subtotal:preco!==null&&q!==null?Number((preco*q).toFixed(2)):null,
      situacao:status,observacao:labels[status]}
  })
  const extras=extraidos.filter((_,i)=>!utilizados.has(i)).map(x=>({
    codigo:String(x.codigo||'').slice(0,80),
    descricao:String(x.descricao||'').slice(0,200),
    quantidade:numero(x.quantidade),
  }))
  const pendentes=linhas.filter(x=>x.situacao!=='conforme')
  const completo=linhas.length>0&&pendentes.length===0&&extras.length===0
  return {
    linhas,extras,
    resumo:{
      solicitados:linhas.length,
      conformes:linhas.length-pendentes.length,
      ausentes:linhas.filter(x=>x.situacao==='ausente').length,
      codigos_divergentes:linhas.filter(x=>x.situacao==='codigo_divergente'||x.situacao==='ambiguo').length,
      quantidades_divergentes:linhas.filter(x=>x.situacao==='quantidade_divergente'||x.situacao==='unidade_divergente').length,
      sem_preco:linhas.filter(x=>x.situacao==='sem_preco').length,
      extras:extras.length,
      completo,
      total_comparavel:completo?Number(linhas.reduce((t,x)=>t+(x.subtotal||0),0).toFixed(2)):null,
    },
  }
}
