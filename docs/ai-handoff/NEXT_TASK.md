# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Entrada de NF no Atlas com XML real

A investigação de custos pelas notas de entrada do W.Vetro foi concluída operacionalmente: o endpoint `/compras/nf` respondeu sem erro, porém com lista vazia. Francis confirmou com Gabi, responsável pelo setor, que as notas de compra não são lançadas no W.Vetro. Portanto, ausência de NFs não é falha da integração.

A nova decisão operacional é o **Atlas ser a fonte de entrada das notas de compra**.

Foi implementado na PR #247 o primeiro fluxo de `Compras / NF`:
- rota operacional `/compras/entrada`;
- três formas de entrada: `XML da NF-e`, `PDF / DANFE` e `Manual`;
- XML lê chave de acesso, número, série, emissão, fornecedor/CNPJ, totais e itens (`cProd`, descrição, NCM, CFOP, unidade, quantidade, valor unitário e total);
- PDF usa `pdf-parse` em modo assistido e exige conferência/edição dos itens quando o DANFE não permitir leitura estruturada confiável;
- modo Manual permite cadastrar nota e itens sem arquivo;
- prévia não grava nada;
- cada item tenta correspondência exata com `produtos.codigo`, `codigo_origem` ou `id_externo_wvetro`;
- correspondência única vira `vinculado`; múltiplas viram `ambíguo`; sem correspondência fica `pendente`;
- produto pendente **não é criado automaticamente**;
- usuário pode escolher manualmente o produto correto usando o catálogo do Atlas;
- fornecedor é reconhecido por CNPJ quando já existe; se for novo, é criado somente na confirmação da NF;
- o arquivo XML/PDF original é guardado no bucket privado `compras-nfs` somente após confirmação;
- opção `Atualizar custo dos produtos vinculados` é explícita e vem desligada por padrão;
- quando ativada, o custo anterior fica registrado em `compras_nf_itens.custo_anterior` e o novo custo só é aplicado aos produtos efetivamente vinculados;
- migration remota `20260823155025_compras_nfe_entrada` aplicada no Supabase de produção;
- tabelas criadas: `compras_nfs` e `compras_nf_itens`, ambas com RLS habilitado e sem políticas de acesso direto; a operação ocorre pelas rotas server-side;
- bucket `compras-nfs` é privado;
- preview Vercel da PR #247 compilou Next.js + TypeScript com sucesso.

### Validar agora — primeiro sem alterar custo

1. abrir `/compras/entrada` com uma sessão real do Atlas;
2. selecionar `Importar XML`;
3. usar um XML real de NF-e de compra da Esquadrifácio;
4. clicar `Ler e montar prévia`;
5. **não marcar `Atualizar custo` no primeiro teste**;
6. conferir fornecedor, CNPJ, número/série, data, chave de acesso e total;
7. conferir todos os itens: código, descrição, NCM, CFOP, unidade, quantidade e custo unitário;
8. conferir quantos itens ficaram `Vinculado`, `Pendente` ou `Ambíguo`;
9. validar manualmente pelo menos 2 ou 3 vínculos de produto antes de confirmar uma entrada real;
10. só após validar a prévia, confirmar uma NF de teste sem atualização de custo;
11. conferir no banco `compras_nfs` e `compras_nf_itens` se os dados e o arquivo foram registrados corretamente;
12. depois repetir com `PDF / DANFE` e com `Manual`;
13. somente após esses testes liberar a opção de atualização de custo para uso operacional da Gabi.

### Próximas evoluções do módulo Compras

Após validar a entrada básica:
- criar `Histórico de NFs` com abertura do arquivo original e detalhes dos itens;
- criar tela/fila `Itens pendentes de vínculo` para resolver produtos novos ou códigos de fornecedor diferentes;
- definir política de custo: último custo, custo médio, custo por fornecedor/cor e tratamento de frete/IPI/ST quando aplicável;
- criar movimento de estoque na confirmação da entrada, depois que a regra de unidade operacional estiver validada;
- permitir conferência de mercadoria por foto/manual comparando NF x recebido;
- adicionar permissões específicas do setor de Compras/Financeiro para a Gabi, em vez de depender apenas do perfil genérico de funcionário.

## INTEGRAÇÃO W.VETRO — estado preservado

A conexão direta Atlas One ↔ W.Vetro está validada em produção. No recorte 26/05/2026–23/08/2026 foram encontrados:
- 72 tipologias;
- 1.069 perfis;
- 756 acessórios;
- 15 vidros.

A reconciliação usa a base completa de 2.485 produtos. Os 1.069 perfis e 756 acessórios históricos possuem códigos correspondentes no Atlas, porém grande parte do cadastro ainda tem `custo = null` e `preco = 0`.

Como as NFs de compra não são alimentadas no W.Vetro, `CustoVlr` dos orçamentos/pedidos continua sendo apenas referência histórica e **não deve ser promovido automaticamente a custo oficial**. A tela de custos históricos por orçamentos pode ser usada como diagnóstico secundário.

## REGRAS DE SEGURANÇA

- GitHub continua sendo a fonte da verdade do código do Atlas;
- credenciais W.Vetro permanecem somente nas variáveis de ambiente da Vercel;
- XML/PDF de compra deve permanecer em storage privado;
- produto não reconhecido nunca deve ser criado automaticamente a partir de XML/PDF;
- atualização de custo exige vínculo de produto + confirmação explícita;
- primeira validação operacional deve ser feita com `Atualizar custo` desligado;
- não gerar movimento de estoque automático até unidade/embalagem de cada categoria estar validada;
- preservar fórmulas técnicas e preços de venda; entrada de NF altera somente o que o usuário explicitamente confirmar.

## DEPOIS — validar Plano de Corte final A4

Após validar a primeira versão de Entrada de NF:
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
