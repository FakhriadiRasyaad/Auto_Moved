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
async function md5Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      const expectedSignature = await md5Hex(
        `${merchantCode}${amount}${merchantOrderId}${apiKey}`
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
