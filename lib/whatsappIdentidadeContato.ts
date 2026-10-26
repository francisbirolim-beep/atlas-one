export type ContatoDiretorio = {
  whatsapp_canal_id: string | null
  telefone: string | null
  contato_jid?: string | null
  nome?: string | null
  nome_verificado?: string | null
}

export type CadastroCliente = {
  id: string
  nome: string
  whatsapp?: string | null
  telefone?: string | null
}

export type ConversaIdentificavel = {
  id: string
  telefone: string
  whatsapp_canal_id?: string | null
  whatsapp_chat_tipo?: string | null
  contato_nome?: string | null
  cliente_id?: string | null
}

export function normalizarNumeroContato(valor?: string | null): string {
  const numero = String(valor || '').replace(/\D/g, '')
  if (numero.length === 10 || numero.length === 11) return '55' + numero
  if (numero.startsWith('55') && (numero.length === 12 || numero.length === 13)) return numero
  return numero
}

export function nomeDePessoa(valor?: string | null): string {
  const nome = String(valor || '').trim()
  if (!nome || !/[A-Za-zÀ-ÿ]/.test(nome)) return ''
  return nome
}

export function identificarConversasWhatsApp<T extends ConversaIdentificavel>(
  conversas: T[],
  diretorio: ContatoDiretorio[],
  clientes: CadastroCliente[],
): Array<T & {
  contato_whatsapp_salvo: boolean
  cliente_candidato_id: string | null
  cliente_candidato_nome: string | null
}> {
  const nomePorCanalNumero = new Map<string,string>()
  for (const contato of diretorio) {
    if (!contato.whatsapp_canal_id) continue
    const numero = normalizarNumeroContato(contato.telefone || contato.contato_jid?.split('@')[0])
    if (!numero) continue
    const chave = contato.whatsapp_canal_id + ':' + numero
    const nome = nomeDePessoa(contato.nome) || nomeDePessoa(contato.nome_verificado)
    if (!nomePorCanalNumero.has(chave) || (!nomeDePessoa(nomePorCanalNumero.get(chave)) && nome)) {
      nomePorCanalNumero.set(chave, nome)
    }
  }
  const clientePorNumero = new Map<string, CadastroCliente>()
  const clientePorId = new Map<string, CadastroCliente>()
  for (const cliente of clientes) {
    clientePorId.set(cliente.id, cliente)
    for (const valor of [cliente.whatsapp, cliente.telefone]) {
      const numero = normalizarNumeroContato(valor)
      if (numero && !clientePorNumero.has(numero)) clientePorNumero.set(numero, cliente)
    }
  }

  return conversas.map(conversa => {
    if (conversa.whatsapp_chat_tipo === 'grupo') return {
      ...conversa, contato_whatsapp_salvo: false,
      cliente_candidato_id: null, cliente_candidato_nome: null,
    }
    const numero = normalizarNumeroContato(conversa.telefone)
    const nomeSalvo = nomePorCanalNumero.get((conversa.whatsapp_canal_id || '') + ':' + numero) || ''
    const cadastrado = clientePorNumero.get(numero)
    const vinculado = conversa.cliente_id ? clientePorId.get(conversa.cliente_id) : null
    const nome = nomeSalvo
      || nomeDePessoa(vinculado?.nome)
      || nomeDePessoa(cadastrado?.nome)
      || nomeDePessoa(conversa.contato_nome)
      || conversa.contato_nome
      || conversa.telefone

    return {
      ...conversa,
      contato_nome: nome,
      contato_whatsapp_salvo: Boolean(nomeSalvo),
      cliente_candidato_id: !conversa.cliente_id ? cadastrado?.id || null : null,
      cliente_candidato_nome: !conversa.cliente_id ? cadastrado?.nome?.trim() || null : null,
    }
  })
}
