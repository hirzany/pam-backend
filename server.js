const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const host = "0.0.0.0"; // Ini memberitahu server untuk mendengarkan di semua antarmuka

app.use(cors());
app.use(express.json());

// Endpoint untuk Health Check dari Railway
app.get("/", (req, res) => {
  res.status(200).send("Server PAM Backend is active and running.");
});
// -----------------------------------------

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

// Endpoint untuk menerima notifikasi (tidak berubah)
app.post("/notification-handler", (req, res) => {
  console.log("✅ NOTIFIKASI DARI MIDTRANS DITERIMA!");
  console.log(JSON.stringify(req.body, null, 2));
  // Logika verifikasi dan update database akan ada di sini
  res.status(200).send("OK");
});

// Kita menambahkan 'host' agar server bisa diakses oleh Railway
app.listen(port, host, () => {
  console.log(`Server pembayaran berjalan di http://${host}:${port}`);
});
