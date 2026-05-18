import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {

  const btnUserFlow = document.querySelector('#adminLoginForm button[type="submit"]');
  const btnAdmin    = document.getElementById("submited");

  function getCredentials() {
    const email    = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    return { email, password };
  }

  async function doLogin(redirectTo, requireAdmin = false) {
    const { email, password } = getCredentials();

    if (!email || !password) {
      alert("Email dan password wajib diisi!");
      return;
    }

    // 1. Sign in via Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      alert("Login gagal: " + (authError?.message ?? "User tidak ditemukan"));
      return;
    }

    const userId = authData.user.id;

    // 2. Ambil profile via RPC function (bypass RLS)
    const { data: profileData, error: profileError } =
      await supabase.rpc("get_my_profile");

    const profile = profileData?.[0] ?? null;

    if (profileError || !profile) {
      alert("Gagal mengambil data profil! Hubungi administrator.");
      await supabase.auth.signOut();
      return;
    }

    // 3. Cek role jika masuk admin dashboard
    if (requireAdmin) {
      if (profile.role !== "admin" && profile.role !== "superadmin") {
        alert("Akses ditolak! Hanya admin yang bisa masuk dashboard.");
        await supabase.auth.signOut();
        return;
      }
    }

    // 4. Simpan session ke localStorage
    localStorage.setItem("loggedIn",    "true");
    localStorage.setItem("userEmail",   authData.user.email);
    localStorage.setItem("userId",      userId);
    localStorage.setItem("userRole",    profile.role);
    localStorage.setItem("branchId",    profile.branch_id ?? "");
    localStorage.setItem("displayName", profile.display_name ?? "");

    // 5. Simpan currentAdmin agar kompatibel dengan halaman lain
    localStorage.setItem("currentAdmin", JSON.stringify({
      id:        userId,
      username:  authData.user.email,
      role:      profile.role,
      branch_id: profile.branch_id ?? ""
    }));

    // 6. Delay kecil lalu redirect
    await new Promise(resolve => setTimeout(resolve, 300));
    window.location.href = redirectTo;
  }

  // Tombol Login User Flow → tutorial.html
  btnUserFlow.addEventListener("click", (e) => {
    e.preventDefault();
    doLogin("tutorial.html", false);
  });

  // Tombol Login Admin Dashboard → admin/dashboard.html
  btnAdmin.addEventListener("click", () => {
    doLogin("admin/dashboard.html", true);
  });

});