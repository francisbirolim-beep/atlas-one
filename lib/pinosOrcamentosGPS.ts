import { usuarioAtual } from '@/lib/auth'
import { coordenadasEmTexto, localizacaoRegistradaNaObra } from '@/lib/enderecoObra'
import { buscarMinhaPermissaoProspeccao } from '@/lib/prospeccaoPermissoes'
import { supabase } from '@/lib/supabase'
import type { RegistroMapaGeral, EventoMapaGeral } from '@/lib/mapaGeral'

type ObraGPS = {
  id: string
  nome: string | null
  cidade: string | null
  bairro: string | null
  endereco: string | null
  observacoes: string | null
  criado_por_nome: string | null
}
type OrcamentoGPS = {
  id: string
  obra_id: string | null
  numero: number | null
  cliente_nome: string | null
  cidade: string | null
  criado_por_nome: string | null
  created_at: string | null
  observacoes: string | null
}

function coordenadaRegistrada(texto: string | null | undefined): { lat: number; lng: number } | null {
  const coordenadas = coordenadasEmTexto(localizacaoRegistradaNaObra(texto))
  if (!coordenadas) return null
  const [lat, lng] = coordenadas.split(',').map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function eventoOrcamento(data: string | null): EventoMapaGeral[] {
  const dia = data?.slice(0, 10)
  return dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? [{ tipo: 'orcamento', data: dia }] : []
}

/**
 * Fonte independente para o mapa da Prospecção: lê somente GPS persistido nas
 * obras ou orçamentos, jamais geocodifica endereços nem insere pinos no banco.
 *
 * A criação de orçamento já grava "Localização: lat,lng" na Obra e liga
 * orcamentos.obra_id. Assim o novo orçamento com GPS aparece na próxima leitura,
 * sem duplicar pinos de orçamentos da mesma obra.
 */
export async function listarPinosOrcamentosGPS(): Promise<RegistroMapaGeral[]> {
  const usuario = await usuarioAtual()
  if (!usuario?.empresa_id) throw new Error('Faça login novamente para consultar os locais dos orçamentos.')
  if (usuario.role !== 'master') {
    const permissao = await buscarMinhaPermissaoProspeccao()
    if (!permissao.pode_ver_mapa) return []
  }

  // Consulta direta evita que falhas eventuais de outras fontes do Mapa Geral
  // impeçam a exibição dos pontos de orçamentos existentes.
  const obras: ObraGPS[] = []
  for (let inicio = 0; inicio < 10000; inicio += 500) {
    const { data, error } = await supabase.from('obras')
      .select('id,nome,cidade,bairro,endereco,observacoes,criado_por_nome')
      .eq('empresa_id', usuario.empresa_id)
      .ilike('observacoes', '%Localização:%')
      .order('id', { ascending: true })
      .range(inicio, inicio + 499)
    if (error) throw new Error('Falha na leitura das localizações das obras: ' + error.message)
    const pagina = (data || []) as ObraGPS[]
    obras.push(...pagina)
    if (pagina.length < 500) break
    if (inicio >= 9500) throw new Error('O volume de obras com GPS ultrapassa o limite de leitura.')
  }
  const validas = obras.map(obra => ({ obra, gps: coordenadaRegistrada(obra.observacoes) }))
    .filter((p): p is { obra: ObraGPS; gps: { lat: number; lng: number } } => p.gps !== null)

  const porObra = new Map<string, OrcamentoGPS[]>()
  for (let i = 0; i < validas.length; i += 75) {
    const ids = validas.slice(i, i + 75).map(p => p.obra.id)
    if (!ids.length) continue
    for (let inicio = 0; inicio < 10000; inicio += 500) {
      const { data, error } = await supabase.from('orcamentos')
        .select('id,obra_id,numero,cliente_nome,cidade,criado_por_nome,created_at,observacoes')
        .eq('empresa_id', usuario.empresa_id)
        .in('obra_id', ids)
        .order('id', { ascending: true })
        .range(inicio, inicio + 499)
      if (error) throw new Error('Falha na leitura dos orçamentos vinculados: ' + error.message)
      const pagina = (data || []) as OrcamentoGPS[]
      for (const orcamento of pagina) {
        if (!orcamento.obra_id) continue
        const grupo = porObra.get(orcamento.obra_id) || []
        grupo.push(orcamento)
        porObra.set(orcamento.obra_id, grupo)
      }
      if (pagina.length < 500) break
      if (inicio >= 9500) throw new Error('O volume de orçamentos ultrapassa o limite de leitura.')
    }
  }

  const registros: RegistroMapaGeral[] = validas.flatMap(({ obra, gps }) => {
    const orcamentos = porObra.get(obra.id) || []
    if (!orcamentos.length) return []
    return [{
      id: 'obra:' + obra.id,
      nome: obra.nome || 'Obra com orçamento',
      cliente: orcamentos.find(o => o.cliente_nome)?.cliente_nome || '',
      cidade: obra.cidade || orcamentos.find(o => o.cidade)?.cidade || '',
      bairro: obra.bairro || '',
      endereco: obra.endereco || '',
      vendedor: orcamentos.find(o => o.criado_por_nome)?.criado_por_nome || obra.criado_por_nome || '',
      etapa: 'orcamento' as const,
      lat: gps.lat,
      lng: gps.lng,
      eventos: orcamentos.flatMap(o => eventoOrcamento(o.created_at)),
      href: '/obras/' + encodeURIComponent(obra.id),
      origem: 'obra' as const,
    }]
  })

  // Compatibilidade: orçamentos independentes com GPS gravado diretamente
  // nas suas observações também aparecem, sem inventar coordenadas.
  for (let inicio = 0; inicio < 10000; inicio += 500) {
    const { data, error } = await supabase.from('orcamentos')
      .select('id,obra_id,numero,cliente_nome,cidade,criado_por_nome,created_at,observacoes')
      .eq('empresa_id', usuario.empresa_id)
      .ilike('observacoes', '%Localização:%')
      .order('id', { ascending: true })
      .range(inicio, inicio + 499)
    if (error) throw new Error('Falha na leitura das localizações dos orçamentos: ' + error.message)
    const pagina = (data || []) as OrcamentoGPS[]
    for (const orcamento of pagina) {
      if (orcamento.obra_id && porObra.has(orcamento.obra_id)) continue
      const gps = coordenadaRegistrada(orcamento.observacoes)
      if (!gps) continue
      registros.push({
        id: 'orcamento:' + orcamento.id,
        nome: 'Orçamento ' + (orcamento.numero || orcamento.id.slice(0, 8)),
        cliente: orcamento.cliente_nome || '',
        cidade: orcamento.cidade || '',
        bairro: '',
        vendedor: orcamento.criado_por_nome || '',
        etapa: 'orcamento',
        lat: gps.lat, lng: gps.lng,
        eventos: eventoOrcamento(orcamento.created_at),
        href: '/kanban/comercial?orcamento=' + encodeURIComponent(orcamento.id),
        origem: 'orcamento',
      })
    }
    if (pagina.length < 500) break
    if (inicio >= 9500) throw new Error('O volume de orçamentos com GPS ultrapassa o limite.')
  }
  return registros
}
