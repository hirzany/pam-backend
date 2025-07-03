// ========================================================================
// KONTEN UNTUK: server.js (VERSI FINAL DENGAN PERBAIKAN HOST & HEALTH CHECK)
// ========================================================================
const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");

// --- PERBAIKAN PENTING ---
// Hanya jalankan dotenv di lingkungan non-produksi (lokal)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
const port = process.env.PORT || 3000; // Railway/Render akan menyediakan PORT
const host = "0.0.0.0"; // Ini memberitahu server untuk mendengarkan di semua antarmuka

app.use(cors());
app.use(express.json());

// --- PERBAIKAN PENTING ---
// Endpoint untuk Health Check dari platform hosting agar server tidak dimatikan
app.get("/", (req, res) => {
  console.log("Health check endpoint '/' diakses, server merespons OK.");
  res.status(200).send("Server PAM Backend is active and running.");
});

const isProduction = process.env.NODE_ENV === "production";
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;

// Validasi bahwa kunci ada di lingkungan produksi
if (isProduction && (!serverKey || !clientKey)) {
  console.error(
    "FATAL ERROR: MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak ditemukan di environment variables."
  );
  process.exit(1); // Hentikan server jika kunci tidak ada
}

console.log(
  `Menjalankan server dalam mode: ${isProduction ? "Produksi" : "Sandbox"}`
);

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
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
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

// Endpoint untuk menerima notifikasi (tidak berubah)
app.post("/notification-handler", (req, res) => {
  console.log("✅ NOTIFIKASI DARI MIDTRANS DITERIMA!");
  console.log(JSON.stringify(req.body, null, 2));
  // Logika verifikasi dan update database akan ada di sini
  res.status(200).send("OK");
});

// Kita menambahkan 'host' agar server bisa diakses oleh Railway/Render
app.listen(port, host, () => {
  console.log(`Server pembayaran berjalan di http://${host}:${port}`);
});
