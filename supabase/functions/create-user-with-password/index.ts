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

    // 1. Crear usuario con contraseña predeterminada
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (userError) {
      if (userError.message?.toLowerCase().includes('already')) {
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
            JSON.stringify({ ok: false, error: userError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        userId = found.id
      } else {
        return new Response(
          JSON.stringify({ ok: false, error: `createUser failed: ${userError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      userId = userData.user.id
    }

    // 2. Crear perfil
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

    // 3. Enviar email de bienvenida vía SendGrid
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')
    if (sendgridApiKey) {
      try {
        const emailRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email, name: full_name }],
                subject: 'Bienvenido a RentalHolidays - Tus credenciales',
              },
            ],
            from: { email: 'noreply@rentalholidays.es', name: 'RentalHolidays' },
            content: [
              {
                type: 'text/html',
                value: `
                  <h2>¡Bienvenido a RentalHolidays!</h2>
                  <p>Tu cuenta ha sido creada exitosamente.</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Contraseña:</strong> ${DEFAULT_PASSWORD}</p>
                  <p><a href="https://basedatospagosrh.vercel.app/login">Acceder a la aplicación</a></p>
                  <p>Por favor, cambia tu contraseña tras el primer acceso.</p>
                `,
              },
            ],
          }),
        })

        if (!emailRes.ok) {
          console.error('SendGrid error:', await emailRes.text())
        } else {
          console.log('Email enviado a:', email)
        }
      } catch (emailErr) {
        console.error('Error enviando email:', emailErr)
      }
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
