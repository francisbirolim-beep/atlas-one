import type { NivelPermissao, Setor } from './tipos'
import type { AcessoUsuarioConfig } from './acessoUsuario'
import { montarBlocosPermissao, ehSetorExclusivoMaster } from './permissoesBlocos'
import { resolverContextoPermissoes } from './permissoesContextuais'
import { podeExecutarAcao } from './producaoPermissoes'

// null = página sem módulo catalogado: não altera os fluxos legados específicos.
// false = setor, tela/módulo ou suas ações foram efetivamente negadas.
// Master acessa todas as rotas, sem restrição.
export function podeAcessarRotaCatalogada(
 pathname:string, role:string, setores:Record<string,NivelPermissao>,
 config:Pick<AcessoUsuarioConfig,'acoes'|'modulos'>, catalogo:Setor[],
):boolean|null {
 if(role==='master')return true
 if(pathname==='/setores')return true
 if(pathname==='/setor'||pathname.startsWith('/setor/')){
   const id=pathname.split('/')[2]
   return id ? Boolean(!ehSetorExclusivoMaster(id) && catalogo.some(s=>s.id===id && (setores[id]||'oculto')!=='oculto')) : null
 }
 // Cliente 360 tem proteção por aba própria. O portão genérico protege /clientes
 // e deixa as subrotas para o guard específico já instalado.
 if(/^\/clientes\/[^/]+(?:\/|$)/.test(pathname))return null
 const contexto=resolverContextoPermissoes(pathname)
 if(!contexto.moduloIds.length)return null
 const modulos=montarBlocosPermissao(catalogo).flatMap(b=>b.itens)
 const aplicaveis=contexto.moduloIds.map(id=>modulos.find(m=>m.id===id)).filter(
   (m):m is NonNullable<typeof m>=>Boolean(m))
 if(!aplicaveis.length)return false // Rota conhecida sem módulo habilitado: bloquear, nunca liberar.
 // Usa o módulo MAIS ESPECÍFICO listado primeiro no catálogo da rota.
 // Liberar Contas a Pagar não libera o resumo do Financeiro, por exemplo.
 const principal=aplicaveis[0]
 return principal.acoes.some(acao=>podeExecutarAcao(
  role,setores,config,principal.setorId,acao.id,'consulta'))
}
