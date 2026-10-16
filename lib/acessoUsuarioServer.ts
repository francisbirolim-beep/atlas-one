import { supabaseAdmin } from './supabaseAdmin'

export type NivelAcessoServer = 'oculto' | 'consulta' | 'edicao'

const peso:Record<NivelAcessoServer,number> = {oculto:0,consulta:1,edicao:2}

function nivel(v:unknown):NivelAcessoServer {
  return v === 'edicao' ? 'edicao' : v === 'consulta' ? 'consulta' : 'oculto'
}

function menor(a:NivelAcessoServer,b:NivelAcessoServer):NivelAcessoServer {
  return peso[a] <= peso[b] ? a : b
}

export async function lerAcessoConfigServer(usuarioId:string, empresaId?:string) {
  try {
    let consulta=supabaseAdmin.from('usuario_acessos_etapas').select('config').eq('usuario_id',usuarioId)
    if(empresaId)consulta=consulta.eq('empresa_id',empresaId)
    const segura=await consulta.maybeSingle()
    if(!segura.error && segura.data)return segura.data.config
    if(segura.error && !['42P01','PGRST205'].includes(segura.error.code))throw segura.error
    const {data,error}=await supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave',`acesso_usuario:${usuarioId}`).maybeSingle()
    if(error)throw error
    if(!data?.valor) return null
    return typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
  } catch {
    throw new Error('Não foi possível conferir as permissões.')
  }
}

export async function nivelAcaoUsuarioServer(params:{
  usuarioId:string
  role:string
  setorId:string
  acaoId:string
  empresaId?:string
}):Promise<NivelAcessoServer> {
  if(params.role==='master') return 'edicao'

  let q=supabaseAdmin.from('permissoes').select('nivel').eq('usuario_id',params.usuarioId).eq('setor_id',params.setorId)
  if(params.empresaId) q=q.eq('empresa_id',params.empresaId)
  const {data:permissao,error}=await q.maybeSingle()
  if(error)throw new Error('Não foi possível conferir o acesso ao setor.')
  const nivelSetor=nivel(permissao?.nivel)
  if(nivelSetor==='oculto') return 'oculto'

  const config=await lerAcessoConfigServer(params.usuarioId,params.empresaId)
  const explicito=nivel(config?.acoes?.[params.acaoId])
  if(!config?.acoes || !(params.acaoId in config.acoes)) return nivelSetor
  return menor(nivelSetor,explicito)
}

export async function usuarioPodeAcaoServer(params:{
  usuarioId:string
  role:string
  setorId:string
  acaoId:string
  minimo?:NivelAcessoServer
  empresaId?:string
}) {
  const atual=await nivelAcaoUsuarioServer(params)
  return peso[atual] >= peso[params.minimo||'consulta']
}