// routes/upload.js
const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET = process.env.S3_BUCKET;
if (!BUCKET) {
  console.warn('S3_BUCKET not set in .env — upload route will fail until configured');
}

// S3 client: if IAM role attached to EC2, credentials are picked up automatically
const s3 = new S3Client({ region: REGION });

router.post('/upload-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) return res.status(400).json({ error: 'missing_filename_or_contentType' });

    const key = `uploads/${Date.now()}-${randomUUID()}-${filename.replace(/\s+/g, '_')}`;
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read' // For public access; prefer signed/private + CloudFront for production
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 minutes
    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    res.json({ url, key, publicUrl });
  } catch (err) {
    console.error('upload-url error', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
