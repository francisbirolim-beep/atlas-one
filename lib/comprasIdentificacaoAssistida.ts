/** Correspondência auditável: NÃO classifica fotos nem valida produtos automaticamente. */
export type CandidatoCompra={id:string;codigo:string|null;nome:string;categoria:string;foto_url:string|null}
export type AprendizadoCompra={produto_id:string;confirmacoes:number;correcoes:number}|null
export type ProdutoSugeridoCompra=CandidatoCompra&{pontuacao:number;origem:'historico_validado'|'correspondencia_texto';motivo:string}
const removerAcentos=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
export const normalizarDescricaoCompra=(s:string)=>removerAcentos(s.toLowerCase()).replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const irrelevantes=new Set(['para','com','sem','uma','uns','das','dos','de','do','da','em','por','tipo','modelo','preciso','comprar','peca','peças','peça','quantidade','linha','aluminio'])
export function sugerirProdutosCompra(descricao:string,categoria:string,produtos:CandidatoCompra[],aprendido:AprendizadoCompra,limite=6):ProdutoSugeridoCompra[]{
 const termo=normalizarDescricaoCompra(descricao)
 const tokens=[...new Set(termo.split(' ').filter(t=>t.length>=2&&!irrelevantes.has(t)))].slice(0,22)
 const candidatos:ProdutoSugeridoCompra[]=[]
 for(const p of produtos){
  const nome=normalizarDescricaoCompra(p.nome||'')
  const codigo=normalizarDescricaoCompra(p.codigo||'')
  const campo=' '+nome+' '+codigo+' '
  const matches=tokens.filter(t=>campo.includes(' '+t+' ')||(t.length>=4&&nome.includes(t)))
  const historico=aprendido?.produto_id===p.id
  const literal=!!codigo&&tokens.includes(codigo)
  const categoriaIgual=normalizarDescricaoCompra(p.categoria)===normalizarDescricaoCompra(categoria)
  const proporcao=tokens.length?matches.length/tokens.length:0
  const pontuacao=(historico?160:0)+(literal?75:0)+(nome===termo?100:0)+matches.length*12+Math.round(proporcao*32)+(categoriaIgual?7:0)
  if(!historico&&!literal&&(!matches.length||proporcao<0.2))continue
  const motivo=historico?`Produto confirmado anteriormente pelo comprador (${aprendido?.confirmacoes||1} confirmação/ões)`:
   literal?'Código identificado na descrição':nome===termo?'Descrição idêntica ao cadastro':`${matches.length} palavra(s) relacionada(s)`
  candidatos.push({...p,pontuacao,origem:historico?'historico_validado':'correspondencia_texto',motivo})
 }
 return candidatos.sort((a,b)=>b.pontuacao-a.pontuacao||Number(!!b.foto_url)-Number(!!a.foto_url)||a.nome.localeCompare(b.nome,'pt-BR')).slice(0,Math.max(1,Math.min(10,limite)))
}
