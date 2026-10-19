package com.cookoff.host

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
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
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.util.concurrent.Executor

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
        val nativeBridge = HostAppNativeInterface()
        webView.addJavascriptInterface(nativeBridge, "HostNativeApp")
        webView.addJavascriptInterface(nativeBridge, "AndroidHostApp")

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

    inner class HostAppNativeInterface {
        @JavascriptInterface
        fun isBiometricAvailable(): Boolean {
            return try {
                val biometricManager = BiometricManager.from(this@MainActivity)
                val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                } else {
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                }
                val canAuth = biometricManager.canAuthenticate(authenticators)
                canAuth == BiometricManager.BIOMETRIC_SUCCESS
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun authenticateBiometrics() {
            runOnUiThread {
                showBiometricPrompt()
            }
        }

        @JavascriptInterface
        fun authenticateBiometric() {
            authenticateBiometrics()
        }
    }

    private fun showBiometricPrompt() {
        try {
            val executor: Executor = ContextCompat.getMainExecutor(this)
            val biometricPrompt = BiometricPrompt(this, executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        val errorText = if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                            errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            errorCode == BiometricPrompt.ERROR_CANCELED
                        ) {
                            "האימות בוטל"
                        } else {
                            errString.toString()
                        }
                        notifyWebBiometricResult(false, errorText)
                    }

                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        notifyWebBiometricResult(true, null)
                    }

                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                    }
                })

            val promptBuilder = BiometricPrompt.PromptInfo.Builder()
                .setTitle("אימות כניסה למארח")
                .setSubtitle("הנח אצבע על חיישן טביעת האצבע או השתמש בנעילת המכשיר")

            val biometricManager = BiometricManager.from(this)
            val canWithDeviceCred = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                biometricManager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                ) == BiometricManager.BIOMETRIC_SUCCESS
            } else {
                false
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && canWithDeviceCred) {
                promptBuilder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
            } else {
                promptBuilder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                promptBuilder.setNegativeButtonText("ביטול")
            }

            biometricPrompt.authenticate(promptBuilder.build())
        } catch (e: Exception) {
            val safeErr = e.message ?: "שגיאה בהפעלת אימות ביומטרי"
            notifyWebBiometricResult(false, safeErr)
        }
    }

    private fun notifyWebBiometricResult(success: Boolean, errorMessage: String?) {
        val safeMsg = errorMessage?.replace("\\", "\\\\")?.replace("\"", "\\\"")?.replace("\n", " ") ?: ""
        val script = if (success) {
            "if (window.onHostNativeBiometricResult) window.onHostNativeBiometricResult(true, null); if (window.onHostBiometricSuccess) window.onHostBiometricSuccess();"
        } else {
            "if (window.onHostNativeBiometricResult) window.onHostNativeBiometricResult(false, \"$safeMsg\"); if (window.onHostBiometricError) window.onHostBiometricError(\"$safeMsg\");"
        }
        webView.evaluateJavascript(script, null)
    }

    private fun showError() {
        webView.visibility = View.GONE
        errorLayout.visibility = View.VISIBLE
    }
}
