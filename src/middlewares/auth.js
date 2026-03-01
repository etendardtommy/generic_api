const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

/**
 * Middleware d'authentification JWT.
 * Vérifie le token dans le header Authorization (format: "Bearer <token>").
 * Si valide, ajoute req.user avec les infos décodées.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token manquant ou invalide" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token expiré ou invalide" });
    }
}

module.exports = authMiddleware;
