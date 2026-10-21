# Blog de Soluções Esquadrifácio® — estratégia de IA editorial

## Objetivo
Transformar dúvidas reais de clientes sobre esquadrias de alumínio em artigos práticos e úteis. O blog reforça confiança e autoridade técnica, direciona para as páginas de soluções e facilita a solicitação de orçamento — sem prometer resultado de SEO ou visibilidade garantida em sistemas de IA.

## Equipe de especialistas (papéis da IA + validação humana)
1. **Estratégia de SEO local e conteúdo:** pesquisa intenção de busca, prioriza temas relacionados às cidades atendidas, evita títulos apelativos e repetição.
2. **Redação e comunicação técnica:** prepara textos em português brasileiro claro, com exemplos aplicáveis e perguntas de clientes.
3. **Especialista técnico em esquadrias:** verifica tipologias, linhas, montagem, vidros, medições, ferragens e limites das especificações; quando necessário, encaminha a Júlio/projetista ou responsável técnico para checagem.
4. **Revisão de marca e comercial:** mantém a linguagem consultiva da Esquadrifácio®, com chamada para orçamento sem promessas irreais.
5. **Edição e publicação:** confirma direitos de uso de imagens, revisa informações legais e autoriza a entrada no site depois do aceite.

Papéis de IA são tarefas editoriais assistidas, **não profissionais humanos contratados nem agentes autônomos conectados ao ERP**.

## Cadência e fila
Proposta inicial: **duas novas pautas/rascunhos por semana**, mais atualização de artigos existentes quando surgirem informações verificadas. Usar a fila em `pautas.json` para evitar assuntos repetidos.

Workflow: **Ideia → Rascunho da IA → Revisão técnica → Revisão editorial/comercial → Aprovado → Publicado.**

O arquivo `artigos.json` é a base estruturada. Conteúdo com `status=rascunho` ou `revisao` aparece **somente na homologação protegida**, com aviso de revisão e `noindex,nofollow`. O gerador público não inclui esses textos. Para liberar um artigo, é necessário `status=aprovado`, `revisaoTecnicaConfirmada=true` e `publishedAt` válido. Nenhum agente pode ajustar esses campos sem registro de aprovação humana.

## Padrões obrigatórios
- **Não inventar** preços, prazos, garantias, disponibilidade, gramaturas, linhas, dimensões máximas, resistência ou requisitos ABNT. Sempre distinguir possibilidades de especificações confirmadas.
- Não chamar conteúdo ilustrativo de obra real. Usar somente fotografias aprovadas e inalteradas, ou imagens que recebam nova autorização.
- Sempre indicar que medições finais, segurança, estrutura, normas e especificações devem ser verificadas caso a caso.
- Não usar dados identificáveis de clientes do Atlas sem consentimento, política de privacidade e controle de acesso. Perguntas podem inspirar temas somente após anonimização e avaliação.
- Evitar artigos duplicados, textos para preencher palavras-chave e afirmações sobre ranking garantido.
- Quando citar normas ou requisitos de fabricantes, consultar a fonte vigente e registrar a referência na pauta para revisão técnica.

## Integração futura com Atlas One Marketing
A ligação com o Atlas deverá ser **isolada, somente depois de homologada**, sem mexer nos fluxos já aprovados do ERP.

Arquitetura proposta:
- A IA de marketing sugere pautas baseadas em pesquisa e dúvidas frequentes **sem acessar automaticamente dados pessoais**.
- Um Kanban editorial de marketing permite acompanhar o texto, os responsáveis e a aprovação.
- Somente a aprovação explícita de quem tem permissão deve gerar uma atualização de conteúdo para o site público, com prévia, testes, registro da revisão e rollback.
- Nunca publicar diretamente a partir de mensagens de WhatsApp, informações de CRM ou respostas não verificadas.

## Geração e publicação
- `gerar-blog.mjs`: gerador estático; não acessa modelos de IA, não pesquisa a internet e **não publica automaticamente**.
- `preparar-publicacao.mjs`: incorpora blog, sitemap e feed RSS **apenas com posts aprovados**, mantendo SEO técnico separado da revisão humana.
- `validar-blog.mjs`: verifica rascunhos e ligações dos canais de atendimento.
- `verificar-links.mjs`: audita links, âncoras e imagens do site e artigos.
- `testar-lancamento.mjs`: simula aprovação em cópia temporária e comprova que conteúdo não aprovado não vai para produção.

## Indicadores sugeridos (quando o site estiver publicado e houver consentimento adequado)
Visualizações por artigo, contatos originados dos artigos, buscas que mostram as páginas no Search Console, atualizações necessárias por conteúdo, taxa de revisão técnica e perguntas recorrentes sobre produtos. **Nenhuma métrica real está conectada nesta etapa.**


## Ciclo editorial atual — 21/10/2026
Cinco rascunhos aguardam revisão. Foram incorporadas duas novas dúvidas práticas (janela de correr x maxim-ar; vidro temperado x laminado) e retiradas da fila para impedir republicação duplicada. Oito pautas permanecem disponíveis. O leitor ganhou sumário por capítulo, perguntas frequentes (sem dados estruturados de FAQ), artigos relacionados, categorias e estimativa de leitura.

A IA deve conferir antes de cada nova pauta os slugs/títulos já existentes em `artigos.json` **e** as propostas de `pautas.json`. Não tratar o texto gerado como informação técnica aprovada; nunca trocar `status`, `revisaoTecnicaConfirmada` ou `publishedAt` sem aprovação humana específica. Os artigos enviados pelas tarefas agendadas do ChatGPT são rascunhos na conversa, não publicações nem alterações automáticas do repositório.

A publicação pública do blog só pode ocorrer num deploy separado do site institucional, com pacote, prévia, testes, backup/rollback e aceite explícito do responsável.
