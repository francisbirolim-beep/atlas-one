# Permissões de IA e relatórios — conclusão técnica em 16/10/2026

Escopo: fechar os caminhos pendentes de IA e relatórios do PR #863, preservando Cliente 360, Kanbans, Compras, Produção, Instalação e cálculos homologados. Este documento substitui a lista de pendências de IA/relatórios do primeiro rascunho; não representa uma auditoria de todo o ERP.

## IA

- Um resolvedor do servidor combina setores, ações individuais, carteira CRM e restrições de domínio já existentes. Falha de leitura, escopo desconhecido e setor oculto negam acesso.
- Geral, ferramentas legadas, Comercial e especialistas usam a mesma decisão. A rota Comercial de funcionário reaproveita o especialista e mantém o contrato de resposta.
- Carteira própria por UUID do criador do orçamento e vínculo UUID do cliente, sem usar nome como prova de autoria. Registros antigos sem vínculo seguro não são exibidos como próprios.
- Totais de produção/financeiro usam o mesmo filtro de criador das listas. RH próprio retorna somente o usuário. Estoque e histórico W.Vetro sem autoria segura ficam indisponíveis no escopo próprio, sem extrapolar para a empresa.
- Gestão não concede acesso implícito a Financeiro ou Orçamentos. O contexto federado verifica cada domínio. Histórico operacional/suprimentos misturado exige acesso a todos os domínios que compõem a fonte.
- Estimativas históricas da empresa não são executadas para escopo próprio, tanto no atalho geral quanto no especialista/contexto federado.
- Sessões OpenCode usam assinatura das fontes de autorização. Após mudança de permissão, a conversa continua com uma nova sessão. Histórico geral enviado ao provedor é reconstruído no servidor com a assinatura vigente, sem confiar em respostas antigas enviadas pelo navegador. A listagem de conversas de funcionário segue o mesmo filtro, sem apagar registros.
- Exemplos antigos e memória livre corporativa não são injetados no contexto restrito do funcionário. Fontes públicas e anexos continuam disponíveis dentro das regras existentes.
- Feedback é limitado à interação do próprio funcionário (Master supervisiona). Correção de funcionário permanece feedback; promoção direta a memória oficial exige Master.
- Conhecimento setorial respeita domínio; escopo próprio lê apenas material do criador. Validação requer edição e alcance de setor.
- Central de aprendizado: funcionários veem as próprias entradas; Master mantém supervisão completa. Aplicação em produtos/fornecedores exige edição do domínio e do cadastro de destino. Sem edição, catálogo continua pendente, sem aplicar automaticamente.
- Áudio, imagem, transcrição interativa, conversas e confirmação de propostas respeitam bloqueio da IA. Token de automação existente e direitos sobre diário privado/consentimento são preservados.

## Relatórios

- Políticas únicas de consulta, edição e exportação para todas as APIs de relatórios.
- Obras/CMV, Financeiro/DRE, book gerencial e plano de contas continuam restritos a funcionários até autorização explícita por ação. O Master mantém o comportamento anterior.
- O teto dos setores continua obrigatório; uma autorização de relatório não libera um setor oculto. Obras/book de empresa também exigem carteira comercial de todos os registros.
- Resumos Comercial e de Medição passam por API autenticada e filtrada por empresa; Comercial aplica carteira própria. Os cálculos originais foram preservados, com período em São Paulo e falhas explícitas em vez de zero silencioso.
- Plano de contas em consulta não semeia cadastros nem permite classificação. POST exige edição antes de consultar ou alterar o título e valida empresa do título e do plano.
- Layout verifica permissões antes de montar as páginas. Central mostra somente abas e links autorizados. Plano de contas pode ser liberado em consulta ou edição separadamente.
- CSV, impressão e book revalidam a autorização no servidor no clique. Consultar informação naturalmente permite lê-la/copiar; a regra de exportação controla as ações oferecidas pelo Atlas, não é DRM sobre conteúdo já exibido.
- Editor aditivo no cadastro de usuários grava as ações na estrutura protegida existente. Escopo detalhado da IA continua na Administração IA. Atalhos de liberar/ocultar tudo incluem os novos controles.

## Validação e preservação

- 67 verificações comportamentais no teste `npm run test:ia-relatorios`, integrado ao CI: bloqueios antes de leitura/provedor/escrita, escopos inválidos, falhas de permissão, teto, tenant, nomes repetidos, totais próprios, sessões antigas, histórico adulterado, exportação e aplicação de aprendizado.
- Regressões: Cliente 360, cadastros, entrada NF, recebimento de venda, PostgreSQL/RLS isolado, permissões Kanban, 31 relatórios, book A4/branding/imagens e 21 verificações de fornecedores/caso Adilson.
- Consulta de metadados confirmou colunas de autoria/empresa e políticas protegidas de configurações. Não houve alteração em permissões de funcionários, dados reais, schema, RLS ou migrations.
- Typecheck aprovado. Executar o preflight completo sobre o commit final antes da integração/publicação.
- Rollback: reverter os commits do PR e publicar a revisão anterior. As permissões adicionais são chaves opcionais de ações; nenhuma transformação de dados precisa ser desfeita.
