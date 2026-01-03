import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Service-role client (NEVER exposed to the client app)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  // 1. Verify caller is authenticated and is an admin
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return new Response('Missing access token', { status: 401 });
  }

  // Represent the calling user using anon key + Authorization header
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

  // Check admin role in profiles.user_id
  const { data: profile, error: profileError } = await supabaseUserClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return new Response('Only admins can delete brands', { status: 403 });
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body || typeof body.brandId !== 'number') {
    return new Response('brandId (number) is required', { status: 400 });
  }

  const brandId: number = body.brandId;

  // 3. Load brand row to get user_id and logo_url
  const { data: brand, error: brandLoadError } = await supabaseAdmin
    .from('brands')
    .select('id, user_id, logo_url')
    .eq('id', brandId)
    .maybeSingle();

  if (brandLoadError || !brand) {
    return new Response('Brand not found', { status: 404 });
  }

  const brandUserId = brand.user_id as string | null;
  const logoUrl = brand.logo_url as string | null;

  // 4. Best-effort delete logo file from storage if we can extract the path
  if (logoUrl) {
    try {
      // Example: https://project.supabase.co/storage/v1/object/public/brand-logos/path/to/file.jpg
      const marker = '/storage/v1/object/public/brand-logos/';
      const idx = logoUrl.indexOf(marker);
      if (idx !== -1) {
        const path = logoUrl.slice(idx + marker.length);
        const { error: storageError } = await supabaseAdmin.storage
          .from('brand-logos')
          .remove([path]);
        if (storageError) {
          console.error('Error deleting brand logo from storage', storageError.message || storageError);
        }
      }
    } catch (e) {
      console.error('Unexpected error while deleting brand logo from storage', e);
    }
  }

  // 5. Delete brand row
  const { error: deleteBrandError } = await supabaseAdmin
    .from('brands')
    .delete()
    .eq('id', brandId);

  if (deleteBrandError) {
    console.error('Error deleting brand row', deleteBrandError.message || deleteBrandError);
    return new Response('Failed to delete brand row', { status: 500 });
  }

  // 6. Delete auth user linked to brand (if any)
  if (brandUserId) {
    try {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(brandUserId);
      if (deleteUserError) {
        console.error('Error deleting brand auth user', deleteUserError.message || deleteUserError);
      }
    } catch (e) {
      console.error('Unexpected error deleting brand auth user', e);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
