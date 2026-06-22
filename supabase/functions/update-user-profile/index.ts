import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { id, email, name, role, phone } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Update auth email if provided (requires service role)
    if (email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: email,
        email_confirm: true,
      });

      if (authError) {
        console.error('Error updating auth email:', authError);
        return new Response(
          JSON.stringify({ error: `Error updating email: ${authError.message}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Update profile record
    const updateData: Record<string, any> = {};
    if (email) updateData.email = email;
    if (name) updateData.full_name = name;
    if (role) updateData.role = role;
    if (phone) updateData.phone = phone;

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return new Response(
        JSON.stringify({ error: `Error updating profile: ${profileError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
