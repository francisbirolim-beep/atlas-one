import type { Cliente } from './tipos'
import type { NovaObraCliente360, ObraCliente360 } from './cliente360'

export type ClienteCadastroEdicao = {
  nome: string
  apelido: string
  cpf_cnpj: string
  data_nascimento: string
  whatsapp: string
  telefone: string
  email: string
  endereco: string
  bairro: string
  cidade: string
  cep: string
  origem: string
  responsavel: string
  observacoes: string
}

export type ObraCadastroEdicao = Required<Pick<NovaObraCliente360,
  'nome' | 'endereco' | 'numero_endereco' | 'complemento' | 'bairro' | 'cidade' |
  'uf' | 'cep' | 'responsavel' | 'data_inicio' | 'previsao_entrega' | 'observacoes'>>

function texto(v: unknown) { return String(v ?? '').trim() }
function nullable(v: unknown) { const s = texto(v); return s || null }
export function cepValido(cep: string) { return !texto(cep) || /^\d{5}-?\d{3}$/.test(texto(cep)) }
export function emailValido(email: string) { return !texto(email) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(email)) }
export function ufValida(uf: string) { return !texto(uf) || /^[a-zA-Z]{2}$/.test(texto(uf)) }
export function normalizarCEP(cep: string) {
  const digitos = texto(cep).replace(/\D/g,'')
  return digitos.length === 8 ? digitos.slice(0,5) + '-' + digitos.slice(5) : texto(cep)
}
export function formularioCliente(c: Cliente & { apelido?: string | null }): ClienteCadastroEdicao {
  return {
    nome: c.nome || '', apelido: c.apelido || '', cpf_cnpj: c.cpf_cnpj || '',
    data_nascimento: c.data_nascimento || '', whatsapp: c.whatsapp || '',
    telefone: c.telefone || '', email: c.email || '', endereco: c.endereco || '',
    bairro: c.bairro || '', cidade: c.cidade || '', cep: c.cep || '',
    origem: c.origem || 'outros', responsavel: c.responsavel || '', observacoes: c.observacoes || '',
  }
}
export function formularioObra(o?: ObraCliente360): ObraCadastroEdicao {
  return {
    nome: o?.nome || '', endereco: o?.endereco || '', numero_endereco: o?.numero_endereco || '',
    complemento: o?.complemento || '', bairro: o?.bairro || '', cidade: o?.cidade || '',
    uf: o?.uf || '', cep: o?.cep || '', responsavel: o?.responsavel || '',
    data_inicio: o?.data_inicio || '', previsao_entrega: o?.previsao_entrega || '',
    observacoes: o?.observacoes || '',
  }
}
export function validarCadastroCliente(f: ClienteCadastroEdicao): string | null {
  if (!texto(f.nome) || texto(f.nome).split(/\s+/).length < 2)
    return 'Informe o nome e sobrenome do cliente.'
  if (!emailValido(f.email)) return 'Confira o e-mail do cliente.'
  if (!cepValido(f.cep)) return 'O CEP do cliente deve ter 8 dígitos.'
  return null
}
export function validarCadastroObra(f: ObraCadastroEdicao): string | null {
  if (!texto(f.nome)) return 'Informe o nome ou identificação da obra.'
  if (texto(f.numero_endereco) && !texto(f.endereco)) return 'Informe a rua ou endereço antes do número.'
  if (!cepValido(f.cep)) return 'O CEP da obra deve ter 8 dígitos.'
  if (!ufValida(f.uf)) return 'Informe a UF com duas letras, por exemplo SP.'
  if (f.data_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(f.data_inicio)) return 'Data de início inválida.'
  if (f.previsao_entrega && !/^\d{4}-\d{2}-\d{2}$/.test(f.previsao_entrega)) return 'Previsão de entrega inválida.'
  return null
}
export function patchCliente(f: ClienteCadastroEdicao) {
  return {
    nome: texto(f.nome), apelido: nullable(f.apelido), cpf_cnpj: nullable(f.cpf_cnpj),
    data_nascimento: nullable(f.data_nascimento), whatsapp: nullable(f.whatsapp),
    telefone: nullable(f.telefone), email: nullable(f.email)?.toLowerCase() || null,
    endereco: nullable(f.endereco), bairro: nullable(f.bairro),
    cidade: nullable(f.cidade), cep: nullable(normalizarCEP(f.cep)),
    origem: texto(f.origem) || 'outros', responsavel: nullable(f.responsavel),
    observacoes: nullable(f.observacoes),
  }
}
export function patchObra(f: ObraCadastroEdicao) {
  return {
    nome: texto(f.nome), endereco: nullable(f.endereco),
    numero_endereco: nullable(f.numero_endereco), complemento: nullable(f.complemento),
    bairro: nullable(f.bairro), cidade: nullable(f.cidade),
    uf: nullable(f.uf)?.toUpperCase() || null, cep: nullable(normalizarCEP(f.cep)),
    responsavel: nullable(f.responsavel), data_inicio: nullable(f.data_inicio),
    previsao_entrega: nullable(f.previsao_entrega), observacoes: nullable(f.observacoes),
  }
}
