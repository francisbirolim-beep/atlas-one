import {celulasTabela} from './catalogoTabelaGeometria'
// Regras comuns a fornecedores; somente dados explicitamente presentes na fonte.
export const VERSAO_REGRAS_CATALOGO = '2026-10-18.2'
const codigoRE = /\b([A-Z]{1,6}\s*[-_/]?\s*\d{2,8}[A-Z]{0,3})\b/gi
const limpar = (v:string) => v.replace(/\s+/g,' ').trim()
const numero = (v:string) => Number(v.replace(',','.'))
export function extrairLinhasCatalogo(paginas:Array<{pagina:number;texto:string;items?:any[]}>) {
  const itens:any[]=[]
  for(const pg of paginas){
    let familia='', linha:string|null=null, tabela=false, cabecalho=''
    for(const original of pg.texto.split(/\r?\n/)){
      const s=limpar(original)
      if(!s)continue
      const lm=original.split('\t')[0].trim().match(/^Linha\s+(.{1,60})$/i)
      if(lm){linha='Linha '+lm[1];familia='';tabela=false;continue}
      if(/^(Cantoneiras?(?: Abas (?:Desiguais|Iguais))?|Barra(?:s)? Chata(?:s)?|Tubo(?:s)? (?:Quadrado|Retangular|Redondo)s?)$/i.test(s)){
        familia=s;tabela=false;cabecalho='';continue
      }
      if(familia && /Perfil|Peso|Mil[ií]metros|Polegadas|^Kg$|^[ABCDe](?:\s+[ABCDe])*$/i.test(s) && !/\d/.test(s)){
        cabecalho+=' '+s
        tabela=/Peso/i.test(cabecalho)&&/Mil[ií]metros/i.test(cabecalho)
        continue
      }
      if(/^Abas (Desiguais|Iguais)$/i.test(s)&&/^Cantoneiras?/i.test(familia)){familia+=' '+s;continue}
      const matches=[...s.matchAll(codigoRE)].filter(m=>!/^LINHA\b|^PERFIL\b/i.test(m[0]))
      for(let k=0;k<matches.length;k++){
        const m=matches[k],codigo=m[1].replace(/\s+/g,'').toUpperCase()
        const trecho=s.slice((m.index||0)+m[0].length,matches[k+1]?.index??s.length).trim()
        let peso:number|null=null
        const pm=trecho.match(/^(\d+(?:[.,]\d+)?)\s*kg\s*\/?\s*m\b/i)
        const medidas_mm:Record<string,number>={},medidas_polegadas:Record<string,string>={}
        if(pm)peso=numero(pm[1])
        else if(tabela){
          const valores=trecho.split(/\s+/).filter(Boolean)
          const quantidade=/retangular|desiguais/i.test(familia)?3:2
          if(valores.length>=quantidade+1 && valores.slice(0,quantidade+1).every(v=>/^\d+(?:[.,]\d+)?$/.test(v))){
            peso=numero(valores[0])
            const chaves=/desiguais/i.test(familia)?['A','B','e']:['A','B','C']
            chaves.slice(0,quantidade).forEach((c,i)=>{medidas_mm[c]=numero(valores[i+1])})
            // Células vazias em polegadas não permitem adivinhar a coluna.
            const pol=valores.slice(quantidade+1)
            if(pol.length===quantidade)chaves.slice(0,quantidade).forEach((c,i)=>{medidas_polegadas[c]=pol[i]})
          }
        }
        const geometria=tabela&&pg.items?celulasTabela(pg.items,codigo):null
        if(geometria){peso=geometria.peso;Object.assign(medidas_mm,geometria.mm);Object.assign(medidas_polegadas,geometria.polegadas)}
        if(peso===null||peso<=0)continue
        itens.push({tipo:'produto',modulo:'engenharia',codigo,
          descricao:familia||('Perfil '+codigo),titulo:codigo+' — '+(familia||'Perfil'),
          categoria:'perfil',unidade:'KG',peso_kg_m:peso,preco:null,linha,
          pagina_catalogo:pg.pagina,medidas_mm,medidas_polegadas,
          evidencia_tabela:original,imagem_tipo:tabela?'familia':'individual',
          familia:familia||null,regras_versao:VERSAO_REGRAS_CATALOGO,confianca:.95})
      }
    }
  }
  // Mesmo código repetido no PDF é um único produto, com referências de todas as páginas.
  // Nunca escolhe silenciosamente um peso diferente: divergências ficam para revisão humana.
  const porCodigo = new Map<string, any>()
  for (const item of itens) {
    const anterior = porCodigo.get(item.codigo)
    if (!anterior) {
      porCodigo.set(item.codigo, { ...item, paginas_referencia: [item.pagina_catalogo] })
      continue
    }
    if (!anterior.paginas_referencia.includes(item.pagina_catalogo)) anterior.paginas_referencia.push(item.pagina_catalogo)
    if (!anterior.linha && item.linha) {
      anterior.linha = item.linha
      anterior.pagina_catalogo = item.pagina_catalogo
      anterior.evidencia_tabela = item.evidencia_tabela
    }
    if (Math.abs(anterior.peso_kg_m - item.peso_kg_m) > 0.0005) {
      anterior.conflito_peso_catalogo = [...new Set([
        ...(anterior.conflito_peso_catalogo || [anterior.peso_kg_m]), item.peso_kg_m,
      ])]
      anterior.confianca = 0.4
    }
    for (const [chave, valor] of Object.entries(item.medidas_mm)) {
      if (anterior.medidas_mm[chave] == null) anterior.medidas_mm[chave] = valor
    }
    for (const [chave, valor] of Object.entries(item.medidas_polegadas)) {
      if (anterior.medidas_polegadas[chave] == null) anterior.medidas_polegadas[chave] = valor
    }
  }
  return [...porCodigo.values()]
}
