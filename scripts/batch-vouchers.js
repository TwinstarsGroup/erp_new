#!/usr/bin/env node
/**
 * Batch Voucher Generation Script
 * ────────────────────────────────────────────────────────────────────────────
 * Generates vouchers automatically for two schedules:
 *   1. Monthly vouchers  – created on the 1st of each month
 *   2. Friday vouchers   – created every Friday
 *
 * IDEMPOTENT: Checks for existing vouchers with the same
 *             (schedule_key, period_label) before inserting.
 *
 * USAGE
 *   # Install deps (first time only):
 *   cd scripts && npm install
 *
 *   # Run manually:
 *   node batch-vouchers.js
 *
 *   # Run with a custom config file:
 *   node batch-vouchers.js --config /path/to/rules.json
 *
 * SCHEDULING IN PRODUCTION
 *   Add a cron entry (crontab -e) to run daily at 06:00:
 *     0 6 * * * /usr/bin/node /path/to/erp_new/scripts/batch-vouchers.js >> /var/log/erp-vouchers.log 2>&1
 *
 * ENVIRONMENT VARIABLES (required)
 *   SUPABASE_URL       – Your Supabase project URL
 *   SUPABASE_SERVICE_KEY – Service-role key (NOT the anon key)
 *
 * CONFIGURATION
 *   Voucher rules are defined in scripts/voucher-rules.json (see below).
 *   Edit that file to add/remove/change voucher types without touching code.
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const https  = require('https');

// ── Config loading ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const configFlag = args.indexOf('--config');
const configFile = configFlag !== -1
  ? args[configFlag + 1]
  : path.join(__dirname, 'voucher-rules.json');

if (!fs.existsSync(configFile)) {
  console.error(`[ERROR] Config file not found: ${configFile}`);
  process.exit(1);
}

const rules = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// ── Environment ───────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL         || rules.supabase_url;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || rules.supabase_service_key;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[ERROR] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
  console.error('        Set them as environment variables or in voucher-rules.json.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Zero-padded string from a number */
function pad(n) { return String(n).padStart(4, '0'); }

/** Minimal HTTP request to Supabase REST API */
function supabaseRequest(method, table, body, params) {
  return new Promise((resolve, reject) => {
    const url  = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        method === 'POST' ? 'return=representation' : ''
      }
    };

    const req = https.request(url, opts, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = raw ? JSON.parse(raw) : {};
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          else resolve(json);
        } catch (e) { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Fetch the current max voucher number to derive the next one */
async function getNextVoucherNumber() {
  const rows = await supabaseRequest('GET', 'cash_vouchers', null, {
    select: 'voucher_number',
    order:  'voucher_number.desc',
    limit:  '1'
  });
  if (!Array.isArray(rows) || rows.length === 0) return 1;
  const last = rows[0].voucher_number || '';
  const match = last.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

/** Check if a voucher for this schedule/period already exists (idempotency) */
async function voucherExists(scheduleKey, periodLabel) {
  const rows = await supabaseRequest('GET', 'cash_vouchers', null, {
    select: 'id',
    schedule_key: `eq.${scheduleKey}`,
    period_label: `eq.${periodLabel}`,
    limit: '1'
  });
  return Array.isArray(rows) && rows.length > 0;
}

/** Insert one voucher row */
async function insertVoucher(payload) {
  return supabaseRequest('POST', 'cash_vouchers', [payload]);
}

// ── Schedule resolution ───────────────────────────────────────────────────
const today = new Date();

/**
 * Determine which rule schedules apply today.
 * Returns an array of { rule, periodLabel } objects.
 */
function applicableRules() {
  const applicable = [];
  const day   = today.getDate();
  const dow   = today.getDay(); // 0=Sun … 5=Fri … 6=Sat
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  for (const rule of (rules.voucher_rules || [])) {
    if (!rule.enabled) continue;

    if (rule.schedule === 'monthly' && day === (rule.day_of_month || 1)) {
      applicable.push({ rule, periodLabel: `${year}-${month}` });
    }

    if (rule.schedule === 'friday' && dow === 5) {
      applicable.push({ rule, periodLabel: isoDate(today) });
    }
  }

  return applicable;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  log('=== Batch Voucher Generation — START ===');
  log(`Today: ${isoDate(today)}`);

  const toProcess = applicableRules();
  if (toProcess.length === 0) {
    log('No scheduled vouchers apply today. Exiting.');
    log('=== Batch Voucher Generation — END (0 generated) ===');
    return;
  }

  log(`Rules to process: ${toProcess.length}`);

  let generated = 0;
  let skipped   = 0;
  let errors    = 0;

  for (const { rule, periodLabel } of toProcess) {
    const key = rule.schedule_key || rule.type;

    try {
      const exists = await voucherExists(key, periodLabel);
      if (exists) {
        log(`SKIP  [${key}] period=${periodLabel} — already exists`);
        skipped++;
        continue;
      }

      const nextNum = await getNextVoucherNumber();
      const voucherNumber = `${rule.prefix || 'CV'}-${pad(nextNum)}`;

      const payload = {
        voucher_number: voucherNumber,
        date:           isoDate(today),
        payee:          rule.payee || 'System',
        payment_mode:   rule.payment_mode || 'Cash',
        amount:         rule.amount || 0,
        amount_words:   rule.amount_words || '',
        purpose:        rule.purpose || `Auto-generated: ${rule.type}`,
        notes:          `Batch generated — schedule: ${rule.schedule}, period: ${periodLabel}`,
        approved_by:    rule.approved_by || null,
        schedule_key:   key,
        period_label:   periodLabel,
        is_batch:       true
      };

      await insertVoucher(payload);
      log(`OK    [${key}] period=${periodLabel} → ${voucherNumber} (₹${rule.amount || 0})`);
      generated++;
    } catch (err) {
      log(`ERROR [${key}] period=${periodLabel} — ${err.message}`);
      errors++;
    }
  }

  log(`=== Batch Voucher Generation — END | Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors} ===`);
  if (errors > 0) process.exitCode = 1;
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
