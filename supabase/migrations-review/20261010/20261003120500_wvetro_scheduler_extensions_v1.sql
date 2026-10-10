-- Scheduler técnico do W.Vetro.
-- Os segredos e jobs são configurados por ambiente; esta migration apenas
-- garante as extensões necessárias para pg_cron + chamadas HTTP assíncronas.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;