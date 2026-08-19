# Correção auditada — L. Suprema > Porta de Correr 03 Folhas — 2026-08-19

## Fonte de evidência

Print real do sistema W.Vetro compartilhado pelo Francis nesta conversa. O cabeçalho do print mostra explicitamente:

- Linha: `L. SUPREMA`;
- Modelo: `PORTA DE CORRER 03 FOLHAS`;
- projetos exibidos: `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

O relatório já existente `docs/tecnico/carga-linha-tipologias-produtos-2026-08-18.md` confirma a chave exata da tipologia no Atlas: `l_suprema_porta_de_correr_03_folhas`.

## Erro identificado

O cadastro realizado anteriormente foi documentado e gravado como:

- tipologia `l_suprema_janela_de_correr_03_folhas`;
- códigos `JC3`;
- valores estruturados `composicao_folha_N` inferidos visualmente.

Isso não corresponde à fonte. Além disso, o desenho `PC3-02-EF` mostra composição vertical mista dentro de cada painel (vidro superior + elemento venezianado/persiana inferior), o que prova que uma única opção simples `vidro | persiana | tela` por folha não representa com fidelidade todos os projetos desse grupo.

## Decisão corretiva

A migration `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`:

1. atua somente nos quatro códigos exatos comprovados;
2. move esses quatro presets para `l_suprema_porta_de_correr_03_folhas`;
3. corrige `JC3` para os códigos `PC3` exatamente como aparecem no print;
4. limpa `valores` para `{}` em vez de substituir uma inferência errada por outra;
5. acrescenta evidência de auditoria ao preset;
6. remove os vínculos `composicao_folha_1..6` que a migration anterior criou nas tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas sem evidência adequada para aquelas janelas;
7. preserva as variáveis/opções globais para futura remodelagem;
8. não cria novos presets, não altera receitas, produtos, preços, fórmulas ou imagens.

## Guardas

- joins por `tipologias.chave` exata;
- identificação dos quatro projetos por código normalizado exato, sem fuzzy;
- exige exatamente quatro registros-alvo e quatro códigos distintos;
- aborta se os mesmos códigos existirem em outra tipologia;
- pós-check exige quatro PC3 na Porta de Correr 03 Folhas, zero alvos na Janela, `valores={}` nos quatro e zero vínculos de composição remanescentes nas janelas alvo;
- idempotente: aceita o estado antigo ou o estado já corrigido.

## Estado

Preparada em branch/PR para Build Validation e Supabase Database Control dry-run. **Não aplicar em produção sem autorização explícita do Francis.**
