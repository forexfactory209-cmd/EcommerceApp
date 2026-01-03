import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Service-role client (NEVER expose this in the app)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  // 1. Verify caller is authenticated and is an admin
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return new Response('Missing access token', { status: 401 });
  }

  // Use anon key plus Authorization header to represent the calling user.
  const supabaseUserClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUserClient.auth.getUser();

  if (userError || !user) {
    return new Response('Invalid or expired token', { status: 401 });
  }

  // Check roles in `profiles` table where auth user id is stored in `user_id` column.
  const { data: profile, error: profileError } = await supabaseUserClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return new Response('Only admins can create brand users', { status: 403 });
  }

  // 2. Read body
  const body = await req.json().catch(() => null);

  if (!body) {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const {
    brandLoginEmail,
    brandLoginPassword,
    name,
    slug,
    logo_url,
    description,
    contact_email,
    contact_phone,
  } = body as {
    brandLoginEmail: string;
    brandLoginPassword: string;
    name: string;
    slug?: string | null;
    logo_url?: string | null;
    description?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  };

  if (!brandLoginEmail || !brandLoginPassword || !name) {
    return new Response('Missing required fields', { status: 400 });
  }

  // 3. Create auth user for brand
  const {
    data: createdUser,
    error: createUserError,
  } = await supabaseAdmin.auth.admin.createUser({
    email: brandLoginEmail,
    password: brandLoginPassword,
    email_confirm: true,
  });

  if (createUserError || !createdUser?.user) {
    console.error('createUser error', createUserError);
    return new Response(
      createUserError?.message || 'Failed to create brand auth user',
      { status: 400 },
    );
  }

  const brandUserId = createdUser.user.id;

  // 4. Insert brand row linked to this user, auto-approved
  const { data: brand, error: brandError } = await supabaseAdmin
    .from('brands')
    .insert([
      {
        user_id: brandUserId,
        name,
        slug,
        logo_url,
        description,
        contact_email,
        contact_phone,
        status: 'approved',
      },
    ])
    .select()
    .maybeSingle();

  if (brandError || !brand) {
    console.error('insert brand error', brandError);
    return new Response(
      brandError?.message || 'Failed to create brand record',
      { status: 400 },
    );
  }

  // 5. Return created brand
  return new Response(JSON.stringify({ brand }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
