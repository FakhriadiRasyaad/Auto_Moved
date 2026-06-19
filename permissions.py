def setup_permissions(window):
    """
    Menyetujui izin Kamera dan Mikrofon secara otomatis pada engine Windows Edge WebView2.
    """
    def on_shown():
        try:
            webview_control = window.native.webview
            
            def permission_requested_handler(sender, args):
                try:
                    kind = int(args.PermissionKind)
                    if kind in [1, 2]:  # 1: Microphone, 2: Camera
                        import System  # type: ignore
                        # Konversi integer 1 (Allow) ke tipe Enum .NET yang sesuai (Pencegahan error tipe data Python.NET 3.0)
                        args.State = System.Enum.ToObject(args.State.GetType(), 1)
                        args.Handled = True
                        print(f"[WebView2] Auto-granted permission for: {'Camera' if kind == 2 else 'Microphone'}")
                except Exception as ex:
                    print(f"Error in permission handler: {ex}")

            if webview_control.CoreWebView2 is not None:
                webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                print("[WebView2] Auto-granted permission handler bound successfully.")
            else:
                def on_init_completed(sender, args):
                    if args.IsSuccess:
                        webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                        print("[WebView2] Auto-granted permission handler bound after initialization.")
                webview_control.CoreWebView2InitializationCompleted += on_init_completed
        except Exception as e:
            # Diabaikan jika berjalan di sistem operasi non-Windows atau tidak menggunakan renderer WebView2
            print(f"Permission handler setup bypassed/failed (expected on non-Windows/non-WebView2): {e}")

    window.events.shown += on_shown
