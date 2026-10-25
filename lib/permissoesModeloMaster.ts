import type { NivelPermissao } from './tipos'
import type { AcaoPermissao } from './permissoesBlocos'

/** Setor é a porta: oculto ou liberado. O estado 'consulta' é legado e
 * permanece armazenado até o Master decidir substituí-lo explicitamente. */
export function opcoesSetorMaster(nivel: NivelPermissao) {
 return [
  {valor:'oculto' as const,label:'Setor oculto — sem acesso'},
  {valor:'edicao' as const,label:'Setor liberado — escolher módulos'},
  ...(nivel==='consulta'?[{valor:'consulta' as const,label:'Consulta anterior — manter até redefinir'}]:[]),
 ]
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
