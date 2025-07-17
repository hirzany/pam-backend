// ========================================================================
// KONTEN FINAL UNTUK: pam-backend/server.js (DENGAN PERBAIKAN LOGIKA)
// ========================================================================
const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");
const admin = require("firebase-admin");

// Hanya jalankan dotenv di lingkungan non-produksi (lokal)
if (
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "sandbox"
) {
  require("dotenv").config();
}

// --- INISIALISASI FIREBASE ADMIN ---
try {
  // Di Railway, ini akan dibaca dari Environment Variables
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK berhasil diinisialisasi.");
} catch (error) {
  console.error(
    "FATAL: Gagal menginisialisasi Firebase Admin SDK. Pastikan FIREBASE_SERVICE_ACCOUNT benar.",
    error
  );
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const host = "0.0.0.0";

app.use(cors());
app.use(express.json());

// Endpoint untuk Health Check
app.get("/", (req, res) => {
  res.status(200).send("Server PAM Backend is active and running.");
});

// --- PERBAIKAN LOGIKA UTAMA ---
// isProduction sekarang akan bernilai 'true' HANYA JIKA NODE_ENV adalah 'production'.
// Jika NODE_ENV adalah 'sandbox' atau lainnya, isProduction akan 'false'.
const isProduction = process.env.NODE_ENV === "production";
console.log(`Server berjalan dalam mode produksi: ${isProduction}`);

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;

if (!serverKey || !clientKey) {
  console.error(
    "FATAL ERROR: Kunci Midtrans tidak ditemukan di environment variables."
  );
  process.exit(1);
}

let snap = new midtransClient.Snap({
  isProduction: isProduction,
  serverKey: serverKey,
  clientKey: clientKey,
});

// Endpoint untuk membuat transaksi (tidak berubah)
app.post("/create-transaction", (req, res) => {
  const { billId, amount, customerName, customerEmail } = req.body;
  const orderId = `PAM-${billId}-${Date.now()}`;
  let parameter = {
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: {
      first_name: customerName,
      email: customerEmail || "customer@example.com",
    },
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

// Endpoint untuk notifikasi Midtrans (tidak berubah)
app.post("/notification-handler", (req, res) => {
  console.log("✅ NOTIFIKASI DARI MIDTRANS DITERIMA!");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send("OK");
});

// --- ENDPOINT BARU UNTUK MENGIRIM NOTIFIKASI ---
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
