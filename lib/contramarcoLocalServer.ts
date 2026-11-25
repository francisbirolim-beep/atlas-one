import 'server-only'
import { NextRequest } from 'next/server'
import { autenticarTenant } from './tenantServer'
import { supabaseAdmin } from './supabaseAdmin'
import { contextoCliente360Server } from './cliente360AcessoServer'
import { podeCliente360 } from './cliente360Permissoes'
import { usuarioPodeAcaoServer } from './acessoUsuarioServer'
import { enderecoCompletoObra, localizacaoRegistradaNaObra } from './enderecoObra'
import type { LocalContramarco } from './contramarcoLocal'

export const BUCKET_LOCAL_CONTRAMARCO = 'contramarco-obra-fotos'
export const UUID_LOCAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function usuarioLocalContramarco(req:NextRequest, editar=false) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return null
  try {
    const ctx=await contextoCliente360Server(usuario)
    if(!podeCliente360(ctx,'medicoes',editar))return null
    if(editar&&!(await usuarioPodeAcaoServer({usuarioId:usuario.id,empresaId:usuario.empresa_id,role:usuario.role,setorId:'medida-final-msdwtt9y',acaoId:'producao.medida_final.preencher',minimo:'edicao'})))return null
  } catch { return null }
  return usuario
}
export async function acessoLocalContramarco(req: NextRequest, medicaoId: string, editar = false) {
  if (!UUID_LOCAL.test(medicaoId)) return null
  const usuario = await usuarioLocalContramarco(req,editar)
  if (!usuario) return null
  const {data:medicao,error} = await supabaseAdmin.from('medicoes_finais')
    .select('id,cliente_id,cliente_nome,obra_id,cidade,status_operacional,tipo_medicao')
    .eq('id',medicaoId).eq('empresa_id',usuario.empresa_id).eq('tipo_medicao','contramarco').maybeSingle()
  if (error || !medicao) return null
  return {usuario,medicao}
}
export async function lerLocalContramarco(acesso: NonNullable<Awaited<ReturnType<typeof acessoLocalContramarco>>>) {
  const {usuario,medicao}=acesso
  const {data,error}=await supabaseAdmin.from('medicao_contramarco_local').select('nome_obra,endereco,cidade,observacoes,gps,updated_at')
    .eq('medicao_id',medicao.id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(error) throw new Error('Não foi possível carregar a identificação da obra.')
  if(data) return data as LocalContramarco
  const {data:obra}=medicao.obra_id ? await supabaseAdmin.from('obras')
    .select('nome,endereco,numero_endereco,complemento,bairro,cidade,uf,cep,observacoes')
    .eq('id',medicao.obra_id).eq('empresa_id',usuario.empresa_id).eq('cliente_id',medicao.cliente_id).maybeSingle() : {data:null}
  return {nome_obra:obra?.nome || '',endereco:obra ? enderecoCompletoObra(obra) : '',cidade:obra?.cidade || medicao.cidade || '',
    observacoes:'',gps:localizacaoRegistradaNaObra(obra?.observacoes),updated_at:null} as LocalContramarco
}
export async function fotosLocalContramarco(empresaId:string,medicaoId:string) {
  const {data,error}=await supabaseAdmin.from('medicao_contramarco_fotos').select('id,arquivo_nome,arquivo_path')
    .eq('empresa_id',empresaId).eq('medicao_id',medicaoId).order('created_at',{ascending:true})
  if(error) throw new Error('Não foi possível carregar as fotos da obra.')
  return Promise.all((data||[]).map(async f=>{
    const {data:link}=await supabaseAdmin.storage.from(BUCKET_LOCAL_CONTRAMARCO).createSignedUrl(f.arquivo_path,3600)
    return {id:f.id,arquivo_nome:f.arquivo_nome,url:link?.signedUrl||null}
  }))
}
