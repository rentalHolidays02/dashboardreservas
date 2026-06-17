// ============================================================
// EDGE FUNCTION: create-user-with-password
// ============================================================
// Copia este código en Supabase Dashboard:
//   Edge Functions → New Function → Nombre: "create-user-with-password"
//
// La función crea un usuario en auth.users con contraseña fija
// y luego crea su perfil en la tabla `profiles`.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_PASSWORD = 'Rentalholidas0211'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, full_name, role, phone, dni, home_address, bank_account } = body

    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ ok: false, error: 'email, full_name y role son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente admin con service_role (disponible automáticamente en Edge Functions)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Crear usuario en auth.users con la contraseña por defecto
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true, // Sin necesidad de confirmar email
      user_metadata: { full_name },
    })

    if (authError) {
      return new Response(
        JSON.stringify({ ok: false, error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id

    // 2. Crear perfil en la tabla `profiles`
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name,
        role,
        phone: phone || null,
      })

    if (profileError) {
      console.error('Error al crear perfil:', profileError)
      // El usuario auth se creó; devolvemos OK con advertencia
      return new Response(
        JSON.stringify({ ok: true, id: userId, warning: 'Perfil no creado: ' + profileError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, id: userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Error inesperado:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err.message || 'Error inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
