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

                    # Prevent app closure on target="_blank" or window.open links (e.g., Duitku payment portal)
                    def handle_create_window(win_type):
                        logger.info(f"[QtWebEngine] Redirecting new window/popup request ({win_type}) to main window.")
                        return page

                    page.createWindow = handle_create_window
                    handler_bound = True
                    logger.info("[QtWebEngine] ✅ Permission & createWindow handler bound successfully.")
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




