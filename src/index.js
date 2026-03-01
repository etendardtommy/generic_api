require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const { router: crudRouter, syncTables } = require("./routes/crud");
const uploadRoutes = require("./routes/upload");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", crudRouter);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Crée le compte admin par défaut s'il n'existe pas encore.
 */
async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL || "admin@api.local";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    try {
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length === 0) {
            const hashed = await bcrypt.hash(password, 10);
            await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashed]);
            console.log(`👤 Compte admin créé : ${email}`);
        } else {
            console.log(`👤 Compte admin existant : ${email}`);
        }
    } catch (err) {
        console.error("❌ Erreur création admin:", err.message);
    }
}

/**
 * Attend que PostgreSQL soit prêt (retry avec délai).
 */
async function waitForDB(retries = 10, delay = 2000) {
    for (let i = 1; i <= retries; i++) {
        try {
            await pool.query("SELECT 1");
            console.log("✅ Connexion PostgreSQL établie");
            return;
        } catch (err) {
            console.log(`⏳ Attente PostgreSQL... (${i}/${retries})`);
            if (i === retries) throw new Error("Impossible de se connecter à PostgreSQL");
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}

/**
 * Démarrage du serveur.
 * 1. Attend PostgreSQL
 * 2. Synchronise les tables depuis models.json
 * 3. Crée le compte admin si nécessaire
 * 4. Lance le serveur Express
 */
async function start() {
    try {
        await waitForDB();
        await syncTables();
        await seedAdmin();
        app.listen(PORT, () => {
            console.log(`🚀 API démarrée sur le port ${PORT}`);
        });
    } catch (err) {
        console.error("❌ Erreur démarrage:", err);
        process.exit(1);
    }
}

start();
