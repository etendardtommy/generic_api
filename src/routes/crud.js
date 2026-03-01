const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const authMiddleware = require("../middlewares/auth");

const router = express.Router();

// Charger les modèles depuis models.json
const modelsPath = path.join(__dirname, "../../models.json");
let models = {};

function loadModels() {
    try {
        const raw = fs.readFileSync(modelsPath, "utf-8");
        models = JSON.parse(raw);
        console.log(`📦 Modèles chargés : ${Object.keys(models).join(", ")}`);
    } catch (err) {
        console.error("❌ Erreur lecture models.json:", err.message);
    }
}

loadModels();

/**
 * Synchronise les tables dans PostgreSQL à partir de models.json.
 * Crée les tables si elles n'existent pas.
 */
async function syncTables() {
    for (const [tableName, config] of Object.entries(models)) {
        const columns = Object.entries(config.fields)
            .map(([col, type]) => `${col} ${type}`)
            .join(", ");

        const query = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        ${columns},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        try {
            await pool.query(query);
            console.log(`✅ Table "${tableName}" synchronisée`);
        } catch (err) {
            console.error(`❌ Erreur synchro table "${tableName}":`, err.message);
        }
    }
}

/**
 * Génère les routes CRUD dynamiques pour chaque modèle.
 */
for (const modelName of Object.keys(models)) {
    // GET /api/:model — Liste tous les enregistrements (public)
    router.get(`/${modelName}`, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT * FROM ${modelName} ORDER BY created_at DESC`
            );
            res.json(result.rows);
        } catch (err) {
            console.error(`Erreur GET ${modelName}:`, err.message);
            res.status(500).json({ error: "Erreur serveur" });
        }
    });

    // GET /api/:model/:id — Un seul enregistrement (public)
    router.get(`/${modelName}/:id`, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT * FROM ${modelName} WHERE id = $1`,
                [req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Non trouvé" });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Erreur GET ${modelName}/${req.params.id}:`, err.message);
            res.status(500).json({ error: "Erreur serveur" });
        }
    });

    // POST /api/:model — Créer (protégé sauf si publicPost)
    const postMiddlewares = models[modelName].publicPost ? [] : [authMiddleware];
    router.post(`/${modelName}`, ...postMiddlewares, async (req, res) => {
        try {
            const fields = Object.keys(models[modelName].fields);
            const values = fields.map((f) => req.body[f]);
            const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
            const columns = fields.join(", ");

            const result = await pool.query(
                `INSERT INTO ${modelName} (${columns}) VALUES (${placeholders}) RETURNING *`,
                values
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(`Erreur POST ${modelName}:`, err.message);
            res.status(500).json({ error: "Erreur serveur" });
        }
    });

    // PUT /api/:model/:id — Modifier (protégé)
    router.put(`/${modelName}/:id`, authMiddleware, async (req, res) => {
        try {
            const fields = Object.keys(models[modelName].fields);
            const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
            const values = fields.map((f) => req.body[f]);
            values.push(req.params.id);

            const result = await pool.query(
                `UPDATE ${modelName} SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Non trouvé" });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Erreur PUT ${modelName}/${req.params.id}:`, err.message);
            res.status(500).json({ error: "Erreur serveur" });
        }
    });

    // DELETE /api/:model/:id — Supprimer (protégé)
    router.delete(`/${modelName}/:id`, authMiddleware, async (req, res) => {
        try {
            const result = await pool.query(
                `DELETE FROM ${modelName} WHERE id = $1 RETURNING *`,
                [req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Non trouvé" });
            }
            res.json({ message: "Supprimé", item: result.rows[0] });
        } catch (err) {
            console.error(`Erreur DELETE ${modelName}/${req.params.id}:`, err.message);
            res.status(500).json({ error: "Erreur serveur" });
        }
    });
}

module.exports = { router, syncTables };
