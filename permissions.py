# -*- coding: utf-8 -*-
import logging

logger = logging.getLogger("Permissions")

def setup_permissions(window):
    """
    Menyetujui izin Kamera dan Mikrofon secara otomatis pada engine Chromium (QtWebEngine & WinForms).
    """
    handler_bound = False

    def bind_permissions():
        nonlocal handler_bound
        if handler_bound:
            return

        try:
            native = getattr(window, 'native', None)
            if not native:
                return

            # 1. PyQt5 / QtWebEngine Backend
            if hasattr(native, 'page'):
                try:
                    from PyQt5.QtWebEngineWidgets import QWebEnginePage, QWebEngineSettings

                    # ── Subclass yang benar-benar override createWindow ──────────
                    # Catatan penting: page.createWindow = func TIDAK bekerja di PyQt5
                    # karena createWindow adalah C++ virtual method.
                    # Satu-satunya cara yang benar adalah subclass QWebEnginePage.
                    class _NoExternalBrowserPage(QWebEnginePage):
                        """
                        Custom page yang mencegat window.open() & target='_blank'
                        agar tidak membuka browser eksternal.
                        Semua navigasi baru diarahkan ke halaman yang sama (current page).
                        """
                        def createWindow(self, win_type):
                            logger.info(
                                f"[QtWebEngine] ✅ Intercepted window.open()/target=_blank "
                                f"(type={win_type}) — ditahan di dalam app."
                            )
                            return self  # redirect ke page yang sama, bukan browser luar

                    page = native.page()

                    # Pasang custom page (preserving profile)
                    try:
                        profile = page.profile()
                        custom_page = _NoExternalBrowserPage(profile, native)

                        # Terapkan user-agent modern agar Duitku / Next.js tidak error
                        try:
                            custom_page.profile().setHttpUserAgent(
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                "AppleWebKit/537.36 (KHTML, like Gecko) "
                                "Chrome/122.0.0.0 Safari/537.36"
                            )
                        except Exception:
                            pass

                        # Settings
                        try:
                            st = custom_page.settings()
                            st.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
                            st.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
                            st.setAttribute(QWebEngineSettings.JavascriptCanOpenWindows, True)
                            st.setAttribute(QWebEngineSettings.JavascriptCanAccessClipboard, True)
                            st.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
                            st.setAttribute(QWebEngineSettings.WebGLEnabled, True)
                            st.setAttribute(QWebEngineSettings.AutoLoadImages, True)
                            if hasattr(QWebEngineSettings, 'PlaybackRequiresUserGesture'):
                                st.setAttribute(QWebEngineSettings.PlaybackRequiresUserGesture, False)
                        except Exception:
                            pass

                        # Auto-grant kamera / mikrofon
                        def grant_permission(security_origin, feature):
                            custom_page.setFeaturePermission(
                                security_origin, feature,
                                QWebEnginePage.PermissionGrantedByUser
                            )
                            logger.info(f"[QtWebEngine] ✅ Auto-granted: {feature}")

                        custom_page.featurePermissionRequested.connect(grant_permission)

                        # Pasang custom page ke webview
                        native.setPage(custom_page)

                        handler_bound = True
                        logger.info("[QtWebEngine] ✅ Custom page (no-external-browser) terpasang.")
                        return

                    except Exception as ex_page:
                        logger.warning(f"[QtWebEngine] Gagal pasang custom page: {ex_page}")

                except Exception as ex_qt:
                    logger.warning(f"[QtWebEngine] Permission setup note: {ex_qt}")

            # 2. WinForms Edge WebView2 Backend
            webview_control = getattr(native, 'webview', None)
            if webview_control:
                try:
                    import System
                    def permission_requested_handler(s, e):
                        try:
                            e.State = System.Enum.ToObject(e.State.GetType(), 1)
                            e.Handled = True
                            logger.info("[WebView2] ✅ Auto-granted permission.")
                        except Exception as ex_wf:
                            logger.warning(f"[WebView2] Error in permission handler: {ex_wf}")

                    def new_window_handler(s, e):
                        try:
                            e.Handled = True
                            if hasattr(e, 'Uri') and e.Uri:
                                core.Navigate(e.Uri)
                            else:
                                try:
                                    e.NewWindow = core
                                except Exception:
                                    pass
                            logger.info("[WebView2] ✅ Redirected new window request to main window.")
                        except Exception as ex_nw:
                            logger.warning(f"[WebView2] Error in NewWindowRequested handler: {ex_nw}")

                    core = getattr(webview_control, 'CoreWebView2', None)
                    if core is not None:
                        core.PermissionRequested += permission_requested_handler
                        core.NewWindowRequested += new_window_handler
                        handler_bound = True
                        logger.info("[WebView2] ✅ Permission & NewWindowRequested handlers bound successfully to CoreWebView2.")
                    else:
                        def on_init_completed(s, e):
                            nonlocal handler_bound
                            if getattr(e, 'IsSuccess', False) and not handler_bound:
                                try:
                                    c = webview_control.CoreWebView2
                                    c.PermissionRequested += permission_requested_handler
                                    c.NewWindowRequested += new_window_handler
                                    handler_bound = True
                                    logger.info("[WebView2] ✅ Handlers bound after CoreWebView2 init.")
                                except Exception as ex2:
                                    logger.warning(f"[WebView2] Error binding after init: {ex2}")

                        if hasattr(webview_control, 'CoreWebView2InitializationCompleted'):
                            webview_control.CoreWebView2InitializationCompleted += on_init_completed
                except ImportError:
                    pass
                except Exception as err_wf:
                    logger.warning(f"[WebView2] Permission setup note: {err_wf}")

        except Exception as err:
            logger.warning(f"[Permissions] Setup note: {err}")

    try:
        window.events.shown += bind_permissions
    except Exception:
        pass
    bind_permissions()
