import {createHash} from 'crypto'
import {supabaseAdmin} from '@/lib/supabaseAdmin'

export type MaterialConferencia = {
 id:string;item_ref?:string|null;categoria?:string|null;codigo?:string|null;
 descricao?:string|null;cor_ref?:string|null;unidade?:string|null;
 quantidade_ajustada?:number|null;comprimento_corte_mm?:number|null;comprimento_barra_mm?:number|null;
 status_calculo?:string|null;origem_calculo?:string|null;produto_id?:string|null;wvetro_dados?:Record<string,unknown>|null
}
export type RegistroConferencia = {metadados?:{wvetro_conferencia?:{item_ref?:string|null;hash_fonte?:string|null}}}
export const imagemSegura=(x:unknown):x is string=>typeof x==='string'&&/^https:\/\//i.test(x.trim())

/** Mantém a assinatura idêntica à da conferência documental original. */
export function assinaturaTecnica(materiais:MaterialConferencia[]){
 const linhas=materiais.map(m=>[
  m.id,m.item_ref,m.categoria,m.codigo,m.descricao,m.cor_ref,m.unidade,
  m.quantidade_ajustada,m.comprimento_corte_mm,m.comprimento_barra_mm,
 ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
 return createHash('sha256').update(JSON.stringify(linhas)).digest('hex')
}

/** Compara apenas parâmetros que mudam a receita de materiais. */
export function assinaturaFonteTipologias(itens:any[]):string{
 const linhas=itens.map((it:any)=>[
  String(it?.id||''),it?.tipologia_id||null,it?.largura_mm??null,it?.altura_mm??null,
  it?.quantidade??null,it?.cor??null,it?.contramarco??null,
  it?.variaveis??null,it?.wvetro_composicao??null,
 ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
 return createHash('sha256').update(JSON.stringify(linhas)).digest('hex')
}

export function pendenciasConferencia(
 itens:any[],materiais:MaterialConferencia[],registros:RegistroConferencia[],
):string[]{
 const erros:string[]=[]
 if(!itens.length)return ['Não há tipologias no pacote técnico.']
 if(itens.length>400)return ['Há mais de 400 tipologias; faça uma conferência assistida.']
 const referencias=itens.map((it:any)=>String(it?.id||'').trim())
 if(referencias.some(r=>!r)||new Set(referencias).size!==referencias.length)
  return ['As tipologias estão sem referência exclusiva. Corrija o cadastro antes da cotação.']
 const refs=new Set(referencias)
 if(materiais.some(m=>!m.item_ref||!refs.has(m.item_ref)))erros.push('Há materiais sem vínculo com tipologia.')
 const ultimas=new Map<string,RegistroConferencia>()
 for(const registro of registros){
  const r=String(registro.metadados?.wvetro_conferencia?.item_ref||'')
  if(r&&!ultimas.has(r))ultimas.set(r,registro)
 }
 for(const ref of referencias){
  const linhas=materiais.filter(m=>m.item_ref===ref)
  if(!linhas.length){erros.push('Tipologia sem composição: '+ref);continue}
  if(linhas.some(m=>m.status_calculo==='pendente_formula'||Number(m.quantidade_ajustada)<0))
   erros.push('Tipologia com fórmula/quantidade pendente: '+ref)
  const hash=ultimas.get(ref)?.metadados?.wvetro_conferencia?.hash_fonte
  if(!hash)erros.push('Tipologia sem aprovação vigente: '+ref)
  else if(hash!==assinaturaTecnica(linhas))erros.push('Tipologia alterada após a aprovação: '+ref)
 }
 return erros
}

/** Usado no servidor de Compras. Falha fechado e nunca grava material nem pedido. */
export async function auditarCotacaoMateriais(dados:{
 empresaId:string;vendaId:string;orcamentoId:string;pacoteId:string;origemPacote?:string;criadoEm?:string;
 itensPacote:any[];materiais:MaterialConferencia[];selecionados:MaterialConferencia[]
}):Promise<string[]>{
 const {empresaId,vendaId,pacoteId,itensPacote,materiais,selecionados}=dados
 const erros:string[]=[]
 if(!selecionados.length)return ['Selecione os materiais que serão cotados.']
 if(materiais.length>=2000)return ['A composição excede o limite de conferência automática.']
 const {data:registros,error:erroRegistros}=await supabaseAdmin.from('ai_aprendizado_entradas')
  .select('created_at,metadados')
  .eq('empresa_id',empresaId)
  .contains('metadados',{wvetro_conferencia:{venda_id:vendaId,pacote_id:pacoteId,tipo:'tipologia'}})
  .order('created_at',{ascending:false}).limit(500)
 if(erroRegistros)throw erroRegistros
 erros.push(...pendenciasConferencia(itensPacote,materiais,registros||[]))
 // Alterações de medidas/quantidade na venda exigem conciliar um novo pacote
 // com compras existentes; nunca reescrever silenciosamente a composição.
 if(dados.origemPacote!=='medicao_final'){
  const {data:estado,error:erroEstado}=await supabaseAdmin.rpc('fn_venda_estado_atual_v1',{p_venda_obra_id:vendaId})
  if(erroEstado)throw erroEstado
  if(Array.isArray(estado?.itens_snapshot)&&estado.itens_snapshot.length
    &&assinaturaFonteTipologias(estado.itens_snapshot)!==assinaturaFonteTipologias(itensPacote))
    erros.push('Dimensões, quantidade ou configuração da venda mudaram desde a geração do pacote. Gere e confira uma revisão técnica.')
 }
 // As fórmulas validadas podem evoluir. Não cotar cortes calculados com uma
 // versão antiga sem regeneração e conferência explícita.
 if(dados.criadoEm&&materiais.some((m:any)=>m.origem_calculo==='formula')){
  const ids=[...new Set(itensPacote.map((i:any)=>i?.tipologia_id).filter(Boolean))]
  for(let i=0;i<ids.length;i+=100){
   const {data,error}=await supabaseAdmin.from('engenharia_tipologia_formulas_corte')
    .select('tipologia_id,updated_at,status,ativo').in('tipologia_id',ids.slice(i,i+100))
   if(error)throw error
   if((data||[]).some(f=>f.ativo&&f.status==='validada'&&new Date(f.updated_at).getTime()>new Date(dados.criadoEm!).getTime()+1000)){
    erros.push('Fórmula técnica revisada após o pacote. Recalcule os cortes e confira o novo conjunto de materiais.')
    break
   }
  }
 }
 const comImagem=selecionados.filter(m=>['perfil','contramarco','acessorio'].includes(m.categoria||''))
 if(comImagem.length){
  const ids=[...new Set(comImagem.map(m=>m.produto_id).filter((v):v is string=>!!v))]
  const codigos=[...new Set(comImagem.map(m=>String(m.codigo||'').trim()).filter(Boolean))]
  const produtos:Array<{id:string;codigo?:string|null;foto_url?:string|null}>=[]
  for(let i=0;i<ids.length;i+=150){
   const {data,error}=await supabaseAdmin.from('produtos').select('id,codigo,foto_url')
    .eq('empresa_id',empresaId).eq('ativo',true).in('id',ids.slice(i,i+150))
   if(error)throw error
   produtos.push(...(data||[]))
  }
  for(let i=0;i<codigos.length;i+=150){
   const {data,error}=await supabaseAdmin.from('produtos').select('id,codigo,foto_url')
    .eq('empresa_id',empresaId).eq('ativo',true).in('codigo',codigos.slice(i,i+150))
   if(error)throw error
   produtos.push(...(data||[]))
  }
  const porId=new Map(produtos.map(p=>[p.id,p]))
  const porCodigo=new Map(produtos.map(p=>[String(p.codigo||'').trim().toUpperCase(),p]))
  for(const m of comImagem){
   const codigo=String(m.codigo||'').trim()
   if(!codigo){erros.push('Material sem código de produto: '+String(m.descricao||m.id));continue}
   const p=porId.get(m.produto_id||'')||porCodigo.get(codigo.toUpperCase())
   const dadosImagem=m.wvetro_dados||{}
   const imagem=imagemSegura(p?.foto_url)||imagemSegura(dadosImagem.imagem_atlas_url)||imagemSegura(dadosImagem.imagem_url)
   if(!imagem)erros.push('Imagem técnica pendente: '+codigo)
  }
 }
 return erros
}
