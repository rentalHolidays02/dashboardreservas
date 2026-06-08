// Edge function: delete-user
// Borra un usuario de auth.users usando service_role.
// Requiere que el caller sea admin (verifica profiles.role).
// La FK profiles.id → auth.users.id (ON DELETE CASCADE, v16) limpia profiles automáticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  // 1. Verificar que el caller esté autenticado y sea admin.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Solo administradores pueden borrar usuarios' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Leer body.
  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const targetId = body.id
  if (!targetId) {
    return new Response(JSON.stringify({ error: 'Falta id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // No permitir que un admin se borre a sí mismo.
  if (targetId === user.id) {
    return new Response(JSON.stringify({ error: 'No puedes borrarte a ti mismo' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. Borrar de auth.users con service_role. CASCADE limpia profiles.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error: delError } = await admin.auth.admin.deleteUser(targetId)
  if (delError) {
    return new Response(JSON.stringify({ error: delError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
