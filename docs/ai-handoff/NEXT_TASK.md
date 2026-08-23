# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar conexão real da API W.Vetro e preparar staging

A integração direta Atlas One ↔ W.Vetro foi preparada em modo somente leitura na PR #238. As credenciais `WVETRO_LICENSE_ID`, `WVETRO_USERNAME` e `WVETRO_PASSWORD` foram configuradas externamente na Vercel para Preview e Production; nenhum segredo deve ser gravado no GitHub.

Validar no Atlas:
1. abrir `/configuracoes/integracoes/wvetro` como usuário Master;
2. confirmar que Licença, Usuário e Senha aparecem como configurados;
3. clicar `Testar conexão e buscar linhas`;
4. confirmar que a autenticação do W.Vetro é aceita e que `/Produtos/linhas` devolve dados reais;
5. depois da conexão validada, consultar pedidos/orçamentos em janelas de até 90 dias e extrair os pares únicos `Linha + Modelo`;
6. criar a próxima etapa de staging/dry-run para comparar linhas, perfis, acessórios, tipologias, custos e preços do W.Vetro com os cadastros atuais do Atlas;
7. nessa etapa, nenhuma importação pode sobrescrever automaticamente cadastro, fórmula ou preço já existente no Atlas;
8. divergências devem ser apresentadas para conferência antes de qualquer promoção do staging para o cadastro oficial.

## REGRAS DE SEGURANÇA DA INTEGRAÇÃO

- W.Vetro é fonte externa de referência; o GitHub continua sendo a fonte da verdade do código do Atlas;
- credenciais ficam somente em variáveis de ambiente da Vercel;
- rotas da integração exigem sessão válida e usuário `master`;
- a primeira fase é estritamente somente leitura;
- não importar automaticamente fórmulas técnicas a partir de histórico de venda sem validação;
- preservar cadastros, preços e regras existentes até comparação explícita;
- limitar consultas históricas do preview a 90 dias por chamada para reduzir risco operacional.

## DEPOIS — validar Plano de Corte final A4

O Editor de Acessórios PC2–PC4 e a identidade white-label do Plano de Corte já foram integrados em `main`. Após fechar a conexão e o staging inicial do W.Vetro, validar o relatório final em uso real:
1. abrir `Engenharia > Fórmulas de Corte`;
2. testar PC2, PC3 e PC4 Suprema em `2000 x 2100`;
3. conferir logo, cliente, obra, ambiente, cor, perfis, acessórios e vidro;
4. confirmar Perfis e Acessórios lado a lado com imagens reais quando disponíveis;
5. imprimir/salvar PDF e confirmar uma única folha A4 com margens compactas.

## DEPOIS DO A4

Continuar a validação estrutural das fórmulas Suprema 3F–9F, principalmente marcos/trilhos compostos acima de 6 planos e regras de acessórios ainda marcadas como referência.

## OUTRAS VALIDAÇÕES PENDENTES

- Cadastro do cliente como central operacional.
- Assistência em campo com rota, GPS e tempo.
- Link do técnico, assinaturas e PDF direto.
- Navegação organizada e Central de Cadastros.
