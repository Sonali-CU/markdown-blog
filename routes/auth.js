// routes/auth.js (replace existing)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const fetch = globalThis.fetch; // Node 20 has fetch
const { Op } = require('sequelize');
const { User } = require('../models');

const SALT_ROUNDS = 10;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';

// password strength validator function
function isStrongPassword(pw) {
  // at least 8 chars, uppercase, lowercase, digit, special char
  return /(?=^.{8,}$)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).*$/.test(pw);
}

// verify recaptcha token with Google
async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET || !token) return { success: true }; // skip if not configured
  try {
    const res = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`
    });
    return await res.json(); // contains success, score, etc.
  } catch (err) {
    console.error('recaptcha verify error', err);
    return { success: false };
  }
}

// Signup
router.post('/signup',
  // validation
  body('username').trim().isLength({ min: 3 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });

      const { username, email, password, recaptchaToken } = req.body;

      // reCAPTCHA server verification (optional)
      const rc = await verifyRecaptcha(recaptchaToken);
      if (!rc.success) return res.status(400).json({ error: 'recaptcha_failed' });

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          error: 'weak_password',
          message: 'Password must be ≥8 chars and include uppercase, lowercase, number and symbol'
        });
      }

      const exists = await User.findOne({
        where: { [Op.or]: [{ email }, { username }] }
      });
      if (exists) return res.status(400).json({ error: 'username_or_email_taken' });

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await User.create({
        username,
        email,
        password_hash: hash,
        display_name: username
      });

      res.json({ message: 'signup_success', user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server_error' });
    }
  });

// Login
router.post('/login',
  body('identifier').trim().notEmpty(),
  body('password').isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });

      const { identifier, password, recaptchaToken } = req.body;

      // recaptcha optional
      const rc = await verifyRecaptcha(recaptchaToken);
      if (!rc.success) return res.status(400).json({ error: 'recaptcha_failed' });

      const user = await User.findOne({
        where: { [Op.or]: [{ email: identifier }, { username: identifier }] }
      });
      if (!user) return res.status(400).json({ error: 'invalid_credentials' });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server_error' });
    }
  });

module.exports = router;

