const express = require('express');
const https = require('https');
const twilio = require('twilio');
const authenticate = require('../middleware/auth');
const db = require('../db');
const { getIO } = require('../io');

const router = express.Router();

// Layer 3: Backfill missing recordings on-demand when reading call logs
async function backfillRecordings(calls) {
  const missing = calls.filter(
    (c) => c.status === 'completed' && c.duration > 0 && !c.recording_sid
  );
  if (missing.length === 0) return calls;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await Promise.all(
    missing.map(async (call) => {
      try {
        const recordings = await client.recordings.list({ callSid: call.call_sid, limit: 1 });
        if (recordings.length === 0) return;

        const rec = recordings[0];
        const recordingUrl = `https://api.twilio.com${rec.uri.replace('.json', '')}`;

        await db.query(
          'UPDATE kc_call_logs SET recording_sid = $1, recording_url = $2 WHERE id = $3 AND recording_sid IS NULL',
          [rec.sid, recordingUrl, call.id]
        );
        call.recording_sid = rec.sid;
        call.recording_url = recordingUrl;
      } catch (err) {
        // Non-fatal — don't break the response
        console.error(`Backfill recording for ${call.call_sid}:`, err.message);
      }
    })
  );

  return calls;
}

// Log a new call
router.post('/', authenticate, async (req, res) => {
  try {
    const { callSid, phoneNumber, direction } = req.body;
    const result = await db.query(
      `INSERT INTO kc_call_logs (agent_id, call_sid, phone_number, direction)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.agent.id, callSid, phoneNumber, direction || 'outbound']
    );

    const callLog = result.rows[0];

    const io = getIO();
    if (io) {
      io.to(`agent:${req.agent.id}`).emit('call:logged', callLog);
    }

    res.json(callLog);
  } catch (err) {
    console.error('Create call log error:', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// Update call status/duration
router.patch('/:callSid', authenticate, async (req, res) => {
  try {
    const { status, duration } = req.body;
    const result = await db.query(
      `UPDATE kc_call_logs
       SET status = COALESCE($1, status),
           duration = COALESCE($2, duration),
           ended_at = CASE WHEN $1 IN ('completed','no-answer','busy','canceled','failed') THEN NOW() ELSE ended_at END
       WHERE call_sid = $3 AND agent_id = $4
       RETURNING *`,
      [status, duration, req.params.callSid, req.agent.id]
    );

    const callLog = result.rows[0];
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    const io = getIO();
    if (io) {
      io.to(`agent:${req.agent.id}`).emit('call:updated', callLog);
    }

    res.json(callLog);
  } catch (err) {
    console.error('Update call log error:', err);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// Delete a call log entry
router.delete('/:callSid', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM kc_call_logs WHERE call_sid = $1 AND agent_id = $2 RETURNING *`,
      [req.params.callSid, req.agent.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    const io = getIO();
    if (io) {
      io.to(`agent:${req.agent.id}`).emit('call:updated', result.rows[0]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete call log error:', err);
    res.status(500).json({ error: 'Failed to delete call' });
  }
});

// Get monthly billing totals for the logged-in agent
router.get('/billing', authenticate, async (req, res) => {
  try {
    const rate = parseFloat(process.env.RATE_PER_MINUTE) || 0;
    const result = await db.query(
      `SELECT
         COALESCE(SUM(duration), 0) AS total_seconds,
         COALESCE(SUM(CEIL(duration / 60.0)), 0) AS total_minutes,
         ROUND(COALESCE(SUM(CEIL(duration / 60.0)), 0) * $1, 2) AS total_cost
       FROM kc_call_logs
       WHERE agent_id = $2
         AND started_at >= date_trunc('month', NOW())
         AND status = 'completed'`,
      [rate, req.agent.id]
    );
    const data = result.rows[0] || { total_seconds: 0, total_minutes: 0, total_cost: 0 };
    data.rate_per_minute = rate;
    res.json(data);
  } catch (err) {
    console.error('Billing query error:', err);
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

// Get monthly billing summary (all months grouped)
router.get('/billing/monthly-summary', authenticate, async (req, res) => {
  try {
    const rate = parseFloat(process.env.RATE_PER_MINUTE) || 0;
    const result = await db.query(
      `SELECT
         date_trunc('month', started_at) AS month,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_calls,
         COUNT(*) FILTER (WHERE status = 'completed' AND direction = 'outbound') AS outbound_calls,
         COUNT(*) FILTER (WHERE status = 'completed' AND direction = 'inbound') AS inbound_calls,
         COALESCE(SUM(duration) FILTER (WHERE status = 'completed'), 0) AS total_seconds,
         COALESCE(SUM(CEIL(duration / 60.0)) FILTER (WHERE status = 'completed'), 0) AS total_billable_minutes,
         COALESCE(SUM(duration) FILTER (WHERE status = 'completed' AND direction = 'outbound'), 0) AS outbound_seconds,
         COALESCE(SUM(CEIL(duration / 60.0)) FILTER (WHERE status = 'completed' AND direction = 'outbound'), 0) AS outbound_billable_minutes,
         COALESCE(SUM(duration) FILTER (WHERE status = 'completed' AND direction = 'inbound'), 0) AS inbound_seconds,
         COALESCE(SUM(CEIL(duration / 60.0)) FILTER (WHERE status = 'completed' AND direction = 'inbound'), 0) AS inbound_billable_minutes
       FROM kc_call_logs
       WHERE agent_id = $1
       GROUP BY date_trunc('month', started_at)
       ORDER BY month DESC`,
      [req.agent.id]
    );

    const months = result.rows.map((row) => ({
      month: row.month,
      completed_calls: parseInt(row.completed_calls),
      outbound_calls: parseInt(row.outbound_calls),
      inbound_calls: parseInt(row.inbound_calls),
      total_seconds: parseInt(row.total_seconds),
      outbound_seconds: parseInt(row.outbound_seconds),
      inbound_seconds: parseInt(row.inbound_seconds),
      total_minutes: parseInt(row.total_billable_minutes),
      outbound_minutes: parseInt(row.outbound_billable_minutes),
      inbound_minutes: parseInt(row.inbound_billable_minutes),
      total_cost: Math.round(parseInt(row.total_billable_minutes) * rate * 100) / 100,
    }));

    res.json({ rate_per_minute: rate, months });
  } catch (err) {
    console.error('Monthly summary error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

// Get paginated call list for a specific month
router.get('/billing/month/:month', authenticate, async (req, res) => {
  try {
    const rate = parseFloat(process.env.RATE_PER_MINUTE) || 0;
    const monthStr = req.params.month; // e.g. "2026-03"
    const startDate = `${monthStr}-01`;
    const [year, mon] = monthStr.split('-').map(Number);
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').replace(/[^\d+]/g, '');

    const searchFilter = search ? ` AND phone_number LIKE $4` : '';
    const countParams = search ? [req.agent.id, startDate, nextMonth, `%${search}%`] : [req.agent.id, startDate, nextMonth];
    const dataParams = search
      ? [req.agent.id, startDate, nextMonth, `%${search}%`, limit, offset]
      : [req.agent.id, startDate, nextMonth, limit, offset];

    const countResult = await db.query(
      `SELECT COUNT(*) FROM kc_call_logs
       WHERE agent_id = $1 AND status = 'completed'
         AND started_at >= $2 AND started_at < $3${searchFilter}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT * FROM kc_call_logs
       WHERE agent_id = $1 AND status = 'completed'
         AND started_at >= $2 AND started_at < $3${searchFilter}
       ORDER BY started_at DESC
       LIMIT $${search ? 5 : 4} OFFSET $${search ? 6 : 5}`,
      dataParams
    );

    res.json({
      month: monthStr,
      rate_per_minute: rate,
      calls: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Monthly detail error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly detail' });
  }
});

// Export CSV for a specific month
router.get('/billing/export/:month', authenticate, async (req, res) => {
  try {
    const monthStr = req.params.month;
    const startDate = `${monthStr}-01`;
    const [year, mon] = monthStr.split('-').map(Number);
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    const rate = parseFloat(process.env.RATE_PER_MINUTE) || 0;

    const result = await db.query(
      `SELECT phone_number, direction, status, duration, started_at, ended_at
       FROM kc_call_logs
       WHERE agent_id = $1 AND status = 'completed'
         AND started_at >= $2 AND started_at < $3
       ORDER BY started_at DESC`,
      [req.agent.id, startDate, nextMonth]
    );

    const escCsv = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csv = 'Phone Number,Direction,Status,Duration (sec),Duration (min),Cost,Started At,Ended At\n';
    for (const row of result.rows) {
      const durSec = row.duration || 0;
      const durMin = durSec > 0 ? Math.ceil(durSec / 60) : 0;
      const cost = Math.round(durMin * rate * 100) / 100;
      csv += [
        escCsv(row.phone_number),
        escCsv(row.direction),
        escCsv(row.status),
        durSec,
        durMin,
        cost.toFixed(2),
        escCsv(row.started_at ? new Date(row.started_at).toISOString() : ''),
        escCsv(row.ended_at ? new Date(row.ended_at).toISOString() : ''),
      ].join(',') + '\n';
    }

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="billing-${monthStr}.csv"`,
    });
    res.send(csv);
  } catch (err) {
    console.error('Billing export error:', err);
    res.status(500).json({ error: 'Failed to export billing' });
  }
});

// Get inbound call history for the agent (paginated)
router.get('/inbound-history', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').replace(/[^\d+]/g, '');

    const searchFilter = search ? ` AND phone_number LIKE $4` : '';
    const countParams = search ? [req.agent.id, `%${search}%`] : [req.agent.id];
    const dataParams = search ? [req.agent.id, limit, offset, `%${search}%`] : [req.agent.id, limit, offset];

    const countResult = await db.query(
      `SELECT COUNT(*) FROM kc_call_logs WHERE agent_id = $1 AND direction = 'inbound'${search ? ` AND phone_number LIKE $2` : ''}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT * FROM kc_call_logs
       WHERE agent_id = $1 AND direction = 'inbound'${searchFilter}
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      dataParams
    );

    // Layer 3: backfill any completed calls missing recording data
    const calls = await backfillRecordings(result.rows);

    res.json({
      calls,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Fetch inbound history error:', err);
    res.status(500).json({ error: 'Failed to fetch inbound history' });
  }
});

// Download call recording as MP3 (proxied through server with Twilio auth)
router.get('/:callSid/recording', authenticate, async (req, res) => {
  try {
    // Check DB first for saved recording URL
    const result = await db.query(
      'SELECT recording_sid, recording_url FROM kc_call_logs WHERE call_sid = $1 AND agent_id = $2',
      [req.params.callSid, req.agent.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Call not found' });
    }

    let recordingUrl = result.rows[0].recording_url;

    // Fallback: look up recording via Twilio API if not saved in DB
    if (!recordingUrl) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const recordings = await client.recordings.list({ callSid: req.params.callSid, limit: 1 });
      if (recordings.length === 0) {
        return res.status(404).json({ error: 'Recording not found' });
      }
      const rec = recordings[0];
      recordingUrl = `https://api.twilio.com${rec.uri.replace('.json', '')}`;
      // Cache both recording_sid and recording_url for next time
      await db.query(
        'UPDATE kc_call_logs SET recording_sid = $1, recording_url = $2 WHERE call_sid = $3 AND recording_sid IS NULL',
        [rec.sid, recordingUrl, req.params.callSid]
      );
    }

    const mp3Url = recordingUrl + '.mp3';
    const authString = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    // Fetch from Twilio and stream to client
    https.get(mp3Url, { headers: { Authorization: `Basic ${authString}` } }, (twilioRes) => {
      // Follow redirect if Twilio returns one
      if (twilioRes.statusCode >= 300 && twilioRes.statusCode < 400 && twilioRes.headers.location) {
        https.get(twilioRes.headers.location, (redirectRes) => {
          res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${req.params.callSid}.mp3"`,
          });
          redirectRes.pipe(res);
        }).on('error', (err) => {
          console.error('Recording redirect fetch error:', err);
          res.status(502).json({ error: 'Failed to fetch recording' });
        });
        return;
      }

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${req.params.callSid}.mp3"`,
      });
      twilioRes.pipe(res);
    }).on('error', (err) => {
      console.error('Recording fetch error:', err);
      res.status(502).json({ error: 'Failed to fetch recording' });
    });
  } catch (err) {
    console.error('Recording download error:', err);
    res.status(500).json({ error: 'Failed to download recording' });
  }
});

// Get call history for the agent (paginated)
router.get('/history', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').replace(/[^\d+]/g, '');

    const searchFilter = search ? ` AND phone_number LIKE $2` : '';
    const countParams = search ? [req.agent.id, `%${search}%`] : [req.agent.id];

    const countResult = await db.query(
      `SELECT COUNT(*) FROM kc_call_logs WHERE agent_id = $1${searchFilter}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    const dataSearchFilter = search ? ` AND phone_number LIKE $4` : '';
    const dataParams = search ? [req.agent.id, limit, offset, `%${search}%`] : [req.agent.id, limit, offset];

    const result = await db.query(
      `SELECT * FROM kc_call_logs
       WHERE agent_id = $1${dataSearchFilter}
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      dataParams
    );

    // Layer 3: backfill any completed calls missing recording data
    const calls = await backfillRecordings(result.rows);

    res.json({
      calls,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
