# -*- coding: utf-8 -*-
import logging

logger = logging.getLogger("Permissions")

def setup_permissions(window):
    """
    Menyetujui izin Kamera dan Mikrofon secara otomatis pada engine Windows Edge WebView2.
    Aman dari Threading Exception karena menggunakan WinForms UI Thread.
    """
    handler_bound = False

    def bind_permissions_on_ui(sender=None, args=None):
        nonlocal handler_bound
        if handler_bound:
            return
        try:
            import System
            native = getattr(window, 'native', None)
            if not native:
                return

            webview_control = getattr(native, 'webview', None)
            if not webview_control:
                return

            def permission_requested_handler(s, e):
                try:
                    # 1 = CoreWebView2PermissionState.Allow
                    e.State = System.Enum.ToObject(e.State.GetType(), 1)
                    e.Handled = True
                    kind_id = int(e.PermissionKind)
                    kind_name = "Camera" if kind_id == 2 else ("Microphone" if kind_id == 1 else f"Kind_{kind_id}")
                    logger.info(f"[WebView2] ✅ Auto-granted permission for: {kind_name}")
                except Exception as ex:
                    logger.warning(f"[WebView2] Error in permission handler: {ex}")

            core = getattr(webview_control, 'CoreWebView2', None)
            if core is not None:
                core.PermissionRequested += permission_requested_handler
                handler_bound = True
                logger.info("[WebView2] ✅ Permission handler bound successfully to CoreWebView2.")
            else:
                def on_init_completed(s, e):
                    nonlocal handler_bound
                    if getattr(e, 'IsSuccess', False) and not handler_bound:
                        try:
                            webview_control.CoreWebView2.PermissionRequested += permission_requested_handler
                            handler_bound = True
                            logger.info("[WebView2] ✅ Permission handler bound after CoreWebView2 init.")
                        except Exception as ex2:
                            logger.warning(f"[WebView2] Error binding after init: {ex2}")

                if hasattr(webview_control, 'CoreWebView2InitializationCompleted'):
                    webview_control.CoreWebView2InitializationCompleted += on_init_completed
                    logger.info("[WebView2] ⏳ Waiting for CoreWebView2 initialization...")
        except Exception as err:
            logger.warning(f"[WebView2] Permission setup note: {err}")

    def safe_attach():
        try:
            import System
            native = getattr(window, 'native', None)
            if not native:
                return

            if hasattr(native, 'IsHandleCreated') and native.IsHandleCreated:
                try:
                    native.BeginInvoke(System.Action(bind_permissions_on_ui))
                except Exception:
                    pass

            if hasattr(native, 'Shown'):
                try:
                    native.Shown += System.EventHandler(bind_permissions_on_ui)
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"[WebView2] safe_attach note: {e}")

    window.events.shown += safe_attach



