def setup_permissions(window):
    """
    Menyetujui izin Kamera dan Mikrofon secara otomatis pada engine Windows Edge WebView2.
    """
    handler_bound = False

    def attach_permissions():
        nonlocal handler_bound
        try:
            native = getattr(window, 'native', None)
            if not native:
                return

            webview_control = getattr(native, 'webview', None)
            if not webview_control:
                return

            def permission_requested_handler(sender, args):
                try:
                    kind = int(args.PermissionKind)
                    if kind in [1, 2]:  # 1: Microphone, 2: Camera
                        import System  # type: ignore
                        args.State = System.Enum.ToObject(args.State.GetType(), 1)  # 1 = Allow
                        args.Handled = True
                        print(f"[WebView2] ✅ Auto-granted permission for: {'Camera' if kind == 2 else 'Microphone'}")
                except Exception as ex:
                    print(f"[WebView2] Error in permission handler: {ex}")

            if hasattr(webview_control, 'CoreWebView2') and webview_control.CoreWebView2 is not None:
                if not handler_bound:
                    webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                    handler_bound = True
                    print("[WebView2] ✅ Auto-granted permission handler bound successfully.")
            else:
                def on_init_completed(sender, args):
                    nonlocal handler_bound
                    if getattr(args, 'IsSuccess', False) and not handler_bound:
                        webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                        handler_bound = True
                        print("[WebView2] ✅ Auto-granted permission handler bound after initialization.")

                if hasattr(webview_control, 'CoreWebView2InitializationCompleted'):
                    webview_control.CoreWebView2InitializationCompleted += on_init_completed
        except Exception as e:
            print(f"[WebView2] Permission setup note: {e}")

    # Coba langsung dan daftarkan ke event window
    attach_permissions()
    window.events.shown += attach_permissions
    window.events.loaded += attach_permissions

