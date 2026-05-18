// assets/js/folder-save.js
// Utility untuk auto-save foto ke Folder A (foto guest) dan Folder B (hasil cetak)

function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("photobooth_fs", 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore("handles");
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e);
    });
  }
  
  async function getHandle(type, adminId) {
    try {
      const db  = await openIDB();
      const tx  = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get(`handle_${type}_${adminId}`);
      return new Promise(resolve => {
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror   = () => resolve(null);
      });
    } catch(e) { return null; }
  }
  
  // Konversi dataURL ke Blob
  function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const buf   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }
  
  // Sanitize nama file
  function sanitizeName(name) {
    return (name || "guest").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40);
  }
  
  /**
   * Simpan foto guest (12 foto terpilih) ke Folder A
   * Membuat subfolder: NamaGuest_YYYYMMDD_HHMMSS/foto_1.jpg, foto_2.jpg, dst
   */
  export async function saveFotosToFolderA(adminId, namaGuest, fotos) {
    const handle = await getHandle("A", adminId);
  
    if (!handle) {
      // Fallback: download satu per satu
      console.warn("Folder A tidak di-set, skip auto-save foto guest.");
      return { success: false, reason: "no_handle" };
    }
  
    try {
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return { success: false, reason: "permission_denied" };
  
      // Buat subfolder dengan nama guest
      const now        = new Date();
      const timestamp  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const folderName = `${sanitizeName(namaGuest)}_${timestamp}`;
      const subFolder  = await handle.getDirectoryHandle(folderName, { create: true });
  
      // Simpan setiap foto
      for (let i = 0; i < fotos.length; i++) {
        const fname    = `foto_${String(i + 1).padStart(2, "0")}.jpg`;
        const fHandle  = await subFolder.getFileHandle(fname, { create: true });
        const writable = await fHandle.createWritable();
        await writable.write(dataURLtoBlob(fotos[i]));
        await writable.close();
      }
  
      return { success: true, folderName };
    } catch(e) {
      console.error("saveFotosToFolderA error:", e);
      return { success: false, reason: e.message };
    }
  }
  
  /**
   * Simpan foto hasil cetak ke Folder B
   * Nama file: NamaGuest_YYYYMMDD_HHMMSS.jpg
   */
  export async function saveFinalToFolderB(adminId, namaGuest, finalImageDataURL) {
    const handle = await getHandle("B", adminId);
  
    if (!handle) {
      // Fallback: trigger download biasa
      fallbackDownload(namaGuest, finalImageDataURL);
      return { success: false, reason: "no_handle", fallback: true };
    }
  
    try {
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        fallbackDownload(namaGuest, finalImageDataURL);
        return { success: false, reason: "permission_denied", fallback: true };
      }
  
      const now       = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fname     = `${sanitizeName(namaGuest)}_${timestamp}.jpg`;
      const fHandle   = await handle.getFileHandle(fname, { create: true });
      const writable  = await fHandle.createWritable();
      await writable.write(dataURLtoBlob(finalImageDataURL));
      await writable.close();
  
      return { success: true, fileName: fname };
    } catch(e) {
      console.error("saveFinalToFolderB error:", e);
      fallbackDownload(namaGuest, finalImageDataURL);
      return { success: false, reason: e.message, fallback: true };
    }
  }
  
  // Fallback jika folder tidak di-set atau izin ditolak
  function fallbackDownload(namaGuest, dataURL) {
    const nama  = sanitizeName(namaGuest);
    const tgl   = new Date().toISOString().slice(0, 10);
    const link  = document.createElement("a");
    link.href   = dataURL;
    link.download = `photobooth_${nama}_${tgl}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }