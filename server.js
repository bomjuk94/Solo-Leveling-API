require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
console.log('server is starting');

const allowedOrigins = [
    'http://localhost:5173',
    'https://digital-garden-client-75iiekjbp-dennisk94s-projects.vercel.app',
    'https://digital-garden.bomjukim.com',
];

app.use(cors({
    origin: (origin, callback) => {
        console.log('🌍 Incoming origin:', origin);
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn('🚫 Blocked CORS request from:', origin);
            callback(null, false);
        }
    },
    credentials: true,
}));

// ✅ FIX: increase body size limits BEFORE any routes
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// === DEV SIMULATION MIDDLEWARE ===
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        const ms = Number(req.headers['x-simulate-cold'] || 0);
        if (ms > 0) {
            console.log(`Simulating cold start delay: ${ms}ms`);
            setTimeout(next, ms);
        } else if (req.headers['x-simulate-503']) {
            return res.status(503).json({ error: 'Service Unavailable (simulated)' });
        } else {
            next();
        }
    });
}

const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

client.connect()
    .then(() => {
        console.log('Connected to MongoDB Atlas');

        const userDataDB = client.db('userData');
        const authDB = client.db('auth');

        const collections = {
            users: authDB.collection('users'),
            profiles: userDataDB.collection('profiles'),
            purchases: userDataDB.collection('purchases'),
            store: userDataDB.collection('store'),
        };

        const authRoutes = require('./routes/auth')(client, collections);
        app.use('/api', authRoutes);

        app.use((err, req, res, next) => {
            console.error('Uncaught error: ', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error: ', err);
        process.exit(1);
    });
