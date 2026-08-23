# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar fluxo completo de Compras com uma NF real

A decisão operacional atual é o **Atlas ser a fonte de entrada e conferência das notas de compra**. O W.Vetro continua servindo como referência histórica/técnica, mas a Gabi confirmou que as NFs de compra não são alimentadas naquele sistema.

### Estado implementado

PR #247 — Entrada de NF, já em produção:
- `/compras/entrada` aceita `XML da NF-e`, `PDF / DANFE` e `Manual`;
- prévia antes de gravar;
- XML lê chave, número, série, emissão, fornecedor/CNPJ, totais e itens (`cProd`, descrição, NCM, CFOP, unidade, quantidade, valor unitário e total);
- PDF usa leitura assistida e exige conferência quando não houver estrutura confiável;
- item tenta correspondência exata por `produtos.codigo`, `codigo_origem` ou `id_externo_wvetro`;
- produto não reconhecido fica `pendente` e não é criado automaticamente;
- fornecedor novo só é criado na confirmação;
- XML/PDF original vai para bucket privado `compras-nfs`;
- atualização de custo é opção explícita e vem desligada;
- tabelas `compras_nfs` e `compras_nf_itens` com RLS habilitado;
- migration remota `20260823155025_compras_nfe_entrada` aplicada.

PR #248 — Central, Histórico e vínculos, já em produção:
- `/compras` virou Central de Compras;
- `/compras/notas` lista o histórico;
- `/compras/notas/[id]` mostra itens e abre o arquivo original por URL temporária privada;
- `/compras/vinculos` mostra itens pendentes/ambíguos;
- vínculo pode ser corrigido manualmente com um produto já existente;
- resolver vínculo não atualiza custo e não movimenta estoque.

PR #249 — Conferência de recebimento, em validação:
- `/compras/recebimentos/[nfId]` compara quantidade da NF x já recebida x recebido agora;
- aceita múltiplos recebimentos parciais para a mesma NF e acumula quantidades;
- classifica item como `ok`, `falta`, `excesso` ou `avaria`;
- registra observação geral e observação por item;
- permite até 4 fotos por conferência; o navegador reduz a imagem antes do envio;
- fotos são armazenadas no bucket privado `compras-recebimentos` e consultadas depois por URL assinada temporária;
- migration remota `20260823161555_compras_conferencia_recebimento` aplicada;
- tabelas `compras_recebimentos`, `compras_recebimento_itens` e `compras_recebimento_fotos` estão com RLS habilitado e são operadas pelas rotas server-side;
- **nenhum estoque é movimentado nesta fase**.

### Validar agora — ordem obrigatória

1. abrir `/compras/entrada` com sessão real do Atlas;
2. selecionar `Importar XML` e usar uma NF-e real de compra da Esquadrifácio;
3. clicar `Ler e montar prévia`;
4. **manter `Atualizar custo` desligado** no primeiro teste;
5. conferir fornecedor, CNPJ, número/série, data, chave, total e todos os itens;
6. conferir código, descrição, NCM, CFOP, unidade, quantidade, valor unitário e vínculo de cada item;
7. validar manualmente pelo menos 2 ou 3 vínculos antes de confirmar;
8. confirmar a primeira NF sem atualização de custo;
9. abrir `Compras > Histórico de NFs` e conferir a nota gravada + arquivo original;
10. se houver itens pendentes, resolver em `Compras > Itens pendentes` e confirmar que nenhum custo mudou;
11. abrir a nota e entrar em `Conferir recebimento`;
12. registrar uma conferência real, incluindo falta/excesso/avaria quando aplicável e pelo menos uma foto se possível;
13. confirmar que o histórico de recebimentos acumula corretamente entregas parciais e que as fotos abrem por link temporário;
14. conferir no Supabase os registros de `compras_nfs`, `compras_nf_itens`, `compras_recebimentos`, `compras_recebimento_itens` e `compras_recebimento_fotos`;
15. depois repetir a entrada com um `PDF / DANFE` real e um lançamento `Manual`.

### Depois da validação real

Somente após validar os três modos de entrada e a conferência física:
- definir política de custo: último custo, custo médio, custo por fornecedor/cor e tratamento de frete, IPI, ST e outros componentes quando aplicável;
- modelar explicitamente unidade de compra, unidade de estoque e fator de conversão por produto/fornecedor quando necessário;
- criar fila de unidades/conversões pendentes sem inferir valores automaticamente;
- só então criar movimentação de estoque a partir do recebimento confirmado;
- evoluir conferência por foto com identificação assistida de perfis/materiais e comparação NF x recebido;
- criar permissões específicas do setor Compras/Financeiro para a Gabi.

## INTEGRAÇÃO W.VETRO — estado preservado

A conexão direta Atlas One ↔ W.Vetro está validada em produção. No recorte 26/05/2026–23/08/2026 foram encontrados:
- 72 tipologias;
- 1.069 perfis;
- 756 acessórios;
- 15 vidros.

A reconciliação usa a base completa de 2.485 produtos. Os 1.069 perfis e 756 acessórios históricos possuem códigos correspondentes no Atlas, porém grande parte do cadastro ainda tem `custo = null` e `preco = 0`.

Como as NFs de compra não são alimentadas no W.Vetro, `CustoVlr` dos orçamentos/pedidos continua sendo referência histórica e **não deve ser promovido automaticamente a custo oficial**.

## REGRAS DE SEGURANÇA

- GitHub continua sendo a fonte da verdade do código do Atlas;
- XML/PDF e fotos de recebimento permanecem em buckets privados;
- produto não reconhecido nunca deve ser criado automaticamente a partir de XML/PDF;
- atualização de custo exige vínculo + confirmação explícita;
- corrigir vínculo posteriormente não deve aplicar custo retroativamente sem uma ação separada;
- não gerar movimento de estoque enquanto unidade operacional, unidade de compra e conversões não estiverem validadas;
- não copiar `unidade_origem` para `produtos.unidade` automaticamente;
- preservar fórmulas técnicas e preços de venda; Compras altera apenas o que o usuário explicitamente confirmar.

## DEPOIS — validar Plano de Corte final A4

Após validar o fluxo inicial de Compras:
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
