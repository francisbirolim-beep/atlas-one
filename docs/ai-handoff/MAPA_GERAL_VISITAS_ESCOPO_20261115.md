# Atlas One — Mapa Geral, Prospecção e Solicitação de Visitas
Data: 2026-11-15
Situação: escopo funcional validado em conversa; implementação e publicação pendentes.
Branch de trabalho isolada: `feat/mapa-geral-checkins-compartilhamento-20261115`

## Regras do projeto
1. Reproduzir fielmente a última prévia visual aprovada; não modificar o que já funciona.
2. Implementar em etapas com check-in verificável, testes de regressão e deploy em segundo plano somente depois da validação.
3. Preservar registros de clientes, orçamento, obras, GPS e W.Vetro, sem sobrescrever dados existentes.
4. Toda atribuição, compartilhamento e acesso a foto deve respeitar empresa, usuário e permissões.
5. Nunca presumir número exato do imóvel apenas pelo GPS. Indicar quando número for informado pelo usuário, sugerido pelo mapa, não confirmado ou ausente.

## Entradas de uma mesma Central de Prospecção
### A — Obra identificada em campo
- Usuário passa em frente à obra, registra identificação ou referência, localização GPS e, opcionalmente, foto(s) da fachada.
- Rua, bairro, cidade e CEP podem ser sugeridos pela geocodificação reversa; usuário confere e corrige.
- Permitir salvar mesmo se não houver contato do proprietário, número confirmado ou foto.

### B — Cliente solicita visita na empresa
- Atendente abre "Prospecção > Nova oportunidade > Pedido de visita".
- Informa cliente (localizar cadastro existente por nome/telefone antes de criar), telefone/WhatsApp, nome ou referência da obra, rua, número (ou S/N), bairro, cidade, CEP, referência/observações, e motivo da visita.
- Endereço digitado é suficiente para salvar e designar visita; GPS e fotos da fachada são opcionais no cadastro inicial.
- Origem do registro = "Pedido de visita na empresa", distinta de "Prospecção em campo", sem contabilizar pedido como visita realizada.
- Usuário poderá selecionar vendedor/responsável e, quando disponível, data ou prioridade da visita, com autorização apropriada.
- Evitar cadastrar novo cliente/obra quando houver vínculo existente; nunca misturar obras diferentes do mesmo cliente.

### C — Vendedor recebe e executa a visita
- Criar "Minhas visitas" com itens atribuídos, cliente, telefone, endereço, status, foto (se houver) e botão "Traçar rota".
- O endereço/coord. abre Google Maps ou Waze no celular mediante toque explícito no botão; se não houver coordenadas confirmadas, usar endereço disponível e sinalizar a limitação.
- Na obra, vendedor acrescenta/corrige GPS, confirmação de endereço/número, foto(s) da fachada e observações sem perder os dados inseridos pelo escritório.
- Registrar visita realizada, tentativas, retornos e resultado, com data/hora e usuário. Uma solicitação pode gerar várias interações sem duplicar a obra.
- Permitir encaminhar a visita para outro vendedor autorizado com registro de atribuição.

### D — Orçamento na obra, instalação e compartilhamento
- Dentro de "Novo orçamento > Cliente e obra > Endereço da obra", adicionar "Fotos da obra/fachada" independentes das fotos por esquadria.
- Captura pela câmera ou galeria; fotos opcionais; preservar rascunho/offline, envio existente e fotos dos itens.
- Vincular fotos e localização à obra, consultáveis na ficha/mapa, respeitando permissão.
- Dentro da ficha da obra/prospecção/orçamento, ação "Compartilhar localização e fotos":
  - Interno: link autenticado para usuários autorizados com endereço, foto e botão GPS.
  - Externo: acesso limitado, revogável e temporário, por token aleatório, sem expor automaticamente dados pessoais/financeiros do cliente; compartilhar apenas os campos explicitamente autorizados.
  - Copiar link ou usar menu nativo de compartilhamento no celular/WhatsApp; expiração e revogação.
- Foto de fachada é do local da obra, não da esquadria; preservar ambos os tipos sem confusão.

## Mapa Geral — recursos já aprovados
- Mapa de José Bonifácio e demais localidades com um ponto por obra, acompanhando o status ao longo da prospecção, orçamento, venda, produção e conclusão.
- Pinos: azul prospecção; amarelo orçamento; verde venda fechada; roxo produção; turquesa concluída; cinza perdida/cancelada.
- Filtros combináveis cidade, bairro, responsável, data/mês/período, tipos de pino multisseleção, busca de cliente/obra.
- Indicadores e gráficos atualizados conforme filtros; eventos por sua data real (visita, emissão de orçamento, fechamento de venda), sem confundir estado atual com evento histórico.
- Clique no pino abre obra, endereço, fotos da fachada, responsável, ficha, histórico, link para rota.
- Relatórios de prospecções/visitas, orçamentos, vendas, oportunidades, PDF A4 e Excel, com endereços/coord. e indicação de número não confirmado.
- Agrupamento de muitos pinos, responsividade e controles por perfil de usuário.

## Lacunas técnicas verificadas no código atual (antes de qualquer alteração)
- Prospecções atuais possuem GPS (latitude, longitude, precisão), cidade, bairro, endereço, `responsavel_id` e histórico (`prospeccao_interacoes`).
- Cadastro atual de `app/prospeccao/nova/page.tsx` ainda não possui arquivo/foto da fachada, nome e telefone editáveis explícitos, nem modo "Pedido de visita na empresa".
- `app/orcamento-rapido/page.tsx` já tem fotos de cada esquadria e GPS/endereço no cabeçalho, porém o conjunto de fotos gerais é vazio na tela atual; adicionar foto da fachada exige integração com rascunho e persistência existentes.
- As políticas de leitura de prospecção hoje permitem dono do registro ou master; encaminhar uma visita a outro vendedor requer permissão compatível, sem afrouxar segurança.
- `lib/upload.ts` gera URL pública de fotos; avaliar armazenamento privado e URLs assinadas para fotos compartilhadas externamente, sem mudar bucket existente no escuro.
- O mapa `components/MapaProspeccoes.tsx` já exibe prospecções por pinos; mapa unificado deve ser nova visão isolada antes de integrar vendas e orçamentos.

## Entrega em 9 etapas, com check-in obrigatório
1. Levantamento e escopo: requisitos de mapa, pedido de visita em escritório, foto fachada, encaminhamento e compartilhamento; auditoria do legado.
2. Modelo unificado de obra/cliente e lista de atribuições, evitando duplicação e distinguindo tipos de origem e eventos de visita.
3. GPS/geocodificação, precisão, número confirmado e fotos da fachada em Prospecção e Novo Orçamento, incluindo rascunho/offline.
4. Filtros múltiplos, data, indicadores e cores dos pinos.
5. Ficha da obra, planejamento de visita e abrir rota no GPS (Google Maps/Waze).
6. Listas para vendedores, compartilhamento interno/externo seguro, relatórios de visitas e exportações.
7. Permissões, auditoria, revogação de links, proteção de fotos e testes de segurança.
8. Integração em preview isolado, comparação fiel com a última prévia aprovada e testes reais autorizados.
9. Regressões completas, validação final, implantação em segundo plano e confirmação em produção.

## Check-ins
- [x] 1A — Mapeadas funções já existentes e lacunas, com base em arquivos reais do projeto.
- [x] 1B — Escopo consolidado em documento na branch isolada.
- [ ] 1C — Validação técnica de estratégia de fotos privadas, permissões e modelo de atribuição.
- [ ] 2 a 9 — Implementação e testes pendentes.
Nenhum ajuste de tela, tabela, permissões ou deploy de produção é declarado concluído apenas por este documento.
