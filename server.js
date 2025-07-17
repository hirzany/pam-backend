// ========================================================================
// KONTEN FINAL UNTUK: pam-backend/server.js (DENGAN LOGIKA NOTIFIKASI)
// ========================================================================
const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");
const admin = require("firebase-admin");

if (
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "sandbox"
) {
  require("dotenv").config();
}

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK berhasil diinisialisasi.");
} catch (error) {
  console.error("FATAL: Gagal menginisialisasi Firebase Admin SDK.", error);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const host = "0.0.0.0";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Server PAM Backend is active and running.");
});

const isProduction = process.env.NODE_ENV === "production";
console.log(`Server berjalan dalam mode produksi: ${isProduction}`);

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;

if (!serverKey || !clientKey) {
  console.error("FATAL ERROR: Kunci Midtrans tidak ditemukan.");
  process.exit(1);
}

let snap = new midtransClient.Snap({
  isProduction: isProduction,
  serverKey: serverKey,
  clientKey: clientKey,
});

// --- PERUBAHAN ---
// Endpoint sekarang menerima fcmToken untuk diteruskan ke Midtrans
app.post("/create-transaction", (req, res) => {
  const { billId, amount, customerName, customerEmail, fcmToken } = req.body;
  const orderId = `PAM-${billId}-${Date.now()}`;

  let parameter = {
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: {
      first_name: customerName,
      email: customerEmail || "customer@example.com",
    },
    // Menyimpan fcmToken untuk digunakan di notifikasi nanti
    custom_field1: fcmToken,
  };

  snap
    .createTransaction(parameter)
    .then((transaction) => {
      res.json({
        token: transaction.token,
        redirect_url: transaction.redirect_url,
      });
    })
    .catch((e) => {
      console.error("Error membuat transaksi:", e.message);
      res.status(500).json({ error: e.message });
    });
});

// --- FUNGSI BARU UNTUK MENGIRIM NOTIFIKASI DARI SERVER ---
async function sendPaymentSuccessNotification(fcmToken, orderId, amount) {
  if (!fcmToken) {
    console.log("Tidak ada FCM Token, notifikasi sukses tidak dikirim.");
    return;
  }
  const message = {
    notification: {
      title: "Pembayaran Berhasil!",
      body: `Pembayaran untuk tagihan sebesar Rp ${amount.toLocaleString(
        "id-ID"
      )} telah diterima.`,
    },
    token: fcmToken,
    android: { priority: "high" },
  };
  try {
    await admin.messaging().send(message);
    console.log(`Notifikasi sukses untuk order ${orderId} telah dikirim.`);
  } catch (error) {
    console.error("Gagal mengirim notifikasi sukses:", error);
  }
}

// --- PERUBAHAN BESAR ---
// Endpoint notifikasi sekarang memiliki logika untuk memproses pembayaran
app.post("/notification-handler", (req, res) => {
  console.log("✅ NOTIFIKASI DARI MIDTRANS DITERIMA!");

  snap.transaction
    .notification(req.body)
    .then((statusResponse) => {
      let orderId = statusResponse.order_id;
      let transactionStatus = statusResponse.transaction_status;
      let fraudStatus = statusResponse.fraud_status;
      let grossAmount = parseFloat(statusResponse.gross_amount);
      let fcmToken = statusResponse.custom_field1; // Ambil fcmToken

      console.log(
        `Status transaksi untuk order id ${orderId}: ${transactionStatus}`
      );

      // Logika untuk pembayaran yang berhasil
      if (transactionStatus == "settlement" || transactionStatus == "capture") {
        if (fraudStatus == "accept") {
          // TODO: Di sini Anda akan memperbarui database Anda.
          // Karena kita menggunakan SQLite lokal, kita akan mengirim notifikasi
          // sebagai gantinya, yang akan ditangani oleh aplikasi.
          console.log(`Pembayaran untuk order ${orderId} berhasil dan aman.`);
          sendPaymentSuccessNotification(fcmToken, orderId, grossAmount);
        }
      }

      res.status(200).send("OK");
    })
    .catch((error) => {
      console.error("Gagal memverifikasi notifikasi Midtrans:", error.message);
      res.status(400).send("Invalid notification");
    });
});

app.post("/send-notification", async (req, res) => {
  const { token, title, body } = req.body;
  if (!token || !title || !body) {
    return res
      .status(400)
      .json({ error: "Token, title, dan body wajib diisi." });
  }
  const message = {
    notification: { title: title, body: body },
    token: token,
    android: { priority: "high" },
  };
  try {
    const response = await admin.messaging().send(message);
    console.log("Notifikasi berhasil dikirim:", response);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error("Gagal mengirim notifikasi:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, host, () => {
  console.log(`Server pembayaran berjalan di http://${host}:${port}`);
});
