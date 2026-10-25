import type { NivelPermissao } from './tipos'
import type { AcaoPermissao } from './permissoesBlocos'

/** Todos os setores internos oferecem os três níveis, independentemente
 * da configuração anterior. Não se deve esconder a opção de consulta. */
export function opcoesSetorMaster(_nivel: NivelPermissao) {
 return [
  {valor:'oculto' as const,label:'Oculto — sem acesso'},
  {valor:'consulta' as const,label:'Somente consulta'},
  {valor:'edicao' as const,label:'Consulta e edição'},
 ]
}

/** O formulário deve exibir o nível efetivo do módulo, nunca parecer que
 * o funcionário pode editar sob um setor com teto Somente consulta. */
export function nivelModuloSobSetor(setor:NivelPermissao, modulo:NivelPermissao):NivelPermissao {
 const peso:Record<NivelPermissao,number>={oculto:0,consulta:1,edicao:2}
 return peso[modulo]<peso[setor]?modulo:setor
}

/** Diferencia visualização de operações de alteração de dados. Na dúvida,
 * tratar uma ação como operação de edição. */
export function acaoExigeEdicao(acao:AcaoPermissao):boolean {
 const id=acao.id
 const label=acao.label.toLocaleLowerCase('pt-BR')
 return !(
   /(?:^|[._])consultar(?:$|[._])|(?:^|[._])visao(?:$|[._])|(?:^|[._])ver(?:$|[._])/.test(id)
   || /^(consultar|ver |visualizar|acessar |pesquisar |buscar )/.test(label)
 )
}

export function acaoAutorizadaNoModulo(acao:AcaoPermissao,nivel:NivelPermissao):boolean {
 return nivel === 'edicao' || (nivel === 'consulta' && !acaoExigeEdicao(acao))
}
