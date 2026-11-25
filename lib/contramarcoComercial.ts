import { calcularPlanoContramarco, identificarFormatoContramarco, sugerirPerfilContramarco, perfilAprovadoContramarco } from './contramarcoRegrasCorte'

export type ProdutoComercialCM = {id:string;codigo:string|null;nome:string;categoria:string;foto_url:string}
export type PosicaoComercialCM = {
  ref:string;ambiente:string;tipologia:string;largura_mm:number;altura_mm:number;folga_l_mm:number;folga_a_mm:number;
  quantidade:number;confirmada:boolean;perfil_codigo:'CM200'|'CM060';perfil_id:string;conexao_id:string;grapa_id:string;
  preco_unit_centavos:number|null;
}
export type ItemComercialCM = PosicaoComercialCM & {
  fabricacao_l_mm:number;fabricacao_a_mm:number;metros_perfil:number;conexoes:number;grapas:number;
  materiais:{perfil:ProdutoComercialCM|null;conexao:ProdutoComercialCM|null;grapa:ProdutoComercialCM|null};
  total_centavos:number;receita_pendente:boolean;
}
export type OrcamentoCM = {id:string;numero:number;cliente_id:string;nome_obra:string;endereco:string;cidade:string;condicoes:string;
  origem_orcamento_id:string|null;origem_medicao_id:string|null;itens:ItemComercialCM[];valor_centavos:number;
  status:'rascunho'|'proposta'|'vendido'|'cancelado';versao:number;confirmado_em:string|null;created_at:string;updated_at:string}

export const UUID_CM=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const codigoCM=(v:unknown)=>String(v||'').replace(/[^a-z0-9]/gi,'').toUpperCase()
export function fotoCM(v:unknown):v is string {
  try {return typeof v==='string'&&new URL(v).protocol==='https:'}catch{return false}
}
function texto(v:unknown,max:number,obrigatorio=false){
  if(typeof v!=='string'||v.length>max|| (obrigatorio&&!v.trim()))throw new Error('Preencha os textos obrigatórios dentro dos limites.')
  return v.trim()
}
function inteiro(v:unknown,min:number,max:number){
  if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new Error('Confira medidas, folgas, quantidade e preço.')
  return v
}
function dimensao(v:unknown,min:number,max:number){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs(v*10-Math.round(v*10))>0.000001)throw new Error('Informe medidas em mm com até uma casa decimal.')
  return v
}
export function centavosCM(s:string):number|null {
  const v=s.trim().replace(',','.')
  if(!v)return null
  if(!/^\d{1,8}(\.\d{1,2})?$/.test(v))return null
  const [a,b='']=v.split('.')
  return Number(a)*100+Number(b.padEnd(2,'0'))
}
export function posicaoDeOrigemCM(v:any,medicao=false,index=0):PosicaoComercialCM {
  let tipologia=String(v.tipo_outro_texto||v.configuracao_nome||v.descricao||v.tipo_esquadria||'').replace(/_/g,' ').trim()
  const tipoBase=String(v.tipo_esquadria||'').replace(/_/g,' ').trim()
  if(tipoBase&&tipoBase!=='outro'&&!identificarFormatoContramarco({tipo_esquadria:'outro',tipo_outro_texto:tipologia,descricao:tipologia})&&identificarFormatoContramarco(v))tipologia=[tipoBase,tipologia].filter(Boolean).join(' · ')
  const perfil=medicao?perfilAprovadoContramarco(v):sugerirPerfilContramarco({...v,descricao:tipologia})
  if(perfil!=='CM200'&&perfil!=='CM060')throw new Error('Perfil especial sem receita validada para este orçamento.')
  return {ref:String(v.id||index),ambiente:String(v.ambiente||'').trim(),tipologia,
    largura_mm:Number(medicao?v.vao_largura_mm:v.largura_mm)||0,altura_mm:Number(medicao?v.vao_altura_mm:v.altura_mm)||0,
    folga_l_mm:medicao?Number(v.folga_largura_mm)||0:0,folga_a_mm:medicao?Number(v.folga_altura_mm)||0:0,
    quantidade:Number(v.quantidade)||1,confirmada:medicao&&v.medido===true&&v.contramarco==='sim',
    perfil_codigo:perfil,
    perfil_id:medicao?String(v.campos_extras?.contramarco_perfil_produto_id||''):'',conexao_id:'',grapa_id:'',preco_unit_centavos:null}
}
export function validarItensCM(raw:unknown,produtos:ProdutoComercialCM[],origemMedida?:PosicaoComercialCM[]):ItemComercialCM[]{
  if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Informe de 1 a 100 posições.')
  const ids=new Set<string>(),catalogo=new Map(produtos.filter(p=>fotoCM(p.foto_url)).map(p=>[p.id,p]))
  return raw.map(r=>{
    if(!r||typeof r!=='object')throw new Error('Posição inválida.')
    const ref=texto(r.ref,100,true)
    if(ids.has(ref))throw new Error('Posição duplicada.');ids.add(ref)
    const base=origemMedida?.find(i=>i.ref===ref)
    if(origemMedida&&!base)throw new Error('Posição não pertence à medição confirmada.')
    const ambiente=texto(r.ambiente,150),tipologia=texto(r.tipologia,200,true)
    const largura_mm=dimensao(r.largura_mm,1,30000),altura_mm=dimensao(r.altura_mm,1,30000)
    const folga_l_mm=dimensao(r.folga_l_mm,0,largura_mm-1),folga_a_mm=dimensao(r.folga_a_mm,0,altura_mm-1)
    const quantidade=inteiro(r.quantidade,1,1000)
    if(base&&(!base.confirmada||base.largura_mm!==largura_mm||base.altura_mm!==altura_mm||base.folga_l_mm!==folga_l_mm||
      base.folga_a_mm!==folga_a_mm||base.quantidade!==quantidade||base.tipologia!==tipologia||base.ambiente!==ambiente))
      throw new Error('A medição de origem mudou ou foi editada. Importe novamente as medidas reais.')
    const perfil_codigo=r.perfil_codigo
    if(perfil_codigo!=='CM200'&&perfil_codigo!=='CM060')throw new Error('Escolha CM200 ou CM060.')
    if(base&&base.perfil_codigo!==perfil_codigo)throw new Error('O perfil deve corresponder ao perfil da medição. Corrija na origem.')
    const produto=(id:unknown,categoria:string)=>{
      if(id===''||id==null)return null
      if(typeof id!=='string'||!UUID_CM.test(id))throw new Error('Produto inválido.')
      const p=catalogo.get(id)
      if(!p||p.categoria!==categoria)throw new Error('Escolha um produto ativo da categoria correta e com foto cadastrada.')
      return p
    }
    const perfil=produto(r.perfil_id,'perfil'),conexao=produto(r.conexao_id,'acessorio'),grapa=produto(r.grapa_id,'acessorio')
    if(perfil&&codigoCM(perfil.codigo)!==perfil_codigo)throw new Error('O código do perfil não corresponde à receita.')
    if(conexao&&grapa&&conexao.id===grapa.id)throw new Error('Conexão e grapa devem ser produtos distintos.')
    const fabricacao_l_mm=Math.round((largura_mm-folga_l_mm)*10)/10,fabricacao_a_mm=Math.round((altura_mm-folga_a_mm)*10)/10
    const formato=identificarFormatoContramarco({tipo_esquadria:'outro',tipo_outro_texto:tipologia,descricao:tipologia})
    const plano=formato?calcularPlanoContramarco(formato,fabricacao_l_mm,fabricacao_a_mm,quantidade):null
    const preco_unit_centavos=r.preco_unit_centavos===null?null:inteiro(r.preco_unit_centavos,1,9999999999)
    return {ref,ambiente,tipologia,largura_mm,altura_mm,folga_l_mm,folga_a_mm,quantidade,confirmada:!!base,
      perfil_codigo,perfil_id:perfil?.id||'',conexao_id:conexao?.id||'',grapa_id:grapa?.id||'',preco_unit_centavos,
      fabricacao_l_mm,fabricacao_a_mm,metros_perfil:plano?plano.pecas.reduce((n,p)=>n+p.corte_mm*p.quantidade,0)/1000:0,
      conexoes:plano?.conectores_90||0,grapas:plano?.grapas||0,materiais:{perfil,conexao,grapa},
      total_centavos:(preco_unit_centavos||0)*quantidade,receita_pendente:!plano}
  })
}
export function totalCM(itens:ItemComercialCM[]){
  const total=itens.reduce((n,i)=>n+i.total_centavos,0)
  if(!Number.isSafeInteger(total)||total>99999999999999)throw new Error('Valor total acima do limite.')
  return total
}
export function propostaProntaCM(itens:ItemComercialCM[]){
  return itens.length>0&&itens.every(i=>i.preco_unit_centavos!==null&&i.preco_unit_centavos>0&&!i.receita_pendente&&
    !!i.materiais.perfil&&!!i.materiais.conexao&&!!i.materiais.grapa)
}
