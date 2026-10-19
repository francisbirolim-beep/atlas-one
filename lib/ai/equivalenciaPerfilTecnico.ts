// Comparação conservadora. Código diferente pode pertencer ao mesmo desenho,
// mas nem código nem peso isoladamente autorizam mesclar um perfil.
export type PerfilComparavel = {
  codigo?:string|null; categoria?:string|null; medidas_mm?:Record<string,unknown>|null;
  peso_kg_m?:number|null; descricao?:string|null; aplicacao?:string|null
}
export function codigoPerfil(v:unknown){
  return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
}
export function medidasPerfil(v:Record<string,unknown>|null|undefined){
  const m:Record<string,number>={}
  for(const [k,valor] of Object.entries(v||{})){
    const n=Number(String(valor??'').replace(',','.'))
    if(Number.isFinite(n)&&n>0&&n<10000)m[k.toUpperCase()]=n
  }
  return m
}
export function compararGeometria(a:PerfilComparavel,b:PerfilComparavel){
  const aa=medidasPerfil(a.medidas_mm), bb=medidasPerfil(b.medidas_mm)
  const chaves=Object.keys(aa).filter(k=>bb[k]!=null)
  const diferencas=chaves.map(k=>({campo:k,origem:aa[k],destino:bb[k],
    diferenca_mm:Math.round(Math.abs(aa[k]-bb[k])*1000)/1000,
    compativel:Math.abs(aa[k]-bb[k])<=Math.max(0.15,Math.min(aa[k],bb[k])*0.01)}))
  const conflitoCategoria=Boolean(a.categoria&&b.categoria&&a.categoria!==b.categoria)
  const divergentes=diferencas.filter(d=>!d.compativel)
  return {conflitoCategoria,medidasComuns:diferencas.length,diferencas,divergentes,
    medidasCompativeis:diferencas.length>=2&&divergentes.length===0&&!conflitoCategoria}
}
export function classificarFuncaoDeclarada(descricao:unknown,aplicacao:unknown){
  const s=(String(descricao||'')+' '+String(aplicacao||'')).normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toUpperCase()
  // É classificação por texto explícito, NÃO inferência visual.
  for(const [nome,padrao] of [
    ['Trilho',/\bTRILHO\b/],['Montante',/\bMONTANTE\b/],
    ['Travessa',/\bTRAVESSA\b/],['Baguete',/\bBAGUETE\b/],
    ['Marco',/\bMARCO\b/],['Contramarco',/\bCONTRAMARCO\b/],
    ['Cantoneira',/\bCANTONEIRA\b/],['Tubo',/\bTUBO\b/],
    ['Barra chata',/\bBARRA CHATA\b/],
  ] as Array<[string,RegExp]>){if(padrao.test(s))return nome}
  return 'Função ainda não identificada'
}
