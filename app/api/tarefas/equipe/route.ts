import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTarefasEquipe, notificarEnvolvidos, prioridadesTarefa, registrarHistorico } from '@/lib/servidorTarefasEquipe'
import { gerarDatasEquipe, type RepeticaoEquipe } from '@/lib/tarefasEquipeRecorrencia'

const REGRAS = new Set<RepeticaoEquipe>(['uma_vez','semanal','mensal','dia_util_mes'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const usuario = await autenticarTarefasEquipe(req)
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const cols = 'id,empresa_id,criado_por_id,titulo,descricao,responsaveis_ids,prioridade,data_hora,status,compartilhada,lote_id,serie_id,recorrencia_tipo,concluida_em,concluida_por_id,iniciada_em,created_at,updated_at'
  const base = () => supabaseAdmin.from('atlas_tarefas_equipe').select(cols).eq('empresa_id',usuario.empresa_id)
  const [autor, responsavel] = await Promise.all([
    base().eq('criado_por_id',usuario.id).order('created_at',{ascending:false}).limit(600),
    base().contains('responsaveis_ids',[usuario.id]).order('created_at',{ascending:false}).limit(600),
  ])
  if (autor.error || responsavel.error) return NextResponse.json({ error: 'Não foi possível carregar tarefas compartilhadas.' }, { status: 500 })
  const encontrados = new Map<string, any>()
  ;[...(autor.data||[]),...(responsavel.data||[])].forEach(t => encontrados.set(t.id,t))
  const tarefas = [...encontrados.values()]
  const usuariosIds = [...new Set(tarefas.flatMap(t => [t.criado_por_id, ...(t.responsaveis_ids||[]),t.concluida_por_id]).filter(Boolean))]
  const {data:nomes,error:erroNomes} = usuariosIds.length
    ? await supabaseAdmin.from('usuarios').select('id,nome').eq('empresa_id',usuario.empresa_id).in('id',usuariosIds)
    : {data:[],error:null}
  if(erroNomes) return NextResponse.json({error:'Não foi possível carregar os responsáveis.'},{status:500})
  const nomesMap = new Map((nomes||[]).map(x=>[x.id,x.nome]))
  const idsTarefas = tarefas.filter(t=>t.responsaveis_ids.includes(usuario.id)).map(t=>t.id)
  const {data:avisos,error:erroAvisos} = idsTarefas.length
    ? await supabaseAdmin.from('atlas_tarefa_avisos').select('tarefa_id,proximo_aviso_em,ultimo_aviso_em,visto_em')
      .eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id).in('tarefa_id',idsTarefas.slice(0,600))
    : {data:[],error:null}
  if(erroAvisos) return NextResponse.json({error:'Falha ao carregar lembretes.'},{status:500})
  const porAviso = new Map((avisos||[]).map(a=>[a.tarefa_id,a]))
  const dados = tarefas.map(t=>({
    ...t,
    criador_nome:nomesMap.get(t.criado_por_id)||'Usuário',
    responsaveis_nomes:t.responsaveis_ids.map((id:string)=>nomesMap.get(id)||'Usuário'),
    concluidora_nome:t.concluida_por_id ? nomesMap.get(t.concluida_por_id)||'Usuário' : null,
    aviso:porAviso.get(t.id)||null,
  }))
  return NextResponse.json({tarefas:dados},{headers:{'Cache-Control':'no-store'}})
}

export async function POST(req:NextRequest) {
  const usuario = await autenticarTarefasEquipe(req)
  if (!usuario) return NextResponse.json({error:'Não autenticado'},{status:401})
  let body:any
  try {body=await req.json()}catch{return NextResponse.json({error:'Dados inválidos'},{status:400})}
  const titulo = typeof body.titulo==='string'?body.titulo.trim():''
  const descricao = typeof body.descricao==='string'?body.descricao.trim():''
  const responsaveis = [...new Set((Array.isArray(body.responsaveisIds)?body.responsaveisIds:[])
    .filter((id:unknown):id is string=>typeof id==='string' && UUID.test(id)))]
  const prioridade = prioridadesTarefa.includes(body.prioridade)?body.prioridade:'normal'
  const tipo:RepeticaoEquipe = REGRAS.has(body.recorrencia)?body.recorrencia:'uma_vez'
  const dataHora=typeof body.dataHora==='string'&&body.dataHora?body.dataHora:null
  const compartilhada=body.modo!=='individual'
  const recorrenciaValor = Number.isInteger(body.recorrenciaValor)?body.recorrenciaValor:null
  const recorrenciaDias = Array.isArray(body.diasSemana)?
    [...new Set(body.diasSemana.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=6))]:[]
  if (!titulo || titulo.length>300 || descricao.length>2000) return NextResponse.json({error:'Verifique o título e a descrição.'},{status:400})
  if (!responsaveis.length||responsaveis.length>15) return NextResponse.json({error:'Selecione de 1 a 15 responsáveis.'},{status:400})
  if (tipo!=='uma_vez'&&!dataHora) return NextResponse.json({error:'Informe data e horário para recorrência.'},{status:400})
  if(dataHora && (Number.isNaN(new Date(dataHora).getTime()) || new Date(dataHora).getFullYear()<2020)) return NextResponse.json({error:'Data inválida'},{status:400})
  if(tipo==='mensal'&&(recorrenciaValor===null||recorrenciaValor<1||recorrenciaValor>31)) return NextResponse.json({error:'Informe o dia de 1 a 31.'},{status:400})
  if(tipo==='dia_util_mes'&&(recorrenciaValor===null||recorrenciaValor<1||recorrenciaValor>23)) return NextResponse.json({error:'Dia útil fora do intervalo permitido.'},{status:400})

  const {data:usuarios,error:usuariosErro}=await supabaseAdmin.from('usuarios')
    .select('id,nome').eq('empresa_id',usuario.empresa_id).in('id',responsaveis)
  if(usuariosErro || !usuarios || usuarios.length!==responsaveis.length) {
    return NextResponse.json({error:'Um dos usuários não pertence à sua empresa.'},{status:403})
  }

  const loteId=crypto.randomUUID()
  const grupos=compartilhada?[responsaveis]:responsaveis.map(id=>[id])
  const datas=dataHora?gerarDatasEquipe(dataHora,tipo,recorrenciaValor||undefined,recorrenciaDias,6):[null]
  if(!datas.length||datas.length>210) return NextResponse.json({error:'Programação inválida ou excessiva.'},{status:400})
  const agora=new Date().toISOString()
  const base=grupos.map(ids=>({ids,serieId:crypto.randomUUID()}))
  const linhas=base.flatMap(({ids,serieId})=>datas.map((data,i)=>({
    id:i===0?serieId:crypto.randomUUID(),
    empresa_id:usuario.empresa_id,criado_por_id:usuario.id,titulo,descricao:descricao||null,
    responsaveis_ids:ids,prioridade,data_hora:data,
    status:'a_fazer',compartilhada,lote_id:loteId,
    serie_id:tipo==='uma_vez'?null:serieId,
    recorrencia_tipo:i===0&&tipo!=='uma_vez'?tipo:null,
    recorrencia_valor:i===0?recorrenciaValor:null,
    recorrencia_dias:i===0?recorrenciaDias:null,
  })))
  const {data:criadas,error:erroCriar}=await supabaseAdmin.from('atlas_tarefas_equipe').insert(linhas).select('id,data_hora,responsaveis_ids')
  if(erroCriar||!criadas) return NextResponse.json({error:'Não foi possível criar as tarefas.'},{status:500})
  const estados=criadas.flatMap(t=>t.responsaveis_ids.map((usuario_id:string)=>({
    empresa_id:usuario.empresa_id,tarefa_id:t.id,usuario_id,
    proximo_aviso_em:(!t.data_hora || t.data_hora<=agora)?agora:t.data_hora,
  })))
  const {error:erroAviso}=await supabaseAdmin.from('atlas_tarefa_avisos').insert(estados)
  if(erroAviso) console.error('Não foi possível preparar todos os lembretes:',erroAviso.message)
  for(const primeira of linhas.filter(t=>t.id===t.serie_id||t.serie_id===null)) {
    await registrarHistorico(usuario.empresa_id,primeira.id,usuario.id,'criada',
      compartilhada?'Tarefa compartilhada':'Responsabilidade individual')
    await notificarEnvolvidos({
      id:primeira.id,empresa_id:usuario.empresa_id,criado_por_id:usuario.id,
      responsaveis_ids:primeira.responsaveis_ids,titulo,
    },usuario.id,'Você recebeu uma nova tarefa',titulo)
  }
  return NextResponse.json({ok:true,quantidade:criadas.length,loteId},
    {status:201,headers:{'Cache-Control':'no-store'}})
}
