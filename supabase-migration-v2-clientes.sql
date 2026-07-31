-- ATLAS ONE — Migração v2: módulo de Clientes (CRM leve)
-- Rode isso no SQL Editor do Supabase (mesma tela onde você rodou o script da tabela "orcamentos")

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  nome TEXT NOT NULL,
  whatsapp TEXT,
  cidade TEXT,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  endereco TEXT,

  origem TEXT DEFAULT 'outros', -- indicacao, arquiteto, engenheiro, construtora, instagram, facebook, google, whatsapp, cliente_antigo, passou_na_frente, outros
  responsavel TEXT,
  observacoes TEXT
);

-- Um cliente por número de WhatsApp (evita duplicar cadastro do mesmo cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_whatsapp
  ON clientes(whatsapp)
  WHERE whatsapp IS NOT NULL AND whatsapp <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade ON clientes(cidade);

-- Trigger de updated_at (reaproveita a função já criada na migração da tabela orcamentos)
DROP TRIGGER IF EXISTS clientes_updated_at ON clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Liga cada orçamento a um cliente cadastrado + novos campos comerciais
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS origem TEXT;

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON orcamentos(cliente_id);

-- IMPORTANTE sobre segurança (RLS):
-- A tabela "orcamentos" já foi criada com "ENABLE ROW LEVEL SECURITY" e SEM nenhuma política.
-- No Supabase isso bloqueia TODO acesso por padrão (nem leitura nem gravação funcionam) —
-- provavelmente o app ainda nem tentou salvar de verdade pra você notar isso.
-- Como o Atlas One ainda não tem login/usuários (fase 1), liberamos acesso total por enquanto
-- usando a chave "anon" pública. Quando o módulo de usuários/permissões entrar, isso deve ser
-- substituído por políticas reais baseadas no usuário autenticado.

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acesso_total_temporario" ON clientes;
CREATE POLICY "acesso_total_temporario" ON clientes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acesso_total_temporario" ON orcamentos;
CREATE POLICY "acesso_total_temporario" ON orcamentos
  FOR ALL USING (true) WITH CHECK (true);
