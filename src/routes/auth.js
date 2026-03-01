const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Retourne un JWT valide 24h.
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email et mot de passe requis" });
        }

        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Identifiants incorrects" });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: "Identifiants incorrects" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
        console.error("Erreur login:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * POST /api/auth/register
 * Body: { email, password }
 * Crée un compte admin. Protégé : nécessite le header X-Admin-Secret.
 */
router.post("/register", async (req, res) => {
    try {
        const adminSecret = req.headers["x-admin-secret"];
        if (adminSecret !== JWT_SECRET) {
            return res.status(403).json({ error: "Accès interdit" });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email et mot de passe requis" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
            [email, hashedPassword]
        );

        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Cet email existe déjà" });
        }
        console.error("Erreur register:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
