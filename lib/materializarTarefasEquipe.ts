import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarDatasEquipe, type RepeticaoEquipe } from '@/lib/tarefasEquipeRecorrencia'
import type { PerfilTarefa } from '@/lib/servidorTarefasEquipe'

// Materialização incremental idempotente: o usuário não perde a recorrência na virada do mês.
// Executa apenas quando uma pessoa envolvida acessa o Atlas. Não depende de cron do servidor.
// Não modifica nem apaga tarefas concluídas ou tarefas individuais antigas.
export async function materializarTarefasEquipe(usuario: PerfilTarefa): Promise<void> {
  const cols='id,empresa_id,criado_por_id,titulo,descricao,responsaveis_ids,prioridade,data_hora,compartilhada,lote_id,serie_id,recorrencia_tipo,recorrencia_valor,recorrencia_dias'
  const base=()=>supabaseAdmin.from('atlas_tarefas_equipe').select(cols)
    .eq('empresa_id',usuario.empresa_id).not('recorrencia_tipo','is',null)
  const [proprias,recebidas]=await Promise.all([
    base().eq('criado_por_id',usuario.id).limit(200),
    base().contains('responsaveis_ids',[usuario.id]).limit(200),
  ])
  if(proprias.error||recebidas.error) return
  const raizes=[...new Map([...(proprias.data||[]),...(recebidas.data||[])].map(t=>[t.id,t])).values()]
  if(!raizes.length)return
  const agora=new Date()
  const inicio=new Date(agora)
  inicio.setUTCMonth(inicio.getUTCMonth()-1)
  const fim=new Date(agora)
  fim.setUTCMonth(fim.getUTCMonth()+6)
  const ids=raizes.map(t=>t.serie_id||t.id)
  const {data:existentes,error}=await supabaseAdmin.from('atlas_tarefas_equipe')
    .select('serie_id,data_hora').eq('empresa_id',usuario.empresa_id)
    .in('serie_id',ids).gte('data_hora',inicio.toISOString()).lte('data_hora',fim.toISOString())
    .limit(8000)
  if(error)return
  const chaves=new Set((existentes||[]).map(t=>t.serie_id+'|'+t.data_hora))
  const linhas:any[]=[]
  for(const regra of raizes) {
    if(!regra.data_hora)continue
    const serie=regra.serie_id||regra.id
    const baseDate=new Date(regra.data_hora)
    const diffMeses=(fim.getUTCFullYear()-baseDate.getUTCFullYear())*12+
      fim.getUTCMonth()-baseDate.getUTCMonth()+1
    if(diffMeses>120)continue // evitam-se gerações históricas ilimitadas
    const tipo=regra.recorrencia_tipo as RepeticaoEquipe
    const datas=gerarDatasEquipe(regra.data_hora,tipo,regra.recorrencia_valor||undefined,
      regra.recorrencia_dias||[],Math.max(6,diffMeses))
    for(const data of datas) {
      if(data<inicio.toISOString()||data>fim.toISOString())continue
      const chave=serie+'|'+data
      if(chaves.has(chave))continue
      chaves.add(chave)
      linhas.push({
        id:crypto.randomUUID(),empresa_id:usuario.empresa_id,criado_por_id:regra.criado_por_id,
        titulo:regra.titulo,descricao:regra.descricao,responsaveis_ids:regra.responsaveis_ids,
        prioridade:regra.prioridade,data_hora:data,status:'a_fazer',
        compartilhada:regra.compartilhada,lote_id:regra.lote_id,serie_id:serie,
      })
    }
  }
  for(let i=0;i<linhas.length;i+=100) {
    const parte=linhas.slice(i,i+100)
    const {data:criadas,error:erroInsercao}=await supabaseAdmin.from('atlas_tarefas_equipe')
      .upsert(parte,{onConflict:'serie_id,data_hora',ignoreDuplicates:true})
      .select('id,data_hora,responsaveis_ids')
    if(erroInsercao||!criadas?.length)continue
    const avisos=criadas.flatMap(t=>t.responsaveis_ids.map((usuario_id:string)=>({
      empresa_id:usuario.empresa_id,tarefa_id:t.id,usuario_id,proximo_aviso_em:t.data_hora,
    })))
    await supabaseAdmin.from('atlas_tarefa_avisos').upsert(avisos,{
      onConflict:'tarefa_id,usuario_id',ignoreDuplicates:true,
    })
  }
}
