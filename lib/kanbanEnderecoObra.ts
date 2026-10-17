import { coordenadasEmTexto, decomporEnderecoObra, linkRotaObra, localizacaoRegistradaNaObra } from './enderecoObra'

// Leitura do cadastro da OBRA, e não do endereço residencial do cliente.
// Mantém a compatibilidade com registros que guardam número e CEP em colunas
// separadas e com registros que os guardam dentro de `endereco`.
export type ObraEnderecoKanban = {
  id: string
  nome?: string | null
  endereco?: string | null
  numero_endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  observacoes?: string | null
}

export function enderecoObraNoKanban(obra?: ObraEnderecoKanban | null) {
  if (!obra) return { texto: '', localizacaoConfirmada: null, localizacaoPendente: null, mapaConferencia: null, rota: null }
  const { rua, numero, cep } = decomporEnderecoObra(obra.endereco, obra.numero_endereco, obra.cep)
  const texto = [
    [rua, numero].filter(Boolean).join(', '),
    obra.bairro?.trim(),
    obra.cidade?.trim(),
    cep ? `CEP ${cep}` : '',
  ].filter(Boolean).join(' · ')
  // GPS rejeitado ou sem confirmação nunca recebe prioridade sobre o endereço.
  const localizacaoConfirmada = (obra.observacoes || '').includes('Localização conferida: Sim')
    ? coordenadasEmTexto(localizacaoRegistradaNaObra(obra.observacoes))
    : null
  const localizacaoPendente = !localizacaoConfirmada ? coordenadasEmTexto(localizacaoRegistradaNaObra(obra.observacoes)) : null
  // Pontos antigos podem estar salvos sem resposta Sim/Não. Permitir conferir no mapa
  // não equivale a marcá-los como validados nem a criar uma rota GPS.
  const mapaConferencia = localizacaoPendente
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localizacaoPendente)}`
    : null
  const rota = (localizacaoConfirmada || rua)
    ? linkRotaObra({ coordenadas: localizacaoConfirmada, endereco: [rua, numero].filter(Boolean).join(', '), bairro: obra.bairro, cidade: obra.cidade })
    : null
  return { texto, localizacaoConfirmada, localizacaoPendente, mapaConferencia, rota }
}
