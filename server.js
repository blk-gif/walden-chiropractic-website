require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const twilio   = require('twilio');
const sgMail   = require('@sendgrid/mail');
const path     = require('path');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

// Serve the static site from the same folder
app.use(express.static(path.join(__dirname)));

// ── Twilio & SendGrid clients ─────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ── /api/contact ─────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { fname, lname, phone, email, reason, message, channel } = req.body;

  // Basic validation
  const name = `${(fname || '').trim()} ${(lname || '').trim()}`.trim() || 'Unknown';
  const hasPhone = phone && phone.trim().length >= 7;
  const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (!hasPhone && !hasEmail) {
    return res.status(400).json({ error: 'A phone number or email address is required.' });
  }

  const results = { sms: null, email: null };
  const errors  = [];

  // ── SMS via Twilio ──────────────────────────────────────────
  if (hasPhone) {
    // Normalize to E.164: strip non-digits, prepend +1 for US numbers
    const digits = phone.replace(/\D/g, '');
    const e164   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

    const smsBody =
      `New patient inquiry — Walden Bailey Chiropractic\n` +
      `Name:    ${name}\n` +
      `Phone:   ${phone.trim()}\n` +
      `Email:   ${email || 'N/A'}\n` +
      `Reason:  ${reason || 'Not specified'}\n` +
      `Message: ${message || 'None'}\n` +
      `Channel: ${channel || 'sms'}`;

    try {
      const msg = await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_FROM_NUMBER,   // your Twilio phone number
        to:   process.env.PRACTICE_PHONE_E164   // practice number, e.g. +17168939200
      });
      results.sms = msg.sid;
    } catch (err) {
      console.error('Twilio SMS error:', err.message);
      errors.push(`SMS: ${err.message}`);
    }

    // Also send a confirmation text to the patient
    if (process.env.SEND_PATIENT_CONFIRMATION === 'true') {
      try {
        await twilioClient.messages.create({
          body:
            `Hi ${fname || 'there'}, thank you for contacting Walden Bailey Chiropractic! ` +
            `We received your message and will follow up shortly. ` +
            `Questions? Call us at (716) 893-9200. Reply STOP to opt out.`,
          from: process.env.TWILIO_FROM_NUMBER,
          to:   e164
        });
      } catch (err) {
        console.error('Twilio confirmation SMS error:', err.message);
        // Non-fatal — don't add to errors
      }
    }
  }

  // ── Email via SendGrid ──────────────────────────────────────
  if (hasEmail) {
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:8px;overflow:hidden;">
        <div style="background:#080808;padding:24px 32px;">
          <h1 style="color:#FFB612;font-size:20px;margin:0;">Walden Bailey Chiropractic</h1>
          <p style="color:#9a9585;font-size:13px;margin:4px 0 0;">New Patient Contact Form Submission</p>
        </div>
        <div style="padding:28px 32px;background:#ffffff;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#666;width:120px;vertical-align:top;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Phone</td><td style="padding:8px 0;">${phone || 'N/A'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Email</td><td style="padding:8px 0;">${email || 'N/A'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Reason</td><td style="padding:8px 0;">${reason || 'Not specified'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Channel</td><td style="padding:8px 0;">${channel || 'email'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Message</td><td style="padding:8px 0;white-space:pre-wrap;">${message || 'None'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Submitted</td><td style="padding:8px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
          </table>
          <div style="margin-top:24px;padding:16px;background:#fff8e1;border-left:4px solid #FFB612;border-radius:4px;font-size:13px;color:#555;">
            Reply to this email or call the patient directly to confirm their appointment.
          </div>
        </div>
        <div style="padding:16px 32px;background:#f0f0f0;font-size:11px;color:#999;text-align:center;">
          Walden Bailey Chiropractic &bull; 1086 Walden Ave Suite 1, Buffalo NY 14211 &bull; (716) 893-9200<br>
          This message was sent via the website contact form and is for internal use only.
        </div>
      </div>`;

    try {
      await sgMail.send({
        to:       process.env.PRACTICE_EMAIL,          // practice inbox
        from:     process.env.SENDGRID_FROM_EMAIL,     // verified sender in SendGrid
        replyTo:  hasEmail ? email.trim() : undefined,
        subject:  `New patient inquiry — ${name} (${reason || 'General'})`,
        html:     htmlBody,
        text:
          `New patient inquiry\nName: ${name}\nPhone: ${phone || 'N/A'}\n` +
          `Email: ${email || 'N/A'}\nReason: ${reason || 'Not specified'}\n` +
          `Message: ${message || 'None'}`
      });
      results.email = 'sent';
    } catch (err) {
      console.error('SendGrid error:', err.response?.body || err.message);
      errors.push(`Email: ${err.message}`);
    }

    // Confirmation email to patient
    if (process.env.SEND_PATIENT_CONFIRMATION === 'true') {
      try {
        await sgMail.send({
          to:      email.trim(),
          from:    process.env.SENDGRID_FROM_EMAIL,
          subject: 'We received your message — Walden Bailey Chiropractic',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
              <div style="background:#080808;padding:24px 32px;">
                <h1 style="color:#FFB612;font-size:20px;margin:0;">Walden Bailey Chiropractic</h1>
              </div>
              <div style="padding:28px 32px;background:#ffffff;">
                <p style="font-size:15px;">Hi ${fname || 'there'},</p>
                <p style="font-size:14px;color:#444;line-height:1.6;">
                  Thank you for reaching out! We received your message and a member of our team
                  will follow up with you shortly during office hours.
                </p>
                <div style="margin:24px 0;padding:16px;background:#fff8e1;border-radius:8px;text-align:center;">
                  <p style="margin:0;font-size:13px;color:#555;">Need to reach us sooner?</p>
                  <a href="tel:7168939200" style="display:inline-block;margin-top:10px;background:#FFB612;color:#080808;font-weight:700;padding:10px 24px;border-radius:50px;text-decoration:none;font-size:15px;">(716) 893-9200</a>
                </div>
                <p style="font-size:13px;color:#888;">1086 Walden Ave Suite 1, Buffalo NY 14211</p>
              </div>
            </div>`
        });
      } catch (err) {
        console.error('SendGrid confirmation error:', err.message);
      }
    }
  }

  if (errors.length > 0 && !results.sms && !results.email) {
    return res.status(502).json({ error: 'Failed to send message.', details: errors });
  }

  return res.status(200).json({ success: true, results });
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Fallback: serve index.html for any non-API route ─────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Walden Bailey Chiropractic server running on http://localhost:${PORT}`);
});
