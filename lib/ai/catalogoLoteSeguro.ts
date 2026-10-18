import { conferirDadosCatalogo } from './catalogoConferencia'

export type ParecerLote = { apto:boolean; motivo:string|null; dados?:Record<string,any> }
const codigo=(v:unknown)=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
const positivo=(v:unknown)=>Number(String(v??'').replace(',','.'))>0

/**
 * Filtro conservador de homologação em massa. Não valida imagens automaticamente.
 * O desenho precisa ter sido confirmado ANTES, de forma individual e persistida,
 * para exatamente este código. A tabela PDF é conferida novamente no servidor.
 */
export function avaliarCatalogoLote(c:any, fonte:Record<string,any>|null):ParecerLote {
  const negar=(motivo:string):ParecerLote=>({apto:false,motivo})
  const d=c?.dados||{}, cod=codigo(d.codigo)
  if(c?.tipo!=='produto'||c?.status!=='pendente'||!cod)
    return negar('Status ou código não permite validação em lote.')
  if(d.revisado_manualmente||d.arquivado_em||['revisar_conflito','revisar_ambiguidade','aguardar_fornecedor'].includes(c.acao_sugerida))
    return negar('Revisão manual, divergência ou fornecedor pendente.')
  if((c.deduplicacao?.ambiguos||[]).length||(c.deduplicacao?.conflitos||[]).length)
    return negar('Duplicidade ou divergência com o cadastro existente.')
  if(!fonte||codigo(fonte.codigo)!==cod||!fonte.evidencia_tabela)
    return negar('Código não confirmado na tabela original do PDF.')
  if((fonte.conflito_peso_catalogo||[]).length>1||(d.conflito_peso_catalogo||[]).length>1)
    return negar('O catálogo apresenta pesos divergentes para este código.')
  const resultado=conferirDadosCatalogo(c,fonte)
  if(!resultado)return negar('Não foi possível reconciliar com a tabela do catálogo.')
  if(resultado.divergencias.length)
    return negar('Dados técnicos divergem da tabela original: '+resultado.divergencias.join(', '))
  const dados=resultado.dados
  if(!dados.codigo||!dados.descricao||dados.categoria==='outro'||!dados.unidade)
    return negar('Descrição, categoria ou unidade insuficiente.')
  if(dados.categoria==='perfil'&&(!positivo(dados.peso_kg_m)||
      !Object.values(dados.medidas_mm||{}).some(positivo)))
    return negar('Peso ou dimensões não confirmados.')
  const url=String(d.imagem_item_url||'')
  const caminho='/catalogo-itens/'+String(c.empresa_id||'')+'/'+String(c.entrada_id||'')+'/'+String(c.id||'')+'/'
  if(d.imagem_confirmada!==true||d.imagem_origem!=='revisada_na_central'||
      codigo(d.imagem_codigo_validado)!==cod||
      !/^https:\/\//i.test(url)||!url.includes(caminho))
    return negar('Desenho individual ainda não confirmado e salvo para este código.')
  return {apto:true,motivo:null,dados}
}
