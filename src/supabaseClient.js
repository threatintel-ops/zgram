import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Zgram uses usernames, not emails, for login. Supabase Auth requires an
// email under the hood, so we map "username" -> "username@zgram.local"
// internally. Users never see or type this.
export const emailForUsername = (username) => `${username.toLowerCase()}@zgram.local`;
