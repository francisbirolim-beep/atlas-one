import { supabase } from '@/lib/supabase'
import { coordenadasEmTexto, localizacaoRegistradaNaObra } from '@/lib/enderecoObra'
import type { Prospeccao } from '@/lib/prospeccao'

/**
 * Registro adicional APENAS para leitura no mapa. Não cria prospecções, obras
 * nem clientes; o vínculo comercial continua sendo sempre o ID da obra.
 */
export type RegistroMapaComercial = Prospeccao & {
  origem_mapa?: 'pedido_orcamento'
  href_mapa?: string
}

export type ObraGpsComercial = {
  id: string
  cliente_id: string | null
  nome: string
  bairro?: string | null
  cidade?: string | null
  endereco?: string | null
  numero_endereco?: string | null
  observacoes?: string | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at?: string | null
  clientes?: { nome?: string | null } | Array<{ nome?: string | null }> | null
}

const PAGINA = 400
const LIMITE = 20000

function posicaoConfirmada(obra: ObraGpsComercial) {
  // Só GPS efetivamente conferido pelo usuário. Uma localização rejeitada não
  // deve reaparecer por engano como pino comercial.
  if (!/^Localização conferida:\s*Sim\s*$/mi.test(obra.observacoes || '')) return null
  const coordenadas = coordenadasEmTexto(localizacaoRegistradaNaObra(obra.observacoes))
  if (!coordenadas) return null
  const [latitude, longitude] = coordenadas.split(',').map(Number)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

/** Retorna apenas obras que têm GPS confirmado; não faz geocodificação estimada. */
export async function listarObrasGpsComerciais(): Promise<{ obras: ObraGpsComercial[]; aviso: string | null }> {
  const obras: ObraGpsComercial[] = []
  for (let inicio = 0; inicio < LIMITE; inicio += PAGINA) {
    const { data, error } = await supabase.from('obras')
      .select('id,cliente_id,nome,bairro,cidade,endereco,numero_endereco,observacoes,criado_por_id,criado_por_nome,created_at,clientes(nome)')
      .ilike('observacoes', '%Localização:%')
      .order('id', { ascending: true })
      .range(inicio, inicio + PAGINA - 1)
    if (error) return { obras: [], aviso: 'Não foi possível consultar as obras com GPS: ' + error.message }
    const pagina = (data || []) as ObraGpsComercial[]
    obras.push(...pagina.filter(obra => !!posicaoConfirmada(obra)))
    if (pagina.length < PAGINA) return { obras, aviso: null }
  }
  return { obras: [], aviso: 'Mais de 20 mil obras com localização. Amplie a consulta antes de confiar nos totais do mapa.' }
}

function nomeCliente(obra: ObraGpsComercial) {
  const cliente = Array.isArray(obra.clientes) ? obra.clientes[0] : obra.clientes
  return cliente?.nome || 'Cliente da obra'
}

function registroDaObra(obra: ObraGpsComercial, posicao: { latitude: number; longitude: number }): RegistroMapaComercial {
  const endereco = [obra.endereco, obra.numero_endereco].filter(Boolean).join(', ')
  const data = obra.created_at || new Date(0).toISOString()
  return {
    id: 'obra:' + obra.id,
    obra_id: obra.id,
    cliente_id: obra.cliente_id,
    nome_cliente: nomeCliente(obra),
    nome_obra: obra.nome,
    cidade: obra.cidade || null,
    bairro: obra.bairro || null,
    endereco: endereco || null,
    latitude: posicao.latitude,
    longitude: posicao.longitude,
    interesses: [],
    temperatura: 'frio',
    status: obra.cliente_id ? 'convertido' : 'nova',
    responsavel_id: obra.criado_por_id || '',
    responsavel_nome: obra.criado_por_nome || '',
    status_atualizado_em: data,
    created_at: data,
    updated_at: data,
    origem_mapa: 'pedido_orcamento',
    href_mapa: obra.cliente_id ? '/clientes/' + encodeURIComponent(obra.cliente_id) : undefined,
  }
}

/**
 * Uma obra com GPS vinda de orçamento não duplica um pino de prospecção com
 * o mesmo obra_id. Sua coordenada conferida prevalece para essa mesma obra.
 * Clientes com duas obras distintas continuam com dois pinos independentes.
 */
export function integrarObrasNoMapa(
  prospeccoes: Prospeccao[],
  obras: ObraGpsComercial[],
): RegistroMapaComercial[] {
  const resultado: RegistroMapaComercial[] = prospeccoes.map(p => ({ ...p }))
  const porObra = new Map<string, number>()
  resultado.forEach((p, index) => {
    if (p.obra_id && !porObra.has(p.obra_id)) porObra.set(p.obra_id, index)
  })
  for (const obra of obras) {
    const posicao = posicaoConfirmada(obra)
    if (!posicao) continue
    const indice = porObra.get(obra.id)
    if (indice !== undefined) {
      const anterior = resultado[indice]
      resultado[indice] = {
        ...anterior,
        ...posicao,
        bairro: anterior.bairro || obra.bairro,
        cidade: anterior.cidade || obra.cidade,
        endereco: anterior.endereco || obra.endereco,
      }
      continue
    }
    porObra.set(obra.id, resultado.length)
    resultado.push(registroDaObra(obra, posicao))
  }
  return resultado
}
