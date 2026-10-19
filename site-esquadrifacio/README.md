# Site público Esquadrifácio® — homologação premium v5

## Origem e objetivo
- Construído **sobre o HTML exato da prévia premium v5 aprovada em 18/10/2026**, preservando a composição, tipografia, cores, fotografias e estrutura principal.
- Esta pasta é **um site estático independente** do app Next.js do Atlas One. Não importar os arquivos no roteamento `app/` nem na navegação privada do ERP.
- `index.html`: homepage institucional leve, com oito imagens WebP independentes em `assets/`, seções de soluções, portfólio, apresentação e botões de orçamento funcionais.
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
1. Conferir com Francis a versão responsiva e as fotografias, autorizações dos titulares/obras e textos. O WhatsApp comercial foi confirmado em 19/10/2026. Não apresentar imagens ilustrativas como obras da empresa sem validação.
2. Validar a página em um projeto Vercel **separado** do Atlas com a raiz deste site como Root Directory; não alterar domínios nem deploy do projeto `atlas-one`. O usuário precisa aprovar o preview antes de apontar domínio.
3. Verificar redirecionamento WhatsApp real em celular e desktop; abrir Instagram e a política de privacidade; testar imagens e navegação com teclado e leitores de tela.
4. Resolver situação e DNS do domínio **esquadrifacio.com.br** na conta do proprietário, e só então atualizar canonical/og:url, gerar `sitemap.xml`, permitir indexação em `robots.txt` e retirar `noindex,nofollow`.
5. Validar textos legais, título/meta SEO local, Search Console, Perfil da Empresa no Google, compartilhamento social, performance de imagens e política de privacidade antes de ativar analytics.
6. Registrar rollback: manter última versão aprovada e DNS anterior para reversão, sem interferir no Atlas One.

## Critérios de aceite automático
Executar `node site-esquadrifacio/validar-site.mjs` na raiz do repositório. O teste não faz requisições externas.

## Limites desta etapa
- O número de WhatsApp comercial foi confirmado em 19/10/2026; faltam homologação visual, autorizações de fotos e textos legais antes do lançamento.
- Não há formulário, banco, CRM, integração com Marketing Inteligente, automação IA nem publicações em redes sociais.
- Os originais incorporam mídia no HTML para preservar exatamente a prévia visual. Em etapa posterior, exportar imagens autorizadas para arquivos otimizados, mantendo a mesma aparência.
- **Não publicar esta versão na internet ou indexá-la sem aprovação expressa.**

## Otimização e acessibilidade (18/10/2026)
- Foram extraídas as mesmas oito imagens WebP da prévia aprovada para arquivos estáticos com nomes descritivos, **sem recorte, alteração, substituição nem perda de qualidade**. A página caiu de ~1,27 MB de HTML para menos de 20 KB; os oito arquivos somam ~940 KB e passam a carregar conforme demanda.
- Foto de destaque é priorizada; demais imagens têm carregamento sob demanda e tamanhos intrínsecos. Favicon usa a marca ®.
- Há atalho acessível para ir ao conteúdo e botão discreto de orçamento no celular (WhatsApp comercial confirmado). Respeita movimento reduzido e área segura de celulares.
- Sem alteração do projeto Atlas, domínio, banco, APIs ou SEO de produção. A versão continua com `noindex,nofollow`.
