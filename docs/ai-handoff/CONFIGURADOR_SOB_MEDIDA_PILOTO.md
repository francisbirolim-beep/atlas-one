# Piloto do configurador Sob Medida — Porta de Correr 2 Folhas

## Acesso e isolamento

- Main de origem: `fcf4451acd4b58e26c1fc4086335a2bc7db92613`, conferida em 2026-09-14.
- Branch: `feat/configurador-porta-2f`.
- Novo Orçamento → Novo Orçamento Sob Medida → **Testar novo configurador · Porta de Correr 2 Folhas**.
- URL: `/orcamento-rapido?piloto=porta-2f`. Aceita também os parâmetros de cliente/obra já existentes.
- Sem esse parâmetro, o seletor V5 e as medidas do formulário original continuam ativos.
- Alteração visual no hub limitada ao link de teste; no formulário, troca somente o bloco técnico de cada item.
- O piloto usa medidas comuns. Medição final permanece no fluxo original.

## Sequência e regras confirmadas

Largura/altura em mm e quantidade → O que é? → Porta → Correr → 2 folhas → exposição → linha opcional para conferência → fechadura → Montante lateral móvel → reforços.

Categorias iniciais: Porta, Janela, Veneziana, Painel ripado, Fixo, Claraboia e Maxim-ar. Porta mostra Correr/Giro/Pivotante; somente Correr/2F continua. Outras categorias e aberturas exibem que aguardam cadastro.

As perguntas são dados ordenados com condições `quando`, sem formulários diferentes codificados por produto. Apenas a próxima pergunta aplicável sem resposta aparece. Alterar uma resposta limpa as decisões posteriores; mudar medidas limpa a linha e reavalia as regras, preservando decisões explícitas.

- Fechadura Sim exige Montante lateral móvel Largo.
- Largo permite Reforço de aba Sim ou Não; fechadura não obriga reforço.
- Reforço de aba, interno e externo têm respostas independentes, sem default.
- Nenhum limite dimensional, receita, código de perfil, montagem ou cálculo de material foi presumido.
- Montagens (2 móveis / fixa+móvel) ainda aguardam confirmação; não foram cadastradas como regra validada.

## Cadastros

Master: `/configuracoes/configurador-sob-medida`, também acessível pelo próprio piloto.

Permite adicionar categorias e criar/editar/excluir/ativar regras por formulário. Regras exigem evidência técnica. Todas as condições precisam coincidir. Dimensões aceitam igualdade, maior ou igual e menor ou igual; exposição, produto, abertura, folhas e demais respostas aceitam igualdade.

- Recomendação e Alerta forte: orientações, sem alterar respostas.
- Obrigatória: exige a opção cadastrada, restringe linhas permitidas ou bloqueia uma linha.
- Análise técnica: impede concluir o piloto até a regra/decisão técnica ser revista.
- Listas obrigatórias de linhas permitidas são unidas; bloqueios prevalecem. Uma lista obrigatória exige escolher uma linha permitida.
- Linhas sem regra não são anunciadas como tecnicamente validadas. Sem cadastro suficiente, linha pode permanecer a definir, salvo regra obrigatória.

Persistência em `configuracoes_gerais`, chave `configurador_sob_medida_v1:<empresa_id>`, com `empresa_id` explícito e filtro por empresa. A chave inclui empresa porque o banco possui também uma PK global por `chave`. Sem migration. Leitura autenticada e escrita Master verificadas no servidor. Catálogo de linhas reutiliza `linhas_tecnicas` ativas.

Cadastro ausente usa somente as perguntas iniciais, sem regras dimensionais. Erro de leitura ou cadastro inválido não usa fallback permissivo. A API valida condições, opções, duplicações, limites e referências de linha antes de salvar. As perguntas aprovadas não podem ser removidas por alteração do cadastro.

## Persistência do pedido

Usa o salvamento existente, incluindo snapshot técnico em `variaveis`. Revalida o cadastro antes de criar cliente, uploads e pedido, inclusive nos reenvios da fila offline. Salva o snapshot do cadastro e os avisos aplicados para rastreabilidade.

O item é marcado `preenchida`, **nunca `validada`**. Produto, preset e tipologia técnica permanecem nulos; preço não é calculado. Escolher linha não atribui uma receita. O resumo final mostra exposição, fechadura, montante e cada reforço. Não altera pedidos existentes nem libera produção/corte.

## Extensões posteriores

O contrato de perguntas/condições permite incorporar mão-de-amigo, trilho, roldanas, contramarco, arremate, vidro e cor quando validados. O snapshot será a entrada para vincular receitas, custos e corte, sem reescrever históricos. Cor/contramarco comerciais existentes no formulário foram preservados e não receberam regras técnicas novas.

Não avançar para 3F/4F/etc. antes de Francis validar este piloto.

## Verificação

- `npm run test:configurador`: cenários de domínio e contrato de API com banco simulado.
- `npx tsc --noEmit` e `npm run build`.
- Banco real: conferida estrutura de `configuracoes_gerais`, índices por chave/empresa e existência de 30 linhas ativas. Nenhum cadastro técnico operacional foi gravado pelo agente.
- Confirmar Preview/CI e registrar resultado no PR. Validação real autenticada e envio controlado ficam explícitos no checklist abaixo.

## Roteiro de Francis

1. Abrir o link do piloto e preencher largura, altura e quantidade.
2. Escolher Porta → Correr → 2 folhas → exposição.
3. Selecionar linha, ou deixar para análise quando não houver regra obrigatória.
4. Fechadura Sim: verificar Estreito indisponível e escolher Largo.
5. Escolher reforço de aba Não, interno Não e externo Não; conferir sequência completa sem exigir aba.
6. Repetir com aba Sim e com outras combinações dos reforços.
7. Mudar medidas/exposição e conferir reavaliação; mudar categoria e verificar limpeza das opções anteriores.
8. Conferir dados comerciais, resumo e enviar um pedido de teste. Confirmar variáveis registradas e validação técnica pendente.
9. No cadastro Master, testar uma regra com limite real já validado e evidência; conferir orientação ou bloqueio conforme nível. Reabrir piloto após salvar cadastro.
10. Abrir caminho original sem parâmetro e conferir compatibilidade.

Depois do teste: confirmar montagem e completar cadastros técnicos, receita, custos, preço e plano de corte, passo a passo.
