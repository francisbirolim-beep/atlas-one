# Regra permanente — Atlas One: permissões administradas pelo Master

**Prioridade do projeto:** nunca alterar o que já funciona; desenvolver e testar em worktree isolado e publicar sem travar a produção. Não mudar permissões, cargos nem dados de colaboradores automaticamente.

## Contrato do usuário

1. Apenas o usuário `master` pode criar, consultar a matriz de outros usuários e conceder/revogar acesso aos setores, módulos, etapas e ações. Funcionário não altera permissões nem configurações globais do Atlas.
2. Para cada **bloco/setor inteiro** (ex.: Financeiro, Comercial, Compras), Master define **Oculto** ou **Liberado**. `Oculto` bloqueia todos os setores internos e módulos/ações, inclusive telas, menu e rotas. `Liberado` não libera nenhum módulo automaticamente quando antes estava oculto.
3. Cada **módulo/etapa** dentro do setor liberado possui **Sem acesso**, **Somente consulta**, **Consulta e edição**. Uma ação não pode elevar o teto do módulo. Consulta não habilita gravações.
4. Cada **ação individual** (ex.: Registrar recebimento, Pagar, Aprovar, Excluir, Liberar Produção) tem **Liberada** ou **Bloqueada**, escolhida pelo Master. Se uma ação exige edição, ela não funciona em módulo somente consulta. Ação de edição não concede acesso aos módulos irmãos.
5. **Configurações globais do Atlas, administração de usuários, acessos e integrações** são exclusivas do Master, ainda que um banco antigo contenha uma permissão `edicao` associada ao módulo Configurações.
6. Compatibilidade: configurações antigas `consulta` no teto do setor continuam válidas até o Master substituí-las. Na edição de um setor de consulta legado para liberado, os módulos mantêm teto de consulta e as ações herdadas não viram edição.
7. Segurança não depende apenas de esconder botões: cada API mutável deve verificar JWT, empresa, nível do módulo e permissão de ação no servidor; RLS deve proteger gravação direta. RLS inédita só pode ser ativada após validar em banco clone com JWT de funcionário.
8. Listas de perfis e acessórios precisam ter imagem do produto.

## Localização das regras

- UI principal: `app/configuracoes/usuarios/page.tsx`
- Configuração contextual da tela: `components/system/PermissoesContextuais.tsx`
- Rótulos e classe de ação: `lib/permissoesModeloMaster.ts`
- Autorizações cliente e servidor: `lib/producaoPermissoes.ts`, `lib/acessoUsuarioServer.ts`
- Navegação: `lib/permissoesRota.ts`, `components/system/SetorRouteGuard.tsx`
- API Master-only da matriz: `app/api/usuarios/acessos-etapas/route.ts`
- Testes obrigatórios no CI: `npm run test:permissoes-regra-master`

## Critérios de homologação

Testar Master; funcionário sem setor; setor liberado mas sem módulos; módulo somente consulta; módulo consulta e edição com operação não liberada; operação liberada; módulos irmãos; mudança de consulta legada sem upgrade automático; funcionalidades técnicas de Medição Final, Produção e Instalação; e endpoints que usam `service_role`. O teste do código não equivale a teste com JWT real e RLS.

**Esta regra é funcional para todas as áreas e continua valendo nas próximas funcionalidades.**
