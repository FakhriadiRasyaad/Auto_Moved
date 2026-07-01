// ============================================================
// Supabase Edge Function: create-duitku-transaction
// ============================================================
// Deploy dengan:  supabase functions deploy create-duitku-transaction
//
// Supabase Secrets yang dibutuhkan (set via Supabase Dashboard):
//   DUITKU_MERCHANT_CODE  → Merchant Code dari dashboard Duitku
//   DUITKU_API_KEY        → API Key / Secret Key dari dashboard Duitku
//   DUITKU_ENV            → "sandbox" atau "production"
//
// Catatan: Merchant Code & API Key juga disimpan di tabel payment_settings
// (kolom gateway_config). Edge Function ini membacanya dari sana
// agar setiap cabang bisa punya credentials berbeda.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HMAC-SHA256 helper (Deno built-in crypto) ─────────────────────────────
async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_id, amount, customer_name, phone, email, description, return_url } = body;

    if (!session_id || !amount) {
      return new Response(
        JSON.stringify({ error: "session_id dan amount wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Inisialisasi Supabase (service role) ──────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 2. Ambil konfigurasi Duitku dari tabel sessions → branch → payment_settings
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("branch_id")
      .eq("id", session_id)
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: "Session tidak ditemukan: " + sessionError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: paymentSetting, error: psError } = await supabase
      .from("payment_settings")
      .select("gateway_config")
      .eq("branch_id", sessionData.branch_id)
      .single();

    if (psError || !paymentSetting?.gateway_config) {
      return new Response(
        JSON.stringify({ error: "Konfigurasi Duitku tidak ditemukan di payment_settings" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = typeof paymentSetting.gateway_config === "string"
      ? JSON.parse(paymentSetting.gateway_config)
      : paymentSetting.gateway_config;

    if (cfg.mode !== "duitku") {
      return new Response(
        JSON.stringify({ error: "Mode gateway bukan Duitku. Mode saat ini: " + cfg.mode }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantCode: string = cfg.merchant_code;
    const apiKey: string = cfg.api_key;
    const env: string = cfg.env ?? "sandbox";

    // ── 3. Buat merchantOrderId unik ─────────────────────────────────────
    const merchantOrderId = `PB-${session_id}-${Date.now()}`;

    // ── 4. Generate signature HMAC-SHA256 ────────────────────────────────
    // Formula: merchantCode + merchantOrderId + paymentAmount
    const stringToSign = merchantCode + merchantOrderId + String(Math.trunc(amount));
    const signature = await hmacSha256Hex(stringToSign, apiKey);

    const baseUrl = env === "production"
      ? "https://passport.duitku.com"
      : "https://sandbox.duitku.com";
    const SUPABASE_PROJECT_URL = "https://umnvwsnhjihhgxfjetuh.supabase.co";
    const callbackUrl = `${SUPABASE_PROJECT_URL}/functions/v1/duitku-callback`;
    const returnUrl   = return_url || `${SUPABASE_PROJECT_URL}/functions/v1/duitku-callback?type=return`;

    const payload = {
      merchantCode,
      paymentAmount: Math.trunc(amount),
      paymentMethod: "", // Kosongkan agar Duitku menampilkan semua opsi bayar
      merchantOrderId,
      productDetails: description || "Photobooth Session",
      customerVaName: customer_name || "Guest",
      email: email || "guest@photobooth.com",
      phoneNumber: phone || "",
      itemDetails: [
        {
          name: description || "Photobooth Session",
          price: Math.trunc(amount),
          quantity: 1
        }
      ],
      customerDetail: {
        firstName: (customer_name || "Guest").split(" ")[0],
        lastName:  (customer_name || "Guest").split(" ").slice(1).join(" ") || "-",
        email:     email || "guest@photobooth.com",
        phoneNumber: phone || ""
      },
      callbackUrl,
      returnUrl,
      signature,
      expiryPeriod: 60  // 60 menit
    };

    // ── 6. POST ke Duitku API ─────────────────────────────────────────────
    const duitkuRes = await fetch(`${baseUrl}/webapi/api/merchant/v2/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const duitkuJson = await duitkuRes.json();

    if (!duitkuRes.ok || !duitkuJson.paymentUrl) {
      console.error("Duitku error:", duitkuJson);
      return new Response(
        JSON.stringify({
          error: "Duitku menolak transaksi",
          detail: duitkuJson.Message ?? duitkuJson
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 7. Simpan merchantOrderId ke tabel sessions ───────────────────────
    await supabase
      .from("sessions")
      .update({ duitku_order_id: merchantOrderId })
      .eq("id", session_id);

    // ── 8. Return paymentUrl ke frontend ──────────────────────────────────
    return new Response(
      JSON.stringify({
        paymentUrl: duitkuJson.paymentUrl,
        reference:  duitkuJson.reference ?? merchantOrderId,
        merchantOrderId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("create-duitku-transaction error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
