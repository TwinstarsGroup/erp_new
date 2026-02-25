# Admin Console

A lightweight, easy-to-use Admin Console web application built with plain HTML/CSS/JavaScript and **Supabase** as the backend.

## Features

| Feature | Description |
|---------|-------------|
| 🔐 Google Auth | Single admin login via Google OAuth (Supabase Auth) |
| 🧾 Receipt Generation | Create, view, print itemised receipts with tax calculation |
| 💳 Cash Voucher Generation | Issue cash payment vouchers with amount-in-words, approval fields and print support |
| 📎 Attachments | Upload, store and manage supporting documents (PDF, images, Office files) via Supabase Storage |
| 📊 Dashboard | At-a-glance stats and recent activity |
| 👤 Create Employee TSE | Add and manage employees with full profile details (name, ID, joining date, account, position, company, email) |
| 💰 Generate Payslip | Select employee, enter salary components, calculate net pay, download PDF payslip, email it to the employee |

## Tech Stack

- **Frontend**: Vanilla HTML5 / CSS3 / JavaScript (no build step required)
- **Backend / Auth / DB / Storage**: [Supabase](https://supabase.com)
- **Fonts**: Inter (Google Fonts)

## Project Structure

```
├── index.html                # Login page (Google Auth)
├── dashboard.html            # Main dashboard
├── receipts.html             # Receipt generation & list
├── vouchers.html             # Cash voucher generation & list
├── attachments.html          # File upload & management
├── create-employee-tse.html  # Create & manage employees
├── generate-payslip.html     # Generate & email payslips
├── css/
│   └── style.css             # Shared stylesheet
├── js/
│   ├── config.js             # Supabase URL + anon key (edit this)
│   ├── auth.js               # Google OAuth helpers
│   ├── common.js             # Shared utilities (toast, currency, date …)
│   ├── receipts.js           # Receipt page logic
│   ├── vouchers.js           # Voucher page logic
│   ├── attachments.js        # Attachment page logic
│   ├── employees.js          # Employee create/list logic
│   └── payslips.js           # Payslip generate/email logic
└── sql/
    └── schema.sql            # Supabase database schema
```

## Quick Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a new project and note your **Project URL** and **anon key** (Settings → API).

### 2. Run the database schema
Open the **SQL Editor** in your Supabase dashboard and execute the contents of `sql/schema.sql`.

### 3. Create the Storage bucket
In Supabase Dashboard → **Storage**, create a bucket named **`attachments`** and set it to **Public**.

Then add these Storage policies:
- `Authenticated upload` — `INSERT` for `authenticated` role, check: `bucket_id = 'attachments'`
- `Public read` — `SELECT` for `anon`, using: `bucket_id = 'attachments'`
- `Authenticated delete` — `DELETE` for `authenticated`, using: `bucket_id = 'attachments'`

### 4. Enable Google OAuth
In Supabase Dashboard → **Authentication → Providers → Google**, enable it and enter your Google OAuth Client ID and Secret (from [Google Cloud Console](https://console.cloud.google.com)).

Add your site URL (e.g. `http://localhost:5500` or your production URL) to the **Redirect URLs** list.

### 5. Configure `js/config.js`
Replace the placeholder values with your real Supabase credentials:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 6. Serve the files
Open `index.html` with any static file server, e.g.:

```bash
# Python
python3 -m http.server 5500

# Node (npx)
npx serve .

# VS Code Live Server extension
```

Then visit `http://localhost:5500` and sign in with Google.

## Pages

| Page | URL | Description |
|---|---|---|
| Login | `index.html` | Google Sign-In; redirects to dashboard if already logged in |
| Dashboard | `dashboard.html` | Stats cards, recent receipts & vouchers |
| Receipts | `receipts.html` | Create receipts with line items, tax; view & print |
| Cash Vouchers | `vouchers.html` | Issue vouchers; amount-in-words auto-fill; view & print |
| Attachments | `attachments.html` | Drag-and-drop file upload; download / delete |
| Create Employee TSE | `create-employee-tse.html` | Add employees (name, ID, joining date, account, position, company, email) |
| Generate Payslip | `generate-payslip.html` | Select employee, enter salary components, calculate net pay, download PDF, email |

## Security Notes

- Only the **anon (public)** key is used in the browser — never the service role key.
- All tables have **Row Level Security (RLS)** enabled; only authenticated users can read or write data.
- The Storage bucket is public-read so uploaded files can be downloaded via direct URL. Restrict this further if needed.

## Payslip Email Setup

Payslip emails are sent via a **Supabase Edge Function** (`send-payslip`) so that SMTP credentials are never exposed to the browser.

### 1. Create the Edge Function

```bash
supabase functions new send-payslip
```

Place the following code in `supabase/functions/send-payslip/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { to, empName, period, pdfBase64, pdfFilename } = await req.json();

  const SMTP_HOST     = Deno.env.get('SMTP_HOST')!;
  const SMTP_PORT     = parseInt(Deno.env.get('SMTP_PORT') || '587');
  const SMTP_USER     = Deno.env.get('SMTP_USER')!;
  const SMTP_PASS     = Deno.env.get('SMTP_PASS')!;
  const SENDER_EMAIL  = 'admin@twinstarsgroup.com';
  const SENDER_NAME   = 'Admin Console';

  // Use any Deno-compatible SMTP library or Resend/SendGrid HTTP API here.
  // Example using Resend (https://resend.com):
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
    },
    body: JSON.stringify({
      from:    `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to:      [to],
      subject: `Payslip for ${period} — ${empName}`,
      html:    `<p>Dear ${empName},</p><p>Please find your payslip for <strong>${period}</strong> attached.</p><p>Regards,<br/>Admin Console</p>`,
      attachments: [{
        filename: pdfFilename,
        content:  pdfBase64
      }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

### 2. Set secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
# or for SMTP:
supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=user SMTP_PASS=pass
```

### 3. Deploy the function

```bash
supabase functions deploy send-payslip --no-verify-jwt
```

> **Note:** The Edge Function validates the caller's Supabase JWT automatically when `--no-verify-jwt` is omitted. Only authenticated users can trigger it.

### 4. Sender address

The sender address is hardcoded as `admin@twinstarsgroup.com` inside the Edge Function. Ensure this address is verified/authorised by your email provider (Resend, SendGrid, etc.).


