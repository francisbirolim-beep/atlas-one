// Cada desenho/descrição/código/peso do catálogo em colunas recebe a
// própria referência. A leitura linear de texto PDF junta colunas vizinhas
// e não pode ser usada para atribuir pesos a códigos nessas páginas.
type Token={str:string;x:number;y:number;w:number}
type Pagina={pagina:number;texto:string;items?:any[]}
const codigoValido=(s:string)=>{
  const x=s.trim().toUpperCase().replace(/\s+/g,'')
  if(x.length>18||/^(LINHA|PERFIL)/.test(x))return ''
  return /^(?:[A-Z]{1,5}[-_/]?\d{2,8}[A-Z]{0,3}|[A-Z]{1,3}\d{1,3}[-_/]\d{2,6}[A-Z]{0,3})$/.test(x)?x:''
}
const pesoValido=(s:string)=>{
  const m=s.trim().match(/^(\d+(?:[.,]\d{1,4})?)\s*KG\s*\/?\s*M$/i)
  if(!m)return null
  const n=Number(m[1].replace(',','.'))
  return n>0&&n<50?n:null
}
function tokensPagina(items:any[]):Token[]{
  return (items||[]).filter(x=>x?.transform&&String(x.str||'').trim())
    .map(x=>({str:String(x.str).trim(),x:Number(x.transform[4]),
      y:Number(x.transform[5]),w:Number(x.width||0)}))
}
const ehDescricao=(s:string)=>s.length>=3&&s.length<=140&&/[A-Za-zÀ-ÿ]/.test(s)
  && !codigoValido(s)&&pesoValido(s)==null
  && !/^\s*(FORTAL|GOLD|LINHA\s+\d+|A\s*L\s*U\s*M|\d+)\s*$/i.test(s)

export function extrairCartoesGeometricos(paginas:Pagina[]){
  const todos:any[]=[]
  for(const pg of paginas){
    if(!pg.items?.length)continue
    const ts=tokensPagina(pg.items)
    const codigos=ts.filter(t=>codigoValido(t.str))
    const pesos=ts.filter(t=>pesoValido(t.str)!=null)
    // A geometria de um cartão tem código e peso na MESMA COLUNA,
    // mas em LINHAS sucessivas, nunca numa tabela em linha horizontal.
    for(const item of codigos){
      const associados=pesos.filter(t=>Math.abs(t.x-item.x)<=18
        &&item.y-t.y>=4&&item.y-t.y<=25).sort((a,b)=>item.y-a.y-(item.y-b.y))
      const pesoToken=associados[0]
      if(!pesoToken)continue
      const peso=pesoValido(pesoToken.str)
      if(peso==null)continue
      const proximos=ts.filter(t=>ehDescricao(t.str)&&Math.abs(t.x-item.x)<=24
        &&t.y>item.y+3&&t.y<item.y+36)
        .sort((a,b)=>b.y-a.y)
      // Os nomes podem ocupar duas linhas acima do código.
      const descricao=proximos.map(x=>x.str).join(' ').trim().replace(/\s+/g,' ')
      if(!descricao)continue
      const paginaLinha=ts.filter(t=>/^LINHA\s+\d+/i.test(t.str))
        .sort((a,b)=>Math.abs(a.x-item.x)-Math.abs(b.x-item.x))[0]
      const codigo=codigoValido(item.str)
      todos.push({tipo:'produto',modulo:'engenharia',
        codigo,descricao,titulo:codigo+' — '+descricao,
        categoria:'perfil',unidade:'KG',peso_kg_m:peso,preco:null,
        tamanho_barra_mm:null,linha:paginaLinha?.str||null,
        pagina_catalogo:pg.pagina,medidas_mm:{},medidas_polegadas:{},
        imagem_tipo:'individual',origem_extracao:'cartao_pdf_geometrico',
        evidencia_tabela:item.str+' '+pesoToken.str+' | '+descricao,
        confianca:.96})
    }
  }
  const resultado=new Map<string,any>()
  for(const x of todos){
    const anterior=resultado.get(x.codigo)
    if(!anterior){resultado.set(x.codigo,{...x,paginas_referencia:[x.pagina_catalogo]});continue}
    if(!anterior.paginas_referencia.includes(x.pagina_catalogo))anterior.paginas_referencia.push(x.pagina_catalogo)
    if(Math.abs(anterior.peso_kg_m-x.peso_kg_m)>0.0005){
      anterior.conflito_peso_catalogo=[...new Set([...(anterior.conflito_peso_catalogo||[anterior.peso_kg_m]),x.peso_kg_m])]
      anterior.confianca=.4
    }
  }
  return [...resultado.values()]
}
export function codigoColadoDeOutrasColunas(valor:unknown){
  const x=String(valor||'').toUpperCase().replace(/\s+/g,'')
  return /(?:[A-Z]{1,5}\d{0,3}[-_/]\d{2,8}){2,}/.test(x)
}
