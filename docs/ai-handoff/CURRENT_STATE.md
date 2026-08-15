# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #127. A branch atual `feat/limpeza-e-fluxo-operacional` agrupa a proxima fase de limpeza da navegacao e o novo padrao configuravel de orcamento/PDF.

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
- atalhos antigos salvos no localStorage que nao pertencem mais a `GUIAS` deixam de aparecer, sem apagar rotas ou dados;
- topbar remove botoes sem funcao real (`IA Atlas` e notificacoes) e transforma o perfil em menu funcional com logout/configuracoes;
- nenhuma rota funcional foi excluida do codigo e nenhum dado foi apagado.

## BRANCH ATUAL — CONFIGURACOES DO ORCAMENTO E PDF
Implementado:
- nova rota Master `/configuracoes/orcamento`;
- configuracoes persistidas na tabela existente `configuracoes_gerais`, chave `configuracao_orcamento`; sem migration;
- campos: titulo do documento, validade em dias, foto dos itens, preco unitario, assinatura/aceite, observacao padrao e rodape;
- padrao inicial de validade = 7 dias;
- `lib/pdfOrcamentoBalcao.ts` agora aceita titulo, validade, assinatura e rodape configuraveis;
- `app/orcamento/balcao/novo` carrega o padrao salvo e aplica as opcoes ao PDF, mantendo a possibilidade de ajustar foto/preco unitario no orcamento atual.

## ORDEM ATUAL POR PECA — MEDICAO FINAL
1. identificacao da peca;
2. foto da trena LARGURA / ALTURA;
3. Largura Baixo / Meio / Cima;
4. Altura Direita / Meio / Esquerda;
5. Contramarco / Arremate / Cadeirinha / Cantoneira — SIM/NAO;
6. observacao;
7. demais campos configuraveis;
8. fotos adicionais.

O fluxo existente foi revisado nesta etapa e a ordem acima continua coerente com o pedido validado. Nao foram inventados novos campos de medicao sem validacao do usuario.

## W.VETRO
Referencia publica informada pelo usuario: `Wvetro Integrations v2` no Postman. A pagina publica foi localizada, mas o crawler nao expoe os schemas/exemplos internos dos endpoints de forma suficiente para implementar campos proprietarios com seguranca.

Regra permanente:
- integracao sera server-side;
- iniciar somente leitura;
- nao adivinhar payload, campos ou autenticacao;
- Atlas continua fonte da verdade;
- PDF W.Vetro original sempre preservado;
- dimensao ausente nunca e inventada.

Implementacao live da API continua bloqueada ate haver credenciais/ambiente de teste W.Vetro e acesso aos schemas reais dos endpoints.

## VERCEL
- conta Hobby atingiu limite diario de deployments (>100 em 24h);
- PR #128 de retry foi fechada sem merge para nao gerar novas tentativas desnecessarias;
- continuar desenvolvimento em uma unica branch/PR agrupada;
- nao promover/mergear para producao enquanto o limite estiver ativo, salvo decisao explicita do usuario.

## IMPLEMENTADO MAS NAO VALIDADO EM PRODUCAO
- navegacao essencial da branch atual;
- Favoritos mobile simplificado e administracao mobile;
- Configuracoes -> Orcamento;
- novo padrao aplicado ao PDF de orcamento Balcao;
- PR #122 ainda precisa teste real de pausa/retomada em campo;
- persistencia dos quatro SIM/NAO, observacao, fotos e medidas continua em validacao de campo.

## DIVIDA TECNICA / SEGURANCA
- paginas antigas/menos usadas continuam no codigo, apenas fora da navegacao principal; excluir somente depois de validar dependencias.
- registro legado de setor `Medida final` pode continuar fisicamente no banco; esta fora da operacao.
- Favoritos seguem locais por dispositivo/navegador.
- testes automatizados de regra de negocio ainda nao existem.
- nao usar `migration repair --reverted` sem diagnostico explicito.
