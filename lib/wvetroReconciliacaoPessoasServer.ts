import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'

type ClienteAtlas = {
  id: string
  nome: string
  cpf_cnpj: string | null
  whatsapp: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
}

export type ReconciliacaoPessoaStatus =
  | 'vinculado_seguro'
  | 'sugestao_forte'
  | 'revisao'
  | 'divergente'
  | 'novo'
  | 'ignorado_nao_cliente'

export type ReconciliacaoPessoaWVetro = {
  chaveExterna: string
  pessoaId: string | null
  pessoaCodigo: string | null
  nome: string
  cpfCnpj: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  cidade: string | null
  status: ReconciliacaoPessoaStatus
  clienteAtlasId: string | null
  clienteAtlasNome: string | null
  metodo: string | null
  candidatos: Array<{ id: string; nome: string; motivos: string[] }>
  motivos: string[]
}

function texto(valor: unknown) {
  const v = String(valor ?? '').trim()
  return v || null
}

function somenteDigitos(valor: unknown) {
  const v = String(valor ?? '').replace(/\D/g, '')
  return v || null
}

function emailNormalizado(valor: unknown) {
  const v = String(valor ?? '').trim().toLowerCase()
  return v || null
}

function nomeNormalizado(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR')
}

function telefoneEquivalente(a: string | null, b: string | null) {
  if (!a || !b) return false
  const da = somenteDigitos(a)
  const db = somenteDigitos(b)
  if (!da || !db) return false
  if (da === db) return true

  // Tolera presença/ausência do código do país 55, sem ignorar DDD.
  if (da.startsWith('55') && da.slice(2) === db) return true
  if (db.startsWith('55') && db.slice(2) === da) return true
  return false
}

async function buscarClientesAtlas(empresaId: string): Promise<ClienteAtlas[]> {
  const todos: ClienteAtlas[] = []
  const pagina = 1000
  let inicio = 0

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('id,nome,cpf_cnpj,whatsapp,telefone,email,cidade')
      .eq('empresa_id', empresaId)
      .order('id', { ascending: true })
      .range(inicio, inicio + pagina - 1)

    if (error) throw new Error(`Falha ao carregar clientes Atlas para reconciliação: ${error.message}`)

    const lote = (data || []) as ClienteAtlas[]
    todos.push(...lote)
    if (lote.length < pagina) break
    inicio += pagina
  }

  return todos
}

function deduplicarClientes(itens: ClienteAtlas[]) {
  return Array.from(new Map(itens.map(item => [item.id, item])).values())
}

export async function reconciliarPessoasWVetroComClientesAtlas(
  payloadWVetro: unknown,
  empresaId: string,
): Promise<{
  totais: Record<ReconciliacaoPessoaStatus, number>
  itens: ReconciliacaoPessoaWVetro[]
}> {
  const { registros } = transformarPayloadWVetroEmStaging('pessoas', payloadWVetro)
  const clientes = await buscarClientesAtlas(empresaId)
  const itens: ReconciliacaoPessoaWVetro[] = []

  for (const registro of registros) {
    const p = registro.payload
    const eCliente = p.PessoaCliente === true || p.PessoaCliente === 1 || String(p.PessoaCliente).toLowerCase() === 'true'
    const nome = texto(p.PessoaRazaoSocial) || texto(p.PessoaFantasia) || texto(p.PessoaResponsavel) || ''
    const cpfCnpj = somenteDigitos(p.PessoaCPFCNPJ)
    const telefone = texto(p.PessoaFone)
    const celular = texto(p.PessoaCelular)
    const email = emailNormalizado(p.PessoaEmail)
    const cidade = texto(p.CidadeNome)

    const base = {
      chaveExterna: registro.chaveExterna,
      pessoaId: texto(p.PessoaId),
      pessoaCodigo: texto(p.PessoaCodigo),
      nome,
      cpfCnpj,
      telefone,
      celular,
      email,
      cidade,
    }

    if (!eCliente) {
      itens.push({
        ...base,
        status: 'ignorado_nao_cliente',
        clienteAtlasId: null,
        clienteAtlasNome: null,
        metodo: null,
        candidatos: [],
        motivos: ['Pessoa W.Vetro não está marcada como cliente.'],
      })
      continue
    }

    // 1. CPF/CNPJ único é o único match automático desta fase.
    if (cpfCnpj) {
      const porDocumento = clientes.filter(c => somenteDigitos(c.cpf_cnpj) === cpfCnpj)
      if (porDocumento.length === 1) {
        itens.push({
          ...base,
          status: 'vinculado_seguro',
          clienteAtlasId: porDocumento[0].id,
          clienteAtlasNome: porDocumento[0].nome,
          metodo: 'cpf_cnpj_exato',
          candidatos: [{ id: porDocumento[0].id, nome: porDocumento[0].nome, motivos: ['CPF/CNPJ exato e único.'] }],
          motivos: ['CPF/CNPJ exato e único no Atlas.'],
        })
        continue
      }

      if (porDocumento.length > 1) {
        itens.push({
          ...base,
          status: 'divergente',
          clienteAtlasId: null,
          clienteAtlasNome: null,
          metodo: 'cpf_cnpj_duplicado_atlas',
          candidatos: porDocumento.map(c => ({
            id: c.id,
            nome: c.nome,
            motivos: ['Mesmo CPF/CNPJ encontrado em mais de um cliente Atlas.'],
          })),
          motivos: ['CPF/CNPJ não pode gerar vínculo enquanto houver duplicidade no Atlas.'],
        })
        continue
      }
    }

    const porContato = clientes
      .map(cliente => {
        const motivos: string[] = []
        if (telefoneEquivalente(celular, cliente.whatsapp) || telefoneEquivalente(celular, cliente.telefone)) {
          motivos.push('Celular/WhatsApp coincide.')
        }
        if (telefoneEquivalente(telefone, cliente.telefone) || telefoneEquivalente(telefone, cliente.whatsapp)) {
          motivos.push('Telefone coincide.')
        }
        if (email && emailNormalizado(cliente.email) === email) motivos.push('E-mail coincide.')
        if (nome && nomeNormalizado(cliente.nome) === nomeNormalizado(nome)) motivos.push('Nome coincide.')
        if (cidade && nomeNormalizado(cliente.cidade) === nomeNormalizado(cidade)) motivos.push('Cidade coincide.')
        return { cliente, motivos }
      })
      .filter(item => item.motivos.some(m => /Celular|Telefone|E-mail/.test(m)))

    const candidatos = deduplicarClientes(porContato.map(x => x.cliente)).map(cliente => {
      const motivos = Array.from(
        new Set(
          porContato
            .filter(x => x.cliente.id === cliente.id)
            .flatMap(x => x.motivos),
        ),
      )
      return { id: cliente.id, nome: cliente.nome, motivos }
    })

    if (candidatos.length === 1) {
      const candidato = candidatos[0]
      const sinaisContato = candidato.motivos.filter(m => /Celular|Telefone|E-mail/.test(m)).length
      const nomeBate = candidato.motivos.includes('Nome coincide.')
      const cidadeBate = candidato.motivos.includes('Cidade coincide.')

      if (sinaisContato >= 2 || (sinaisContato >= 1 && nomeBate && cidadeBate)) {
        itens.push({
          ...base,
          status: 'sugestao_forte',
          clienteAtlasId: candidato.id,
          clienteAtlasNome: candidato.nome,
          metodo: 'contato_composto',
          candidatos,
          motivos: [
            'Há sinais fortes de que é o mesmo cliente, mas exige aprovação porque não houve CPF/CNPJ exato.',
          ],
        })
      } else {
        itens.push({
          ...base,
          status: 'revisao',
          clienteAtlasId: null,
          clienteAtlasNome: null,
          metodo: 'contato_parcial',
          candidatos,
          motivos: ['Existe contato coincidente, mas não há evidência suficiente para vínculo automático.'],
        })
      }
      continue
    }

    if (candidatos.length > 1) {
      itens.push({
        ...base,
        status: 'divergente',
        clienteAtlasId: null,
        clienteAtlasNome: null,
        metodo: 'contato_multiplos_candidatos',
        candidatos,
        motivos: ['Telefone/e-mail encontrou mais de um cliente Atlas.'],
      })
      continue
    }

    itens.push({
      ...base,
      status: 'novo',
      clienteAtlasId: null,
      clienteAtlasNome: null,
      metodo: null,
      candidatos: [],
      motivos: ['Nenhum cliente Atlas compatível foi encontrado pelos identificadores disponíveis.'],
    })
  }

  const totais: Record<ReconciliacaoPessoaStatus, number> = {
    vinculado_seguro: 0,
    sugestao_forte: 0,
    revisao: 0,
    divergente: 0,
    novo: 0,
    ignorado_nao_cliente: 0,
  }

  for (const item of itens) totais[item.status] += 1

  return { totais, itens }
}
