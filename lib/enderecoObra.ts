// Formata o endereço da obra sem interferir no cadastro do cliente.
// CEP fica dentro da coluna endereco já existente; não requer migration.
export function formatarEnderecoObra(rua: string, numero: string, cep: string): string {
  const partes = [rua.trim().replace(/\s+/g, ' '), numero.trim()].filter(Boolean)
  const soDigitos = cep.replace(/\D/g, '')
  const cepFormatado = soDigitos.length === 8
    ? soDigitos.slice(0, 5) + '-' + soDigitos.slice(5)
    : cep.trim()
  const endereco = partes.join(', ')
  return endereco && cepFormatado ? endereco + ' - CEP ' + cepFormatado : endereco
}

export function coordenadasDaObra(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return latitude.toFixed(6) + ',' + longitude.toFixed(6)
}

// Leitura do formato legado usado nos orçamentos, para que o mesmo ponto possa
// ser aberto por outros setores sem criar uma segunda localização por cliente.
export function coordenadasEmTexto(valor?: string | null): string | null {
  const texto = valor?.trim() || ''
  const match = texto.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!match) return null
  return coordenadasDaObra(Number(match[1]), Number(match[2]))
}

export function localizacaoRegistradaNaObra(observacoes?: string | null): string | null {
  const match = (observacoes || '').match(/^Localização:\s*([^\r\n]+)$/mi)
  return coordenadasEmTexto(match?.[1])
}

export function linkRotaObra(dados: { coordenadas?: string | null; endereco?: string | null; bairro?: string | null; cidade?: string | null }): string | null {
  const destino = coordenadasEmTexto(dados.coordenadas) ||
    [dados.endereco, dados.bairro, dados.cidade].map(item => item?.trim()).filter(Boolean).join(', ')
  return destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}` : null
}

// Conserva observações livres. Rejeições são registradas como feedback, mas
// NUNCA viram ponto de navegação válido sem a confirmação humana.
export function registrarFeedbackLocalizacao(
  observacoes: string | null | undefined,
  confirmada?: string | null,
  rejeitada?: string | null,
): string | null {
  const linhas = (observacoes || '').split(/\r?\n/).filter(Boolean)
  const confirmadaValida = coordenadasEmTexto(confirmada)
  const rejeitadaValida = coordenadasEmTexto(rejeitada)
  const localizacaoRegistrada = (linha: string) =>
    linha.startsWith('Localização: ') ? coordenadasEmTexto(linha.slice('Localização: '.length)) : null
  const gpsDesconsiderado = !confirmadaValida && !!rejeitadaValida &&
    linhas.some(linha => localizacaoRegistrada(linha) === rejeitadaValida)
  const semLocalizacaoAntiga = (confirmadaValida || gpsDesconsiderado)
    ? linhas.filter(linha => !localizacaoRegistrada(linha) && linha !== 'Localização conferida: Sim')
    : linhas
  if (confirmadaValida) {
    semLocalizacaoAntiga.push(`Localização: ${confirmadaValida}`)
    if (!semLocalizacaoAntiga.includes('Localização conferida: Sim')) semLocalizacaoAntiga.push('Localização conferida: Sim')
  }
  if (rejeitadaValida) semLocalizacaoAntiga.push(`GPS rejeitado pelo usuário: ${rejeitadaValida}`)
  return semLocalizacaoAntiga.join('\n') || null
}

export function decomporEnderecoObra(endereco?: string | null, numero_endereco?: string | null, cep?: string | null) {
  let rua = (endereco || '').trim()
  let numero = (numero_endereco || '').trim()
  let cepAtual = (cep || '').trim()
  const cepNoEndereco = rua.match(/\s*-\s*CEP\s*(\d{5}-?\d{3})\s*$/i)
  if (cepNoEndereco) {
    cepAtual ||= cepNoEndereco[1]
    rua = rua.slice(0, cepNoEndereco.index).trim()
  }
  if (!numero) {
    const fim = rua.match(/^(.*),\s*(\d+[a-zA-Z]?|S\/?N)\s*$/i)
    if (fim) { rua = fim[1].trim(); numero = fim[2].trim() }
  }
  return { rua, numero, cep: cepAtual }
}

// O número pode estar dentro de endereco (cadastros antigos) ou em coluna própria.
// Não duplica o número e não usa endereço residencial do cliente como endereço da obra.
export function enderecoCompletoObra(obra: {
  endereco?: string | null; numero_endereco?: string | null; cep?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null;
}): string {
  const { rua: ruaOriginal, numero, cep } = decomporEnderecoObra(obra.endereco, obra.numero_endereco, obra.cep)
  let rua = ruaOriginal
  if (numero && rua.toLowerCase().endsWith(', ' + numero.toLowerCase())) rua = rua.slice(0, -(numero.length + 2))
  const partes = [rua, numero, obra.bairro, obra.cidade, obra.uf].filter(v => !!v?.trim())
  const local = partes.join(', ')
  return local && cep && !local.includes(cep) ? `${local} · CEP ${cep}` : local
}
