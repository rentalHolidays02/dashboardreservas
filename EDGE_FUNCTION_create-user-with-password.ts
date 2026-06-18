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

    // Crear cliente admin con service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que el caller es admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo los administradores pueden crear usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Invitar al usuario — esto dispara el template de email "Invite user"
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name, password_set: false },
        redirectTo: Deno.env.get('SITE_URL') ?? 'https://basedatospagosrh.vercel.app',
      }
    )

    if (inviteError) {
      return new Response(
        JSON.stringify({ ok: false, error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = inviteData.user.id

    // 2. Establecer contraseña por defecto para que pueda entrar sin esperar el link
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    })
    if (pwError) {
      console.error('Error al establecer contraseña:', pwError)
    }

    // 3. Crear perfil en la tabla `profiles`
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
