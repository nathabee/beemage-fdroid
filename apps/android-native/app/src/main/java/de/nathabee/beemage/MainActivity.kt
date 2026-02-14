// android-wrapper/app/src/main/java/de/nathabee/beemage/MainActivity.kt
package de.nathabee.beemage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    companion object {
        private const val ORIGIN = "https://appassets.androidplatform.net"
    }

    private var pendingFileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result: ActivityResult ->
            val cb = pendingFileChooserCallback
            pendingFileChooserCallback = null

            if (cb == null) return@registerForActivityResult

            val uris: Array<Uri> = when {
                result.resultCode != Activity.RESULT_OK -> emptyArray()
                result.data == null -> emptyArray()
                else -> {
                    val data = result.data!!
                    // Multiple selection
                    val clip = data.clipData
                    if (clip != null && clip.itemCount > 0) {
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    } else {
                        // Single selection
                        val u = data.data
                        if (u != null) arrayOf(u) else emptyArray()
                    }
                }
            }

            cb.onReceiveValue(uris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WebView.setWebContentsDebuggingEnabled(true)

        setContentView(R.layout.activity_main)
        val webView = findViewById<WebView>(R.id.webView)

        // Serve app/src/main/assets/* at https://appassets.androidplatform.net/
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true

        // Hardening (safe with appassets origin)
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false

        webView.webChromeClient = object : WebChromeClient() {

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                // If a chooser is already pending, cancel it.
                pendingFileChooserCallback?.onReceiveValue(emptyArray())
                pendingFileChooserCallback = filePathCallback

                val intent = try {
                    fileChooserParams.createIntent().apply {
                        // Helpful defaults; WebView sets most of this itself.
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                } catch (_: Throwable) {
                    // Fallback intent if createIntent() fails for any reason
                    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                    }
                }

                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: Throwable) {
                    pendingFileChooserCallback = null
                    filePathCallback.onReceiveValue(emptyArray())
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return !url.startsWith("$ORIGIN/")
            }
        }

        webView.loadUrl("$ORIGIN/index.html")
    }

    override fun onDestroy() {
        // Prevent leaks if activity is destroyed while chooser is pending
        pendingFileChooserCallback?.onReceiveValue(emptyArray())
        pendingFileChooserCallback = null
        super.onDestroy()
    }
}
