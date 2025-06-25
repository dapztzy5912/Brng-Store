const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 30002;

// WhatsApp configuration
const WHATSAPP_CONFIG = {
    number: '263780379588', // Ganti dengan nomor WhatsApp Anda (format: 62xxx tanpa +)
    storeName: 'BORING STORE' // Nama toko Anda
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports the following filetypes - " + filetypes));
    }
});

let products = [
    {
        id: uuidv4(),
        name: "testing",
        price: 15000,
        images: ["/images/placeholder1.png", "/images/placeholder2.png"],
        description: "ini hanya testing yaw bukan untuk publoc,."
    },
    {
        id: uuidv4(),
        name: "robux",
        price: 10000,
        images: ["/images/placeholder3.png"],
        description: "kami sebagai pemula menyediakan layanan, seperti panel pterodactyl, vps, akum free fire, dan robux atau roblox."
    }
];

// API Routes
app.get('/api/products', (req, res) => {
    res.json(products);
});

app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
});

// WhatsApp configuration endpoint
app.get('/api/whatsapp-number', (req, res) => {
    res.json({ 
        number: WHATSAPP_CONFIG.number,
        storeName: WHATSAPP_CONFIG.storeName
    });
});

// Update WhatsApp configuration (optional - untuk admin)
app.put('/api/whatsapp-config', (req, res) => {
    const { number, storeName } = req.body;
    
    if (number) {
        // Validasi format nomor WhatsApp
        const cleanNumber = number.replace(/\D/g, ''); // Hapus semua karakter non-digit
        if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            WHATSAPP_CONFIG.number = cleanNumber;
        } else {
            return res.status(400).json({ message: 'Format nomor WhatsApp tidak valid' });
        }
    }
    
    if (storeName) {
        WHATSAPP_CONFIG.storeName = storeName;
    }
    
    res.json({ 
        message: 'Konfigurasi WhatsApp berhasil diperbarui',
        config: WHATSAPP_CONFIG
    });
});

app.post('/api/products', upload.array('product-images', 10), (req, res) => {
    try {
        const { productName, productPrice, productDescription } = req.body;
        if (!productName || !productPrice) {
            return res.status(400).json({ message: 'Nama dan harga produk diperlukan.' });
        }

        const newProduct = {
            id: uuidv4(),
            name: productName,
            price: parseFloat(productPrice),
            images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : [],
            description: productDescription || ''
        };
        products.push(newProduct);
        res.status(201).json(newProduct);
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ message: "Gagal menambahkan produk", error: error.message });
    }
});

app.put('/api/products/:id', upload.array('product-images', 10), (req, res) => {
    try {
        const productId = req.params.id;
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Produk tidak ditemukan' });
        }

        const { productName, productPrice, productDescription, existingImages } = req.body;
        const updatedProduct = { ...products[productIndex] };

        if (productName) updatedProduct.name = productName;
        if (productPrice) updatedProduct.price = parseFloat(productPrice);
        if (productDescription !== undefined) updatedProduct.description = productDescription;

        let finalImages = [];
        if (existingImages) {
            try {
                const parsedExisting = JSON.parse(existingImages);
                if (Array.isArray(parsedExisting)) {
                    finalImages = parsedExisting;
                }
            } catch (e) {
                console.warn("Could not parse existingImages:", existingImages);
            }
        } else if (typeof existingImages === 'string' && existingImages.startsWith('/uploads/')) {
            finalImages = [existingImages];
        }

        if (req.files && req.files.length > 0) {
            const newImagePaths = req.files.map(file => `/uploads/${file.filename}`);
            finalImages = finalImages.concat(newImagePaths);
        }
        updatedProduct.images = finalImages.length > 0 ? finalImages : products[productIndex].images;

        products[productIndex] = updatedProduct;
        res.json(updatedProduct);
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Gagal memperbarui produk", error: error.message });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    const productToDelete = products[productIndex];
    if (productToDelete.images && productToDelete.images.length > 0) {
        productToDelete.images.forEach(imgPath => {
            const fullPath = path.join(__dirname, imgPath.startsWith('/') ? imgPath.substring(1) : imgPath);
            if (fs.existsSync(fullPath) && imgPath.startsWith('/uploads/')) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (err) {
                    console.error("Gagal menghapus file gambar:", fullPath, err);
                }
            }
        });
    }

    products.splice(productIndex, 1);
    res.status(200).json({ message: 'Produk berhasil dihapus' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Halaman admin: http://localhost:${PORT}/a5ujemb0t.html`);
    console.log(`WhatsApp Number: ${WHATSAPP_CONFIG.number}`);
    console.log(`Store Name: ${WHATSAPP_CONFIG.storeName}`);
});
