// server.js (final)
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const { sequelize } = require('./models');

// Routers (make sure these files exist in routes/)
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// Basic rate limiting for API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// CORS - restrict in production
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static front-end (public folder)
app.use('/', express.static(path.join(__dirname, 'public')));

// Mount APIs
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', uploadRoutes);

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// DB sync and start server
// For first-time deploy set DB_SYNC_ALTER=true in .env to run sequelize.sync({ alter: true })
// After initial run set DB_SYNC_ALTER=false to avoid unintended schema changes
const alterSchema = process.env.DB_SYNC_ALTER === 'true';

sequelize.authenticate()
  .then(() => console.log('DB connection authenticated'))
  .catch(err => {
    console.error('DB connection error', err);
    process.exit(1);
  });

sequelize.sync({ alter: alterSchema })
  .then(() => {
    console.log('Database synced!');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB sync error:', err);
    process.exit(1);
  });

