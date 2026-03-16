/**
 * Cash Vouchers page logic
 */

let vouchers = [];
let editingVoucherId = null;
let nextVoucherNum   = 1;
let voucherAttachments = [];
let currentVoucherView = null;
let selectedCompanyId   = null;
let selectedCompanyName = '';

function companyInitials(name) {
  if (!name) return 'NA';

  const parts = String(name)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const skip = new Set(['PVT', 'PRIVATE', 'LTD', 'LIMITED', 'LLP', 'INC', 'CO', 'COMPANY', 'THE']);
  const meaningful = parts.filter(p => !skip.has(p.toUpperCase()));

  if (!meaningful.length) return 'NA';

  // Special rule for "Twinstar ..." → TS + next meaningful word's initial
  if (meaningful[0].toUpperCase() === 'TWINSTAR') {
    const next = meaningful[1] || meaningful[0];
    return ('TS' + next[0].toUpperCase());
  }

  // Fallback: first letters of up to 3 meaningful words
  return meaningful.slice(0, 3).map(w => w[0].toUpperCase()).join('');
}

// ── Initialise ────────────────────────────────────────────────────────────
async function initVouchers() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  document.getElementById('voucher-date').value = todayISO();
  await populateCompanyDropdown();
  await fetchVouchers();
  initVoucherAttachments();

  // Watch amount field → update words
  const amtInput = document.getElementById('voucher-amount');
  if (amtInput) {
    amtInput.addEventListener('input', () => {
      const words = numberToWords(parseFloat(amtInput.value) || 0);
      document.getElementById('amount-words').textContent = words || '—';
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('id')) openVoucherById(params.get('id'));
}

// ── Fetch vouchers ────────────────────────────────────────────────────────
async function fetchVouchers(search = '') {
  let query = supabaseClient.from('cash_vouchers').select('*').order('created_at', { ascending: false });
  if (search) query = query.ilike('payee', `%${search}%`);
  const { data, error } = await query;
  if (error) { showToast('Failed to load vouchers', 'error'); return; }
  vouchers = data || [];
  renderVoucherList();
}

// ── Render list ───────────────────────────────────────────────────────────
function renderVoucherList() {
  const el = document.getElementById('voucher-list');
  if (!vouchers.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <h3>No vouchers found</h3>
      <p>Create your first cash voucher using the form above</p>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Voucher #</th><th>Company</th><th>Date</th><th>Payee</th><th>Purpose</th>
      <th>Payment Mode</th><th>Amount</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${vouchers.map(v => `<tr>
        <td style="font-weight:600;color:#800020;">${v.voucher_number}</td>
        <td>${v.company_name || '—'}</td>
        <td>${formatDate(v.date)}</td>
        <td>${v.payee}</td>
        <td>${v.purpose || '—'}</td>
        <td><span class="badge badge-info">${v.payment_mode || 'Cash'}</span></td>
        <td style="font-weight:700;">${formatCurrency(v.amount)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="openVoucherView('${v.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteVoucher('${v.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ── Company dropdown ──────────────────────────────────────────────────────
async function populateCompanyDropdown() {
  const { data, error } = await supabaseClient.from('companies').select('id, name').order('name');
  if (error) {
  console.error('Failed to load companies', error);
  showToast('Failed to load companies: ' + error.message, 'error');
  return;
}
if (!data) return;
  const sel = document.getElementById('voucher-company');
  data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function onVoucherCompanyChange() {
  const sel = document.getElementById('voucher-company');
  selectedCompanyId   = sel.value || null;
  selectedCompanyName = sel.options[sel.selectedIndex]?.text || '';
  if (selectedCompanyId) {
    setNextVoucherNumber();
  } else {
    document.getElementById('voucher-number').value = '';
  }
}

// ── Next number ───────────────────────────────────────────────────────────
async function setNextVoucherNumber() {
  if (!selectedCompanyId) {
    document.getElementById('voucher-number').value = '';
    return;
  }
  const { data } = await supabaseClient
    .from('cash_vouchers')
    .select('voucher_number')
    .eq('company_id', selectedCompanyId)
    .order('voucher_number', { ascending: false })
    .limit(1);

  let maxNum = 0;
  if (data && data.length > 0) {
    const match = (data[0].voucher_number || '').match(/(\d+)$/);
    if (match) maxNum = parseInt(match[1], 10);
  }
  nextVoucherNum = maxNum + 1;
  const init = companyInitials(selectedCompanyName);
  document.getElementById('voucher-number').value = `CVR-${init}-${String(nextVoucherNum).padStart(4, '0')}`;
}

// ── Save voucher ──────────────────────────────────────────────────────────
async function saveVoucher() {
  const voucherNumber = document.getElementById('voucher-number').value.trim();
  const date          = document.getElementById('voucher-date').value;
  const payee         = document.getElementById('voucher-payee').value.trim();
  const amount        = parseFloat(document.getElementById('voucher-amount').value) || 0;
  const purpose       = document.getElementById('voucher-purpose').value.trim();
  const paymentMode   = document.getElementById('voucher-payment-mode').value;
  const reference     = document.getElementById('voucher-reference').value.trim();
  const approvedBy    = document.getElementById('voucher-approved-by').value.trim();
  const notes         = document.getElementById('voucher-notes').value.trim();

  if (!editingVoucherId && !selectedCompanyId) {
    showToast('Please select a company', 'warning');
    return;
  }
  if (!voucherNumber || !date || !payee || !amount) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  const payload = {
    voucher_number: voucherNumber,
    date,
    payee,
    amount,
    amount_words: numberToWords(amount),
    purpose,
    payment_mode:  paymentMode,
    reference,
    approved_by:   approvedBy,
    notes
  };

  // Include company fields only when creating a new voucher.
  // On edit, company_id and voucher_number are locked to their original values
  // to preserve the integrity of the per-company sequence and audit trail.
  if (!editingVoucherId) {
    payload.company_id   = selectedCompanyId;
    payload.company_name = selectedCompanyName;
  }

  showLoading(true);
  let error;
  if (editingVoucherId) {
    ({ error } = await supabaseClient.from('cash_vouchers').update(payload).eq('id', editingVoucherId));
  } else {
    ({ error } = await supabaseClient.from('cash_vouchers').insert([payload]));
  }
  showLoading(false);

  if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
  showToast(editingVoucherId ? 'Voucher updated!' : 'Voucher saved!', 'success');

  // Preserve the company selection across saves for a smoother workflow
  const savedCompanyId   = selectedCompanyId;
  const savedCompanyName = selectedCompanyName;
  resetVoucherForm();
  if (savedCompanyId) {
    const sel = document.getElementById('voucher-company');
    sel.value = savedCompanyId;
    selectedCompanyId   = savedCompanyId;
    selectedCompanyName = savedCompanyName;
    await setNextVoucherNumber();
  }
  await fetchVouchers();
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetVoucherForm() {
  editingVoucherId = null;
  voucherAttachments = [];
  document.getElementById('voucher-form').reset();
  document.getElementById('voucher-date').value = todayISO();
  document.getElementById('amount-words').textContent = '—';
  // form.reset() resets the company select to empty; sync state accordingly
  selectedCompanyId   = null;
  selectedCompanyName = '';
  document.getElementById('voucher-number').value = '';
  renderVoucherAttachments();
}

// ── Delete ────────────────────────────────────────────────────────────────
async function deleteVoucher(id) {
  if (!confirmAction('Delete this voucher? This cannot be undone.')) return;
  const { error } = await supabaseClient.from('cash_vouchers').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Voucher deleted', 'success');
  fetchVouchers();
}

// ── View modal ────────────────────────────────────────────────────────────
async function openVoucherById(id) {
  const { data } = await supabaseClient.from('cash_vouchers').select('*').eq('id', id).single();
  if (data) renderVoucherModal(data);
}

function openVoucherView(id) {
  const v = vouchers.find(x => x.id === id);
  if (v) renderVoucherModal(v);
}

function renderVoucherModal(v) {
  currentVoucherView = v;
  document.getElementById('voucher-modal-content').innerHTML = `
    <div class="print-doc" id="printable-voucher" style="background:#fff;padding:32px;font-family:inherit;">

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #800020;padding-bottom:16px;">
        <div>
          <div style="font-size:1.4rem;font-weight:800;color:#1e293b;">Cash Payment Voucher</div>
          <div style="font-size:.9rem;color:#64748b;"># ${v.voucher_number}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem;font-weight:700;color:#800020;">${v.company_name || 'Twinstar Group'}</div>
          <div style="font-size:.8rem;color:#64748b;">Date: ${formatDate(v.date)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
        <div>
          <div style="font-size:.72rem;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Pay To</div>
          <div style="font-weight:700;font-size:1.05rem;">${v.payee}</div>
        </div>
        <div>
          <div style="font-size:.72rem;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Payment Mode</div>
          <div style="font-weight:600;">${v.payment_mode || 'Cash'}</div>
          ${v.reference ? `<div style="font-size:.8rem;color:#64748b;">Ref: ${v.reference}</div>` : ''}
        </div>
      </div>

      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:.72rem;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Amount</div>
        <div style="font-size:1.8rem;font-weight:800;color:#15803d;">${formatCurrency(v.amount)}</div>
        <div style="font-size:.82rem;color:#64748b;margin-top:4px;font-style:italic;">${v.amount_words || numberToWords(v.amount)}</div>
      </div>

      ${v.purpose ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:.72rem;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Purpose / Narration</div>
        <div style="font-size:.9rem;">${v.purpose}</div>
      </div>` : ''}

      ${v.notes ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:.875rem;color:#475569;margin-bottom:20px;">
        <strong>Notes:</strong> ${v.notes}
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <div style="text-align:center;">
          <div style="border-top:1px solid #1e293b;padding-top:8px;font-size:.8rem;color:#64748b;">
            ${v.approved_by ? `Approved By: ${v.approved_by}` : 'Authorised Signatory'}
          </div>
        </div>
        <div style="text-align:center;">
          <div style="border-top:1px solid #1e293b;padding-top:8px;font-size:.8rem;color:#64748b;">Receiver's Signature</div>
        </div>
      </div>
    </div>`;

  showModal('voucher-modal');
}

function printVoucher() {
  const content = document.getElementById('printable-voucher').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Cash Voucher</title>
    <style>body{font-family:system-ui,sans-serif;} * {box-sizing:border-box; margin:0; padding:0;}</style>
    </head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// ── Voucher PDF download ──────────────────────────────────────────────────
function _voucherWatermarkDataURL() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, 0, 0, 200, 200);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => {
      console.error('Failed to load watermark image: images/logo200.png');
      resolve(document.createElement('canvas').toDataURL('image/png'));
    };
    img.src = 'images/logo200.png';
  });
}

function _voucherLogoDataURL() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 200;
      c.height = img.naturalHeight || 200;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'images/logo200.png';
  });
}

function _voucherFmt(amount) {
  return 'Rs.' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _voucherDatestamp() {
  const n = new Date();
  return n.getFullYear() + '-' +
    String(n.getMonth() + 1).padStart(2, '0') + '-' +
    String(n.getDate()).padStart(2, '0') + '_' +
    String(n.getHours()).padStart(2, '0') +
    String(n.getMinutes()).padStart(2, '0');
}

async function downloadVoucherPDF(v) {
  if (!v) return;
  if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - 2 * margin;

  // ── Watermark ──────────────────────────────────────────
  const wmDataURL = await _voucherWatermarkDataURL();
  doc.addImage(wmDataURL, 'PNG', (pageW - 200) / 2, (pageH - 200) / 2, 200, 200);

  // ── Header bar ─────────────────────────────────────────
  doc.setFillColor(128, 0, 32);
  doc.rect(margin, margin, contentW, 2, 'F');

  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('CASH PAYMENT VOUCHER', margin, margin + 32);

  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`# ${v.voucher_number}`, margin, margin + 48);

  // ── Company name / logo in header ──────────────────────
  const logoDataURL = await _voucherLogoDataURL();
  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', pageW - margin - 60, margin + 4, 60, 30);
  }
  const company = (typeof COMPANY_INFO !== 'undefined') ? COMPANY_INFO : null;
  const headerName = company ? company.name : 'Twinstar Group';
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 32);
  doc.text(headerName, pageW - margin, margin + 52, { align: 'right' });
  if (company) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(company.email, pageW - margin, margin + 64, { align: 'right' });
  }

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${formatDate(v.date)}`, pageW - margin, margin + 76, { align: 'right' });

  // ── Pay To / Payment Mode ─────────────────────────────
  let y = margin + 100;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('PAY TO', margin, y);
  doc.text('PAYMENT MODE', margin + contentW / 2, y);
  y += 14;

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(v.payee, margin, y);
  doc.setFontSize(11);
  doc.text(v.payment_mode || 'Cash', margin + contentW / 2, y);
  y += 14;

  if (v.reference) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Ref: ${v.reference}`, margin + contentW / 2, y);
  }
  y += 20;

  // ── Amount box ────────────────────────────────────────
  doc.setFillColor(254, 243, 199); doc.setDrawColor(200, 150, 12);
  doc.roundedRect(margin, y, contentW, 52, 4, 4, 'FD');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('AMOUNT', margin + 12, y + 14);
  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 32);
  doc.text(_voucherFmt(v.amount), margin + 12, y + 36);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(v.amount_words || numberToWords(v.amount), margin + 12, y + 48,
    { maxWidth: contentW - 24 });
  y += 64;

  // ── Purpose ───────────────────────────────────────────
  if (v.purpose) {
    y += 8;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('PURPOSE / NARRATION', margin, y); y += 14;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(v.purpose, margin, y, { maxWidth: contentW }); y += 16;
  }

  // ── Notes ─────────────────────────────────────────────
  if (v.notes) {
    y += 8;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentW, 28, 4, 4, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Notes:', margin + 10, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v.notes), margin + 10 + doc.getTextWidth('Notes:') + 4, y + 12,
      { maxWidth: contentW - 30 });
    y += 28;
  }

  // ── Signature lines ───────────────────────────────────
  y = Math.max(y + 60, pageH - 140);
  const sigW = (contentW - 40) / 2;
  doc.setDrawColor(30, 41, 59);
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 40, y, margin + contentW, y);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const authLabel = v.approved_by ? `Approved By: ${v.approved_by}` : 'Authorised Signatory';
  doc.text(authLabel, margin + sigW / 2, y + 12, { align: 'center' });
  doc.text("Receiver's Signature", margin + sigW + 40 + sigW / 2, y + 12, { align: 'center' });

  // ── Footer ────────────────────────────────────────────
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your business.', pageW / 2, pageH - 40, { align: 'center' });

  doc.save(`Voucher_${v.voucher_number}_${_voucherDatestamp()}.pdf`);
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

// ── Inline attachment handling ────────────────────────────────────────────
function initVoucherAttachments() {
  const input = document.getElementById('voucher-file-input');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const file of files) {
      showLoading(true);
      const att = await uploadAttachment(file);
      showLoading(false);
      if (att) {
        voucherAttachments.push(att);
        renderVoucherAttachments();
        showToast(`${file.name} attached`, 'success');
      }
    }
  });
}

function renderVoucherAttachments() {
  const list = document.getElementById('voucher-attachment-list');
  if (!list) return;
  if (!voucherAttachments.length) { list.innerHTML = ''; return; }
  list.innerHTML = voucherAttachments.map(a => {
    const ext = (a.name || '').split('.').pop().toUpperCase();
    const badgeCls = getFileBadgeClass(a.name);
    return `<div style="display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 10px;font-size:.8rem;">
      <span class="file-badge ${badgeCls}">${ext}</span>
      <a href="${escapeHtml(a.public_url)}" target="_blank" style="color:#800020;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</a>
      <button type="button" class="btn-close" onclick="removeVoucherAttachment('${escapeHtml(a.id)}','${escapeHtml(a.file_path)}')" title="Remove">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

async function removeVoucherAttachment(id, filePath) {
  showLoading(true);
  await deleteAttachmentById(id, filePath);
  showLoading(false);
  voucherAttachments = voucherAttachments.filter(a => a.id !== id);
  renderVoucherAttachments();
  showToast('Attachment removed', 'success');
}
