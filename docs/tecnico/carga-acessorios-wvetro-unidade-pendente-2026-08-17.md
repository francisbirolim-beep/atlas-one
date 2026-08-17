# Carga de acessórios W.Vetro com unidade operacional pendente — 2026-08-17

## Objetivo

Permitir que os 136 acessórios faltantes cuja unidade de origem não é `UN` entrem no catálogo sem transformar a unidade da fonte em unidade operacional do Atlas e sem inventar fator de conversão.

## Escopo auditado

Distribuição exata da fonte:
- MT: 68
- PR: 37
- BR: 16
- PC: 5
- CJ: 4
- TB: 2
- M2: 2
- CT: 1
- RO: 1

Total: 136.

A fonte também traz `Qtde Emb.`, mas os valores observados não permitem inferir uma regra de conversão confiável.

## Modelagem

`produtos.unidade` passa a aceitar `NULL`.

Semântica:
- valor preenchido: unidade operacional/canônica já definida para uso no Atlas;
- `NULL`: unidade operacional ainda não validada;
- produtos sem unidade são bloqueados dos fluxos que exigem unidade;
- `produtos.unidade_origem`: preserva exatamente a unidade recebida da fonte;
- `produtos.qtde_embalagem_origem`: preserva exatamente `Qtde Emb.`.

A coluna mantém o default legado `unidade` para cadastros manuais que não enviarem valor explicitamente. A importação reconciliada dos 136 envia `NULL` de propósito.

## Proteção operacional

Produtos ativos sem unidade operacional não devem aparecer como opção em fluxos que exigem unidade:
- Engenharia / Receitas;
- substituição de componentes no Plano de Corte;
- Orçamento Balcão.

Eles continuam visíveis em `Cadastro > Produtos`, onde o Master pode revisar a unidade de origem e preencher a unidade operacional correta.

O Orçamento Rápido também deve evitar usar produtos tecnicamente incompletos como produto de origem.

## Carga

Migration:
`supabase/migrations/20260817151000_carga_acessorios_wvetro_unidade_pendente_v1.sql`

Regras:
- `categoria = acessorio`;
- `preco = 0` apenas como placeholder porque a fonte não fornece preço/custo;
- `unidade = NULL`;
- `unidade_origem` preservada;
- `qtde_embalagem_origem` preservada;
- `status_validacao = importado`;
- linha/cor ficam somente em `dados_origem`;
- nenhum `linha_id`, `cor_id`, fator de conversão ou `id_externo_wvetro` é inferido;
- NCM permanece `pendente` ou `invalido`, nunca `valido` automaticamente.

## Guardas

A migration aborta se:
- não houver exatamente 136 linhas;
- houver código normalizado duplicado;
- aparecer unidade fora do conjunto auditado;
- a distribuição MT/PR/BR/PC/CJ/TB/M2/CT/RO divergir da reconciliação;
- houver item inativo na fonte;
- algum código já existir em `produtos`;
- o pós-insert não encontrar 136 itens;
- qualquer um dos 136 terminar com `unidade` operacional preenchida.

## Próxima validação

A unidade operacional deve ser definida item a item ou por regra de categoria somente quando houver evidência operacional de compra/estoque/consumo. `unidade_origem` e `Qtde Emb.` não constituem, sozinhas, uma regra de conversão.
