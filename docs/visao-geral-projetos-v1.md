# Atlas One — Visão Geral de Projetos e Planejamento de Instalação
Data: 24–25/10/2026. Branch isolada: `feat/visao-geral-etapas-20261024`.

## Situação comprovada
- **Implementado na branch de desenvolvimento, NÃO publicado:** telas em `/visao-geral-projetos` e `/relatorios/instalacoes`; projeção somente leitura autenticada dos dados de venda/obra; solicitações de compra separadas; abas do painel lateral; modo TV; visão de capacidade mensal; regras de configuração e de metas. Tipos e testes locais aprovados.
- **Prévia local demonstrativa sem banco:** `http://localhost:4017/atlas-visao-geral-preview.html`, servidor Python na própria máquina, preso a `127.0.0.1:4017`. Funciona sem login; todos os nomes e valores são fictícios. Além dela, as páginas Next aceitam `?demo=1` dentro do shell Atlas, que continua exigindo autenticação.
- **Migrações CANDIDATAS, não aplicadas:** `20261025030000_instalacao_planejamento_visao_geral_v1.sql` e `20261025031500_visao_geral_colunas_por_empresa_v1.sql`. O uso real de metas, reservas e colunas persistentes exige aplicar/verificar essas migrações somente em ambiente de homologação autorizado. O servidor retorna aviso claro enquanto elas não existem.
- **NÃO verificado ainda com base real de teste nem homologado com usuário:** conciliação completa de tipologias, lista técnica de materiais, estoque, recebimentos parciais, equipes de instalação e eventos históricos; é requisito de aceite antes da produção.

## Layout aprovado / oito colunas
Vendido → Separação de Materiais → Compras → Aguardando Material → Medição Final → Produção → Instalação → Finalizado.
Uma posição principal por venda/obra, inclusive venda confirmada ainda sem obra vinculada (com pendência explícita). Cores: verde no prazo, amarelo atenção, vermelho atraso, azul conclusão e cinza prazo não apurado. O card mostra nome do cliente, **número original do orçamento** e três barras de Perfis/Vidros/Acessórios; valores monetários ficam ocultos na TV/board e somente aparecem no painel autorizado. Quando não há informação quantitativa confiável por categoria/unidade, exibir `Não apurado`.

Pedidos de compra reais (`compras_solicitacoes` + itens) têm mini-cards próprios em Compras ou Aguardando Material, com identidade `solicitação + obra`, e NÃO duplicam o card principal da venda; pedidos que cobrem mais de uma obra geram um mini-card por obra. Quando há múltiplas vendas ligadas à mesma obra e o orçamento do pedido é ambíguo, identificar `orçamento não vinculado`, não escolher automaticamente. No painel de compra, mostrar quantidade por item, pedido emitido versus recebimento real de `compras_carrinho_itens`, fornecedor e responsável **pelo registro do carrinho**, sem afirmar falsamente que esse responsável necessariamente efetuou a compra. Perfis/acessórios exibem `foto_url` do produto cadastrado da mesma empresa, quando existe; sem foto mostrar `Imagem pendente`, jamais imagem aleatória.

## Vínculo com Cliente 360
- Venda em `vendas_obras`, orçamento em `orcamentos.numero`, cliente e obra de mesma empresa. Abrir Cliente 360 pela venda real, mantendo as permissões.
- `compras_necessidades` legadas entram na apuração de perfis/vidros/acessórios somente quando quantidade e unidades compatíveis foram verificadas; `compras_solicitacao_itens` e carrinhos são apresentados na lista detalhada de pedidos, sem consolidar fontes de forma potencialmente duplicada.
- Ordens de produção começam apenas com status efetivo de execução; uma OP apenas criada não equivale a produção iniciada; encerramento somente quando a venda estiver concluída **e** todas as OPs/instalações válidas estiverem concluídas.
- Medições existentes são tratadas inicialmente como em andamento; a presença de um cabeçalho não prova medição integral concluída. O cruzamento por tipologia requer validação adicional.
- Compras/vidros podem continuar como pendência paralela se a produção de outras tipologias já estiver executando. Não mover automaticamente para trás nem duplicar o card de projeto.
- Campos de instalação planejada vêm exclusivamente da tabela de reserva própria, **não** da data comercial `obras.previsao_entrega`.

## Configuração por empresa
`lib/visaoGeralProjetos.ts` valida cobertura exclusiva de cada etapa operacional. Criar, renomear, reordenar, vincular e excluir colunas são ações sobre layout, sem tocar nos estados operacionais. Excluir obriga escolher destino dos vínculos, não apaga projeto. Persistência candidata com RPC exclusiva de `service_role`, autorização redundante de Master, transação e histórico. Nenhum acesso direto de `anon`/`authenticated` às tabelas de configuração.

## Relatório / capacidade de instalação
- Gráfico dos próximos seis meses, calendário, valores previstos, confirmados e concluídos, total programado, meta financeira mensal (R$), percentual e saldo de capacidade.
- Regra de atenção a partir de 85% da meta; excedeu meta -> alerta e **bloqueio na RPC** até que o Master registre justificativa de excesso. Uma reprogramação da mesma venda substitui a reserva anterior e não soma duas vezes. Histórico auditado na mesma transação.
- Meta financeira em reais **não é** capacidade operacional física. Agendamento de equipes, dias/homens, deslocamento e duração de instalação exigem futura conciliação com as agendas oficiais. Programar a data não confirma instalação concluída.
- Nunca alterar instalação operativa ou faturamento automaticamente a partir da agenda.

## Validação / próximas tarefas antes de qualquer publicação
1. Executar `node scripts/test-visao-geral-etapas.cjs`, `node scripts/test-instalacao-capacidade.cjs`, `npm run typecheck`, `npm run release:check`; comparar resultado com código anterior.
2. Testar prévia visual no Mac e ajustar de acordo com Francis; garantir que imagem, tipografia e cores mantenham modelo aprovado.
3. Validar SQL em Supabase de **homologação** e executar testes transacionais com rollback: Master, não Master, isolamento de empresa, concorrência de reservas, meta excedida/justificativa, auditoria, reprogramação e observações. Não aplicar ao banco de produção diretamente.
4. Com dados reais autorizados em ambiente de teste, confrontar 1 venda com várias tipologias, medida final parcial, compra/recebimento parcial, fornecedor, vidro em paralelo e duas vendas na mesma obra; não inventar percentuais ou orçamento.
5. Após aceite, PR, revisão, snapshot de produção, release check, plano de rollback e **autorização específica de Francis** para publicar.

**Regra preservada:** não alterar nem apagar módulos de compras, estoque, medição, produção, instalação, financeiros, tarefas e permissões que já estão funcionando.
