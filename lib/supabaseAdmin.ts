import { createClient } from '@supabase/supabase-js'

// Cliente administrativo — SÓ pode ser usado em código de servidor (API routes),
// nunca em componentes 'use client'. Usa a chave secreta do Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const secretKey = process.env.SUPABASE_SECRET_KEY!

export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
