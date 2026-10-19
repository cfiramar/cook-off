package com.cookoff.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var errorLayout: LinearLayout
    private lateinit var retryButton: Button

    private val targetUrl = "https://cook-off-contest.web.app/view"
    private var lastBackPressTime = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on continuously for big-screen TV viewing
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Enable immersive full screen
        hideSystemUI()

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#030712"))
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#030712"))
            isFocusable = true
            isFocusableInTouchMode = true
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = "${settings.userAgentString} CookOffTV/1.0"

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showError()
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                errorLayout.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }
        }

        // Sleek error fallback screen for TV if offline
        errorLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(Color.parseColor("#030712"))
            visibility = View.GONE
            setPadding(48, 48, 48, 48)

            val titleView = TextView(context).apply {
                text = "אין חיבור לאינטרנט"
                setTextColor(Color.WHITE)
                textSize = 28f
                gravity = android.view.Gravity.CENTER
            }
            addView(titleView)

            val descView = TextView(context).apply {
                text = "יש לוודא שהטלוויזיה מחוברת לרשת (Wi-Fi) ולנסות שוב."
                setTextColor(Color.LTGRAY)
                textSize = 18f
                setPadding(0, 16, 0, 32)
                gravity = android.view.Gravity.CENTER
            }
            addView(descView)

            retryButton = Button(context).apply {
                text = "נסה שוב"
                textSize = 20f
                setPadding(32, 16, 32, 16)
                isFocusable = true
                setOnClickListener {
                    errorLayout.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                    webView.loadUrl(targetUrl)
                }
            }
            addView(retryButton)
        }

        rootLayout.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        rootLayout.addView(errorLayout, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        setContentView(rootLayout)
        webView.loadUrl(targetUrl)
    }

    private fun showError() {
        webView.visibility = View.GONE
        errorLayout.visibility = View.VISIBLE
        retryButton.requestFocus()
    }

    private fun hideSystemUI() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val currentUrl = webView.url ?: ""
            // If on specific event view (/view/...), return to general view dashboard (/view)
            if (currentUrl.contains("/view/") && !currentUrl.endsWith("/view")) {
                webView.loadUrl(targetUrl)
                return true
            }

            if (webView.canGoBack()) {
                webView.goBack()
                return true
            }

            // Double back to exit
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastBackPressTime < 2500) {
                finish()
            } else {
                lastBackPressTime = currentTime
            }
            return true
        }

        return super.onKeyDown(keyCode, event)
    }
}
