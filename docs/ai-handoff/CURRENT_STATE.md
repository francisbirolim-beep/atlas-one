# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-15. `main` esta no merge da PR #127. A branch atual `feat/limpeza-e-fluxo-operacional` agrupa limpeza da navegacao, padrao configuravel de orcamento/PDF e a nova etapa Plano de Corte da Producao.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PRs #112 a #118: importacao W.Vetro em Nova Medicao, suporte a PDFs sem dimensoes e correcoes do parser.
- PR #119: toda peca da Medicao Final mostra sempre 3 larguras, 3 alturas, foto da trena de LARGURA e ALTURA; `medido=true` somente quando as seis medidas sao positivas.
- PR #120: CONTRAMARCO, ARREMATE, CADEIRINHA, CANTONEIRA SIM/NAO, observacao por peca e lembrete da vista interna.
- PR #121: fluxo mobile por peca em ordem unica: medidas/fotos -> SIM/NAO -> observacao -> demais campos -> fotos adicionais.
- PR #122: medicao parcial, tempo ativo, historico de pausa/retomada e indicacao das pecas feitas/em aberto.
- PR #123: barra inferior mobile extensa removida; Favoritos virou o acesso rapido principal no celular.
- PR #124: botoes mobile `Voltar` e `Inicio` para telas internas.
- PR #125: remove da navegacao a Medida Final generica/legada e mantem somente `/producao/medicao-final` como oficial.
- PR #126: limpa o hero da Home.
- PR #127: Home passa a mostrar somente Hero, Favoritos e Resumo da operacao.
- Medicao Final V2 oficial em `/producao/medicao-final` operacional.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## BRANCH ATUAL — LIMPEZA DA NAVEGACAO
Implementado:
- navegacao diaria reduzida a `Inicio`, `Clientes`, `Orcamentos`, `Kanban`, `Medicao Final`, `Producao` e `Engenharia`;
- desktop Sidebar deixa de misturar setores dinamicos, paginas antigas, historico, relatorios, dashboard e atalhos administrativos com a operacao diaria;
- administracao fica separada para Master: `Configuracoes`, `Padrao do Orcamento` e `Setores`;
- Favoritos mobile passa a listar apenas as sete areas principais;
- Master continua tendo acesso administrativo pelo painel de Favoritos no celular;
- topbar remove botoes sem funcao real e transforma o perfil em menu funcional com logout/configuracoes;
- nenhuma rota funcional foi excluida do codigo e nenhum dado foi apagado.

## BRANCH ATUAL — CONFIGURACOES DO ORCAMENTO E PDF
Implementado:
- nova rota Master `/configuracoes/orcamento`;
- configuracoes persistidas em `configuracoes_gerais`, chave `configuracao_orcamento`;
- titulo, validade, fotos, preco unitario, assinatura/aceite, observacao padrao e rodape;
- validade inicial = 7 dias;
- PDF de Orcamento Balcao aplica o padrao salvo.

## BRANCH ATUAL — PRODUCAO / PLANO DE CORTE V1
Implementado:
- nova etapa `/producao/plano-corte`, ligada ao setor Producao ao lado da Medicao Final;
- pesquisa produtos cadastrados na categoria `porta_janela_padrao` (ex.: porta de correr 3 folhas);
- produto fornece nome e medidas de referencia quando cadastradas;
- usuario escolhe a tipologia/receita tecnica validada da Engenharia; o sistema nao adivinha receita;
- ao gerar, cria snapshot editavel do plano e copia perfis/acessorios/reforcos da receita sem alterar a receita original;
- variaveis editaveis por plano: largura, altura, quantidade, folga largura/altura, linha, folhas, montagem, trilho, contramarco, arremate, fechadura, puxador, mao amiga, travessas e roldana;
- componentes do snapshot permitem trocar perfil/acessorio por outro produto tecnico cadastrado, ajustar quantidade, unidade e corte final em mm;
- formulas existentes na receita aparecem como referencia; se ainda nao estiverem validadas o sistema nao inventa resultado de corte;
- planos recentes podem ser reabertos e continuados;
- permissao usa o setor Producao existente: Master = edicao; funcionario com `edicao` pode alterar; `consulta` apenas visualiza; `oculto` nao acessa;
- migration `20260815100000_plano_corte_producao_v1.sql` cria `planos_corte` e `plano_corte_componentes`.

## ORDEM ATUAL POR PECA — MEDICAO FINAL
1. identificacao da peca;
2. foto da trena LARGURA / ALTURA;
3. Largura Baixo / Meio / Cima;
4. Altura Direita / Meio / Esquerda;
5. Contramarco / Arremate / Cadeirinha / Cantoneira — SIM/NAO;
6. observacao;
7. demais campos configuraveis;
8. fotos adicionais.

## W.VETRO
Integracao live continua bloqueada ate haver credenciais/ambiente de teste e schemas reais. Regras: server-side, iniciar somente leitura, nao adivinhar payload, Atlas continua fonte da verdade, PDF original preservado e dimensao ausente nunca inventada.

## VERCEL
- conta Hobby atingiu limite diario de deployments (>100 em 24h);
- PR #128 de retry foi fechada sem merge;
- continuar desenvolvimento agrupado na PR #129;
- nao mergear para producao enquanto o limite estiver ativo, salvo decisao explicita do usuario.

## IMPLEMENTADO MAS NAO VALIDADO EM PRODUCAO
- navegacao essencial/Favoritos simplificados;
- Configuracoes -> Orcamento e novo padrao do PDF;
- Plano de Corte V1 e migration ainda precisam validacao depois que a quota de deploy liberar;
- PR #122 ainda precisa teste real de pausa/retomada em campo.

## DIVIDA TECNICA / SEGURANCA
- formulas de corte ainda dependem das receitas tecnicas validadas por tipologia; nao executar formula nao validada automaticamente;
- paginas antigas continuam no codigo, apenas fora da navegacao principal;
- Favoritos seguem locais por dispositivo/navegador;
- testes automatizados de regra de negocio ainda nao existem;
- nao usar `migration repair --reverted` sem diagnostico explicito.
