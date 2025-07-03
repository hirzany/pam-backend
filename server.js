const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Kunci yang ada di midtrans (Produksi)
const isProduction = process.env.NODE_ENV === "production";
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;

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

// Endpoint untuk menerima notifikasi dari Midtrans
app.post("/notification-handler", (req, res) => {
  const notificationJson = req.body;
  console.log(
    "Menerima notifikasi dari Midtrans:",
    JSON.stringify(notificationJson, null, 2)
  );

  // --- Verifikasi Keamanan (Penting untuk Produksi) ---
  const orderId = notificationJson.order_id;
  const statusCode = notificationJson.status_code;
  const grossAmount = notificationJson.gross_amount;
  const signatureKey = notificationJson.signature_key;

  const serverKeyForHashing = serverKey;
  const hash = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKeyForHashing}`)
    .digest("hex");

  if (signatureKey !== hash) {
    console.error("Signature Key tidak valid!");
    return res.status(403).send("Forbidden");
  }
  // --- Akhir Verifikasi Keamanan ---

  let transactionStatus = notificationJson.transaction_status;

  // Logika ini tetap penting untuk memvalidasi bahwa notifikasi diterima dengan benar.
  if (transactionStatus == "capture" || transactionStatus == "settlement") {
    console.log(
      `✅ Pembayaran untuk Order ID ${orderId}: BERHASIL (${transactionStatus})`
    );
  } else {
    console.log(
      `➡️ Status Pembayaran untuk Order ID ${orderId}: GAGAL/PENDING (${transactionStatus})`
    );
  }

  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server pembayaran berjalan di port ${port}`);
});
