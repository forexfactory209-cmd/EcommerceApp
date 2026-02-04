import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// TODO: replace these with your actual Supabase project values
export const SUPABASE_URL = 'https://aeivheqhwlifhancoswz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlaXZoZXFod2xpZmhhbmNvc3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzE3MjcsImV4cCI6MjA3OTQwNzcyN30.Cb-KGI5SEQI5dLRW5q222CEWkaVSCQz46BRJU7_uLRo';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or anon key is missing. Please set them in src/lib/supabase.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
