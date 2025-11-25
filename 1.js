// server.js
const express = require('express');
const Replicate = require('replicate');
const cloudinary = require('cloudinary').v2;
// Use require('dotenv') for standard environment variable loading
require('dotenv').config();

const app = express();
const PORT = 3000;
const MODEL_ID = 'openai/sora-2-pro';

// --- Cloudinary Configuration (CRITICAL: Reads from environment) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
// -----------------------------------------------------------------

// Global Error Handlers (Kept for process stability)
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n--- CRITICAL ERROR: Unhandled Promise Rejection ---');
  console.error('Reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('\n--- CRITICAL ERROR: Uncaught Synchronous Exception ---');
  console.error('Error:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());

// --- Authentication Middleware ---
const validateReplicateKey = (req, res, next) => {
  const apiKey = req.headers['x-replicate-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-REPLICATE-API-KEY header. Please provide your Replicate API token.'
    });
  }

  req.replicateApiKey = apiKey;
  next();
};

// --- CORE ENDPOINT: GENERATE, UPLOAD, AND RETURN CLOUDINARY LINK ---
app.post('/generate-video', validateReplicateKey, async (req, res) => {
  const { prompt, duration_seconds, aspect_ratio, reference_image_url } = req.body;

  try {
    // 1. Replicate Client Init & Input Setup
    const replicate = new Replicate({ auth: req.replicateApiKey });

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required parameter: prompt' });
    }

    const input = {
      prompt: prompt,
      seconds: duration_seconds || 4,
      aspect_ratio: aspect_ratio || 'landscape',
      resolution: 'high',
    };

    // I2V Logic: reference_image_url is passed directly as a URL string
    if (reference_image_url) {
      input.input_reference = reference_image_url;
      console.log(`[INFO] I2V Enabled. Ref Image: ${reference_image_url}`);
    }

    console.log(`[REQUEST] Submitting ${MODEL_ID} job. Waiting for video generation...`);

    // 2. Call Replicate API
    const replicateOutput = await replicate.run(MODEL_ID, { input });
    
    // 🔥 FIX FOR TypeError: Ensure the output URL is explicitly converted to a string.
    // Cloudinary's underlying library requires a string, not a Node.js URL object.
    const videoUrlFromReplicate = String(replicateOutput.url()); 
    
    console.log(`[SUCCESS] Replicate job complete. Video URL: ${videoUrlFromReplicate}`);

    // 3. Upload Video from Remote URL to Cloudinary
    console.log('[UPLOAD] Uploading video to Cloudinary from remote URL...');
    
    // This leverages Cloudinary's ability to pull from a remote URL, resolving 
    // MIME-type issues as Cloudinary handles the fetch directly.
    const cloudinaryResult = await cloudinary.uploader.upload(videoUrlFromReplicate, {
      resource_type: 'video', // CRITICAL: Must be set to 'video'
      folder: 'sora_generated_videos',
      timeout: 180000, // Extend timeout for large video files (3 minutes)
    });

    // 4. Return the Final Cloudinary URL
    console.log(`[SUCCESS] Cloudinary upload complete. Public URL: ${cloudinaryResult.secure_url}`);

    res.json({
      status: 'completed',
      cloudinary_video_url: cloudinaryResult.secure_url, // Permanent link
      model: MODEL_ID,
    });

  } catch (error) {
    console.error(`[ERROR] Generation or Upload failed:`, error);
    
    // Log the configuration error if Cloudinary is misconfigured (shows "your_cloud_name")
    if (process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
        console.error("!!! CLOUDINARY CONFIGURATION ERROR: Check your .env file !!!");
    }

    const status = error.message.includes('401') ? 401 : 500;
    res.status(status).json({
      status: 'failed',
      error: error.message || 'An unexpected server error occurred during processing.',
    });
  }
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`\n✅ Server is LIVE and listening on http://localhost:${PORT}`);
  console.log(`Cloudinary Cloud Name: ${cloudinary.config().cloud_name}`);
  console.log('--- READY TO ACCEPT REQUESTS ---');
});