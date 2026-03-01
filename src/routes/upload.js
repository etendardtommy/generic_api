const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middlewares/auth");

const router = express.Router();

// Configuration Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Type de fichier non autorisé. Formats acceptés : JPG, PNG, WebP, GIF"), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
});

/**
 * POST /api/upload
 * Protégé par JWT. Upload une image, retourne son URL.
 */
router.post("/", authMiddleware, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier envoyé" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({ url: imageUrl, filename: req.file.filename });
});

module.exports = router;
