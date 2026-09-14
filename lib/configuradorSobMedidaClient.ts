import { supabase } from './supabase'
import { CadastroConfigurador, validarCadastro } from './configuradorSobMedida'

export async function requisicaoConfigurador(cadastro?: CadastroConfigurador) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Entre no Atlas para acessar o piloto.')
  const resposta = await fetch('/api/orcamento/configurador', {
    method: cadastro ? 'PUT' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    ...(cadastro ? { body: JSON.stringify(cadastro) } : {}),
    cache: 'no-store',
  })
  const dados = await resposta.json()
  if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar o configurador.')
  validarCadastro(dados.cadastro)
  return dados as { cadastro: CadastroConfigurador; master: boolean; linhas: { id: string; nome: string }[] }
}
