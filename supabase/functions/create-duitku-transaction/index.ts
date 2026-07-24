// ============================================================
// Supabase Edge Function: create-duitku-transaction
// ============================================================
// Deploy dengan:  supabase functions deploy create-duitku-transaction
//
// Menggunakan Duitku Pop API (createInvoice) agar user bisa memilih
// metode pembayaran langsung di halaman Duitku (VA, QRIS, e-wallet, dll).
//
// Catatan: Merchant Code & API Key disimpan di tabel payment_settings
// (kolom gateway_config). Edge Function ini membacanya dari sana
// agar setiap cabang bisa punya credentials berbeda.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── MD5 helper (pure JS, Deno crypto.subtle tidak support MD5) ────────────
// Duitku createInvoice signature: MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
function md5Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);

  function toWord(b: Uint8Array): number[] {
    const w: number[] = [];
    for (let i = 0; i < b.length * 8; i += 8)
      w[i >> 5] |= (b[i / 8] & 0xff) << (i % 32);
    return w;
  }

  function wordsToHex(w: number[]): string {
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < w.length * 32; i += 8)
      s += hex.charAt((w[i >> 5] >>> (i % 32 + 4)) & 0x0f) +
           hex.charAt((w[i >> 5] >>> (i % 32)) & 0x0f);
    return s;
  }

  function add(a: number, b: number) { return (a + b) & 0xffffffff; }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    const r = add(add(a, q), add(x, t));
    return add((r << s) | (r >>> (32 - s)), b);
  }
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(c ^ (b | ~d), a, b, x, s, t);

  const x = toWord(bytes);
  const len = bytes.length * 8;
  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let i = 0; i < x.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a,b,c,d,x[i],    7, -680876936);  d = ff(d,a,b,c,x[i+1], 12, -389564586);
    c = ff(c,d,a,b,x[i+2], 17,  606105819);  b = ff(b,c,d,a,x[i+3], 22,-1044525330);
    a = ff(a,b,c,d,x[i+4],  7, -176418897);  d = ff(d,a,b,c,x[i+5], 12, 1200080426);
    c = ff(c,d,a,b,x[i+6], 17,-1473231341);  b = ff(b,c,d,a,x[i+7], 22, -45705983);
    a = ff(a,b,c,d,x[i+8],  7, 1770035416);  d = ff(d,a,b,c,x[i+9], 12,-1958414417);
    c = ff(c,d,a,b,x[i+10],17,      -42063); b = ff(b,c,d,a,x[i+11],22,-1990404162);
    a = ff(a,b,c,d,x[i+12], 7, 1804603682);  d = ff(d,a,b,c,x[i+13],12, -40341101);
    c = ff(c,d,a,b,x[i+14],17,-1502002290);  b = ff(b,c,d,a,x[i+15],22, 1236535329);

    a = gg(a,b,c,d,x[i+1],  5, -165796510);  d = gg(d,a,b,c,x[i+6],  9,-1069501632);
    c = gg(c,d,a,b,x[i+11],14,  643717713);  b = gg(b,c,d,a,x[i],   20, -373897302);
    a = gg(a,b,c,d,x[i+5],  5, -701558691);  d = gg(d,a,b,c,x[i+10], 9,   38016083);
    c = gg(c,d,a,b,x[i+15],14, -660478335);  b = gg(b,c,d,a,x[i+4], 20, -405537848);
    a = gg(a,b,c,d,x[i+9],  5,  568446438);  d = gg(d,a,b,c,x[i+14], 9,-1019803690);
    c = gg(c,d,a,b,x[i+3], 14, -187363961);  b = gg(b,c,d,a,x[i+8], 20, 1163531501);
    a = gg(a,b,c,d,x[i+13], 5,-1444681467);  d = gg(d,a,b,c,x[i+2],  9,  -51403784);
    c = gg(c,d,a,b,x[i+7], 14, 1735328473);  b = gg(b,c,d,a,x[i+12],20,-1926607734);

    a = hh(a,b,c,d,x[i+5],  4,    -378558);  d = hh(d,a,b,c,x[i+8], 11,-2022574463);
    c = hh(c,d,a,b,x[i+11],16, 1839030562);  b = hh(b,c,d,a,x[i+14],23,  -35309556);
    a = hh(a,b,c,d,x[i+1],  4,-1530992060);  d = hh(d,a,b,c,x[i+4], 11, 1272893353);
    c = hh(c,d,a,b,x[i+7], 16, -155497632);  b = hh(b,c,d,a,x[i+10],23,-1094730640);
    a = hh(a,b,c,d,x[i+13], 4,  681279174);  d = hh(d,a,b,c,x[i],   11, -358537222);
    c = hh(c,d,a,b,x[i+3], 16, -722521979);  b = hh(b,c,d,a,x[i+6], 23,   76029189);
    a = hh(a,b,c,d,x[i+9],  4, -640364487);  d = hh(d,a,b,c,x[i+12],11, -421815835);
    c = hh(c,d,a,b,x[i+15],16,  530742520);  b = hh(b,c,d,a,x[i+2], 23, -995338651);

    a = ii(a,b,c,d,x[i],    6, -198630844);  d = ii(d,a,b,c,x[i+7], 10, 1126891415);
    c = ii(c,d,a,b,x[i+14],15,-1416354905);  b = ii(b,c,d,a,x[i+5], 21,  -57434055);
    a = ii(a,b,c,d,x[i+12], 6, 1700485571);  d = ii(d,a,b,c,x[i+3], 10,-1894986606);
    c = ii(c,d,a,b,x[i+10],15,   -1051523);  b = ii(b,c,d,a,x[i+1], 21,-2054922799);
    a = ii(a,b,c,d,x[i+8],  6, 1873313359);  d = ii(d,a,b,c,x[i+15],10,  -30611744);
    c = ii(c,d,a,b,x[i+6], 15,-1560198380);  b = ii(b,c,d,a,x[i+13],21, 1309151649);
    a = ii(a,b,c,d,x[i+4],  6, -145523070);  d = ii(d,a,b,c,x[i+11],10,-1120210379);
    c = ii(c,d,a,b,x[i+2], 15,  718787259);  b = ii(b,c,d,a,x[i+9], 21, -343485551);

    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }

  return wordsToHex([a, b, c, d]);
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

    // ── 3. Buat merchantOrderId unik (maksimal 50 karakter) ──────────────
    // Ambil 8 karakter pertama dari session_id agar tidak terlalu panjang
    const shortSession = session_id.split("-")[0];
    const merchantOrderId = `PB-${Date.now()}-${shortSession}`;
    const paymentAmount = Math.trunc(amount);
    const timestamp = Date.now().toString();

    // ── 4. Generate signature SHA256 (format Duitku API v3) ──────────────
    // Formula: SHA256(merchantCode + timestamp + apiKey)
    const stringToSign = merchantCode + timestamp + apiKey;
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const baseUrl = env === "production"
      ? "https://api-prod.duitku.com"
      : "https://api-sandbox.duitku.com";
    const SUPABASE_PROJECT_URL = "https://umnvwsnhjihhgxfjetuh.supabase.co";
    const callbackUrl = `${SUPABASE_PROJECT_URL}/functions/v1/duitku-callback`;
    const returnUrl   = return_url || `${SUPABASE_PROJECT_URL}/functions/v1/duitku-callback?type=return`;

    // ── 5. Payload untuk Duitku Pop (createInvoice) ──────────────────────
    const payload = {
      merchantCode,
      paymentAmount,
      merchantOrderId,
      productDetails: description || "Photobooth Session",
      email: email || "guest@photobooth.com",
      phoneNumber: phone || "081234567890", // Prevent empty string issues
      additionalParam: "",
      merchantUserInfo: "",
      customerVaName: customer_name || "Guest",
      callbackUrl,
      returnUrl,
      expiryPeriod: 60,  // 60 menit
      customerDetail: {
        firstName: (customer_name || "Guest").split(" ")[0],
        lastName:  (customer_name || "Guest").split(" ").slice(1).join(" ") || "-",
        email:     email || "guest@photobooth.com",
        phoneNumber: phone || "081234567890"
      },
      itemDetails: [
        {
          name: description || "Photobooth Session",
          price: paymentAmount,
          quantity: 1
        }
      ]
    };

    console.log("Duitku createInvoice payload:", JSON.stringify(payload));

    // ── 6. POST ke Duitku Pop API ────────────────────────────────────────
    const duitkuRes = await fetch(`${baseUrl}/api/merchant/createInvoice`, {
      method: "POST",
      headers: { 
        "Accept": "application/json",
        "Content-Type": "application/json; charset=UTF-8",
        "x-duitku-signature": signature,
        "x-duitku-timestamp": timestamp,
        "x-duitku-merchantcode": merchantCode
      },
      body: JSON.stringify(payload)
    });

    const duitkuJson = await duitkuRes.json();
    console.log("Duitku response:", JSON.stringify(duitkuJson));

    if (!duitkuRes.ok || !duitkuJson.paymentUrl) {
      console.error("Duitku error:", duitkuJson);
      return new Response(
        JSON.stringify({
          error: "Duitku menolak transaksi",
          detail: duitkuJson.Message ?? duitkuJson.statusMessage ?? JSON.stringify(duitkuJson)
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
