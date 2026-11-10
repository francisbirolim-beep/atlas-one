import {COLUNAS_GERAIS_PADRAO,validarColunasGerais,type ColunaVisualProjeto,type EtapaOperacional} from './visaoGeralProjetos'

/** Fonte única das colunas visuais dos Kanbans Geral, Cliente 360 e da venda. */
export function colunasKanbanEmpresa(valor:unknown):ColunaVisualProjeto[]{
 try {
  if(Array.isArray(valor)&&!validarColunasGerais(valor as ColunaVisualProjeto[]).length)
   return (valor as ColunaVisualProjeto[]).map(c=>({...c,criterios:[...c.criterios]})).sort((a,b)=>a.ordem-b.ordem)
 }catch{/* Rejeitar configuração incompleta sem afetar as operações. */}
 return COLUNAS_GERAIS_PADRAO.map(c=>({...c,criterios:[...c.criterios]}))
}

export type ControleVisualCard={
 estado?:string|null; etapa_visual?:string|null; coluna_visual_id?:string|null; motivo?:string|null
}

/** A posição manual pertence à coluna visual, nunca ao estado da produção. */
export function posicionarCardVisual<T extends {colunaId:string;etapaOperacional:string}>(
 card:T,controle:ControleVisualCard|undefined,colunas:ColunaVisualProjeto[]
):T & {etapaOrigem?:string;controleMaster?:string|null;motivoControle?:string|null}{
 if(!controle)return card
 if(controle.estado==='finalizado'){
  const final=colunas.find(c=>c.criterios.includes('finalizado'))?.id||'finalizado'
  return {...card,etapaOrigem:card.etapaOperacional,etapaOperacional:'finalizado',colunaId:final,
   controleMaster:'finalizado',motivoControle:controle.motivo}
 }
 if(controle.estado==='manual'){
  const destino=colunas.find(c=>c.id===controle.coluna_visual_id)
   ||colunas.find(c=>c.criterios.includes(controle.etapa_visual as EtapaOperacional))
  if(destino)return {...card,colunaId:destino.id,etapaOrigem:card.etapaOperacional,
   // Para colunas novas sem critério operacional, preserve o estágio real.
   etapaOperacional:destino.criterios[0]||card.etapaOperacional,
   controleMaster:'manual',motivoControle:controle.motivo}
 }
 return {...card,controleMaster:controle.estado||null,motivoControle:controle.motivo||null}
}
