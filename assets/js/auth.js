import { supabase } from "./supabase.js?v=2";

document.addEventListener("DOMContentLoaded", () => {

  const btnUserFlow = document.getElementById("btn-login-user");
  const btnAdmin    = document.getElementById("btn-login-admin");

  function getCredentials() {
    const email    = document.getElementById("email")?.value.trim() ?? "";
    const password = document.getElementById("password")?.value.trim() ?? "";
    return { email, password };
  }

  /**
   * loginMode:
   *   "user"  → Login User Flow (admin & superadmin boleh)
   *   "admin" → Login Admin Dashboard (redirect berdasarkan role)
   */
  async function doLogin(loginMode) {
    const { email, password } = getCredentials();

    if (!email || !password) {
      alert("Email dan Password wajib diisi!");
      return;
    }

    let authSuccess = false;
    let authData = null;
    let profile = null;
    let supabaseAuthError = null;

    try {
      // 1. Sign in via Supabase Auth
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        supabaseAuthError = authError;
      }

      if (!authError && data?.user) {
        authData = data;

        // 2. Ambil profile via RPC function (bypass RLS)
        const { data: profileData, error: profileError } =
          await supabase.rpc("get_my_profile");

        profile = profileData?.[0] ?? null;

        if (profileError || !profile) {
          console.error("Profile fetch error:", profileError);
          const detail = profileError ? profileError.message : "Data user tidak ditemukan di tabel 'profiles'.";
          alert(`Gagal mengambil data profil! Hubungi administrator.\n\nDetail Error: ${detail}`);
          await supabase.auth.signOut();
          return;
        }

        authSuccess = true;
      }
    } catch (e) {
      console.warn("Supabase Auth network error, checking offline local bypass:", e);
    }

    // Jika login Supabase gagal, cek apakah ada error spesifik atau fallback ke offline
    if (!authSuccess) {
      // Jika ada error dari Supabase Auth (bukan network error), tampilkan pesan yang jelas
      if (supabaseAuthError) {
        const errDetail = supabaseAuthError.message || supabaseAuthError.error_description || (typeof supabaseAuthError === "object" ? JSON.stringify(supabaseAuthError) : String(supabaseAuthError));
        const errMsg = errDetail.toLowerCase();

        if (errMsg.includes("email not confirmed")) {
          alert("Email belum dikonfirmasi! Matikan 'Confirm email' di Supabase Dashboard → Authentication → Providers → Email, atau buat user via Dashboard UI dengan centang Auto Confirm User.");
        } else if (errMsg.includes("invalid login credentials") || errMsg.includes("invalid")) {
          alert("Email atau Password salah! Pastikan akun sudah dibuat via Supabase Dashboard → Authentication → Users.");
        } else {
          alert("Login gagal: " + errDetail);
        }
        return;
      }

      // Fallback ke kredensial offline lokal (hanya jika tidak bisa koneksi ke Supabase)
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

        // Mock account selalu role admin → redirect sesuai loginMode
        if (loginMode === "admin") {
          window.location.href = "admin/dashboard.html";
        } else {
          window.location.href = "photobox-session/daftar-akun.html";
        }
        return;
      } else {
        alert("Username atau Password salah!");
        return;
      }
    }

    // 3. Cek role — admin & superadmin boleh masuk kedua mode
    const userRole = profile.role;
    if (userRole !== "admin" && userRole !== "superadmin") {
      alert("Akses ditolak! Hanya admin atau superadmin yang bisa login.");
      await supabase.auth.signOut();
      return;
    }

    // 4. Simpan session ke localStorage
    localStorage.setItem("loggedIn",    "true");
    localStorage.setItem("userEmail",   authData.user.email);
    localStorage.setItem("userId",      authData.user.id);
    localStorage.setItem("userRole",    userRole);
    localStorage.setItem("branchId",    profile.branch_id ?? "");
    localStorage.setItem("displayName", profile.display_name ?? "");

    // 5. Simpan currentAdmin agar kompatibel dengan halaman lain
    localStorage.setItem("currentAdmin", JSON.stringify({
      id:        authData.user.id,
      username:  authData.user.email,
      role:      userRole,
      branch_id: profile.branch_id ?? ""
    }));

    // 6. Ambil data branch dari Supabase untuk selectedBranch
    let branchName = "";
    let branchCode = "";
    if (profile.branch_id) {
      try {
        const { data: branchData } = await supabase
          .from("branches")
          .select("name, code")
          .eq("id", profile.branch_id)
          .single();
        if (branchData) {
          branchName = branchData.name ?? "";
          branchCode = branchData.code ?? "";
        }
      } catch (e) {
        console.warn("Gagal mengambil data branch:", e);
      }
    }

    sessionStorage.setItem("selectedBranch", JSON.stringify({
      id:   profile.branch_id ?? "",
      name: branchName,
      code: branchCode
    }));

    // 7. Tentukan redirect berdasarkan mode login
    let redirectTo;

    if (loginMode === "user") {
      // Login User Flow → kedua role (admin & superadmin) boleh
      redirectTo = "photobox-session/daftar-akun.html";
    } else {
      // Login Admin Dashboard → selalu ke admin/dashboard.html
      redirectTo = "admin/dashboard.html";
    }

    // 8. Delay kecil lalu redirect
    await new Promise(resolve => setTimeout(resolve, 300));
    window.location.href = redirectTo;
  }

  // Tombol Login User Flow → admin & superadmin boleh masuk
  if (btnUserFlow) {
    btnUserFlow.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin("user");
    });
  }

  // Tombol Login Admin Dashboard → redirect berdasarkan role
  if (btnAdmin) {
    btnAdmin.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin("admin");
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