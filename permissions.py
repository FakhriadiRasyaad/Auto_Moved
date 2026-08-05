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
                    page = native.page()

                    # Set modern Chrome User-Agent so Next.js / Duitku payment portal loads without client-side exceptions
                    try:
                        profile = page.profile()
                        profile.setHttpUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    except Exception:
                        pass

                    try:
                        st = page.settings()
                        st.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
                        st.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
                        st.setAttribute(QWebEngineSettings.JavascriptCanOpenWindows, True)
                        st.setAttribute(QWebEngineSettings.JavascriptCanAccessClipboard, True)
                        st.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
                        st.setAttribute(QWebEngineSettings.WebGLEnabled, True)
                        st.setAttribute(QWebEngineSettings.AutoLoadImages, True)
                    except Exception:
                        pass

                    def grant_permission(security_origin, feature):
                        page.setFeaturePermission(security_origin, feature, QWebEnginePage.PermissionGrantedByUser)
                        logger.info(f"[QtWebEngine] ✅ Auto-granted permission for feature: {feature}")

                    page.featurePermissionRequested.connect(grant_permission)

                    # Intercept target="_blank" and window.open links (e.g. Duitku payment portal)
                    # and open them in system default browser (Edge/Chrome) so Next.js loads without errors,
                    # while keeping the Photobooth Kiosk window on pembayaran.html with live status polling.
                    import webbrowser
                    def handle_create_window(win_type):
                        try:
                            dummy_page = QWebEnginePage(native)
                            def on_url_changed(qurl):
                                url_str = qurl.toString()
                                if url_str and url_str != "about:blank":
                                    logger.info(f"[QtWebEngine] Opening external link in system browser: {url_str}")
                                    webbrowser.open(url_str)
                                    dummy_page.deleteLater()
                            dummy_page.urlChanged.connect(on_url_changed)
                            return dummy_page
                        except Exception as ex_cw:
                            logger.warning(f"[QtWebEngine] Error in createWindow: {ex_cw}")
                            return None

                    page.createWindow = handle_create_window
                    handler_bound = True
                    logger.info("[QtWebEngine] ✅ Permission & external window handler bound successfully.")
                    return
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

                    core = getattr(webview_control, 'CoreWebView2', None)
                    if core is not None:
                        core.PermissionRequested += permission_requested_handler
                        handler_bound = True
                        logger.info("[WebView2] ✅ Permission handler bound successfully to CoreWebView2.")
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




