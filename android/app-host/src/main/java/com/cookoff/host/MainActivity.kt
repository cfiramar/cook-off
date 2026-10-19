package com.cookoff.host

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.ValueCallback
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
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var errorLayout: LinearLayout
    private lateinit var retryButton: Button

    private val targetUrl = "https://cook-off-contest.web.app/host"
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            val intentData = result.data
            val results: Array<Uri>? = if (result.resultCode == RESULT_OK && intentData != null) {
                val clipData = intentData.clipData
                val singleUri = intentData.data
                if (clipData != null) {
                    val uriList = ArrayList<Uri>()
                    for (i in 0 until clipData.itemCount) {
                        val itemUri = clipData.getItemAt(i).uri
                        if (itemUri != null) {
                            uriList.add(itemUri)
                        }
                    }
                    uriList.toTypedArray()
                } else if (singleUri != null) {
                    arrayOf(singleUri)
                } else {
                    null
                }
            } else {
                null
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F9FAFB"))
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F9FAFB"))
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = "${settings.userAgentString} CookOffHost/1.0"

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }

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

        errorLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(Color.parseColor("#F9FAFB"))
            visibility = View.GONE
            setPadding(32, 32, 32, 32)

            val titleView = TextView(context).apply {
                text = "שגיאת חיבור"
                setTextColor(Color.parseColor("#1F2937"))
                textSize = 24f
                gravity = android.view.Gravity.CENTER
            }
            addView(titleView)

            val descView = TextView(context).apply {
                text = "לא ניתן להתחבר לשרת. בדוק את החיבור לרשת ונסה שוב."
                setTextColor(Color.parseColor("#6B7280"))
                textSize = 16f
                setPadding(0, 12, 0, 24)
                gravity = android.view.Gravity.CENTER
            }
            addView(descView)

            retryButton = Button(context).apply {
                text = "נסה שוב"
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

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl(targetUrl)
    }

    private fun showError() {
        webView.visibility = View.GONE
        errorLayout.visibility = View.VISIBLE
    }
}
