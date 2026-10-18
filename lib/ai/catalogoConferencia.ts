// Consulta de tabela para candidatos antigos: nunca grava ou altera decisoes humanas.
const codigoLimpo=(v:unknown)=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
const vazio=(v:unknown)=>v===null||v===undefined||v===''
const numero=(v:unknown)=>typeof v==='number'?v:Number(String(v||'').replace(',','.'))
export function conferirDadosCatalogo(candidato:{status?:string;dados?:Record<string,any>},extraido:Record<string,any>){
  const antigo=candidato.dados||{}
  if(candidato.status!=='pendente'||antigo.revisado_manualmente||antigo.arquivado_em||
     !extraido||codigoLimpo(antigo.codigo)!==codigoLimpo(extraido.codigo)||
     !codigoLimpo(antigo.codigo))return null
  if(extraido.conflito_peso_catalogo?.length>1)return null
  const dados={...antigo},divergencias:string[]=[]
  if(!antigo.descricao||/^(peso|perfil\s+[a-z0-9_-]+)$/i.test(String(antigo.descricao).trim()))
    dados.descricao=extraido.descricao
  else if(String(antigo.descricao).trim().toUpperCase()!==String(extraido.descricao).trim().toUpperCase())
    divergencias.push('descricao')
  if(!antigo.categoria||antigo.categoria==='outro')dados.categoria=extraido.categoria
  if(vazio(antigo.unidade))dados.unidade=extraido.unidade
  if(vazio(antigo.peso_kg_m)||!(numero(antigo.peso_kg_m)>0))dados.peso_kg_m=extraido.peso_kg_m
  else if(Math.abs(numero(antigo.peso_kg_m)-numero(extraido.peso_kg_m))>0.0005)divergencias.push('peso_kg_m')
  if(vazio(antigo.linha)&&extraido.linha)dados.linha=extraido.linha
  if(vazio(antigo.pagina_catalogo))dados.pagina_catalogo=extraido.pagina_catalogo
  for(const campo of ['medidas_mm','medidas_polegadas']){
    const atuais={...(antigo[campo]||{})}
    for(const [chave,valor] of Object.entries(extraido[campo]||{})){
      if(vazio(atuais[chave]))atuais[chave]=valor
      else if(String(atuais[chave]).replace(',','.')!==String(valor).replace(',','.'))divergencias.push(campo+'.'+chave)
    }
    dados[campo]=atuais
  }
  // Imagens confirmadas, observacoes e qualquer decisao humana continuam intocadas.
  dados.evidencia_tabela=antigo.evidencia_tabela||extraido.evidencia_tabela
  dados.familia=antigo.familia||extraido.familia
  dados.imagem_tipo=antigo.imagem_tipo||extraido.imagem_tipo
  dados.conferencia_tabela_visualizada=true
  return {dados,divergencias}
}
