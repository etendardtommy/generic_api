const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middlewares/auth");

const router = express.Router();

/**
 * GET /api/admin/tables
 * Liste toutes les tables de la base de données (protégé).
 */
router.get("/tables", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        const tables = result.rows.map((r) => r.table_name);

        // Pour chaque table, récupérer le nombre de lignes
        const tablesWithCounts = await Promise.all(
            tables.map(async (table) => {
                const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                return { name: table, count: parseInt(countResult.rows[0].count) };
            })
        );

        res.json(tablesWithCounts);
    } catch (err) {
        console.error("Erreur listing tables:", err.message);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * GET /api/admin/tables/:table
 * Récupère les colonnes et les données d'une table (protégé).
 */
router.get("/tables/:table", authMiddleware, async (req, res) => {
    const { table } = req.params;

    // Sécurité : vérifier que la table existe
    const tableCheck = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    if (tableCheck.rows.length === 0) {
        return res.status(404).json({ error: "Table introuvable" });
    }

    try {
        // Colonnes
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
        `, [table]);

        // Données (limité à 100 lignes)
        const dataResult = await pool.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 100`);

        res.json({
            table,
            columns: columnsResult.rows,
            rows: dataResult.rows,
            total: dataResult.rowCount,
        });
    } catch (err) {
        console.error(`Erreur lecture table ${table}:`, err.message);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
