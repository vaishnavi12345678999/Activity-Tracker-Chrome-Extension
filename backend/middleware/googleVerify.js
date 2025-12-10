// backend/middleware/googleVerify.js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = async function (req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No Google token provided' });
  }

  try {
    // This verifies the access token and returns token info
    const info = await client.getTokenInfo(token);

    // Make sure this token was actually issued to YOUR CLIENT ID
    if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Token audience mismatch');
    }

    req.userEmail = info.email;
    next();
  } catch (err) {
    console.error('❌ googleVerify error:', err);
    return res.status(403).json({ message: 'Invalid Google token' });
  }
};
