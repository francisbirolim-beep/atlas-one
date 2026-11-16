# Verificador de integridade de pacote de backup Atlas One

STATUS: utilitário isolado, não instalado no SERVIDOR, não agendado, sem ligação com dados reais.

Arquivos deste diretório:
- verificar-pacote.mjs: verifica integridade SHA-256 e tamanho de todos os itens de um pacote congelado, detecta itens ausentes/extras, links simbólicos e caminhos inseguros.
- testar-verificador.mjs: testa o verificador com arquivos inteiramente fictícios em pasta temporária, apaga a pasta no final.

Para testar com Node.js 18+:
~~~shell
node scripts/backup/testar-verificador.mjs
~~~

Para verificar um pacote de exportação já gerado e CONGELADO:
~~~shell
node scripts/backup/verificar-pacote.mjs /pasta/segura/do/pacote
~~~

A pasta deve incluir bundle-manifest.json com formato:

~~~json
{
  "format": "atlas-one-backup-bundle-v1",
  "createdAt": "2026-11-16T12:00:00Z",
  "items": [
    { "path": "database/exportacao.sql", "kind": "database", "sizeBytes": 3, "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { "path": "storage/foto.bin", "kind": "storage", "sizeBytes": 4, "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
  ]
}
~~~

Os hashes do exemplo são fictícios; um exportador homologado deve calcular hashes reais. Não colocar manifestos reais no GitHub: nomes de arquivos podem identificar clientes.

O resultado OK significa SOMENTE que o pacote CONGELADO confere com seu manifesto: arquivos, tamanhos, hashes e ausência de extras. Não comprova:
- completude da base Supabase (tabelas, outros schemas, views, funções, roles e permissões);
- captura completa de arquivos e versões do Storage, inclusive fotos de perfis/acessórios;
- consistência temporal da exportação;
- cifragem, cópia local, backup online e retenção;
- restauração funcional ou funcionamento offline.

Não executar contra diretórios operacionais ativos, pois uma gravação durante o hash invalida o resultado. Não enviar arquivos reais nem segredos para GitHub ou ChatGPT.

Testes locais: executado no MacBook em pasta temporária com arquivos fictícios, usando o código do commit 29a69f28453418229757851e743b56dfacaa2668. Testados pacote válido, corrupção, path traversal, duplicação, ausência de Storage, extras, exclusão de arquivo e link simbólico.

Pendências: criar exportador completo, escolher destino online separado, criptografar, automatizar transferência em segundo plano com limite de recursos, gerar manifesto protegido, conferir cópia recebida e realizar restauração isolada antes de produção.
