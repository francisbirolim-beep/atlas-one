import type { AcessoUsuarioConfig } from './acessoUsuario'
import type { NivelPermissao } from './tipos'
import { moduloDaAcaoPermissao, fallbackAcaoPermissao } from './permissoesBlocos'

// Um módulo oculto nunca é reaberto pela permissão de uma ação.
// Regras explícitas da ação prevalecem, respeitando o teto do setor.
const PESO: Record<NivelPermissao, number> = { oculto: 0, consulta: 1, edicao: 2 }

export function nivelEfetivoAcao(
  role: string,
  setores: Record<string, NivelPermissao>,
  config: Pick<AcessoUsuarioConfig, 'acoes' | 'modulos'>,
  setorId: string,
  acaoId: string,
): NivelPermissao {
  if (role === 'master') return 'edicao'
  // A administração e configuração estrutural do Atlas são exclusivas do Master.
  if(moduloDaAcaoPermissao(acaoId)?.id==='configuracoes')return 'oculto'
  const setor = setores[setorId] || 'oculto'
  if (setor === 'oculto') return 'oculto'
  const modulo=moduloDaAcaoPermissao(acaoId)
  const nivelModulo=modulo?.setorId===setorId?config.modulos?.[modulo.id]:undefined
  const tetoModulo=nivelModulo && PESO[nivelModulo]<PESO[setor]?nivelModulo:setor
  if(tetoModulo==='oculto')return 'oculto'
  const acao=config.acoes?.[acaoId]
  if(!acao)return fallbackAcaoPermissao(acaoId,tetoModulo) // Delegações de retirada exigem liberação explícita.
  return PESO[acao]<PESO[tetoModulo]?acao:tetoModulo
}

export function podeExecutarAcao(
  role: string,
  setores: Record<string, NivelPermissao>,
  config: Pick<AcessoUsuarioConfig, 'acoes' | 'modulos'>,
  setorId: string,
  acaoId: string,
  minimo: NivelPermissao = 'consulta',
): boolean {
  return PESO[nivelEfetivoAcao(role, setores, config, setorId, acaoId)] >= PESO[minimo]
}

export function permissaoDaRotaProducao(pathname: string): { setor: string; acao: string } | null {
  if (!(pathname === '/producao' || pathname.startsWith('/producao/'))) return null
  if (pathname === '/producao/medicao-final' || pathname.startsWith('/producao/medicao-final/')) {
    return { setor: 'medida-final-msdwtt9y', acao: 'producao.medida_final.consultar' }
  }
  if (pathname === '/producao/separacao' || pathname.startsWith('/producao/separacao/')) {
    return { setor: 'producao', acao: 'producao.separacao.consultar' }
  }
  if (pathname === '/producao/plano-corte' || pathname.startsWith('/producao/plano-corte/')) {
    return { setor: 'producao', acao: 'producao.plano_corte.consultar' }
  }
  return { setor: 'producao', acao: 'producao.geral.consultar' }
}
