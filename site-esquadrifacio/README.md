# Site público Esquadrifácio® — homologação premium v5

## Origem e objetivo
- Construído **sobre o HTML exato da prévia premium v5 aprovada em 18/10/2026**, preservando a composição, tipografia, cores, fotografias e estrutura principal.
- Esta pasta é **um site estático independente** do app Next.js do Atlas One. Não importar os arquivos no roteamento `app/` nem na navegação privada do ERP.
- `index.html`: homepage institucional leve, com oito imagens WebP independentes em `assets/`, seções de soluções, portfólio, apresentação e botões de orçamento funcionais.
- `solucoes.html`: página complementar com nove categorias de esquadrias, processo de atendimento, perguntas frequentes e WhatsApp comercial. Mantém a vitrine premium aprovada sem alterações estruturais.
- `politica-de-privacidade.html`: orientações sobre o uso dos canais de contato.
- `vercel.json`: cabeçalhos de segurança; `robots.txt` e meta robots em ambas as páginas **bloqueiam indexação enquanto estiver em homologação**.

## Contatos e localização — WhatsApp confirmado pelo proprietário
- WhatsApp comercial **confirmado pelo proprietário em 19/10/2026**: **(17) 99636-1318**. Usar como destino de pedidos de orçamento em todos os botões da homepage e na política de privacidade. Não modificar sem nova orientação.
- Instagram: https://www.instagram.com/esquadrifacio/.
- Endereço conferido para a prévia: Av. Leonel Guilherme Pereira, 775, Residencial Veneza, José Bonifácio - SP, CEP 15202-420.
- Link de localização fornecido pelo proprietário: https://maps.app.goo.gl/SnZxkUvSYJLgceed6. O botão **Como chegar** abre rota para o ponto `-21.050927,-49.667694` informado no Google Maps. O endereço escrito também abre a ficha do local.
- Rodapé: Instagram e Como chegar em destaque responsivo, sem alterar o visual principal do site.
- Região atendida: José Bonifácio — SP e região.
- Verificar endereço informado na política e escolher dado oficial de contato LGPD.

## Publicação segura, SOMENTE após aprovação explícita do usuário
1. Conferir com o proprietário a versão responsiva e os textos. As oito fotos existentes estão autorizadas para o site institucional, com hashes em `autorizacao-fotos.json`; qualquer mudança de arquivo exige nova autorização. O WhatsApp foi confirmado em 19/10/2026.
2. Validar a página em um projeto Vercel **separado** do Atlas com a raiz deste site como Root Directory; não alterar domínios nem deploy do projeto `atlas-one`. O usuário precisa aprovar o preview antes de apontar domínio.
3. Verificar redirecionamento WhatsApp real em celular e desktop; abrir Instagram e a política de privacidade; testar imagens e navegação com teclado e leitores de tela.
4. Resolver situação e DNS do domínio **esquadrifacio.com.br** na conta do proprietário, e só então atualizar canonical/og:url, gerar `sitemap.xml`, permitir indexação em `robots.txt` e retirar `noindex,nofollow`.
5. Validar textos legais, título/meta SEO local, Search Console, Perfil da Empresa no Google, compartilhamento social, performance de imagens e política de privacidade antes de ativar analytics.
6. Registrar rollback: manter última versão aprovada e DNS anterior para reversão, sem interferir no Atlas One.

## Critérios de aceite automático
Executar `node site-esquadrifacio/validar-site.mjs`, `node site-esquadrifacio/testar-lancamento.mjs` e `node site-esquadrifacio/verificar-links.mjs` na raiz do repositório. Os testes são locais: conferem conteúdo e bloqueios de publicação, simulam a geração segura e verificam links, âncoras e arquivos de imagens. Não fazem requisições externas nem alteram o site publicado.

## Limites desta etapa
- O WhatsApp comercial e a divulgação das oito fotografias exatas da prévia foram aprovados em 19/10/2026. **Permanecem pendentes** revisão legal e autorização explícita para a troca do site. A administração do domínio foi identificada em capturas do hPanel em 19/10/2026.
- Não há formulário, banco, CRM, integração com Marketing Inteligente, automação IA nem publicações em redes sociais.
- As oito fotografias já estão em arquivos WebP independentes; o HTML e as imagens originais não são substituídos na geração da versão de lançamento.
- **Não publicar esta versão na internet ou indexá-la sem aprovação expressa.**

## Otimização e acessibilidade (18/10/2026)
- Foram extraídas as mesmas oito imagens WebP da prévia aprovada para arquivos estáticos com nomes descritivos, **sem recorte, alteração, substituição nem perda de qualidade**. A página caiu de ~1,27 MB de HTML para menos de 20 KB; os oito arquivos somam ~940 KB e passam a carregar conforme demanda.
- Foto de destaque é priorizada; demais imagens têm carregamento sob demanda e tamanhos intrínsecos. Favicon usa a marca ®.
- Há atalho acessível para ir ao conteúdo e botão discreto de orçamento no celular (WhatsApp comercial confirmado). Respeita movimento reduzido e área segura de celulares.
- Sem alteração do projeto Atlas, domínio, banco, APIs ou SEO de produção. A versão continua com `noindex,nofollow`.

## Preparação para publicação — 19/10/2026

**Dois modos de compilação estática, sem deploy automático:**

```sh
node site-esquadrifacio/preparar-publicacao.mjs --modo=homologacao
# Gera somente site-esquadrifacio/.gerado/homologacao, com noindex e robots Disallow.

node site-esquadrifacio/preparar-publicacao.mjs --modo=producao --dominio=https://esquadrifacio.com.br
# BLOQUEADO por padrão até quatro liberações explícitas.
```

Em `controle-lancamento.json`, **fotos e controle do domínio identificados**, com autorização do proprietário em 19/10/2026 registrada em `autorizacao-fotos.json` e hash SHA-256 de cada arquivo. Os dois controles restantes continuam false: privacidade_revisada e publicacao_autorizada. O domínio aparece no hPanel autenticado do proprietário, com painel de DNS acessível; veja evidencia-dominio.json. Isso não autoriza trocar registros. Não usar aprovações simuladas na produção. Uma foto alterada ou substituída bloqueia a compilação até nova aprovação. A confirmação de uso das fotos não autoriza publicar nem trocar DNS.

Após confirmar cada etapa e registrar a autorização do proprietário, o gerador de candidato público cria `.gerado/producao/`, contendo canonical HTTPS correto na homepage, soluções e privacidade; metadados de compartilhamento, imagem OG, dados estruturados LocalBusiness, `robots.txt` liberado, `sitemap.xml` e cabeçalho CSP com hash da marcação estruturada. **Não publica nada nem altera DNS**; é necessário um deploy manual do diretório gerado em projeto Vercel próprio e separado do Atlas.

No projeto Vercel exclusivo do site, usar os **arquivos gerados** como raiz estática (não a pasta de origem nem o monorepo Next.js) e conferir o domínio antes de apontar DNS. Guardar o deploy anterior para rollback. Não habilitar integrações Git que publiquem automaticamente rascunhos. Após publicação autorizada, testar HTTPS, WhatsApp, Instagram, GPS, sitemap, robots, compartilhamento e Search Console, sem modificar o projeto `atlas-one`.

**Observação sobre domínio:** em 19/10/2026, `esquadrifacio.com.br` respondia HTTP 200 e apontava para a hospedagem existente. Isso **não comprova a titularidade do domínio nem autoriza sua substituição**. Conferir posse e capacidade de editar DNS no Registro.br/Hostinger com o proprietário.

**Pendente para liberação:** revisão jurídica e aprovação do texto de privacidade; revisão do plano de DNS e autorização expressa do lançamento. **Oito fotos atuais autorizadas e registradas**, sem abranger futuras trocas ou novas mídias.

## Autorização de imagens (19/10/2026)

O proprietário respondeu `pode seguir assim` à pergunta sobre a divulgação pública das oito fotos da prévia. Essa autorização foi interpretada exclusivamente para **as oito imagens existentes e inalteradas** no site institucional, e registrada no manifesto `autorizacao-fotos.json` com data, finalidade e SHA-256 de cada WebP. O preparo do site verifica os oito hashes e falha se algum arquivo for trocado ou modificado. Não se estende a anúncios pagos, novos arquivos nem integrações com redes sociais.

**Esta autorização não significa aprovação do deploy.** Confirmar política, domínio, acesso ao DNS e receber autorização de publicação da versão final antes de abrir o site ao público.

## Domínio e preservação de e-mail — 19/10/2026

A administração do domínio foi observada por capturas do hPanel autenticado enviadas pelo proprietário: domínio ativo, gerenciamento e DNS acessíveis. Por isso, dominio_controlado=true significa apenas acesso para planejamento, NUNCA autorização para mudar o DNS. Evidência sem dados pessoais em evidencia-dominio.json.

O registro ALIAS @ mostrado no hPanel apontava para equifacio.com.br.cdn.hstgr.net, grafia distinta da marca. O site atual responde HTTP 200 na Hostinger: NÃO presumir erro nem alterar o alvo antes de comparar com um backup completo dos registros.

Regra obrigatória do corte: preservar nameservers e registros MX, TXT de SPF/DKIM/DMARC, autoconfig/autodiscover. Se a troca for expressamente autorizada, alterar somente registros necessários de site (raiz/www), com valores conferidos para o projeto separado na Vercel. Capturar estado imediatamente anterior, testar HTTPS, www e e-mails pós-corte, e manter rollback.


## Minuta de privacidade em revisão — 19/10/2026

Texto da política complementado para informar responsável (razão social da Esquadrifácio), exemplos de dados recebidos no atendimento, finalidades de elaboração de propostas, compartilhamento com provedores e conservação proporcional às obrigações. É uma **minuta técnica**, sem parecer jurídico ou aprovação do usuário. O controle privacidade_revisada permanece false até aceite explícito do proprietário ou revisão especializada.

A prévia online existente deverá ser atualizada apenas no projeto independente, com autenticação Vercel e noindex. Não configurar o domínio oficial nem permitir indexação enquanto faltar a aprovação do texto.


## Blog de soluções com IA editorial (21/10/2026)

O site ganhou seção “Blog de soluções” na homepage, link no menu e rodapé, e páginas estáticas dedicadas ao blog. **Três artigos completos estão disponíveis somente em homologação e marcados como rascunhos**: escolha da porta de correr, informações para orçamento e painéis ripados amadeirados. São materiais educativos, não prescrições de engenharia. Nenhum texto foi publicado no domínio oficial.

O diretório \`blog/\` contém a biblioteca de artigos (\`artigos.json\`), dez pautas futuras (\`pautas.json\`), identidade visual (\`blog.css\`), renderizador (\`gerar-blog.mjs\`) e procedimentos de revisão por papéis de especialista (\`GUIA_EDITORIAL_IA.md\`).

No modo de homologação, o construtor gera páginas com aviso **“Em revisão”** e \`noindex,nofollow\`. No modo público, só gera artigos com \`status=aprovado\`, \`revisaoTecnicaConfirmada=true\`, data válida e sob as quatro autorizações globais de publicação. O build gera automaticamente rotas dos artigos aprovados no \`sitemap.xml\`, feed RSS e metadados \`BlogPosting\`. Publicação automática de conteúdos novos segue **desativada** até a validação técnica/editorial.

Teste adicional: \`node site-esquadrifacio/blog/validar-blog.mjs\`. O \`verificar-links.mjs\` agora também audita todos os links do blog em uma cópia gerada localmente.

**Integração Atlas:** etapa futura, projeto isolado, dependente de aprovação específica; não há conexão com dados de CRM, WhatsApp, financeiros ou publicações sociais.


## Central editorial somente na prévia (21/10/2026)

O caminho \`/blog/editorial/\` é gerado **exclusivamente em homologação**, no projeto separado e protegido da Vercel. Reúne os 3 artigos em rascunho, 10 pautas futuras, contadores de status e regras de aprovação. É um painel **somente de leitura**, sem botões de aprovação fictícios; a tarefa recorrente do ChatGPT gera rascunhos para revisão mas ainda não grava dados diretamente no repositório.

A geração pública não inclui esta página, os rascunhos nem a fila de pautas. O workflow local e de CI verifica que o painel tem aviso de privacidade, não é indexável, tem navegação válida e fica ausente do pacote de produção.


## Decisão de publicação institucional — 21/10/2026

O proprietário autorizou expressamente a publicação **do site institucional agora**, mantendo o blog para revisão posterior. Por isso \`publicacao_autorizada=true\`. A **política de privacidade ainda precisa de aceite específico**, portanto \`privacidade_revisada=false\` e o gerador de produção segue bloqueado até essa aprovação.

Para publicar só o institucional, usar o modo \`--modo=producao --sem-blog=true --dominio=https://esquadrifacio.com.br\` após todos os bloqueios estarem verdadeiros. Este modo retira os links e a seção do blog, não copia rascunhos nem central editorial, e não inclui RSS ou blog no sitemap. Os demais elementos aprovados (fotos, soluções, WhatsApp, Instagram, GPS, cores) não são modificados. O blog continua protegido em projeto separado até aprovação técnica dos artigos.

Não apontar DNS ou anunciar lançamento enquanto privacidade não estiver aprovada e os testes e backup DNS não estiverem completos.


### Homologação da versão institucional (sem blog)

Antes de publicar, gerar e conferir o **mesmo recorte visual sem blog** usando:
\`\`\`
node site-esquadrifacio/preparar-publicacao.mjs --modo=homologacao --sem-blog=true
\`\`\`
Este comando mantém os cabeçalhos de bloqueio de indexação e deixa o site original inalterado. Não cria páginas de blog nem aponta domínio.


## Política de privacidade aprovada para publicação institucional — 21/10/2026

O proprietário respondeu **“você pode fazer”** à pergunta direta que solicitava aprovação do texto da privacidade e autorização para avançar com a hospedagem comercial gratuita Netlify. Isto registra o aceite da **minuta atual** para divulgação no site institucional, e o controle \`privacidade_revisada=true\`. Não representa parecer jurídico independente nem autorização para publicar os artigos do blog, que seguem em revisão. O ato de apontar DNS continuará exigindo conferência do alvo da nova hospedagem, backup integral da zona do hPanel e testes de SSL e de e-mail. Caso a conta Netlify não esteja conectada, o proprietário deve se autenticar antes da configuração do domínio.
