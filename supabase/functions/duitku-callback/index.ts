// ============================================================
// Supabase Edge Function: duitku-callback
// ============================================================
// Deploy dengan:  supabase functions deploy duitku-callback
//
// URL ini harus diisi di Dashboard Duitku → Project → Callback URL:
//   https://<project-ref>.supabase.co/functions/v1/duitku-callback
//
// Duitku akan POST ke sini saat transaksi berhasil / gagal.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── MD5 helper untuk validasi signature callback ──────────────────────────
// Duitku callback menggunakan MD5, bukan HMAC-SHA256
// Deno crypto.subtle TIDAK mendukung MD5, jadi pakai implementasi JS murni.
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
    let r = add(add(a, q), add(x, t));
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle GET request — Duitku mungkin ping URL callback dengan GET untuk validasi
  if (req.method === "GET") {
    return new Response("SUCCESS", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  try {
    // ── 1. Parse body dari Duitku ─────────────────────────────────────────
    // Duitku mengirim POST form-encoded atau JSON
    let body: Record<string, string> = {};
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) {
        body[k] = v;
      }
    }

    console.log("Duitku callback received:", JSON.stringify(body));

    const {
      merchantCode,
      amount,
      merchantOrderId,
      productDetail,
      additionalParam,
      paymentCode,
      resultCode,    // "00" = sukses
      merchantUserId,
      reference,
      signature: receivedSignature
    } = body;

    // ── 2. Inisialisasi Supabase ──────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. Ambil API Key dari payment_settings untuk validasi signature ───
    // Cari session berdasarkan merchantOrderId
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, branch_id, status")
      .eq("duitku_order_id", merchantOrderId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Session tidak ditemukan untuk merchantOrderId:", merchantOrderId);
      // Tetap return 200 agar Duitku tidak retry terus
      return new Response(JSON.stringify({ success: false, reason: "session not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Ambil API Key dari payment_settings
    const { data: paymentSetting } = await supabase
      .from("payment_settings")
      .select("gateway_config")
      .eq("branch_id", sessionData.branch_id)
      .single();

    const cfg = typeof paymentSetting?.gateway_config === "string"
      ? JSON.parse(paymentSetting.gateway_config)
      : (paymentSetting?.gateway_config ?? {});

    const apiKey: string = cfg.api_key ?? "";

    // ── 4. Validasi signature Duitku ──────────────────────────────────────
    // Formula signature callback Duitku:
    //   MD5(merchantCode + amount + merchantOrderId + apiKey)
    if (apiKey && receivedSignature) {
      const cleanAmount = Math.trunc(Number(amount));
      const expectedSignature = md5Hex(
        `${merchantCode}${cleanAmount}${merchantOrderId}${apiKey}`
      );

      if (expectedSignature.toLowerCase() !== receivedSignature.toLowerCase()) {
        console.error("Signature mismatch! Expected:", expectedSignature, "Got:", receivedSignature);
        return new Response(
          JSON.stringify({ success: false, reason: "invalid signature" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Update status session berdasarkan resultCode ──────────────────
    // resultCode "00" = sukses, yang lain = gagal / pending
    if (resultCode === "00") {
      // Jangan update jika sudah paid (idempoten)
      if (sessionData.status !== "paid") {
        const { error: updateError } = await supabase
          .from("sessions")
          .update({
            status:           "paid",
            duitku_reference: reference ?? null,
            paid_at:          new Date().toISOString()
          })
          .eq("id", sessionData.id);

        if (updateError) {
          console.error("Gagal update session:", updateError);
        } else {
          console.log("✅ Session", sessionData.id, "berhasil di-update ke PAID");
        }
      }
    } else {
      // Opsional: log transaksi gagal / pending
      console.log(`Transaksi ${merchantOrderId} status: ${resultCode} (bukan sukses)`);
    }

    // Duitku mengharapkan response "SUCCESS" atau HTTP 200
    return new Response("SUCCESS", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });

  } catch (err) {
    console.error("duitku-callback error:", err);
    // Tetap return 200 agar Duitku tidak retry tanpa henti
    return new Response("ERROR", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }
});
