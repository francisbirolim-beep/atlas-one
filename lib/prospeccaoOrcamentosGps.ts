import { supabase } from '@/lib/supabase'
import { coordenadasEmTexto, localizacaoRegistradaNaObra } from '@/lib/enderecoObra'
import type { Prospeccao } from '@/lib/prospeccao'
import type { EtapaComercialProspeccao } from '@/lib/prospeccaoEtapas'

// Registro somente de leitura para o mapa: não cria prospecção nem altera o orçamento.
export type RegistroMapaOrcamento = Prospeccao & {
  origem_mapa: 'pedido_orcamento'
  orcamento_id_mapa: string
}

type ObraGps = {
  id: string
  cliente_id: string | null
  nome: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  observacoes: string | null
  criado_por_id: string | null
  criado_por_nome: string | null
}

type OrcamentoDaObra = {
  id: string
  obra_id: string | null
  status: string | null
  cliente_nome: string | null
  criado_por_id: string | null
  criado_por_nome: string | null
  created_at: string | null
}

const PAGINA = 400
const LIMITE = 20000

export function gpsConfirmadoDaObra(observacoes: string | null | undefined) {
  // O pedido só utiliza o GPS após confirmação explícita no mapa.
  // Coordenadas rejeitadas e texto livre nunca viram pinos.
  if (!/(^|\n)Localização conferida: Sim(?:\r?\n|$)/i.test(observacoes || '')) return null
  const texto = localizacaoRegistradaNaObra(observacoes)
  const coordenadas = coordenadasEmTexto(texto)
  if (!coordenadas) return null
  const [latitude, longitude] = coordenadas.split(',').map(Number)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export function consolidarRegistrosMapa(
  prospeccoes: Prospeccao[],
  orcamentosGps: RegistroMapaOrcamento[],
): Prospeccao[] {
  // Uma obra já geolocalizada na Prospecção não recebe um segundo pino
  // quando o orçamento é criado. A etapa comercial será atualizada pelo vínculo obra_id.
  const obrasComProspeccaoGeolocalizada = new Set(
    prospeccoes.filter(p => p.obra_id && p.latitude != null && p.longitude != null &&
      Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) &&
      Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180,
    ).map(p => p.obra_id),
  )
  return [...prospeccoes, ...orcamentosGps.filter(o => !obrasComProspeccaoGeolocalizada.has(o.obra_id))]
}

export async function listarOrcamentosGpsParaMapa(): Promise<{
  registros: RegistroMapaOrcamento[]
  etapas: Record<string, EtapaComercialProspeccao>
  aviso: string | null
}> {
  const vazio = (aviso: string | null) => ({
    registros: [] as RegistroMapaOrcamento[],
    etapas: {} as Record<string, EtapaComercialProspeccao>,
    aviso,
  })

  // Acesso sempre pela sessão atual, sujeito ao RLS de obras, orçamentos e vendas.
  // Não usa service_role, não consulta endereços de clientes como se fossem obras.
  const obras: ObraGps[] = []
  for (let inicio = 0; inicio < LIMITE; inicio += PAGINA) {
    const { data, error } = await supabase.from('obras')
      .select('id,cliente_id,nome,endereco,bairro,cidade,observacoes,criado_por_id,criado_por_nome')
      .ilike('observacoes', '%Localização:%')
      .order('id')
      .range(inicio, inicio + PAGINA - 1)
    if (error) return vazio('Não foi possível consultar as obras com GPS do Pedido de Orçamento.')
    const lote = (data || []) as ObraGps[]
    obras.push(...lote.filter(o => gpsConfirmadoDaObra(o.observacoes) != null))
    if (lote.length < PAGINA) break
    if (inicio + PAGINA >= LIMITE) return vazio('Há mais de 20.000 obras com GPS. Não foi possível carregar a lista completa.')
  }
  if (!obras.length) return vazio(null)

  const porObra = new Map<string, OrcamentoDaObra>()
  const obraPorOrcamento = new Map<string, string>()
  const vendasAtivas = new Set<string>()
  let aviso: string | null = null

  for (let posicao = 0; posicao < obras.length; posicao += 150) {
    const ids = obras.slice(posicao, posicao + 150).map(o => o.id)
    const orcamentoIds: string[] = []
    for (let inicio = 0; inicio < LIMITE; inicio += PAGINA) {
      const { data, error } = await supabase.from('orcamentos')
        .select('id,obra_id,status,cliente_nome,criado_por_id,criado_por_nome,created_at')
        .in('obra_id', ids)
        .order('created_at', { ascending: false })
        .order('id')
        .range(inicio, inicio + PAGINA - 1)
      if (error) return vazio('Não foi possível confirmar os pedidos de orçamento das obras com GPS.')
      const lote = (data || []) as OrcamentoDaObra[]
      for (const orcamento of lote) {
        if (!orcamento.obra_id || String(orcamento.status || '').toLowerCase() === 'recusado') continue
        obraPorOrcamento.set(orcamento.id, orcamento.obra_id)
        orcamentoIds.push(orcamento.id)
        if (!porObra.has(orcamento.obra_id)) porObra.set(orcamento.obra_id, orcamento)
      }
      if (lote.length < PAGINA) break
      if (inicio + PAGINA >= LIMITE) return vazio('Muitos orçamentos vinculados; refine o período antes de conferir o mapa.')
    }
    for (let inicio = 0; inicio < LIMITE; inicio += PAGINA) {
      const { data, error } = await supabase.from('vendas_obras')
        .select('id,obra_id')
        .in('obra_id', ids)
        .eq('status', 'ativa')
        .is('excluida_em', null)
        .order('id')
        .range(inicio, inicio + PAGINA - 1)
      if (error) {
        aviso = 'Não foi possível verificar todas as vendas. Confira a situação comercial dos pinos.'
        break
      }
      const lote = data || []
      for (const venda of lote) if (venda.obra_id) vendasAtivas.add(venda.obra_id)
      if (lote.length < PAGINA) break
      if (inicio + PAGINA >= LIMITE) {
        aviso = 'Há mais vendas do que o limite de consulta; o estágio de alguns pinos pode estar incompleto.'
        break
      }
    }
    // Algumas vendas antigas guardam o orcamento_id, mas não o obra_id.
    // Consultar também o vínculo da proposta impede que uma venda ativa
    // permaneça incorretamente com o pino de orçamento.
    for (let posOrc = 0; posOrc < orcamentoIds.length; posOrc += 150) {
      const loteIds = orcamentoIds.slice(posOrc, posOrc + 150)
      for (let inicio = 0; inicio < LIMITE; inicio += PAGINA) {
        const { data, error } = await supabase.from('vendas_obras')
          .select('id,orcamento_id')
          .in('orcamento_id', loteIds)
          .eq('status', 'ativa')
          .is('excluida_em', null)
          .order('id')
          .range(inicio, inicio + PAGINA - 1)
        if (error) {
          aviso = 'Não foi possível conferir todas as vendas vinculadas ao orçamento.'
          break
        }
        const lote = data || []
        for (const venda of lote) {
          const obraId = obraPorOrcamento.get(venda.orcamento_id)
          if (obraId) vendasAtivas.add(obraId)
        }
        if (lote.length < PAGINA) break
        if (inicio + PAGINA >= LIMITE) {
          aviso = 'Limite de vendas por orçamento atingido; alguns pinos podem estar incompletos.'
          break
        }
      }
    }
  }

  const registros: RegistroMapaOrcamento[] = []
  const etapas: Record<string, EtapaComercialProspeccao> = {}
  for (const obra of obras) {
    const orcamento = porObra.get(obra.id)
    const gps = gpsConfirmadoDaObra(obra.observacoes)
    if (!orcamento || !gps) continue
    const id = 'orcamento-mapa-' + obra.id
    registros.push({
      id,
      origem_mapa: 'pedido_orcamento',
      orcamento_id_mapa: orcamento.id,
      nome_cliente: orcamento.cliente_nome || 'Cliente não informado',
      nome_obra: obra.nome || null,
      cidade: obra.cidade,
      bairro: obra.bairro,
      endereco: obra.endereco,
      latitude: gps.latitude,
      longitude: gps.longitude,
      interesses: [],
      temperatura: 'frio',
      status: 'convertido',
      responsavel_id: orcamento.criado_por_id || obra.criado_por_id || '',
      responsavel_nome: orcamento.criado_por_nome || obra.criado_por_nome || 'Não informado',
      cliente_id: obra.cliente_id,
      obra_id: obra.id,
      status_atualizado_em: orcamento.created_at || '',
      created_at: orcamento.created_at || '',
      updated_at: orcamento.created_at || '',
    })
    etapas[id] = vendasAtivas.has(obra.id) ? 'venda' : 'orcamento'
  }
  return { registros, etapas, aviso }
}
