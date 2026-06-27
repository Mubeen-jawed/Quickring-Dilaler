require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const db = require('./index');
const bcrypt = require('bcryptjs');
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');

async function setup() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(schema);
    console.log('Tables created successfully.');

    // Generate TOTP secrets for both agents
    const secret1 = new Secret({ size: 20 });
    const secret2 = new Secret({ size: 20 });

    // Create Agent One
    const hash1 = await bcrypt.hash('password1', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number, totp_secret)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, phone_number = EXCLUDED.phone_number, totp_secret = EXCLUDED.totp_secret`,
      ['Agent One', 'agent1', hash1, '+18888538185', secret1.base32]
    );

    // Create Agent Two
    const hash2 = await bcrypt.hash('password2', 10);
    await db.query(
      `INSERT INTO kc_agents (name, email, password_hash, phone_number, totp_secret)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, phone_number = EXCLUDED.phone_number, totp_secret = EXCLUDED.totp_secret`,
      ['Agent Two', 'agent2', hash2, '+18333002882', secret2.base32]
    );

    // Deactivate old agents from previous setup
    await db.query(
      `UPDATE kc_agents SET is_active = false WHERE email NOT IN ('agent1', 'agent2')`
    );

    // Generate QR codes for both agents
    const totp1 = new TOTP({ issuer: 'QuickRing', label: 'agent1', secret: secret1, period: 30, digits: 6 });
    const totp2 = new TOTP({ issuer: 'QuickRing', label: 'agent2', secret: secret2, period: 30, digits: 6 });

    const uri1 = totp1.toString();
    const uri2 = totp2.toString();

    console.log('\n========================================');
    console.log('  TOTP AUTHENTICATOR SETUP');
    console.log('========================================\n');

    console.log('Agent One (agent1):');
    console.log('  Manual key:', secret1.base32);
    console.log('  URI:', uri1);
    const qr1 = await QRCode.toString(uri1, { type: 'terminal', small: true });
    console.log(qr1);

    console.log('\nAgent Two (agent2):');
    console.log('  Manual key:', secret2.base32);
    console.log('  URI:', uri2);
    const qr2 = await QRCode.toString(uri2, { type: 'terminal', small: true });
    console.log(qr2);

    console.log('========================================');
    console.log('Open the "Authenticator" app on each agent\'s phone,');
    console.log('tap "+" or "Add account", then scan the QR code above.');
    console.log('Or manually enter the key shown above.');
    console.log('========================================\n');

    // Also save QR codes as PNG files for easy scanning
    const qrDir = path.join(__dirname, '../../totp-qrcodes');
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);

    await QRCode.toFile(path.join(qrDir, 'agent1-qr.png'), uri1, { width: 400 });
    await QRCode.toFile(path.join(qrDir, 'agent2-qr.png'), uri2, { width: 400 });
    console.log(`QR code images saved to: ${qrDir}/`);
    console.log('  - agent1-qr.png');
    console.log('  - agent2-qr.png');
    console.log('Send each QR image to the respective agent to scan.\n');

    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
