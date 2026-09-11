# 📱 Sri Hari — Centralized Product API & Android Integration Guide

This document is the official technical specification for integrating the **Sri Hari Android Application** with the **Central Product API**.

By consuming this shared API, **any price, product name, image, category, stock availability, or new product change made from the Admin Panel will automatically reflect on both the Website and Android Application without requiring a Google Play Store update**.

---

## 🌐 1. Base URL & Deployment Endpoints

| Environment | Base API URL |
|---|---|
| **Production** | `https://srihari-store.vercel.app/api` (or your custom domain `/api`) |
| **Development** | `http://localhost:5173/api` |

---

## 📡 2. Public Read Endpoints

### 2.1 Get Full Product Catalog
`GET /api/products`

Returns the complete catalog of 80+ products with real-time pricing, stock status, categories, images, and variants.

#### Query Parameters (Optional)
| Parameter | Type | Description |
|---|---|---|
| `category` | `string` | Filter by category ID (e.g. `keerai`, `microgreens`, `nuts-seeds`) |
| `inStock` | `boolean` | Set `true` to fetch only currently available products |
| `search` | `string` | Search query across English name, Tamil name, ID, and unit |

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "count": 82,
  "lastUpdated": "2026-08-28T18:45:00.000Z",
  "data": [
    {
      "id": "almond",
      "name": "Almond (Badam)",
      "nameTamil": "பாதாம் பருப்பு",
      "tamilName": "பாதாம் பருப்பு",
      "price": 99,
      "mrp": 120,
      "unit": "100g",
      "quantity": "100g",
      "category": "nuts-seeds",
      "image": "/product-images/Almond.webp",
      "description": "Crunchy, premium California almonds. Rich in Vitamin E, magnesium and plant-based protein.",
      "shortDescription": "Premium California almonds",
      "inStock": true,
      "stockQuantity": 50,
      "featured": true,
      "active": true,
      "variantType": "weight",
      "variants": [
        { "id": "almond-100g", "unit": "100g", "price": 99, "inStock": true },
        { "id": "almond-250g", "unit": "250g", "price": 239, "inStock": true },
        { "id": "almond-500g", "unit": "500g", "price": 469, "inStock": true },
        { "id": "almond-1kg", "unit": "1kg", "price": 899, "inStock": true }
      ],
      "updatedAt": "2026-08-28T18:45:00.000Z"
    }
  ]
}
```

---

### 2.2 Get Single Product by ID
`GET /api/products?id={productId}`

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "ponnangani-keerai",
    "name": "Ponnangani Keerai",
    "nameTamil": "பொன்னாங்கண்ணி கீரை",
    "tamilName": "பொன்னாங்கண்ணி கீரை",
    "price": 49,
    "mrp": 55,
    "unit": "250g Cleaned Pack",
    "category": "keerai",
    "image": "/product-images/ponnangani-keerai.webp",
    "description": "Fresh cleaned Ponnangani Keerai. Rich in iron and vitamins. Ready to cook straight from the pack.",
    "inStock": true,
    "active": true
  }
}
```

---

### 2.3 Get Categories
`GET /api/categories`

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": "keerai",
      "name": "Greens (Keerai)",
      "emoji": "🌿",
      "description": "Fresh leafy greens",
      "color": "#EAF8F0",
      "sortOrder": 1,
      "active": true
    },
    {
      "id": "microgreens",
      "name": "Microgreens",
      "emoji": "🌱",
      "description": "Nutrient-packed microgreens (40g Pack)",
      "color": "#E8F5E9",
      "sortOrder": 2,
      "active": true
    },
    {
      "id": "nuts-seeds",
      "name": "Nuts & Seeds",
      "emoji": "🥜",
      "description": "Nutritious nuts & seeds",
      "color": "#FFF5E6",
      "sortOrder": 8,
      "active": true
    }
  ]
}
```

---

## 🖼️ 3. Image URL Handling in Android

Image paths returned by the API can be:
1. **Relative Paths** (e.g. `/product-images/Almond.webp`): Prefix with the base website domain:
   ```kotlin
   fun getFullImageUrl(imagePath: String?): String {
       if (imagePath.isNullOrBlank()) return "https://srihari-store.vercel.app/favicon.svg"
       if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath
       return "https://srihari-store.vercel.app${imagePath}"
   }
   ```
2. **Absolute Cloud URLs** (e.g. `https://res.cloudinary.com/...` or `https://cdn.example.com/...`): Load directly.
3. Recommended Android Image Loaders: **Coil** or **Glide** with memory & disk caching enabled.

---

## ⚡ 4. Recommended Caching Strategy (Stale-While-Revalidate)

To provide an instant (0ms) app launch experience and offline capability:

```
App Opens
   ↓
Load Cached Products from Room Database / SharedPreferences (0ms display)
   ↓
Fetch GET /api/products in background (Coroutines / WorkManager)
   ↓
Update Room Database
   ↓
Flow / LiveData emits updated products if prices, stock, or items changed
```

### HTTP Cache Headers
The API automatically returns:
```http
Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=86400
```

---

## 🛠️ 5. Android Kotlin Implementation (Retrofit + Kotlinx Serialization)

### 5.1 Data Models (`ProductDto.kt`)
```kotlin
package com.srihari.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ProductResponse(
    val success: Boolean,
    val count: Int = 0,
    val lastUpdated: String? = null,
    val data: List<ProductDto> = emptyList()
)

@Serializable
data class ProductDto(
    val id: String,
    val name: String,
    val nameTamil: String? = null,
    val tamilName: String? = null,
    val price: Double,
    val mrp: Double? = null,
    val unit: String,
    val quantity: String? = null,
    val category: String,
    val image: String? = null,
    val description: String? = null,
    val shortDescription: String? = null,
    val note: String? = null,
    val inStock: Boolean = true,
    val stockQuantity: Int? = null,
    val featured: Boolean? = false,
    val active: Boolean? = true,
    val variantType: String? = null,
    val variants: List<ProductVariantDto>? = null,
    val updatedAt: String? = null
)

@Serializable
data class ProductVariantDto(
    val id: String,
    val name: String? = null,
    val unit: String,
    val price: Double,
    val inStock: Boolean? = true
)

@Serializable
data class CategoryResponse(
    val success: Boolean,
    val count: Int = 0,
    val data: List<CategoryDto> = emptyList()
)

@Serializable
data class CategoryDto(
    val id: String,
    val name: String,
    val emoji: String,
    val description: String? = null,
    val color: String? = null,
    val sortOrder: Int? = 0,
    val active: Boolean? = true
)
```

### 5.2 Retrofit Interface (`SriHariApiService.kt`)
```kotlin
package com.srihari.data.api

import com.srihari.data.model.CategoryResponse
import com.srihari.data.model.ProductResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface SriHariApiService {

    @GET("products")
    suspend fun getProducts(
        @Query("category") category: String? = null,
        @Query("inStock") inStock: Boolean? = null,
        @Query("search") search: String? = null
    ): ProductResponse

    @GET("products")
    suspend fun getProductById(
        @Query("id") productId: String
    ): ProductResponse

    @GET("categories")
    suspend fun getCategories(): CategoryResponse
}
```

### 5.3 Repository with Offline Fallback (`ProductRepository.kt`)
```kotlin
package com.srihari.data.repository

import com.srihari.data.api.SriHariApiService
import com.srihari.data.model.ProductDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

class ProductRepository @Inject constructor(
    private val api: SriHariApiService,
    private val productDao: ProductDao // Local Room Database
) {
    fun getProductsFlow(): Flow<List<ProductDto>> = flow {
        // 1. Emit cached data immediately
        val cached = productDao.getAllProducts()
        if (cached.isNotEmpty()) {
            emit(cached)
        }

        // 2. Fetch fresh catalog from Central API
        try {
            val response = api.getProducts()
            if (response.success && response.data.isNotEmpty()) {
                productDao.replaceAll(response.data)
                emit(response.data)
            }
        } catch (e: Exception) {
            // Keep displaying cached data gracefully
            if (cached.isEmpty()) throw e
        }
    }
}
```

---

## 🔒 6. Security Note

* **Public Read Endpoints** (`GET /api/products`, `GET /api/categories`) are open for the Customer Website and Android application without requiring API keys.
* **Admin Write Endpoints** (`POST /api/products`, `PUT /api/products`, `DELETE /api/products`) are strictly server-side authenticated and must **NEVER** be included in the Android client APK.

---

## 📲 8. Razorpay WebView UPI Intent Support

This section covers all Android-side changes required so that UPI apps (GPay, PhonePe, Paytm, BHIM, etc.) appear inside the Razorpay checkout when loaded in a WebView.

> **Why this is needed**: Razorpay's Standard Checkout detects the `wv` marker in the Android WebView user-agent and switches to an intent-based UPI flow. The web layer already sends `webview_intent: true` and `config.supports_upi_intent: 1` to the Razorpay SDK (see `paymentService.ts`). The Android host app must also handle the resulting `upi://` and `intent://` deep links by intercepting them in `WebViewClient.shouldOverrideUrlLoading()`.

---

### 8.1 Prerequisites — Razorpay Dashboard

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings → Payment Methods**.
3. Under **UPI**, enable **UPI Intent / UPI App** (sometimes listed as "UPI Intent for Android").
4. Save changes. Without this, `webview_intent: true` has no effect.

---

### 8.2 Required WebView Settings (`WebViewActivity.kt` / `PaymentWebViewFragment.kt`)

```kotlin
webView.settings.apply {
    javaScriptEnabled = true          // Required for Razorpay SDK
    domStorageEnabled = true          // Required for sessionStorage / localStorage
    javaScriptCanOpenWindowsAutomatically = true
    setSupportMultipleWindows(true)
    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW // HTTPS checkout.js → intent:// links
}
```

---

### 8.3 Deep-Link Interception (`shouldOverrideUrlLoading`)

Add the following `WebViewClient` to your WebView. It intercepts every URL navigation and forwards `upi://` and `intent://` scheme URLs to the Android OS via `startActivity()`, which launches the appropriate UPI app.

```kotlin
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class RazorpayWebViewClient(private val activity: Activity) : WebViewClient() {

    /**
     * Intercepts every URL the WebView is about to load.
     *
     * Returns TRUE  → URL is handled externally; WebView does NOT load it.
     * Returns FALSE → WebView loads the URL normally.
     *
     * UPI Intent deep links emitted by Razorpay SDK:
     *   • upi://pay?pa=merchant@upi&pn=…&am=…&cu=INR&tn=…
     *   • intent://pay?pa=merchant@upi…#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end
     */
    override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?
    ): Boolean {
        val url = request?.url?.toString() ?: return false
        return handleDeepLink(view, url)
    }

    // Legacy API (API < 21) — keep for maximum compatibility
    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url == null) return false
        return handleDeepLink(view, url)
    }

    private fun handleDeepLink(view: WebView?, url: String): Boolean {
        return when {
            // ── UPI scheme (direct link) ──────────────────────────────────────
            // Format: upi://pay?pa=vpa@upi&pn=Name&am=100&cu=INR&tn=Note
            url.startsWith("upi://") -> {
                launchIntent(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                true
            }

            // ── Intent scheme (app-specific link) ────────────────────────────
            // Format: intent://…#Intent;scheme=upi;package=com.…;end
            // Used by GPay, PhonePe, Paytm, BHIM, etc.
            url.startsWith("intent://") -> {
                try {
                    val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    // Fallback URL (S.browser_fallback_url) is honoured automatically
                    launchIntent(intent)
                } catch (e: Exception) {
                    // Malformed intent URI — let the WebView handle it
                    view?.loadUrl(url)
                }
                true
            }

            // ── All other URLs (https, http, about:blank) handled by WebView ─
            else -> false
        }
    }

    private fun launchIntent(intent: Intent) {
        try {
            activity.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            // Target UPI app not installed — show a user-friendly message
            Toast.makeText(
                activity,
                "No UPI app found. Please install GPay, PhonePe, or Paytm.",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
```

**Attach the client to your WebView:**

```kotlin
webView.webViewClient = RazorpayWebViewClient(requireActivity())
// or, if you are inside an Activity:
webView.webViewClient = RazorpayWebViewClient(this)
```

---

### 8.4 `AndroidManifest.xml` — UPI App Visibility (Android 11+)

From Android 11 (API 30), apps must declare which external package intents they query. Add the following `<queries>` block inside `<manifest>` (not inside `<application>`):

```xml
<!-- Required for UPI intent-based payment (Android 11+, API 30+) -->
<queries>
    <!-- Google Pay -->
    <package android:name="com.google.android.apps.nbu.paisa.user" />
    <!-- PhonePe -->
    <package android:name="com.phonepe.app" />
    <!-- Paytm -->
    <package android:name="net.one97.paytm" />
    <!-- BHIM (NPCI) -->
    <package android:name="in.org.npci.upiapp" />
    <!-- Amazon Pay -->
    <package android:name="in.amazon.mShop.android.shopping" />
    <!-- Generic UPI intent query (catches other UPI apps) -->
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" />
    </intent>
</queries>
```

---

### 8.5 Verification Checklist — UPI Intent

| Check | Expected Result |
|---|---|
| Razorpay Dashboard → Settings → UPI Intent enabled | ✅ |
| `WebViewClient.shouldOverrideUrlLoading()` implemented | ✅ |
| `<queries>` block present in `AndroidManifest.xml` | ✅ |
| WebView UA contains `wv` token (automatic) | ✅ |
| GPay / PhonePe appear in Razorpay UPI app list | ✅ |
| Tapping GPay launches Google Pay app directly | ✅ |
| Card payment flow unchanged | ✅ |

---

## ✅ 9. Verification Checklist for Android Developers

- [x] Tested `GET /api/products` — returns HTTP 200 with valid JSON.
- [x] Tested `GET /api/categories` — returns HTTP 200 with categories list.
- [x] Product images load properly using Coil/Glide via `getFullImageUrl()`.
- [x] Changing a price or stock status in the Admin Panel immediately updates the next `GET /api/products` call without any Play Store build update.
- [x] UPI Intent enabled in Razorpay Dashboard (Settings → Payment Methods → UPI).
- [x] `RazorpayWebViewClient.shouldOverrideUrlLoading()` intercepts `upi://` and `intent://` URLs.
- [x] `<queries>` block added to `AndroidManifest.xml` for Android 11+ UPI app visibility.
- [x] GPay, PhonePe, Paytm, BHIM appear as UPI options in the Razorpay checkout sheet.
