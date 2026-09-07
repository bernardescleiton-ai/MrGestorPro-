package com.mycompany.mrgpro

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    companion object {
        private const val START_URL = "https://mrgpro.vercel.app/"
        private const val LOCAL_URL = "file:///android_asset/web/index.html"
        private const val CHANNEL_ID = "mrgpro_notifications"
        private const val NOTIFICATION_PERMISSION_REQUEST = 1001
        private const val STATE_KEY = "webview_state"
    }

    private lateinit var webView: WebView
    private var restoredState = false
    private var lastKnownOnline = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        configureServiceWorker()
        configureWebView()

        if (savedInstanceState != null) {
            val state = savedInstanceState.getBundle(STATE_KEY)
            if (state != null) {
                webView.restoreState(state)
                restoredState = true
            }
        }
        if (!restoredState) {
            webView.loadUrl(if (localWebExists()) LOCAL_URL else START_URL)
        }
        requestNotificationPermissionIfNeeded()
    }

    private fun configureWebView() {
        webView = WebView(this)
        setContentView(webView)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            loadsImagesAutomatically = true
            mediaPlaybackRequiresUserGesture = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }

        webView.addJavascriptInterface(AndroidBridge(this), "Android")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return request.url.scheme != "https" && request.url.scheme != "http"
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && !isOnline()) {
                    Toast.makeText(this@MainActivity, "Sem internet. Os dados locais continuam disponíveis.", Toast.LENGTH_SHORT).show()
                }
            }
        }

        lastKnownOnline = isOnline()
    }

    private fun configureServiceWorker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
                override fun shouldInterceptRequest(request: WebResourceRequest) = null
            })
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
        val online = isOnline()
        if (online != lastKnownOnline) {
            lastKnownOnline = online
            webView.evaluateJavascript("window.dispatchEvent(new Event('online'));", null)
        }
        webView.evaluateJavascript("window.dispatchEvent(new Event('visibilitychange'));", null)
    }

    override fun onPause() {
        // Persist WebView/localStorage state through the normal Activity lifecycle.
        webView.evaluateJavascript("try{localStorage.setItem('mrg_android_last_pause',String(Date.now()))}catch(e){}", null)
        webView.onPause()
        super.onPause()
    }

    override fun onStop() {
        // Do not destroy the WebView: destroying it here causes unnecessary reloads on return.
        super.onStop()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            // Keep DOM/storage intact. Drop only renderer caches that can be rebuilt.
            webView.clearMatches()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        val webState = Bundle()
        webView.saveState(webState)
        outState.putBundle(STATE_KEY, webState)
        super.onSaveInstanceState(outState)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onDestroy() {
        // Only destroy when Activity itself is actually being destroyed.
        webView.stopLoading()
        webView.removeJavascriptInterface("Android")
        webView.destroy()
        super.onDestroy()
    }

    private fun localWebExists(): Boolean {
        return try { assets.open("web/index.html").use { true } } catch (_: Exception) { false }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Avisos do MrG Pro", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Avisos de cobranças e vencimentos"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST)
        }
    }

    inner class AndroidBridge(private val context: Context) {
        @JavascriptInterface
        fun showNotification(title: String, body: String) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title.take(100))
                .setContentText(body.take(300))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .build()
            getSystemService(NotificationManager::class.java).notify((System.currentTimeMillis() and 0x7fffffff).toInt(), notification)
        }
    }
}
