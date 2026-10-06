import { descobrirEImportarCatalogoWVetro } from '../lib/wvetroCatalogoCompletoServer'
import {
  mapearReferenciasComponentesExatas,
  materializarReferenciasTipologiasWVetroPendentes,
  processarBaseTecnicaWVetroDia,
  resumoBaseTecnicaWVetro,
  sincronizarCatalogoEsquadriasWVetro,
  sincronizarCustosProdutosWVetro,
} from '../lib/wvetroBaseTecnicaServer'
import { sincronizarLinhasApiWVetro } from '../lib/wvetroAuditoriaServer'
import { supabaseAdmin } from '../lib/supabaseAdmin'

function dataLocal(offsetDias = 0) {
  const agora = new Date()
  const base = new Date(agora.getTime() + offsetDias * 86400000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base)
  const valor = Object.fromEntries(partes.map(p => [p.type, p.value]))
  return valor.year + '-' + valor.month + '-' + valor.day
}

async function resolverPendencias(limite = 200, concorrencia = 5) {
  const { data: pendencias, error } = await supabaseAdmin
    .from('wvetro_base_tecnica_pendencias')
    .select('*')
    .eq('status', 'pendente')
    .order('data', { ascending: true })
    .limit(limite)
  if (error) throw error

  async function processar(p:any) {
    const tentativas = Number(p.tentativas || 0) + 1
    try {
      const resultado = await processarBaseTecnicaWVetroDia(String(p.data))
      const agora = new Date().toISOString()
      const { error: erroUpdate } = await supabaseAdmin
        .from('wvetro_base_tecnica_pendencias')
        .update({ status: 'resolvida', resultado, tentativas, resolvido_em: agora, atualizado_em: agora })
        .eq('id', p.id)
        .eq('status', 'pendente')
      if (erroUpdate) throw erroUpdate
      console.log('[WVETRO][PENDENCIA][OK]', p.data, JSON.stringify(resultado))
      return { data: p.data, ok: true, resultado }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Falha ao reprocessar.'
      await supabaseAdmin
        .from('wvetro_base_tecnica_pendencias')
        .update({ erro: mensagem, tentativas, atualizado_em: new Date().toISOString() })
        .eq('id', p.id)
      console.error('[WVETRO][PENDENCIA][ERRO]', p.data, mensagem)
      return { data: p.data, ok: false, erro: mensagem }
    }
  }

  const resultados:any[] = []
  const lista = pendencias || []
  for (let i = 0; i < lista.length; i += concorrencia) {
    const lote = lista.slice(i, i + concorrencia)
    const feitos = await Promise.all(lote.map(processar))
    resultados.push(...feitos)
    console.log('[WVETRO][PENDENCIA][LOTE]', JSON.stringify({
      concluidas: Math.min(i + lote.length, lista.length),
      totalSelecionado: lista.length,
    }))
  }

  const { count: restantes } = await supabaseAdmin
    .from('wvetro_base_tecnica_pendencias')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')

  return { processadas: resultados.length, restantes: restantes || 0, resultados }
}

async function verificarPortaGiroSuprema() {
  const [{ data: refs, error: e1 }, { data: tips, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('wvetro_referencias_tipologias')
      .select('id,linha_raw,modelo_raw,tipologia_atlas_id,ultimo_visto,ocorrencias')
      .ilike('linha_raw', '%Suprema%')
      .ilike('modelo_raw', '%Giro%')
      .order('modelo_raw', { ascending: true }),
    supabaseAdmin
      .from('tipologias')
      .select('id,label,linha_origem_wvetro,modelo_origem_wvetro,ativo')
      .ilike('linha_origem_wvetro', '%Suprema%')
      .or('label.ilike.%Giro%,modelo_origem_wvetro.ilike.%Giro%')
      .order('label', { ascending: true }),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return { referencias: refs || [], tipologias: tips || [] }
}

async function registrarMemoriaIA(payload:any) {
  const { data: contexto } = await supabaseAdmin
    .from('agente_memorias')
    .select('empresa_id,usuario_id')
    .not('empresa_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!contexto?.empresa_id) {
    console.warn('[WVETRO] memória IA não registrada: empresa não encontrada')
    return
  }
  const { error } = await supabaseAdmin.from('agente_memorias').insert({
    empresa_id: contexto.empresa_id,
    usuario_id: contexto.usuario_id || null,
    chave: 'atlas_operacional:v1:wvetro',
    valor: JSON.stringify(payload),
  })
  if (error) console.warn('[WVETRO] memória IA não registrada:', error.message)
}

async function main() {
  const hoje = dataLocal(0)
  console.log('[WVETRO] início sync one-time', hoje)

  const resumoAntes = await resumoBaseTecnicaWVetro()
  console.log('[WVETRO] resumo antes', JSON.stringify(resumoAntes))

  const linhas = await sincronizarLinhasApiWVetro()
  console.log('[WVETRO] linhas', JSON.stringify(linhas))

  const [perfis, acessorios, esquadrias] = await Promise.all([
    descobrirEImportarCatalogoWVetro('P'),
    descobrirEImportarCatalogoWVetro('A'),
    sincronizarCatalogoEsquadriasWVetro(),
  ])
  console.log('[WVETRO] catalogos', JSON.stringify({ perfis, acessorios, esquadrias }))

  const hojeResultado = await processarBaseTecnicaWVetroDia(hoje)
  console.log('[WVETRO] hoje', JSON.stringify(hojeResultado))

  const pendencias = await resolverPendencias(200, 5)
  console.log('[WVETRO] pendencias', JSON.stringify({ processadas: pendencias.processadas, restantes: pendencias.restantes }))

  const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
  const mapeamento = await mapearReferenciasComponentesExatas()
  const custos = await sincronizarCustosProdutosWVetro()
  const resumoDepois = await resumoBaseTecnicaWVetro()
  const portaGiroSuprema = await verificarPortaGiroSuprema()

  console.log('[WVETRO] consolidacao', JSON.stringify({ tipologias, mapeamento, custos }))
  console.log('[WVETRO] resumo depois', JSON.stringify(resumoDepois))
  console.log('[WVETRO] porta giro suprema', JSON.stringify(portaGiroSuprema))

  await registrarMemoriaIA({
    versao: 1,
    dominio: 'wvetro',
    tipo: 'sincronizacao_manual_completa',
    periodo: { inicio: hoje, fim: hoje },
    catalogos: { linhas, perfis, acessorios, esquadrias },
    hoje: hojeResultado,
    pendencias: { processadas: pendencias.processadas, restantes: pendencias.restantes },
    resumo: resumoDepois,
    porta_giro_suprema: portaGiroSuprema,
    evidencia: 'observado',
    registrado_em: new Date().toISOString(),
  })

  console.log('[WVETRO] fim sync one-time')
}

main().catch(err => {
  console.error('[WVETRO] FALHA', err)
  process.exit(1)
})
