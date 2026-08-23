# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar custos reais de compra via NF W.Vetro

A conexão direta Atlas One ↔ W.Vetro já foi validada em produção. As credenciais estão configuradas na Vercel, a autenticação é aceita e `/Produtos/linhas` devolve dados reais.

Também foi validada a prévia histórica de orçamentos no período 26/05/2026–23/08/2026:
- 72 tipologias;
- 1.069 perfis;
- 756 acessórios;
- 15 vidros.

A reconciliação exata contra a base completa do Atlas foi corrigida para paginar todos os 2.485 produtos. Resultado observado:
- 38 das 72 tipologias possuem correspondência exata;
- 34 tipologias dependem de mapeamento de linha;
- os 1.069 perfis históricos possuem código correspondente no Atlas;
- os 756 acessórios históricos possuem código correspondente no Atlas;
- os cadastros W.Vetro existentes no Atlas estão, em grande parte, com `custo = null` e `preco = 0`, portanto esses casos não devem ser tratados automaticamente como divergência real de cadastro;
- 15 vidros do recorte histórico ainda não encontraram correspondência exata.

Foi implementada na PR #244 uma nova etapa somente leitura para diagnosticar custo real de compra pelas notas de entrada do W.Vetro:
- API `/api/integracoes/wvetro/custos`;
- tela Master `/configuracoes/integracoes/wvetro/custos`;
- leitura de `/compras/nf` e `/compras/itemNf`;
- janela máxima de 90 dias;
- limite configurável de 10, 25 ou 50 NFs detalhadas por teste;
- nenhuma gravação ou atualização de produto/custo/preço.

Validar agora no Atlas:
1. abrir `/configuracoes/integracoes/wvetro/custos` como Master;
2. começar com os últimos 30 dias e limite de 25 NFs;
3. clicar `Analisar notas`;
4. confirmar quantas NFs e itens foram identificados;
5. verificar se a API real fornece código de produto, unidade e valor unitário/custo com os campos reconhecidos pelo parser;
6. se a tela mostrar 0 itens, usar o diagnóstico de chaves exibido para corrigir o parser sem expor credenciais;
7. depois de validar o formato real, reconciliar custo por código exato + unidade com os produtos existentes no Atlas;
8. separar na reconciliação os estados `cadastro existente`, `valor pendente`, `divergência real`, `novo` e `linha não mapeada` antes de permitir qualquer promoção;
9. não escrever custo/preço no cadastro oficial até existir conferência explícita da unidade e da fonte do valor.

## REGRAS DE SEGURANÇA DA INTEGRAÇÃO

- W.Vetro é fonte externa de referência; o GitHub continua sendo a fonte da verdade do código do Atlas;
- credenciais ficam somente em variáveis de ambiente da Vercel;
- rotas da integração exigem sessão válida e usuário `master`;
- a fase atual é estritamente somente leitura;
- `CustoVlr` e `VendaVlr` de orçamentos/pedidos são histórico de venda e não devem virar automaticamente custo/preço oficial do produto;
- custos de compra devem ser validados pelas notas de entrada e pela unidade do item antes de qualquer atualização;
- não importar automaticamente fórmulas técnicas a partir de histórico de venda sem validação;
- preservar cadastros, preços e regras existentes até comparação explícita;
- limitar consultas históricas a janelas de até 90 dias por chamada.

## DEPOIS — validar Plano de Corte final A4

Após fechar o staging de custos/valores do W.Vetro, validar o relatório final em uso real:
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
