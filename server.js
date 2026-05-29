const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// PostgreSQL connection
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "my_life",
  user: "postgres",       // ganti sesuai user PostgreSQL kamu
  password: "iman1220",   // ganti sesuai password PostgreSQL kamu
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Multer config untuk upload foto
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Hanya file gambar yang diperbolehkan!"));
  },
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET semua transaksi
app.get("/api/transaksi", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM transaksi ORDER BY date DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET transaksi by ID
app.get("/api/transaksi/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM transaksi WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST buat transaksi baru
app.post("/api/transaksi", upload.single("foto"), async (req, res) => {
  try {
    const { name, description, amount, date } = req.body;
    const foto = req.file ? req.file.filename : null;

    if (!name || !amount || !date) {
      return res.status(400).json({
        success: false,
        message: "Field name, amount, dan date wajib diisi",
      });
    }

    const result = await pool.query(
      `INSERT INTO transaksi (name, description, amount, date, foto)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, parseFloat(amount), date, foto]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update transaksi
app.put("/api/transaksi/:id", upload.single("foto"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, amount, date } = req.body;

    // Cek data lama untuk hapus foto lama jika ada foto baru
    const existing = await pool.query(
      "SELECT foto FROM transaksi WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });

    let foto = existing.rows[0].foto;
    if (req.file) {
      // Hapus foto lama
      if (foto && fs.existsSync(`uploads/${foto}`)) {
        fs.unlinkSync(`uploads/${foto}`);
      }
      foto = req.file.filename;
    }

    const result = await pool.query(
      `UPDATE transaksi
       SET name=$1, description=$2, amount=$3, date=$4, foto=$5
       WHERE id=$6 RETURNING *`,
      [name, description || null, parseFloat(amount), date, foto, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE transaksi
app.delete("/api/transaksi/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Hapus foto
    const existing = await pool.query(
      "SELECT foto FROM transaksi WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });

    const foto = existing.rows[0].foto;
    if (foto && fs.existsSync(`uploads/${foto}`)) {
      fs.unlinkSync(`uploads/${foto}`);
    }

    await pool.query("DELETE FROM transaksi WHERE id = $1", [id]);
    res.json({ success: true, message: "Transaksi berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});