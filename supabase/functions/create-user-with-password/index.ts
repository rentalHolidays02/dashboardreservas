import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_PASSWORD = 'Rentalholidays0211'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, full_name, role, phone } = body

    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ ok: false, error: 'email, full_name y role son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    let userId: string

    // 1. Intentar invitar (dispara email de bienvenida)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://basedatospagosrh.vercel.app/login',
      data: { full_name, password_set: false },
    })

    console.log('inviteError:', JSON.stringify(inviteError))
    console.log('inviteData:', JSON.stringify(inviteData?.user?.id))

    if (inviteError) {
      // Si ya existe, reutilizarlo sin reenviar
      if (inviteError.message?.toLowerCase().includes('already') || inviteError.message?.toLowerCase().includes('exists')) {
        let found = null
        let page = 1
        while (!found) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
          if (!list?.users?.length) break
          found = list.users.find((u: { email?: string | null }) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
          if (found || list.users.length < 1000) break
          page++
        }
        if (!found) {
          return new Response(
            JSON.stringify({ ok: false, error: inviteError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        userId = found.id
      } else {
        return new Response(
          JSON.stringify({ ok: false, error: `invite failed: ${inviteError.message} (status: ${inviteError.status})` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      userId = inviteData.user.id
      // Poner contraseña y confirmar email para que entre sin clicar el link
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      })

    }

    // 2. Perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, email, full_name, role, phone: phone || null })

    if (profileError) {
      console.error('Error al crear perfil:', profileError)
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
