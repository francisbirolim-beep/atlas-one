import type { Prospeccao, StatusProspeccao } from '@/lib/prospeccao'
import type { EtapaComercialProspeccao } from '@/lib/prospeccaoEtapas'

export type ClassificacaoMapa = 'identificada' | 'sem_contato' | 'visitada' | 'andamento' | 'convertida' | 'orcamento' | 'venda' | 'sem_interesse'

export const GRUPOS_MAPA: { id: ClassificacaoMapa; titulo: string; cor: string; explicacao: string }[] = [
  { id: 'identificada', titulo: 'Nova obra', cor: '#2563eb', explicacao: 'Obra identificada, ainda sem contato registrado.' },
  { id: 'sem_contato', titulo: 'Tentando contato', cor: '#e11d48', explicacao: 'Obra já identificada, mas ainda sem contato conseguido.' },
  { id: 'visitada', titulo: 'Visitada / contato feito', cor: '#0891b2', explicacao: 'Visita ou contato já realizado.' },
  { id: 'andamento', titulo: 'Em andamento', cor: '#d97706', explicacao: 'Aguardando retorno, projeto ou visita; oportunidade qualificada.' },
  { id: 'convertida', titulo: 'Convertida em cliente', cor: '#15803d', explicacao: 'Cliente cadastrado, ainda sem orçamento confirmado nesta obra.' },
  { id: 'orcamento', titulo: 'Com orçamento', cor: '#e6a500', explicacao: 'Existe orçamento vinculado à obra prospectada.' },
  { id: 'venda', titulo: 'Venda confirmada', cor: '#7c3aed', explicacao: 'Orçamento da obra registrado como venda confirmada.' },
  { id: 'sem_interesse', titulo: 'Sem interesse', cor: '#64748b', explicacao: 'Registro marcado como sem interesse comercial.' },
]

export function classificacaoDoStatus(status: StatusProspeccao): ClassificacaoMapa {
  if (status === 'nova') return 'identificada'
  if (status === 'tentando_contato') return 'sem_contato'
  if (status === 'contato_realizado') return 'visitada'
  if (status === 'convertido') return 'convertida'
  if (status === 'sem_interesse') return 'sem_interesse'
  return 'andamento'
}

export interface PontoProspeccao {
  registro: Prospeccao
  latitude: number
  longitude: number
  classificacao: ClassificacaoMapa
}

export interface GrupoBairro {
  chave: string
  nome: string
  cidade: string
  latitude: number
  longitude: number
  pontos: PontoProspeccao[]
}

export function pontosValidos(registros: Prospeccao[], etapas: Record<string, EtapaComercialProspeccao> = {}): PontoProspeccao[] {
  return registros.flatMap(registro => {
    if (registro.latitude == null || registro.longitude == null) return []
    const latitude = Number(registro.latitude)
    const longitude = Number(registro.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return []
    const etapa = etapas[registro.id]
    const classificacao: ClassificacaoMapa = etapa === 'venda' ? 'venda'
      : etapa === 'orcamento' ? 'orcamento' : classificacaoDoStatus(registro.status)
    return [{ registro, latitude, longitude, classificacao }]
  })
}

export function agruparPontosPorBairro(pontos: PontoProspeccao[]): GrupoBairro[] {
  const grupos = new Map<string, GrupoBairro>()
  for (const ponto of pontos) {
    const cidade = ponto.registro.cidade?.trim() || 'Cidade não informada'
    const nome = ponto.registro.bairro?.trim() || 'Bairro não informado'
    const chave = `${cidade.toLocaleLowerCase('pt-BR')}::${nome.toLocaleLowerCase('pt-BR')}`
    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = { chave, nome, cidade, latitude: 0, longitude: 0, pontos: [] }
      grupos.set(chave, grupo)
    }
    grupo.pontos.push(ponto)
    grupo.latitude += ponto.latitude
    grupo.longitude += ponto.longitude
  }
  return [...grupos.values()].map(grupo => ({
    ...grupo,
    latitude: grupo.latitude / grupo.pontos.length,
    longitude: grupo.longitude / grupo.pontos.length,
  })).sort((a, b) => b.pontos.length - a.pontos.length || a.nome.localeCompare(b.nome, 'pt-BR'))
}
