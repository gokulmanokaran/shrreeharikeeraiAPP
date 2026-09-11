/**
 * Google Apps Script for Shree Hari Keerai — Google Sheets & Email Order Notification
 * ────────────────────────────────────────────────────────────────────────────────────
 * HOW TO USE:
 * 1. Open your Google Sheet (or create a new Google Sheet).
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any existing code and PASTE THIS ENTIRE SCRIPT.
 * 4. Update the `ADMIN_EMAIL` below with your business email address (e.g. "shreeharikeerai1@gmail.com").
 * 5. Click "Deploy" > "New deployment" (or "Manage deployments" > "Edit" > "New version" if updating).
 * 6. Select type "Web app".
 * 7. Set "Execute as": "Me" (your Google account).
 * 8. Set "Who has access": "Anyone" (allows storefront order submission).
 * 9. Click "Deploy" and authorize permissions.
 * 10. Copy the "Web app URL" and add it to your project's `.env` as `VITE_ORDER_WEBHOOK_URL=...`
 */

// ── CONFIGURATION & BUSINESS DETAILS ─────────────────────────────────────────
var ADMIN_EMAIL = "shreeharikeerai1@gmail.com"; // Admin email — order notifications sent here
var STORE_NAME = "Shree Hari Keerai";
var SHEET_NAME = "Orders"; // Tab name in Google Sheets
var GSTIN_NO = "33BBHPP5925L1ZA";
var FSSAI_NO = "22423557000359";
var SUPPORT_PHONE = "9790209685";
var SUPPORT_EMAIL = "shreeharikeerai1@gmail.com";
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Handle incoming POST requests from the storefront checkout
 */
function doPost(e) {
  var startTime = new Date().toISOString();
  var orderId = "UNKNOWN";

  try {
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("[doPost] ERROR: No post data received at " + startTime);
      return createJsonResponse({ success: false, error: "No post data received" }, 400);
    }

    var data = JSON.parse(e.postData.contents);
    orderId = data.orderId || "SHK-" + new Date().getTime();

    Logger.log(
      "[doPost] START | Order: " + orderId +
      " | Payment: " + (data.paymentId || data.razorpayPaymentId || "N/A") +
      " | Customer: " + (data.email || data.mobile || "N/A") +
      " | Source: " + (data.source || "unknown") +
      " | Time: " + startTime
    );

    // 1. Save order to Google Sheet (with concurrency lock)
    var sheetResult = appendOrderToSheet(data);

    // 2. Send Admin Email Notification
    var emailResult = sendAdminOrderEmail(data);

    // 3. Send Customer Email Notification immediately if email is entered
    var customerEmailResult = sendCustomerOrderEmail(data);

    Logger.log(
      "[doPost] DONE | Order: " + orderId +
      " | SheetAppended: " + sheetResult.appended +
      " | Duplicate: " + (sheetResult.duplicate || false) +
      " | AdminEmailSent: " + emailResult.sent +
      " | CustomerEmailSent: " + customerEmailResult.sent
    );

    return createJsonResponse({
      success: true,
      orderId: orderId,
      sheetUpdated: sheetResult.appended,
      duplicate: sheetResult.duplicate || false,
      emailSent: emailResult.sent,
      customerEmailSent: customerEmailResult.sent,
      message: "Order successfully processed"
    });
  } catch (err) {
    Logger.log(
      "[doPost] EXCEPTION | Order: " + orderId +
      " | Error: " + err.toString() +
      " | Stack: " + (err.stack || "N/A")
    );
    return createJsonResponse({ success: false, error: err.toString(), orderId: orderId }, 500);
  }
}


/**
 * Handle GET requests for health check
 */
function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "Shree Hari Keerai Order Webhook",
    gstin: GSTIN_NO,
    fssai: FSSAI_NO,
    timestamp: new Date().toISOString()
  });
}

/**
 * Appends a new order row into the Google Sheet with deduplication
 */
function appendOrderToSheet(data) {
  // Acquire script lock to prevent concurrent appends racing past the dedup check
  // This ensures two simultaneous orders cannot both pass the orderId check at the same time
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    // Wait up to 10 seconds to acquire the lock
    lock.waitLock(10000);
    lockAcquired = true;
  } catch (lockErr) {
    Logger.log("[appendOrderToSheet] WARNING: Could not acquire lock for order " + (data.orderId || "?") + ": " + lockErr.toString() + ". Proceeding without lock.");
    // Proceed anyway — dedup check is still a partial guard
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Define Column Headers
    var headers = [
      "Order ID",
      "Date & Time",
      "Customer Name",
      "Mobile",
      "Email",
      "Delivery Address",
      "City",
      "State",
      "Pincode",
      "Latitude",
      "Longitude",
      "Google Maps Link",
      "Products Summary",
      "Total Quantity",
      "Subtotal (₹)",
      "Delivery Charge (₹)",
      "Discount (₹)",
      "Total Amount (₹)",
      "Payment Status",
      "Razorpay Payment ID"
    ];

    // Initialize headers if sheet is brand new
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#00A651");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var orderId = data.orderId || "";

    // Deduplication Check: Look for existing orderId in Column A
    // NOTE: This check is inside the lock, so concurrent requests cannot race past it
    if (sheet.getLastRow() > 1 && orderId) {
      var existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) {
        if (existingIds[i][0] === orderId) {
          Logger.log("[appendOrderToSheet] Duplicate order detected: " + orderId + ". Skipping sheet append.");
          return { appended: false, duplicate: true };
        }
      }
    }

    // Format Products Summary
    var productsSummary = data.productsSummary || "";
    if (!productsSummary && data.items && data.items.length) {
      productsSummary = data.items.map(function (item) {
        return item.name + (item.unit ? " (" + item.unit + ")" : "") + " × " + item.quantity;
      }).join(", ");
    }

    var mapsLink = data.mapsLink || (data.lat && data.lng ? "https://www.google.com/maps?q=" + data.lat + "," + data.lng : "");
    var formattedDate = data.formattedDate || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var paymentStatus = data.paymentStatus || "Paid (Razorpay)";
    var paymentId = data.paymentId || data.razorpayPaymentId || "N/A";

    var mobileDisplay = "'" + (data.mobile || "") + (data.alternateMobile ? " (Alt: " + data.alternateMobile + ")" : "");

    var row = [
      orderId,
      formattedDate,
      data.fullName || "",
      mobileDisplay,
      data.email || "N/A",
      data.address || "",
      data.city || "",
      data.state || "",
      data.pincode || "",
      data.lat || "",
      data.lng || "",
      mapsLink,
      productsSummary,
      data.totalQuantity || (data.items ? data.items.reduce(function (a, b) { return a + (b.quantity || 1); }, 0) : 1),
      data.subtotal || 0,
      data.deliveryCharge || 0,
      data.discount || 0,
      data.total || 0,
      paymentStatus,
      paymentId
    ];

    sheet.appendRow(row);
    Logger.log("[appendOrderToSheet] Row appended for order: " + orderId + " | Payment: " + paymentId);
    return { appended: true, duplicate: false };

  } finally {
    // Always release the lock
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) { /* ignore */ }
    }
  }
}


/**
 * Sends a clean, professional HTML order notification email to Admin
 */
function sendAdminOrderEmail(data) {
  var recipient = ADMIN_EMAIL;
  if (!recipient || recipient === "shreeharikeerai@gmail.com") {
    // If not changed, fallback to the sheet owner's email
    recipient = Session.getEffectiveUser().getEmail() || ADMIN_EMAIL;
  }

  var orderId = data.orderId || "SHK-" + new Date().getTime();
  var customerName = data.fullName || "Valued Customer";
  var mobile = data.mobile || "";
  var email = data.email || "Not provided";
  var address = data.address || "";
  var city = data.city || "";
  var state = data.state || "";
  var pincode = data.pincode || "";
  var total = data.total || 0;
  var subtotal = data.subtotal || total;
  var deliveryCharge = data.deliveryCharge || 0;
  var discount = data.discount || 0;
  var formattedDate = data.formattedDate || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  var mapsLink = data.mapsLink || (data.lat && data.lng ? "https://www.google.com/maps?q=" + data.lat + "," + data.lng : "");
  var paymentStatus = data.paymentStatus || "Paid (Razorpay)";
  var paymentId = data.paymentId || data.razorpayPaymentId || "N/A";

  // Build WhatsApp pre-filled message (items, total, address, thank-you)
  var waItemLines = "";
  if (data.items && data.items.length) {
    for (var wi = 0; wi < data.items.length; wi++) {
      var waItem = data.items[wi];
      waItemLines += "  • " + waItem.name + (waItem.unit ? " (" + waItem.unit + ")" : "") + " × " + waItem.quantity + " = ₹" + ((waItem.price || 0) * (waItem.quantity || 1)) + "\n";
    }
  } else {
    waItemLines = "  " + (data.productsSummary || "Your order items") + "\n";
  }
  var waMsg =
    "Hello " + customerName + ",\n\n" +
    "Thank you for your order from Shree Hari Keerai! 🌿\n\n" +
    "*Order Details* (#" + orderId + ")\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    waItemLines +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    (discount > 0 ? "Subtotal: ₹" + subtotal + "\nDiscount: −₹" + discount + "\n" : "") +
    "Delivery Charge: ₹" + deliveryCharge + "\n" +
    "*Total Paid: ₹" + total + "*\n\n" +
    "*Delivery Address:*\n" + address + (pincode ? ", " + pincode : "") + "\n\n" +
    "Today Order – Tomorrow Evening Delivery Guaranteed. 🚚\n\n" +
    "For any queries, feel free to WhatsApp or call us at " + SUPPORT_PHONE + ".\n\n" +
    "Thank you for choosing Shree Hari Keerai! 🙏";
  var waPhone = "91" + mobile.replace(/\D/g, "");
  var waUrl = "https://wa.me/" + waPhone + "?text=" + encodeURIComponent(waMsg);

  var subject = "🌿 New Order Received: #" + orderId + " · ₹" + total + " (" + customerName + ")";

  // Build Ordered Items HTML Rows
  var itemsHtml = "";
  if (data.items && data.items.length) {
    for (var i = 0; i < data.items.length; i++) {
      var item = data.items[i];
      var tamilName = item.nameTamil ? ' <span style="color:#00A651; font-size:12px;">(' + item.nameTamil + ')</span>' : '';
      var itemTotal = (item.price || 0) * (item.quantity || 1);

      itemsHtml += '<tr>' +
        '<td style="padding:10px 12px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#222222;">' +
        '<strong>' + item.name + '</strong>' + tamilName +
        (item.unit ? '<div style="font-size:11px; color:#888888;">' + item.unit + '</div>' : '') +
        '</td>' +
        '<td style="padding:10px 12px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#444444; text-align:center;">' +
        item.quantity +
        '</td>' +
        '<td style="padding:10px 12px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#444444; text-align:right;">' +
        '₹' + item.price +
        '</td>' +
        '<td style="padding:10px 12px; border-bottom:1px solid #EEEEEE; font-size:13px; font-weight:bold; color:#111111; text-align:right;">' +
        '₹' + itemTotal +
        '</td>' +
        '</tr>';
    }
  } else {
    itemsHtml = '<tr><td colspan="4" style="padding:12px; text-align:center; color:#888;">' + (data.productsSummary || "Order items") + '</td></tr>';
  }

  // Construct Full Responsive HTML Email
  var htmlBody = '<!DOCTYPE html>' +
    '<html>' +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
    '<body style="margin:0; padding:20px 10px; background-color:#F5F7F6; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">' +
    '<div style="max-width:600px; margin:0 auto; background-color:#FFFFFF; border-radius:18px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.06); border:1px solid #EAEAEA;">' +

    // Header Banner
    '<div style="background:linear-gradient(135deg, #00A651 0%, #087A43 100%); padding:24px 20px; text-align:center; color:#FFFFFF;">' +
    '<h1 style="margin:0; font-size:22px; font-weight:900; letter-spacing:0.5px;">🌿 ' + STORE_NAME + '</h1>' +
    '<p style="margin:6px 0 0 0; font-size:13px; opacity:0.95; font-weight:500;">New Customer Order Notification</p>' +
    '</div>' +

    // Order Status Bar
    '<div style="background-color:#EAF8F0; padding:12px 20px; border-bottom:1px solid #D5EFE1; display:flex; justify-content:space-between; align-items:center;">' +
    '<div style="font-size:13px; color:#087A43;"><strong>Order ID:</strong> #' + orderId + '</div>' +
    '<div style="font-size:12px; color:#666666;">' + formattedDate + '</div>' +
    '</div>' +

    '<div style="padding:20px;">' +

    // Payment Info Box
    '<div style="background-color:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; padding:12px 16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">' +
    '<div>' +
    '<div style="font-size:12px; color:#15803D; font-weight:bold;">💳 Payment Status: ' + paymentStatus + '</div>' +
    '<div style="font-size:11px; color:#166534; margin-top:2px;">Razorpay ID: <code>' + paymentId + '</code></div>' +
    '</div>' +
    '</div>' +

    // Customer Details Box
    '<div style="background-color:#F9FBFA; border:1px solid #E5ECE8; border-radius:14px; padding:16px; margin-bottom:20px;">' +
    '<h2 style="margin:0 0 12px 0; font-size:14px; text-transform:uppercase; color:#00A651; letter-spacing:0.5px;">👤 Customer & Delivery Details</h2>' +
    '<table style="width:100%; border-collapse:collapse; font-size:13px;">' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666; width:120px;">Customer Name:</td>' +
    '<td style="padding:4px 0; color:#111111; font-weight:bold;">' + customerName + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Mobile Number:</td>' +
    '<td style="padding:4px 0; color:#111111; font-weight:bold;">' +
    '<a href="tel:' + mobile + '" style="color:#00A651; text-decoration:none;">' + mobile + '</a>' +
    (data.alternateMobile ? ' &nbsp;·&nbsp; <span style="color:#666; font-size:12px;">Alt: <a href="tel:' + data.alternateMobile + '" style="color:#00A651; text-decoration:none;">' + data.alternateMobile + '</a></span>' : '') +
    ' &nbsp;·&nbsp; ' +
    '<a href="https://wa.me/91' + mobile.replace(/\D/g, '') + '" style="color:#25D366; text-decoration:none; font-weight:bold;">WhatsApp Chat 💬</a>' +
    '</td>' +
    '</tr>' +
    (data.alternateMobile ?
      '<tr>' +
      '<td style="padding:4px 0; color:#666666;">Alt. Mobile:</td>' +
      '<td style="padding:4px 0; color:#111111; font-weight:bold;">' +
      '<a href="tel:' + data.alternateMobile + '" style="color:#00A651; text-decoration:none;">' + data.alternateMobile + '</a>' +
      '</td>' +
      '</tr>' : '') +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Email Address:</td>' +
    '<td style="padding:4px 0; color:#111111;">' + email + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666; vertical-align:top;">Delivery Address:</td>' +
    '<td style="padding:4px 0; color:#111111; font-weight:600; line-height:1.4;">' + address + '</td>' +
    '</tr>' +
    (city || state || pincode ?
      '<tr>' +
      '<td style="padding:4px 0; color:#666666;">Area / Pincode:</td>' +
      '<td style="padding:4px 0; color:#444444;">' + [city, state, pincode ? '📮 ' + pincode : ''].filter(Boolean).join(', ') + '</td>' +
      '</tr>' : '') +
    (mapsLink ?
      '<tr>' +
      '<td style="padding:8px 0 0 0; color:#666666; vertical-align:middle;">Location Pin:</td>' +
      '<td style="padding:8px 0 0 0;">' +
      '<a href="' + mapsLink + '" target="_blank" style="display:inline-block; background-color:#00A651; color:#FFFFFF; padding:6px 14px; border-radius:8px; text-decoration:none; font-size:12px; font-weight:bold;">📍 Open in Google Maps</a>' +
      '</td>' +
      '</tr>' : '') +
    '</table>' +
    '</div>' +

    // Ordered Items Table
    '<h2 style="margin:0 0 10px 0; font-size:14px; text-transform:uppercase; color:#00A651; letter-spacing:0.5px;">📦 Ordered Items</h2>' +
    '<table style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #EAEAEA; border-radius:10px; overflow:hidden;">' +
    '<thead>' +
    '<tr style="background-color:#F5F5F5; font-size:12px; color:#555555; text-transform:uppercase;">' +
    '<th style="padding:8px 12px; text-align:left;">Item</th>' +
    '<th style="padding:8px 12px; text-align:center;">Qty</th>' +
    '<th style="padding:8px 12px; text-align:right;">Price</th>' +
    '<th style="padding:8px 12px; text-align:right;">Total</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    itemsHtml +
    '</tbody>' +
    '</table>' +

    // Pricing Summary Box
    '<div style="background-color:#F9F9F9; border-radius:12px; padding:14px 16px; margin-bottom:20px;">' +
    '<table style="width:100%; font-size:13px; border-collapse:collapse;">' +
    '<tr>' +
    '<td style="padding:3px 0; color:#666666;">Subtotal:</td>' +
    '<td style="padding:3px 0; color:#111111; text-align:right; font-weight:600;">₹' + subtotal + '</td>' +
    '</tr>' +
    (discount > 0 ?
      '<tr>' +
      '<td style="padding:3px 0; color:#00A651;">Discount Applied:</td>' +
      '<td style="padding:3px 0; color:#00A651; text-align:right; font-weight:600;">−₹' + discount + '</td>' +
      '</tr>' : '') +
    '<tr>' +
    '<td style="padding:3px 0; color:#666666;">Delivery Charge:</td>' +
    '<td style="padding:3px 0; color:#111111; text-align:right; font-weight:600;">₹' + deliveryCharge + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:8px 0 0 0; border-top:1px solid #E0E0E0; font-size:15px; font-weight:bold; color:#111111;">Total Amount:</td>' +
    '<td style="padding:8px 0 0 0; border-top:1px solid #E0E0E0; font-size:17px; font-weight:900; color:#00A651; text-align:right;">₹' + total + '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +

    // Delivery Schedule Note
    '<div style="background-color:#EAF8F0; border-left:4px solid #00A651; padding:10px 14px; border-radius:6px; font-size:12px; color:#087A43; margin-bottom:20px;">' +
    '🚚 <strong>Delivery Schedule:</strong> Today Order – Tomorrow Evening Delivery Guaranteed.' +
    '</div>' +



    // Action Quick Bar
    '<div style="text-align:center; padding-top:10px; display:flex; flex-direction:column; align-items:center; gap:10px;">' +

    // Row 1: Call + plain WhatsApp
    '<div>' +
    '<a href="tel:' + mobile + '" style="display:inline-block; background-color:#111111; color:#FFFFFF; padding:10px 18px; border-radius:10px; text-decoration:none; font-size:13px; font-weight:bold; margin-right:8px;">📞 Call Customer</a>' +
    '<a href="https://wa.me/' + waPhone + '" style="display:inline-block; background-color:#25D366; color:#FFFFFF; padding:10px 18px; border-radius:10px; text-decoration:none; font-size:13px; font-weight:bold;">💬 WhatsApp</a>' +
    '</div>' +

    // Row 2: Send WhatsApp with pre-filled order message (prominent green button)
    '<a href="' + waUrl + '" target="_blank" style="' +
    'display:inline-block; ' +
    'background:linear-gradient(135deg, #25D366 0%, #128C7E 100%); ' +
    'color:#FFFFFF; ' +
    'padding:13px 28px; ' +
    'border-radius:12px; ' +
    'text-decoration:none; ' +
    'font-size:14px; ' +
    'font-weight:900; ' +
    'letter-spacing:0.3px; ' +
    'box-shadow:0 4px 12px rgba(37,211,102,0.35);' +
    '">📲 Send WhatsApp (Order Details Pre-filled)</a>' +

    '</div>' +

    '</div>' +

    // Footer
    '<div style="background-color:#FAFAFA; border-top:1px solid #EAEAEA; padding:14px; text-align:center; font-size:11px; color:#999999;">' +
    '© ' + new Date().getFullYear() + ' ' + STORE_NAME + ' · Automated Order Notification<br>' +
    'GSTIN: ' + GSTIN_NO + ' | FSSAI: ' + FSSAI_NO +
    '</div>' +

    '</div>' +
    '</body>' +
    '</html>';

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
    return { sent: true, recipient: recipient };
  } catch (err) {
    Logger.log("Error sending admin email: " + err.toString());
    return { sent: false, error: err.toString() };
  }
}

/**
 * Sends a clean, comprehensive, professional HTML Order Confirmation Email to the Customer
 * Triggered automatically immediately after successful payment & order confirmation.
 * Only sends if a customer email is provided.
 */
function sendCustomerOrderEmail(data) {
  // Check if customer email was provided
  if (!data.email || data.email === "N/A" || data.email.trim() === "" || data.email.indexOf("@") === -1) {
    Logger.log("No valid customer email entered. Skipping customer confirmation email for order #" + (data.orderId || ""));
    return { sent: false, reason: "No customer email provided" };
  }

  var recipient = data.email.trim();
  var orderId = data.orderId || "SHK-" + new Date().getTime();
  var customerName = data.fullName || "Valued Customer";
  var total = data.total || 0;
  var subtotal = data.subtotal || total;
  var deliveryCharge = data.deliveryCharge || 0;
  var discount = data.discount || 0;
  var formattedDate = data.formattedDate || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  var paymentStatus = data.paymentStatus || "Paid (Razorpay)";
  var paymentId = data.paymentId || data.razorpayPaymentId || "N/A";
  var address = data.address || "";
  var city = data.city || "";
  var state = data.state || "";
  var pincode = data.pincode || "";

  var subject = "🌿 Order Confirmed #" + orderId + " — " + STORE_NAME;

  // Build Ordered Items HTML Rows for Customer
  var itemsHtml = "";
  if (data.items && data.items.length) {
    for (var i = 0; i < data.items.length; i++) {
      var item = data.items[i];
      var tamilName = item.nameTamil ? ' <span style="color:#00A651; font-size:12px;">(' + item.nameTamil + ')</span>' : '';
      var itemTotal = (item.price || 0) * (item.quantity || 1);

      itemsHtml += '<tr>' +
        '<td style="padding:12px 14px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#222222; text-align:left;">' +
        '<strong style="color:#111111;">' + item.name + '</strong>' + tamilName +
        (item.unit ? '<div style="font-size:11px; color:#777777; margin-top:2px;">' + item.unit + '</div>' : '') +
        '</td>' +
        '<td style="padding:12px 14px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#444444; text-align:center;">' +
        item.quantity +
        '</td>' +
        '<td style="padding:12px 14px; border-bottom:1px solid #EEEEEE; font-size:13px; color:#444444; text-align:right;">' +
        '₹' + item.price +
        '</td>' +
        '<td style="padding:12px 14px; border-bottom:1px solid #EEEEEE; font-size:13px; font-weight:bold; color:#00A651; text-align:right;">' +
        '₹' + itemTotal +
        '</td>' +
        '</tr>';
    }
  } else {
    itemsHtml = '<tr><td colspan="4" style="padding:16px; text-align:center; color:#888;">' + (data.productsSummary || "Order items") + '</td></tr>';
  }

  // Construct Full Responsive HTML Customer Receipt Email
  var htmlBody = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Order Confirmation #' + orderId + '</title>' +
    '</head>' +
    '<body style="margin:0; padding:20px 10px; background-color:#F5F7F6; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color:#222222;">' +
    '<div style="max-width:600px; margin:0 auto; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 6px 28px rgba(0,0,0,0.07); border:1px solid #EAEAEA;">' +

    // Top Header Banner
    '<div style="background:linear-gradient(135deg, #00A651 0%, #087A43 100%); padding:28px 24px; text-align:center; color:#FFFFFF;">' +
    '<h1 style="margin:0; font-size:24px; font-weight:900; letter-spacing:0.5px;">🌿 ' + STORE_NAME + '</h1>' +
    '<p style="margin:6px 0 0 0; font-size:14px; opacity:0.95; font-weight:500;">Order Confirmation & Receipt</p>' +
    '</div>' +

    // Success Confirmation Banner
    '<div style="background-color:#EAF8F0; padding:16px 24px; border-bottom:1px solid #CDEED9; text-align:center;">' +
    '<div style="display:inline-block; background-color:#00A651; color:#FFFFFF; font-size:12px; font-weight:bold; padding:4px 14px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">' +
    '✓ Order Placed & Confirmed' +
    '</div>' +
    '<h2 style="margin:4px 0 0 0; font-size:17px; font-weight:bold; color:#087A43;">Thank You for Your Order, ' + customerName + '! 🎉</h2>' +
    '</div>' +

    '<div style="padding:24px;">' +

    // Order & Payment Summary Box
    '<div style="background-color:#F9FBFA; border:1px solid #E5ECE8; border-radius:14px; padding:16px; margin-bottom:20px;">' +
    '<table style="width:100%; border-collapse:collapse; font-size:13px;">' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666; width:130px;">Order ID:</td>' +
    '<td style="padding:4px 0; color:#111111; font-weight:bold;">#' + orderId + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Order Date & Time:</td>' +
    '<td style="padding:4px 0; color:#111111; font-weight:600;">' + formattedDate + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Payment Status:</td>' +
    '<td style="padding:4px 0; color:#00A651; font-weight:bold;">' + paymentStatus + '</td>' +
    '</tr>' +
    (paymentId && paymentId !== "N/A" ?
      '<tr>' +
      '<td style="padding:4px 0; color:#666666;">Payment Ref ID:</td>' +
      '<td style="padding:4px 0; color:#555555;"><code>' + paymentId + '</code></td>' +
      '</tr>' : '') +
    '</table>' +
    '</div>' +

    // Delivery Address Box
    '<div style="background-color:#FFFFFF; border:1px solid #EAEAEA; border-radius:14px; padding:16px; margin-bottom:20px;">' +
    '<h3 style="margin:0 0 8px 0; font-size:13px; text-transform:uppercase; color:#00A651; letter-spacing:0.5px;">📍 Delivery Address</h3>' +
    '<p style="margin:0; font-size:13px; line-height:1.5; color:#333333; font-weight:600;">' + address + '</p>' +
    (city || state || pincode ?
      '<p style="margin:4px 0 0 0; font-size:12px; color:#666666;">' + [city, state, pincode ? '📮 ' + pincode : ''].filter(Boolean).join(', ') + '</p>' : '') +
    '</div>' +

    // Itemized Products Table
    '<h3 style="margin:0 0 10px 0; font-size:13px; text-transform:uppercase; color:#00A651; letter-spacing:0.5px;">📦 Purchased Products</h3>' +
    '<table style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #EAEAEA; border-radius:12px; overflow:hidden;">' +
    '<thead>' +
    '<tr style="background-color:#F5F5F5; font-size:12px; color:#555555; text-transform:uppercase;">' +
    '<th style="padding:10px 14px; text-align:left;">Product</th>' +
    '<th style="padding:10px 14px; text-align:center;">Qty</th>' +
    '<th style="padding:10px 14px; text-align:right;">Price</th>' +
    '<th style="padding:10px 14px; text-align:right;">Total</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    itemsHtml +
    '</tbody>' +
    '</table>' +

    // Financial Summary Box
    '<div style="background-color:#F9F9F9; border-radius:14px; padding:16px; margin-bottom:20px; border:1px solid #EAEAEA;">' +
    '<table style="width:100%; font-size:13px; border-collapse:collapse;">' +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Subtotal:</td>' +
    '<td style="padding:4px 0; color:#111111; text-align:right; font-weight:600;">₹' + subtotal + '</td>' +
    '</tr>' +
    (discount > 0 ?
      '<tr>' +
      '<td style="padding:4px 0; color:#00A651;">Discount Applied:</td>' +
      '<td style="padding:4px 0; color:#00A651; text-align:right; font-weight:600;">−₹' + discount + '</td>' +
      '</tr>' : '') +
    '<tr>' +
    '<td style="padding:4px 0; color:#666666;">Delivery Charge:</td>' +
    '<td style="padding:4px 0; color:#111111; text-align:right; font-weight:600;">' +
    (deliveryCharge === 0 ? '<span style="color:#00A651; font-weight:bold;">FREE</span>' : '₹' + deliveryCharge) +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:10px 0 0 0; border-top:1px solid #E0E0E0; font-size:16px; font-weight:bold; color:#111111;">Total Amount Paid:</td>' +
    '<td style="padding:10px 0 0 0; border-top:1px solid #E0E0E0; font-size:18px; font-weight:900; color:#00A651; text-align:right;">₹' + total + '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +

    // Delivery Guarantee Highlight Box
    '<div style="background-color:#EAF8F0; border-left:4px solid #00A651; padding:12px 16px; border-radius:8px; font-size:13px; color:#087A43; margin-bottom:24px; line-height:1.5;">' +
    '🚚 <strong>Delivery Schedule:</strong> Today Order – Tomorrow Evening Delivery Guaranteed directly to your pinned address.' +
    '</div>' +



    // Support & Help Contact
    '<div style="text-align:center; padding:10px 0; border-top:1px solid #EEEEEE;">' +
    '<p style="margin:0 0 10px 0; font-size:12px; color:#666666;">Need help or have questions about your delivery?</p>' +
    '<a href="https://wa.me/91' + SUPPORT_PHONE + '" style="display:inline-block; background-color:#25D366; color:#FFFFFF; padding:10px 22px; border-radius:10px; text-decoration:none; font-size:13px; font-weight:bold; margin-right:8px;">💬 WhatsApp Support</a>' +
    '<a href="tel:' + SUPPORT_PHONE + '" style="display:inline-block; background-color:#111111; color:#FFFFFF; padding:10px 22px; border-radius:10px; text-decoration:none; font-size:13px; font-weight:bold;">📞 Call Us</a>' +
    '</div>' +

    '</div>' +

    // Email Footer
    '<div style="background-color:#FAFAFA; border-top:1px solid #EAEAEA; padding:16px; text-align:center; font-size:11px; color:#888888; line-height:1.6;">' +
    '© ' + new Date().getFullYear() + ' ' + STORE_NAME + ' · Fresh • Natural • Premium<br>' +
    '<strong>GSTIN:</strong> ' + GSTIN_NO + ' &nbsp;|&nbsp; <strong>FSSAI:</strong> ' + FSSAI_NO + '<br>' +
    'Coimbatore, Tamil Nadu, India' +
    '</div>' +

    '</div>' +
    '</body>' +
    '</html>';

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
    Logger.log("Customer order confirmation email sent successfully to: " + recipient + " for Order #" + orderId);
    return { sent: true, recipient: recipient };
  } catch (err) {
    Logger.log("Error sending customer confirmation email: " + err.toString());
    return { sent: false, error: err.toString() };
  }
}

/**
 * Helper to create standard JSON output
 * Note: Google Apps Script ContentService does not support real HTTP status codes
 * for CORS-enabled deployments. We embed the status in the response body.
 */
function createJsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(
    Object.assign({ _status: statusCode || 200 }, obj)
  ));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
