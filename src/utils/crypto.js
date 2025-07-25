const crypto = require('crypto');

const SECRET_KEY = process.env.PASSWORD_RESET_SECRET_KEY || 'default-secret-key-for-development';
const IV_LENGTH = 16; // AES block size

// Derive a 32-byte key from the secret
function getEncryptionKey() {
  return crypto.scryptSync(SECRET_KEY, 'salt', 32);
}

function encrypt(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(token) {
  const [ivHex, encryptedHex] = token.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}

module.exports = { encrypt, decrypt }; 