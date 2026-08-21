# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar navegação organizada e Central de Cadastros

Após deploy desta implementação:
1. entrar como Master e confirmar que a sidebar está separada em `Geral`, `Comercial` e `Operações`;
2. usar `Buscar no menu...` e procurar: `cliente`, `orçamento`, `assistência`, `logo`, `usuário`, `fornecedor`, `fórmula`, `backup`, `automação` e `precificação`;
3. confirmar que `Administração` fica recolhida quando não está sendo usada e abre ao entrar em uma rota administrativa;
4. abrir `Central de Administração` e validar se a organização por Empresa e equipe, Comercial, Engenharia e cadastros e Sistema ficou intuitiva;
5. abrir `Central de Cadastros` e testar a busca por `produto`, `linha`, `fornecedor`, `unidade`, `receita` e `campo`;
6. validar os atalhos de Produtos, Linhas, Materiais, Fornecedores, Produtos por Linha, Precificação, Unidades Pendentes, Receitas Técnicas, Fórmulas de Corte e Campos adicionais;
7. confirmar que `Cadastros Avançados` ainda abre a tela antiga `/cadastro`, preservando funções que ainda não foram separadas;
8. testar o mesmo menu em tema claro e tema escuro;
9. entrar como funcionário e confirmar que as opções administrativas de Master não aparecem;
10. confirmar que nenhuma rota operacional anterior deixou de funcionar.

Depois dessa validação visual, a próxima etapa recomendada é separar gradualmente as funções ainda concentradas em `/configuracoes` e `/cadastro` em páginas próprias, sem apagar as telas antigas até cada função ser validada em seu novo local.

## VALIDAÇÃO AINDA PENDENTE — Home por usuário + Assistência + Ordem de Serviço

Permanece necessário validar em produção:
- composição da Home por usuário;
- escopo de Assistências (`próprias` ou `todas`);
- criação online de assistência com abertura automática da OS e diálogo de impressão;
- impressão / Salvar como PDF da OS;
- reimpressão pelo Kanban;
- criação offline e sincronização posterior.

Esta etapa de organização da navegação não exige migration nem alteração de schema.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.