# Auditoria completa W.Vetro → Atlas — 2026-08-23

## Objetivo

Usar o W.Vetro como **base de referência integral** para Linha, Tipologia, Perfil, Acessório, Vidro e imagem, preservando o Atlas como fonte da verdade técnica depois de validação.

Regra permanente desta frente:

- W.Vetro = referência/origem;
- Atlas validado = versão técnica oficial;
- fórmula/receita/configuração validada no Atlas nunca é sobrescrita automaticamente por histórico W.Vetro;
- vínculo de produto/linha/tipologia só usa código ou campo de Linha explícito e igualdade exata; nunca fuzzy;
- custo/preço histórico do W.Vetro não vira custo/preço oficial automaticamente;
- unidade da origem não vira unidade operacional automaticamente.

## Estado encontrado antes da PR #258

### Produtos

- Perfis W.Vetro no Atlas: **1.307**.
- Perfis documentados no `ExportWWPerfil (1)(1).xlsx`: **1.307**.
- Resultado: catálogo de perfis do export conhecido está completo por código.
- Acessórios W.Vetro no Atlas: **1.174**.
- Acessórios documentados no `ExportWWAcessorios.xlsx`: **1.174**.
- Existem mais **3 acessórios exclusivos Atlas** (`origem != wvetro`).
- Total Atlas nas categorias perfil/acessório: **2.484**, sendo **2.481** de origem W.Vetro.
- Todos os 2.481 registros W.Vetro têm `codigo_origem` e `dados_origem` preservados.
- `id_externo_wvetro` continua vazio porque código técnico não deve ser fingido como ID externo.

### Tipologias

O lote histórico de 2026-08-16 contém exatamente **109 tipologias** provenientes da extração anterior de **1.038 vendas/orçamentos W.Vetro**.

- 109/109 têm token de Linha no formato `Modelo (Linha)`;
- **28** valores de Linha distintos aparecem nessas 109 tipologias;
- antes desta PR, somente **46/109** estavam ligadas formalmente a `linha_tipologias`;
- **63/109** estavam no cadastro Atlas, mas sem vínculo formal com a Linha de origem;
- o Atlas possui hoje 122 tipologias no total porque, além do lote W.Vetro, existem registros antigos/próprios e tipologias novas criadas no desenvolvimento técnico.

A PR #258 formaliza a proveniência das 109 sem alterar `label`, `chave`, fórmula ou receita e passa a ligar todas pela Linha exata da origem.

### Linhas

Antes da PR existiam somente 5 `linhas_tecnicas`:

- SUPREMA;
- GOLD;
- LINHA 30;
- PELE DE VIDRO / FACHADA ATLANTA;
- REVESTIMENTO RIPADO.

As fontes W.Vetro já preservadas mostram um universo maior:

- **28** valores distintos de Linha nas tipologias históricas;
- **36** valores não vazios de `linha_raw` no export de acessórios;
- união case-insensitive das duas fontes: **59 referências de Linha**;
- somente 5 nomes aparecem simultaneamente nas duas fontes quando comparados case-insensitive.

A PR cria `wvetro_referencias_linhas` e:

- reaproveita Linha Atlas existente somente quando nome/apelido é igualdade exata;
- cria as Linhas usadas por tipologias W.Vetro que estavam ausentes, com `origem_referencia = wvetro`, `status_validacao = referencia_wvetro` e `ativo = true`, para que possam ser selecionadas e tratadas;
- preserva Linhas encontradas apenas em acessórios como referência **inativa**, evitando poluir o orçamento sem modelo associado;
- a auditoria viva `/Produtos/linhas` complementa esta lista e pode encontrar Linhas não presentes nos exports/histórico.

### Vidros

No estado pré-PR existem **0 produtos categoria vidro** no cadastro geral. O histórico da API possui `Vidros[]` dentro de pedidos/orçamentos, com campos como Código, Especificação, largura, altura, quantidade, m², fixação, lado, posição, custo/venda e NCM.

A PR cria `wvetro_referencias_vidros` para guardar todas as referências únicas antes de qualquer promoção para `produtos`. Isso evita inventar unidade operacional ou cadastro fiscal.

### Imagens

`/Produtos/produtoByKey` documenta o campo `URL`. A PR passa a:

1. guardar a URL original no snapshot W.Vetro;
2. preencher `produtos.foto_url` somente se o produto ainda não tiver foto Atlas;
3. tentar copiar a imagem para o bucket público `fotos`, em `wvetro/produtos/...`;
4. preservar foto Atlas existente quando ela for diferente;
5. registrar `copiada`, `preservada_atlas`, `sem_imagem` ou `erro` no snapshot.

Não é prometida imagem onde a API W.Vetro não fornecer URL/imagem válida.

## Auditoria viva implementada

Nova tela Master:

`/configuracoes/integracoes/wvetro/auditoria`

Fluxo:

1. autentica na API W.Vetro;
2. consulta `/Produtos/linhas`;
3. tenta descoberta do catálogo completo P e A omitindo código; se a instalação não suportar, mantém fallback;
4. se a API listar códigos novos, cria os faltantes com `origem=wvetro`, `status_validacao=importado`, `unidade=NULL`, `preco=0`, sem custo/margem inventados;
5. percorre pedidos + orçamentos em janelas de até 90 dias;
6. agrega Linha+Modelo, perfis, acessórios e vidros;
7. percorre todos os produtos W.Vetro conhecidos e consulta `produtoByKey` por código;
8. preserva payload, LinhaId/LinhaNome, NCM/unidade de origem e URL;
9. vincula `linha_produtos` somente a partir de Linha explícita da API;
10. copia imagens possíveis para Storage Atlas;
11. fecha a execução com totais auditáveis.

## Status mostrado no orçamento

O seletor `components/orcamento/SeletorEsquadriaInteligente.tsx` passa a informar, ao lado da tipologia:

- `REFERÊNCIA WVETRO` — existe como referência, sem tratamento técnico Atlas;
- `WVETRO · EM VALIDAÇÃO ATLAS` — referência W.Vetro já está sendo tratada por fórmula/preset Atlas;
- `WVETRO · VALIDADA ATLAS` — referência W.Vetro possui fórmula/configuração validada no Atlas;
- `VALIDADA ATLAS` — tipologia própria Atlas validada;
- `CADASTRADA ATLAS` — cadastro Atlas ainda sem configuração validada.

Assim o vendedor/orçamentista sabe imediatamente se está seguindo somente a referência do W.Vetro ou uma regra efetivamente validada no Atlas.

## O que a execução ao vivo ainda precisa responder

Depois das migrations + código entrarem em ambiente utilizável, a execução completa deve fechar com números reais para:

- quantidade exata retornada por `/Produtos/linhas`;
- se `produtoByKey` sem código suporta listar todo o catálogo na licença real;
- número final de perfis e acessórios depois de detectar eventuais itens criados após os exports;
- quantidade final de pares Linha+Modelo em todo o período auditado;
- quantidade final de perfis/acessórios usados no histórico;
- quantidade final de referências de vidro;
- número de produtos com URL de imagem;
- número de imagens efetivamente copiadas para o Atlas;
- divergências/ambiguidades que exigem validação humana.
