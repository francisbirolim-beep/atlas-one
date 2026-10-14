// Lista comercial W.Vetro ≠ plano de corte. Somente leitura.
// Perfis: payload.Barras (barras comerciais), nunca Itens[].Perfil (peças).
// Acessórios: agregados de Itens[].Acessorios por código + acabamento.
// Vidros: agrupados por especificação + L/A + fixação, sem apagar medidas.
export type CategoriaCompraWVetro='perfil'|'acessorio'|'vidro'
export type MaterialCompraWVetro={
 chave:string;categoria:CategoriaCompraWVetro;codigo:string;descricao:string;
 cor:string;quantidade:number;unidade:string;
 medida:string|null;pesoKg:number|null;imagemUrl:string|null;imagemPendente:boolean;
 origem:string
}
type Obj=Record<string,unknown>
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{}
const arr=(v:unknown)=>Array.isArray(v)?v:[]
const txt=(v:unknown)=>String(v??'').trim()
function num(v:unknown):number{
 if(typeof v==='number')return Number.isFinite(v)?v:0
 const t=txt(v);if(!t)return 0
 let c=t.replace(/[^0-9,.-]/g,'')
 if(c.includes(',')&&c.includes('.'))c=c.lastIndexOf(',')>c.lastIndexOf('.')?c.replace(/\./g,'').replace(',','.'):c.replace(/,/g,'')
 else c=c.replace(',','.')
 const n=Number(c);return Number.isFinite(n)?n:0
}
function key(s:unknown){return txt(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()}
const moneyQty=(n:number)=>Math.round(n*10000)/10000
export type ResumoCompraWVetro={
 numero:string;fonte:'barras_comerciais_e_composicao_de_itens';
 itens:MaterialCompraWVetro[];
 totais:{perfis:number; barras:number;acessorios:number;unidadesAcessorios:number;vidros:number;pecasVidro:number};
 alertas:string[]
}
export function montarListaCompraWVetro(payload:unknown,produtos:unknown[]=[]):ResumoCompraWVetro|null{
 const p=obj(payload)
 const numero=txt(p.Nro)
 const barras=arr(p.Barras)
 const tipologias=arr(p.Itens)
 if(!numero||!barras.length)return null
 const imagens=new Map<string,string>()
 for(const row of produtos){
  const r=obj(row),cod=key(r.codigo),url=txt(r.foto_url)
  // Só imagens reais relacionadas ao código cadastrado.
  if(cod&&/^https:\/\//i.test(url))imagens.set(cod,url)
 }
 const map=new Map<string,MaterialCompraWVetro>()
 function inserir(item:Omit<MaterialCompraWVetro,'chave'|'imagemUrl'|'imagemPendente'>){
  const chave=[item.categoria,key(item.codigo),key(item.cor),key(item.medida)].join('|')
  const atual=map.get(chave)
  if(atual){
   atual.quantidade=moneyQty(atual.quantidade+item.quantidade)
   if(atual.pesoKg!==null&&item.pesoKg!==null)atual.pesoKg=moneyQty(atual.pesoKg+item.pesoKg)
   return
  }
  const imagemUrl=imagens.get(key(item.codigo))||null
  map.set(chave,{...item,chave,imagemUrl,imagemPendente:item.categoria!=='vidro'&&!imagemUrl})
 }
 for(const barraRaw of barras){
  const barra=obj(barraRaw)
  const codigo=txt(barra.PerfilCodigo||barra.PerfilSeuCodigo)
  const quantidade=num(barra.OrcamentoBarraQtde)
  if(!codigo||quantidade<=0)continue
  inserir({categoria:'perfil',codigo,descricao:txt(barra.PerfilNome)||codigo,
   cor:txt(barra.PerfilCorNome),quantidade,unidade:'BR',
   medida:null,pesoKg:num(barra.OrcamentoBarraPeso)||null,
   origem:'Barras / OrcamentoBarraQtde'})
 }
 for(const itemRaw of tipologias){
  const i=obj(itemRaw)
  for(const aRaw of arr(i.Acessorios).length?arr(i.Acessorios):arr(i.Acessórios)){
   const a=obj(aRaw)
   const codigo=txt(a.Codigo||a.SeuCodigo)
   const quantidade=num(a.Qtde||a.Quantidade)
   if(!codigo||quantidade<=0)continue
   inserir({categoria:'acessorio',codigo,descricao:txt(a.Nome)||codigo,cor:txt(a.Cor),
    quantidade,unidade:'UN',medida:null,pesoKg:null,
    origem:'Itens / Acessorios (agrupado por código e acabamento)'})
  }
  for(const vRaw of arr(i.Vidros)){
   const v=obj(vRaw)
   const codigo=txt(v.Codigo)||'VIDRO'
   const quantidade=num(v.Qtde||v.Quantidade)
   if(quantidade<=0)continue
   const descricao=txt(v.Especificacao||v.Nome)||'Vidro'
   const medida=[txt(v.Largura),txt(v.Altura)].every(Boolean)
    ?txt(v.Largura)+' × '+txt(v.Altura)+' mm'+(v.TipoFixacao?' · '+txt(v.TipoFixacao):''):null
   // Não somar vidros com medidas diferentes, mesmo com código repetido.
   inserir({categoria:'vidro',codigo,descricao,cor:descricao,quantidade,unidade:'PC',
    medida,pesoKg:null,origem:'Itens / Vidros (medidas preservadas)'})
  }
 }
 const itens=Array.from(map.values()).sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.codigo.localeCompare(b.codigo)||a.cor.localeCompare(b.cor))
 const perfis=itens.filter(x=>x.categoria==='perfil')
 const acessorios=itens.filter(x=>x.categoria==='acessorio')
 const vidros=itens.filter(x=>x.categoria==='vidro')
 const alertas:string[]=[]
 if(itens.some(x=>x.imagemPendente))alertas.push('Alguns perfis ou acessórios estão sem imagem cadastrada. Não substituir por imagem de outro produto.')
 if(!acessorios.length)alertas.push('A API não retornou acessórios detalhados; não considerar a lista completa.')
 if(!vidros.length)alertas.push('A API não retornou vidros detalhados; não considerar a lista completa.')
 return {numero,fonte:'barras_comerciais_e_composicao_de_itens',itens,
  totais:{perfis:perfis.length,barras:moneyQty(perfis.reduce((s,x)=>s+x.quantidade,0)),acessorios:acessorios.length,
   unidadesAcessorios:moneyQty(acessorios.reduce((s,x)=>s+x.quantidade,0)),vidros:vidros.length,
   pecasVidro:moneyQty(vidros.reduce((s,x)=>s+x.quantidade,0))},alertas}
}
export function compararListaCompraWVetro(anterior:ResumoCompraWVetro,atual:ResumoCompraWVetro){
 if(anterior.numero!==atual.numero)throw Error('Não comparar orçamentos W.Vetro diferentes')
 const a=new Map(anterior.itens.map(x=>[x.chave,x])),b=new Map(atual.itens.map(x=>[x.chave,x]))
 const chaves=new Set([...a.keys(),...b.keys()])
 const mudancas=[...chaves].flatMap(chave=>{
  const origem=a.get(chave),novo=b.get(chave)
  if(origem?.quantidade===novo?.quantidade&&origem?.descricao===novo?.descricao)return []
  return [{
   chave,codigo:novo?.codigo||origem?.codigo||'',descricao:novo?.descricao||origem?.descricao||'',
   categoria:novo?.categoria||origem!.categoria,antes:origem?.quantidade??0,depois:novo?.quantidade??0,
   status:!origem?'incluido':!novo?'removido':'alterado',
  }]
 })
 return {mudancas,total:mudancas.length}
}
