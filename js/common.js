/**
 * Common utilities shared across all pages
 */

// ── Toast notifications ───────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.color = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#800020';
  toast.innerHTML = `${icons[type] || icons.info}<span style="color:#1e293b;font-size:.875rem;">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Format currency ───────────────────────────────────────────────────────
function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount || 0);
}

// ── Format date ───────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Today's date as YYYY-MM-DD (for date inputs) ──────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Generate sequential reference number ─────────────────────────────────
function generateRef(prefix, num) {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

// ── Number to words (for cheque/voucher amounts) ─────────────────────────
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (isNaN(num) || num < 0) return '';
  num = Math.round(num * 100) / 100;

  const [intPart, decPart] = String(num).split('.');

  function convert(n) {
    n = parseInt(n);
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  let words = convert(parseInt(intPart)) || 'Zero';
  words += ' Rupees';
  if (decPart && parseInt(decPart) > 0) {
    // Normalise to exactly 2 decimal digits (e.g. "5" → 50 paise, "05" → 5 paise)
    const paiseStr = decPart.length === 1 ? decPart + '0' : decPart.slice(0, 2);
    words += ' and ' + convert(parseInt(paiseStr, 10)) + ' Paise';
  }
  return words + ' Only';
}

// ── Show/hide loading overlay ─────────────────────────────────────────────
function showLoading(show = true) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ── Confirm modal (simple confirm dialog) ─────────────────────────────────
function confirmAction(message) {
  return window.confirm(message);
}

// ── Determine file type badge class ──────────────────────────────────────
function getFileBadgeClass(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'img';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls';
  return '';
}

// ── Format file size ──────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ── Active nav link ───────────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

// ── HTML escape helper ────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Inline attachment upload helper ──────────────────────────────────────
async function uploadAttachment(file) {
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showToast(`${file.name}: file too large (max 50 MB)`, 'warning');
    return null;
  }

  const filePath = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

  const { error: storageError } = await supabaseClient.storage
    .from('attachments')
    .upload(filePath, file, { upsert: false });

  if (storageError) {
    showToast('Upload failed: ' + storageError.message, 'error');
    return null;
  }

  const { data: { publicUrl } } = supabaseClient.storage.from('attachments').getPublicUrl(filePath);

  const { data, error: dbError } = await supabaseClient.from('attachments').insert([{
    name:       file.name,
    file_path:  filePath,
    file_size:  file.size,
    mime_type:  file.type,
    public_url: publicUrl
  }]).select().single();

  if (dbError) {
    showToast('Metadata save failed: ' + dbError.message, 'error');
    return null;
  }

  return data;
}

// ── Delete attachment helper ──────────────────────────────────────────────
async function deleteAttachmentById(id, filePath) {
  const { error: storageError } = await supabaseClient.storage.from('attachments').remove([filePath]);
  if (storageError) console.error('Storage delete failed:', storageError.message);

  const { error: dbError } = await supabaseClient.from('attachments').delete().eq('id', id);
  if (dbError) console.error('DB delete failed:', dbError.message);
}
