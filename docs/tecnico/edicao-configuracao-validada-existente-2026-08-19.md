# Edição de configuração validada existente — 2026-08-19

## Problema confirmado

Após o cadastro real dos presets `*SUCB-JC3-01EF` a `04EF`, o handoff registrava que as imagens poderiam ser adicionadas editando cada configuração. Porém a tela `Engenharia > Configurações validadas` não possuía edição: só permitia criar nova configuração e ativar/desativar. Fazer novo cadastro apenas para anexar imagem criaria duplicidade de preset.

## Correção desta branch

- adiciona atualização autenticada via `PUT /api/engenharia/configuracoes-orcamento`;
- reaproveita as mesmas validações de tipologia, produto, variáveis, opções obrigatórias e nome duplicado usadas no cadastro;
- a checagem de duplicidade ignora o próprio ID durante edição;
- atualizar um preset renova os metadados de validação (`validado_em`, `validado_por_*`, evidência) sem alterar `criado_por_*`;
- `lib/orcamentoConfiguracoes.ts` ganha helper `atualizarConfiguracaoValidadaOrcamento`;
- a tela administrativa ganha botão `Editar`, pré-carrega nome, evidência, valores, produto e imagem existente;
- linha e tipologia ficam bloqueadas durante a edição para preservar a identidade técnica do preset;
- permite trocar ou remover a imagem e salvar no mesmo registro;
- mantém ativar/desativar como ação separada.

## Segurança

- sem migration;
- sem carga automática;
- sem alteração em presets de produção durante o deploy;
- nenhuma imagem é criada ou vinculada automaticamente;
- a escrita só ocorre quando um usuário Master clicar em `Salvar alterações`.
