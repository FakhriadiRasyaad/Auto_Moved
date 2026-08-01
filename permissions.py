import System

def setup_permissions(window):
    """
    Menyetujui izin Kamera dan Mikrofon secara otomatis pada engine Windows Edge WebView2.
    Harus diakses melalui UI Thread WinForms.
    """
    handler_bound = False

    def do_bind():
        nonlocal handler_bound
        if handler_bound:
            return
        try:
            native = getattr(window, 'native', None)
            if not native:
                return

            webview_control = getattr(native, 'webview', None)
            if not webview_control:
                return

            def permission_requested_handler(sender, args):
                try:
                    # Grant permission (1 = Allow)
                    args.State = System.Enum.ToObject(args.State.GetType(), 1)
                    args.Handled = True
                    kind_id = int(args.PermissionKind)
                    kind_name = "Camera" if kind_id == 2 else ("Microphone" if kind_id == 1 else f"Kind_{kind_id}")
                    print(f"[WebView2] ✅ Auto-granted permission for: {kind_name}", flush=True)
                except Exception as ex:
                    print(f"[WebView2] Error in permission handler: {ex}", flush=True)

            core = getattr(webview_control, 'CoreWebView2', None)
            if core is not None:
                core.PermissionRequested += permission_requested_handler
                handler_bound = True
                print("[WebView2] ✅ Auto-granted permission handler bound successfully to CoreWebView2.", flush=True)
            else:
                def on_init_completed(sender, args):
                    nonlocal handler_bound
                    if getattr(args, 'IsSuccess', False) and not handler_bound:
                        try:
                            webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                            handler_bound = True
                            print("[WebView2] ✅ Auto-granted permission handler bound after CoreWebView2 init.", flush=True)
                        except Exception as e:
                            print(f"[WebView2] Error binding after init: {e}", flush=True)

                if hasattr(webview_control, 'CoreWebView2InitializationCompleted'):
                    webview_control.CoreWebView2InitializationCompleted += on_init_completed
                    print("[WebView2] ⏳ Waiting for CoreWebView2 initialization to bind permissions...", flush=True)
        except Exception as e:
            print(f"[WebView2] Permission setup note: {e}", flush=True)

    def safe_bind():
        try:
            native = getattr(window, 'native', None)
            if native and hasattr(native, 'InvokeRequired') and native.InvokeRequired:
                native.BeginInvoke(System.Action(do_bind))
                return
        except Exception:
            pass
        do_bind()

    safe_bind()
    window.events.shown += safe_bind
    window.events.loaded += safe_bind


