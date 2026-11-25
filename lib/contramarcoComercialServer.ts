import 'server-only'
import { NextRequest } from 'next/server'
import { autenticarTenant } from './tenantServer'
import { supabaseAdmin } from './supabaseAdmin'
import { contextoCliente360Server } from './cliente360AcessoServer'
import { podeCliente360 } from './cliente360Permissoes'
import { usuarioPodeAcaoServer } from './acessoUsuarioServer'
import { fotoCM, posicaoDeOrigemCM, UUID_CM, type ProdutoComercialCM } from './contramarcoComercial'
import { enderecoCompletoObra } from './enderecoObra'

export async function acessoComercialCM(req:NextRequest,clienteId:string){
  if(!UUID_CM.test(clienteId))return null
  const usuario=await autenticarTenant(req)
  if(!usuario)return null
  const ctx=await contextoCliente360Server(usuario)
  const verOrcamento=podeCliente360(ctx,'orcamentos')
  const verVenda=podeCliente360(ctx,'vendas')
  if(!verOrcamento&&!verVenda)return null
  const acao=(acaoId:string)=>usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'fazer-orcamento-msanfyvj',acaoId,minimo:'edicao'})
  const [criar,editar,preco,vender,pdf]=await Promise.all([
    podeCliente360(ctx,'orcamento_sob_medida',true)?acao('comercial.orcamento.criar'):false,
    podeCliente360(ctx,'orcamentos',true)?acao('comercial.orcamento.editar'):false,
    podeCliente360(ctx,'orcamentos',true)?acao('comercial.orcamento.margem'):false,
    podeCliente360(ctx,'vendas',true)?acao('comercial.orcamento.aprovar'):false,
    verOrcamento||verVenda?acao('comercial.orcamento.pdf'):false,
  ])
  const {data:cliente,error}=await supabaseAdmin.from('clientes').select('id,nome,cidade').eq('id',clienteId).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(error||!cliente)return null
  return {usuario,cliente,permissoes:{verOrcamento,verVenda,criar,editar,preco,vender,pdf,medir:podeCliente360(ctx,'medicoes')}}
}
export type AcessoCM=NonNullable<Awaited<ReturnType<typeof acessoComercialCM>>>
export async function catalogoCM(empresa:string,ids?:string[]){
  if(ids&&!ids.length)return []
  const q=supabaseAdmin.from('produtos').select('id,codigo,nome,categoria,foto_url').eq('empresa_id',empresa).eq('ativo',true)
    .in('categoria',['perfil','acessorio']).not('foto_url','is',null)
  if(ids)q.in('id',ids)
  else q.order('nome').limit(1000)
  const {data,error}=await q
  if(error)throw new Error('Catálogo de produtos indisponível.')
  return (data||[]).filter(p=>fotoCM(p.foto_url)) as ProdutoComercialCM[]
}
export async function origemCM(a:AcessoCM,orcamentoId:string|null,medicaoId:string|null){
  const empresa=a.usuario.empresa_id,cliente=a.cliente.id
  if(medicaoId){
    if(!a.permissoes.medir||!UUID_CM.test(medicaoId))throw new Error('Sem acesso à medição.')
    const {data:m,error}=await supabaseAdmin.from('medicoes_finais').select('id,obra_id,cidade,orcamento_id')
      .eq('id',medicaoId).eq('empresa_id',empresa).eq('cliente_id',cliente).eq('tipo_medicao','contramarco').maybeSingle()
    if(error||!m)throw new Error('Medição não encontrada neste cliente.')
    if(orcamentoId&&m.orcamento_id!==orcamentoId)throw new Error('A medição não pertence ao orçamento de origem.')
    const [{data:itens,error:erroItens},{data:local,error:erroLocal}]=await Promise.all([
      supabaseAdmin.from('medicao_itens').select('*').eq('medicao_id',m.id).eq('empresa_id',empresa).order('ordem'),
      supabaseAdmin.from('medicao_contramarco_local').select('nome_obra,endereco,cidade').eq('medicao_id',m.id).eq('empresa_id',empresa).maybeSingle(),
    ])
    if(erroItens||erroLocal)throw new Error('Não foi possível conferir a medição e a identificação.')
    if((itens||[]).some(i=>!i.medido||!['sim','nao'].includes(i.contramarco)))throw new Error('Conclua todas as posições antes de gerar o orçamento.')
    const selecionados=(itens||[]).filter(i=>i.contramarco!=='nao')
    if(!selecionados.length||selecionados.some(i=>!i.medido||i.contramarco!=='sim'||!(Number(i.vao_largura_mm)>0)||!(Number(i.vao_altura_mm)>0)||i.folga_largura_mm==null||i.folga_altura_mm==null||!(Number(i.producao_largura_mm)>0)||!(Number(i.producao_altura_mm)>0)||Math.abs(Number(i.producao_largura_mm)-(Number(i.vao_largura_mm)-Number(i.folga_largura_mm)))>0.001||Math.abs(Number(i.producao_altura_mm)-(Number(i.vao_altura_mm)-Number(i.folga_altura_mm)))>0.001))
      throw new Error('Conclua as medidas de contramarco antes de gerar o orçamento.')
    const posicoes=selecionados.map((i,index)=>posicaoDeOrigemCM(i,true,index))
    const ids=[...new Set(posicoes.map(i=>i.perfil_id).filter(Boolean))]
    const produtos=await catalogoCM(empresa,ids)
    for(const i of posicoes)if(i.perfil_id&&!produtos.some(p=>p.id===i.perfil_id))i.perfil_id=''
    const {data:obra}=!local&&m.obra_id?await supabaseAdmin.from('obras').select('nome,endereco,numero_endereco,bairro,cidade,uf,cep')
      .eq('id',m.obra_id).eq('empresa_id',empresa).eq('cliente_id',cliente).maybeSingle():{data:null}
    return {origem_orcamento_id:m.orcamento_id||null,itens:posicoes,produtos,nome_obra:local?.nome_obra||obra?.nome||'',endereco:local?.endereco||(obra?enderecoCompletoObra(obra):''),cidade:local?.cidade||obra?.cidade||m.cidade||''}
  }
  if(orcamentoId){
    if(!a.permissoes.verOrcamento||!UUID_CM.test(orcamentoId))throw new Error('Sem acesso ao orçamento.')
    const {data:o,error}=await supabaseAdmin.from('orcamentos').select('id,obra_id,cidade,itens,revisao_atual,status,modo_entrada')
      .eq('id',orcamentoId).eq('empresa_id',empresa).eq('cliente_id',cliente).maybeSingle()
    if(error||!o||o.revisao_atual===false||o.modo_entrada==='balcao'||o.status==='recusado')throw new Error('Orçamento de origem indisponível.')
    const {data:obra}=o.obra_id?await supabaseAdmin.from('obras').select('nome,endereco,numero_endereco,bairro,cidade,uf,cep')
      .eq('id',o.obra_id).eq('empresa_id',empresa).eq('cliente_id',cliente).maybeSingle():{data:null}
    const itens=(Array.isArray(o.itens)?o.itens:[]).map((i,index)=>posicaoDeOrigemCM(i,false,index))
    if(!itens.length)throw new Error('Este orçamento não possui tipologias estruturadas. Cadastre as posições manualmente.')
    return {origem_orcamento_id:o.id,itens,nome_obra:obra?.nome||'',endereco:obra?enderecoCompletoObra(obra):'',cidade:obra?.cidade||o.cidade||''}
  }
  return {origem_orcamento_id:null,itens:[],nome_obra:'',endereco:'',cidade:a.cliente.cidade||''}
}
export function textoComercialCM(v:unknown,max:number,obrigatorio=false){
  if(typeof v!=='string'||v.length>max||(obrigatorio&&!v.trim()))throw new Error('Informe os dados obrigatórios da obra e condições.')
  return v.trim()
}
