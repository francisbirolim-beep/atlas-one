import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type TipoMelhoriaAtlas = 'bug' | 'melhoria' | 'ideia'
export type RiscoMelhoriaAtlas = 'nao_avaliado' | 'baixo' | 'medio' | 'alto' | 'critico'
export type UrgenciaMelhoriaAtlas = 'baixa' | 'media' | 'alta' | 'critica'

export type UsuarioMelhoriaAtlas = {
  id: string
  nome?: string | null
  role?: string | null
  empresa_id: string
}

export type EntradaMelhoriaAtlas = {
  tipo?: string
  titulo?: string
  descricao?: string
  tela?: string
  area?: string
  resultado_atual?: string
  resultado_esperado?: string
  impacto?: string
  urgencia?: string
  risco_sugerido?: string
  exige_aprovacao?: boolean
  justificativa_risco?: string
  recomendacao?: string
  origem?: string
  contexto?: Record<string, unknown>
}

const TIPOS = new Set<TipoMelhoriaAtlas>(['bug', 'melhoria', 'ideia'])
const URGENCIAS = new Set<UrgenciaMelhoriaAtlas>(['baixa', 'media', 'alta', 'critica'])
const RISCOS = new Set<RiscoMelhoriaAtlas>(['baixo', 'medio', 'alto', 'critico'])

function texto(valor: unknown, max = 4000) {
  return String(valor || '').trim().slice(0, max)
}

function semAcentos(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizar(valor: string) {
  return semAcentos(valor.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function classificarRiscoPorTexto(base: string): { risco: RiscoMelhoriaAtlas; motivo: string } {
  const t = normalizar(base)

  if (/vazamento|senha|credencial|invas|hack|seguranc|lgpd|dados pessoais|excluir dados|perda de dados/.test(t)) {
    return { risco: 'critico', motivo: 'Envolve segurança, privacidade ou risco de perda/exposição de dados.' }
  }

  if (/financeir|pagamento|recebimento|boleto|pix|cartao|preco|custo|margem|permiss|acesso|login|autentic|banco de dados|supabase|migracao|mee|formula|calculo|producao|estoque/.test(t)) {
    return { risco: 'alto', motivo: 'Pode afetar dados sensíveis, regras determinísticas ou operação crítica.' }
  }

  if (/novo fluxo|nova funcao|nova funcionalidade|integracao|automacao|whatsapp|kanban|orcamento|cliente|obra|medicao|relatorio/.test(t)) {
    return { risco: 'medio', motivo: 'Pode alterar fluxo operacional ou comportamento funcional do Atlas.' }
  }

  if (/texto|rotulo|label|cor|espacamento|alinhamento|visual|layout|icone|botao|tamanho|fonte|ortografia/.test(t)) {
    return { risco: 'baixo', motivo: 'A solicitação aparenta ser visual, textual ou de baixo impacto funcional.' }
  }

  return { risco: 'medio', motivo: 'Impacto funcional ainda precisa ser confirmado antes de qualquer alteração.' }
}

function maiorRisco(a: RiscoMelhoriaAtlas, b: RiscoMelhoriaAtlas): RiscoMelhoriaAtlas {
  const ordem: Record<RiscoMelhoriaAtlas, number> = {
    nao_avaliado: 0,
    baixo: 1,
    medio: 2,
    alto: 3,
    critico: 4,
  }
  return ordem[a] >= ordem[b] ? a : b
}

function gerarDedupeKey(tipo: TipoMelhoriaAtlas, titulo: string, tela: string) {
  const base = [tipo, normalizar(titulo), normalizar(tela)].join('|')
  return createHash('sha1').update(base).digest('hex')
}

export async function registrarEventoMelhoria(
  melhoriaId: string,
  empresaId: string,
  usuario: { id?: string | null; nome?: string | null },
  evento: string,
  detalhe: Record<string, unknown> = {},
) {
  await supabaseAdmin.from('atlas_melhorias_eventos').insert({
    melhoria_id: melhoriaId,
    empresa_id: empresaId,
    usuario_id: usuario.id || null,
    usuario_nome: usuario.nome || null,
    evento,
    detalhe,
  })
}
export async function registrarMelhoriaAtlas(
  usuario: UsuarioMelhoriaAtlas,
  entrada: EntradaMelhoriaAtlas,
) {
  const tipoEntrada = texto(entrada.tipo, 30) as TipoMelhoriaAtlas
  const tipo: TipoMelhoriaAtlas = TIPOS.has(tipoEntrada) ? tipoEntrada : 'melhoria'
  const titulo = texto(entrada.titulo, 180) || (tipo === 'bug' ? 'Defeito relatado no Atlas' : 'Melhoria sugerida no Atlas')
  const descricao = texto(entrada.descricao, 6000)
  if (!descricao) return { erro: 'Descrição da melhoria vazia.' }

  const tela = texto(entrada.tela, 300)
  const area = texto(entrada.area, 120)
  const resultadoAtual = texto(entrada.resultado_atual, 3000)
  const resultadoEsperado = texto(entrada.resultado_esperado, 3000)
  const impacto = texto(entrada.impacto, 1500)
  const justificativaIA = texto(entrada.justificativa_risco, 1800)
  const recomendacao = texto(entrada.recomendacao, 1800)
  const urgenciaEntrada = texto(entrada.urgencia, 20) as UrgenciaMelhoriaAtlas
  const urgencia: UrgenciaMelhoriaAtlas = URGENCIAS.has(urgenciaEntrada) ? urgenciaEntrada : 'media'

  const riscoTexto = classificarRiscoPorTexto([
    titulo,
    descricao,
    tela,
    area,
    resultadoAtual,
    resultadoEsperado,
    impacto,
  ].join(' '))
  const riscoSugeridoEntrada = texto(entrada.risco_sugerido, 20) as RiscoMelhoriaAtlas
  const riscoSugerido = RISCOS.has(riscoSugeridoEntrada) ? riscoSugeridoEntrada : 'nao_avaliado'
  const risco = maiorRisco(riscoTexto.risco, riscoSugerido)
  const exigeAprovacao = risco !== 'baixo'
  const justificativaRisco = [justificativaIA, riscoTexto.motivo].filter(Boolean).join(' ')

  const dedupeKey = gerarDedupeKey(tipo, titulo, tela)
  const { data: existente } = await supabaseAdmin
    .from('atlas_melhorias')
    .select('id,numero,titulo,status,relatos_count')
    .eq('empresa_id', usuario.empresa_id)
    .eq('dedupe_key', dedupeKey)
    .not('status', 'in', '("publicado","rejeitado")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) {
    const novoCount = Number(existente.relatos_count || 1) + 1
    await supabaseAdmin
      .from('atlas_melhorias')
      .update({
        relatos_count: novoCount,
        impacto: impacto || undefined,
        urgencia,
      })
      .eq('id', existente.id)
      .eq('empresa_id', usuario.empresa_id)

    await registrarEventoMelhoria(existente.id, usuario.empresa_id, usuario, 'relato_repetido', {
      descricao,
      tela: tela || null,
      impacto: impacto || null,
      urgencia,
    })

    return {
      ok: true,
      duplicado: true,
      id: existente.id,
      numero: existente.numero,
      titulo: existente.titulo,
      status: existente.status,
      relatos_count: novoCount,
      mensagem: 'Esse ponto já estava registrado. Somei este relato ao item #' + existente.numero + '.',
    }
  }
  const statusInicial = exigeAprovacao ? 'aguardando_aprovacao' : 'solucao_proposta'
  const { data: criada, error } = await supabaseAdmin
    .from('atlas_melhorias')
    .insert({
      empresa_id: usuario.empresa_id,
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome || null,
      tipo,
      titulo,
      descricao,
      tela: tela || null,
      area: area || null,
      resultado_atual: resultadoAtual || null,
      resultado_esperado: resultadoEsperado || null,
      impacto: impacto || null,
      urgencia,
      status: statusInicial,
      risco,
      exige_aprovacao: exigeAprovacao,
      justificativa_risco: justificativaRisco || null,
      analise_ia: {
        risco_sugerido_pela_ia: riscoSugerido === 'nao_avaliado' ? null : riscoSugerido,
        risco_final: risco,
        recomendacao: recomendacao || null,
        regra: exigeAprovacao
          ? 'Exige aprovação humana antes de desenvolvimento.'
          : 'Pode ser preparado como alteração de baixo risco; publicação continua exigindo validação.',
      },
      aprovacao_status: 'pendente',
      origem: texto(entrada.origem, 80) || 'atlas_ia',
      dedupe_key: dedupeKey,
      contexto_json: entrada.contexto || {},
    })
    .select('id,numero,titulo,tipo,status,risco,exige_aprovacao,created_at')
    .single()

  if (error || !criada) return { erro: error?.message || 'Não foi possível registrar a melhoria.' }

  await registrarEventoMelhoria(criada.id, usuario.empresa_id, usuario, 'criado', {
    origem: texto(entrada.origem, 80) || 'atlas_ia',
    tipo,
    risco,
    exige_aprovacao: exigeAprovacao,
  })

  return {
    ok: true,
    duplicado: false,
    ...criada,
    mensagem: exigeAprovacao
      ? 'Registrei como #' + criada.numero + '. Pela triagem, exige aprovação antes de desenvolvimento.'
      : 'Registrei como #' + criada.numero + '. A triagem marcou como baixo risco; pode seguir para preparação, mas publicação continua sujeita a validação.',
  }
}