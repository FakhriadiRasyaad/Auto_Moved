import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const SUPABASE_URL = "https://umnvwsnhjihhgxfjetuh.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbnZ3c25oamloaGd4ZmpldHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTkzOTAsImV4cCI6MjA4NzA5NTM5MH0.f3AOSfV5a5ucQIv29OwfasHCDZJ9a5xVlXkKHvXcHMI"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)