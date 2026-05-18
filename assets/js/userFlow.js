document.getElementById("userForm")?.addEventListener("submit", function(e){
    e.preventDefault();
  
    const admin = JSON.parse(localStorage.getItem("currentAdmin"));
  
    if(!admin){
      alert("Admin belum login");
      return;
    }
  
    const user = {
      id: Date.now(),
      nama: document.getElementById("nama").value,
      nohp: document.getElementById("nohp").value,
      admin_id: admin.id,
      paket: null,
      pembayaran: false,
      foto: [],
      selectedFoto: []
    };
  
    localStorage.setItem("currentUser", JSON.stringify(user));
  
    window.location.href = "tutorial.html";
  });
  