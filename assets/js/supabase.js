import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const SUPABASE_URL = "https://umnvwsnhjihhgxfjetuh.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_APyfhhTgB3GH9pR4OU2VPw_2YP25fAQ"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)