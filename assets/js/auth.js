import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {

  const btnUserFlow = document.getElementById("btn-login-user");
  const btnAdmin    = document.getElementById("btn-login-admin");

  function getCredentials() {
    const email    = document.getElementById("email")?.value.trim() ?? "";
    const password = document.getElementById("password")?.value.trim() ?? "";
    return { email, password };
  }

  async function doLogin(redirectTo, requireAdmin = false) {
    const { email, password } = getCredentials();

    if (!email || !password) {
      alert("Email dan Password wajib diisi!");
      return;
    }

    let authSuccess = false;
    let authData = null;
    let profile = null;

    try {
      // 1. Sign in via Supabase Auth
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (!authError && data?.user) {
        authData = data;

        // 2. Ambil profile via RPC function (bypass RLS)
        const { data: profileData, error: profileError } =
          await supabase.rpc("get_my_profile");

        profile = profileData?.[0] ?? null;

        if (profileError || !profile) {
          alert("Gagal mengambil data profil! Hubungi administrator.");
          await supabase.auth.signOut();
          return;
        }

        authSuccess = true;
      }
    } catch (e) {
      console.warn("Supabase Auth error, checking offline local bypass:", e);
    }

    // Fallback ke kredensial offline lokal jika login asli gagal atau email pengujian bypass digunakan
    if (!authSuccess) {
      if (email === "1@admin.com" && password === "1") {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("userEmail", "1@admin.com");
        localStorage.setItem("userId", "mock_admin_id");
        localStorage.setItem("userRole", "admin");
        localStorage.setItem("branchId", "b149999f-33ec-4342-95bb-4f4961956c0b");
        localStorage.setItem("displayName", "Admin Test");
        localStorage.setItem("currentAdmin", JSON.stringify({
          id: "mock_admin_id",
          username: "1@admin.com",
          role: "admin",
          branch_id: "b149999f-33ec-4342-95bb-4f4961956c0b"
        }));
        sessionStorage.setItem("selectedBranch", JSON.stringify({
          id: "b149999f-33ec-4342-95bb-4f4961956c0b",
          name: "Jakarta",
          code: "JKT"
        }));
        
        // Delay kecil lalu redirect
        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = redirectTo;
        return;
      } else {
        alert("Username atau Password salah!");
        return;
      }
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
    localStorage.setItem("userId",      authData.user.id);
    localStorage.setItem("userRole",    profile.role);
    localStorage.setItem("branchId",    profile.branch_id ?? "");
    localStorage.setItem("displayName", profile.display_name ?? "");

    // 5. Simpan currentAdmin agar kompatibel dengan halaman lain
    localStorage.setItem("currentAdmin", JSON.stringify({
      id:        authData.user.id,
      username:  authData.user.email,
      role:      profile.role,
      branch_id: profile.branch_id ?? ""
    }));

    // Simpan selectedBranch jika diperlukan
    sessionStorage.setItem("selectedBranch", JSON.stringify({
      id: profile.branch_id ?? "b149999f-33ec-4342-95bb-4f4961956c0b",
      name: "Jakarta",
      code: "JKT"
    }));

    // 6. Delay kecil lalu redirect
    await new Promise(resolve => setTimeout(resolve, 300));
    window.location.href = redirectTo;
  }

  // Tombol Login User Flow → photobox-session/daftar-akun.html
  if (btnUserFlow) {
    btnUserFlow.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin("photobox-session/daftar-akun.html", false);
    });
  }

  // Tombol Login Admin Dashboard → admin/dashboard.html
  if (btnAdmin) {
    btnAdmin.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin("admin/dashboard.html", true);
    });
  }

  // Listener tombol enter
  const inputs = [
    document.getElementById("email"),
    document.getElementById("password")
  ];

  inputs.forEach(input => {
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          btnUserFlow ? btnUserFlow.click() : null;
        }
      });
    }
  });

});