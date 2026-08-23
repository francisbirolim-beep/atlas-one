# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Editor de Acessórios PC2–PC4

A PR #234 adiciona `Engenharia > Acessórios`, com organização `Linha → Tipologia → Configuração` e carga inicial das Portas de Correr Suprema 2F, 3F e 4F na configuração mão-amiga larga sem reforço.

Validar no preview:
1. abrir `Engenharia > Acessórios`;
2. selecionar `SUPREMA → Porta de Correr 02 Folhas → Mão-amiga larga sem reforço`;
3. confirmar que a lista aparece compacta e que clicar no código/nome de qualquer acessório abre as ações `Substituir`, `Alterar` e `Apagar`;
4. em `Substituir`, selecionar/digitar outro código do catálogo e confirmar atualização de descrição/unidade quando reconhecido;
5. em `Alterar`, editar código, descrição, cor, unidade, fórmula, quantidade de referência, status, origem do cálculo e fonte;
6. em `Apagar`, confirmar que existe confirmação antes de remover o item da tipologia;
7. clicar em `Acrescentar` e confirmar que o novo acessório abre automaticamente em modo de substituição/cadastro;
8. executar teste `2000 x 2100` em PC2, PC3 e PC4 e comparar resultados com as referências W.Vetro cadastradas;
9. confirmar que fórmulas podem usar `Largura`, `Altura`, `LF`, `HF`, `Folhas`, `Encontros`, códigos de perfis calculados e resultados anteriores de acessórios;
10. manter itens sem fórmula comprovada como `Referência do PDF`, sem inventar regra de produção;
11. somente após a validação manual fazer merge da PR #234 em `main`.

Regras em validação pela comparação PC2/PC3/PC4:
- `NYL335 = Folhas - 1`;
- `NYL332 = Folhas * 4`;
- `RPCS100 = Folhas * 2`;
- `PAR435 marco = Folhas * 2`;
- `PAR435 montar folhas = Folhas * 6`;
- `NYL042 = Folhas * 4`;
- `FIT206 = SU243 * Encontros / 1000`;
- `FIT246 = SU280 * 4 / 1000`;
- `FIT212 = Largura * 4 / 1000`;
- `GUA258 = SU280 * Folhas * 2 / 1000`;
- `GUA259 = GUA258 + GUA171`;
- `NYL414 = Encontros * 4` somente PC3/PC4 por enquanto.

Continuam como referência até nova validação de medida/montagem: `GUA171`, `PAR1023`, `NYL-10005`, `CHU838`, `NYL190`, `PAR1025`, `SIL-PU` e quantidades fixas de fechamento.

Importante: nenhuma fórmula existente de perfis deve ser alterada nesta etapa. A divergência de vidro/perfis observada no W.Vetro será corrigida no próprio W.Vetro antes de qualquer revisão das fórmulas Atlas.

## DEPOIS — continuar validação do Editor Técnico e fórmulas Suprema

Após fechar a PR #234, continuar a validação das fórmulas estruturais já cadastradas no Editor Técnico, principalmente marcos/trilhos de 3F–9F e composições acima de 6 planos. Manter separadas a folga de encaixe da esquadria e a folga técnica do vidro.

## OUTRAS VALIDAÇÕES PENDENTES

- Lista de vidros e folgas no Plano de Corte.
- Cadastro do cliente como central operacional.
- Assistência em campo com rota, GPS e tempo.
- Link do técnico, assinaturas e PDF direto.
- Impressão A4 e data ajustável da Assistência.
- Navegação organizada e Central de Cadastros.
- Localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.
