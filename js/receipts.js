/**
 * Receipts page logic
 * Handles creating, listing, printing receipts via Supabase.
 */

let receiptItems = [];
let editingId   = null;
let receipts    = [];
let nextNum     = 1;
let currentReceiptView  = null;
let receiptAttachments  = [];
let selectedCompanyId   = null;
let selectedCompanyName = '';

function receiptCompanyCode(companyName) {
  const n = (companyName || '').trim().toUpperCase();
  if (n === 'TWINSTAR DATALYTIKS LLP') return 'TSD';
  if (n === 'TWINSTAR ENTERTAINES LLP' || n === 'TWINSTAR ENTERTAINERS LLP') return 'TSE';
  return 'NA';
}

function currentFYStartISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1–12
  const fyYear = (m >= 4) ? y : (y - 1);
  return `${fyYear}-04-01`;
}

// ── Company dropdown ──────────────────────────────────────────────────────
async function populateReceiptCompanyDropdown() {
  const { data, error } = await supabaseClient.from('companies').select('id, name').order('name');
  if (error) {
    console.error('Failed to load companies', error);
    showToast('Failed to load companies: ' + error.message, 'error');
    return;
  }
  if (!data) return;
  const sel = document.getElementById('receipt-company');
  data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function onReceiptCompanyChange() {
  const sel = document.getElementById('receipt-company');
  selectedCompanyId   = sel.value || null;
  selectedCompanyName = sel.options[sel.selectedIndex]?.text || '';
  if (selectedCompanyId) {
    setNextReceiptNumber();
  } else {
    document.getElementById('receipt-number').value = '';
  }
}

// ── Initialise ────────────────────────────────────────────────────────────
async function initReceipts() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  document.getElementById('receipt-date').value = todayISO();

  await populateReceiptCompanyDropdown();
  await fetchReceipts();
  initReceiptAttachments();

  // If URL has ?id=... open that receipt for viewing
  const params = new URLSearchParams(window.location.search);
  if (params.get('id')) openReceiptById(params.get('id'));
}

// ── Fetch all receipts ────────────────────────────────────────────────────
async function fetchReceipts(search = '') {
  let query = supabaseClient.from('receipts').select('*').order('created_at', { ascending: false });
  if (search) query = query.ilike('customer_name', `%${search}%`);
  const { data, error } = await query;
  if (error) { showToast('Failed to load receipts', 'error'); return; }
  receipts = data || [];
  renderReceiptList();
}

// ── Render list ───────────────────────────────────────────────────────────
function renderReceiptList() {
  const el = document.getElementById('receipt-list');
  if (!receipts.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <h3>No receipts found</h3>
      <p>Create your first receipt using the form above</p>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Receipt #</th><th>Company</th><th>Date</th><th>Customer</th><th>Phone</th>
      <th>Subtotal</th><th>Tax</th><th>Total</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${receipts.map(r => `<tr>
        <td style="font-weight:600;color:#800020;">${r.receipt_number}</td>
        <td>${r.company_name || '—'}</td>
        <td>${formatDate(r.date)}</td>
        <td>${r.customer_name}</td>
        <td>${r.customer_phone || '—'}</td>
        <td>${formatCurrency(r.subtotal)}</td>
        <td>${formatCurrency(r.tax_amount)}</td>
        <td style="font-weight:700;">${formatCurrency(r.total)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="openReceiptView('${r.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteReceipt('${r.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ── Set next receipt number ───────────────────────────────────────────────
async function setNextReceiptNumber() {
  if (!selectedCompanyId) {
    document.getElementById('receipt-number').value = '';
    return;
  }

  const fyStart = currentFYStartISO();
  const { data, error } = await supabaseClient
    .from('receipts')
    .select('receipt_number')
    .eq('company_id', selectedCompanyId)
    .gte('date', fyStart);

  if (error) {
    showToast('Failed to generate receipt number: ' + error.message, 'error');
    return;
  }

  let maxNum = 0;
  if (data && data.length > 0) {
    data.forEach(r => {
      const match = (r.receipt_number || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }

  nextNum = maxNum + 1;
  const code = receiptCompanyCode(selectedCompanyName);
  document.getElementById('receipt-number').value = `RCP-${code}-${String(nextNum).padStart(4, '0')}`;
}

// ── Line-item management ──────────────────────────────────────────────────
function addItem() {
  receiptItems.push({ desc: '', qty: 1, rate: 0 });
  renderItems();
}

function removeItem(idx) {
  receiptItems.splice(idx, 1);
  renderItems();
}

function updateItem(idx, field, value) {
  receiptItems[idx][field] = field === 'desc' ? value : parseFloat(value) || 0;
  recalcTotals();
  // Update amount cell for this row
  const amtCell = document.getElementById(`item-amount-${idx}`);
  if (amtCell) amtCell.textContent = formatCurrency(receiptItems[idx].qty * receiptItems[idx].rate);
}

function renderItems() {
  const tbody = document.getElementById('items-tbody');
  if (!tbody) return;
  tbody.innerHTML = receiptItems.map((item, i) => `
    <tr>
      <td class="col-no">${i + 1}</td>
      <td class="col-desc">
        <input type="text" value="${escapeHtml(item.desc)}" placeholder="Description"
          oninput="updateItem(${i},'desc',this.value)" />
      </td>
      <td class="col-qty">
        <input type="number" value="${item.qty}" min="1" step="1"
          oninput="updateItem(${i},'qty',this.value)" />
      </td>
      <td class="col-rate">
        <input type="number" value="${item.rate}" min="0" step="0.01"
          oninput="updateItem(${i},'rate',this.value)" />
      </td>
      <td class="col-amount" id="item-amount-${i}">${formatCurrency(item.qty * item.rate)}</td>
      <td class="col-action">
        <button class="btn btn-icon btn-danger btn-sm" onclick="removeItem(${i})" title="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>`).join('');
  recalcTotals();
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function recalcTotals() {
  const subtotal   = receiptItems.reduce((s, it) => s + it.qty * it.rate, 0);
  const taxPct     = parseFloat(document.getElementById('tax-percent')?.value) || 0;
  const taxAmt     = subtotal * taxPct / 100;
  const total      = subtotal + taxAmt;

  if (document.getElementById('subtotal-display')) document.getElementById('subtotal-display').textContent = formatCurrency(subtotal);
  if (document.getElementById('tax-display')) document.getElementById('tax-display').textContent = formatCurrency(taxAmt);
  if (document.getElementById('total-display')) document.getElementById('total-display').textContent = formatCurrency(total);
  return { subtotal, taxPct, taxAmt, total };
}

// ── Save receipt ──────────────────────────────────────────────────────────
async function saveReceipt() {
  const receiptNumber = document.getElementById('receipt-number').value.trim();
  const date          = document.getElementById('receipt-date').value;
  const customerName  = document.getElementById('customer-name').value.trim();
  const customerPhone = document.getElementById('customer-phone').value.trim();
  const customerEmail = document.getElementById('customer-email').value.trim();
  const notes         = document.getElementById('receipt-notes').value.trim();

  if (!editingId && !selectedCompanyId) {
    showToast('Please select a company', 'warning');
    return;
  }
  if (!receiptNumber || !date || !customerName) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }
  if (!receiptItems.length) {
    showToast('Add at least one line item', 'warning');
    return;
  }

  const { subtotal, taxPct, taxAmt, total } = recalcTotals();

  const payload = {
    receipt_number: receiptNumber,
    date,
    customer_name:  customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    items:          receiptItems,
    subtotal,
    tax_percent:    taxPct,
    tax_amount:     taxAmt,
    total,
    notes
  };

  // Include company fields only when creating a new receipt.
  // On edit, company_id and receipt_number are locked to their original values
  // to preserve the integrity of the per-company sequence and audit trail.
  if (!editingId) {
    payload.company_id   = selectedCompanyId;
    payload.company_name = selectedCompanyName;
  }

  showLoading(true);
  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from('receipts').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabaseClient.from('receipts').insert([payload]));
  }
  showLoading(false);

  if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
  showToast(editingId ? 'Receipt updated!' : 'Receipt saved!', 'success');

  // Preserve the company selection across saves for a smoother workflow
  const savedCompanyId   = selectedCompanyId;
  const savedCompanyName = selectedCompanyName;
  resetForm();
  if (savedCompanyId) {
    const sel = document.getElementById('receipt-company');
    sel.value = savedCompanyId;
    selectedCompanyId   = savedCompanyId;
    selectedCompanyName = savedCompanyName;
    await setNextReceiptNumber();
  }
  await fetchReceipts();
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetForm() {
  editingId = null;
  receiptItems = [];
  receiptAttachments = [];
  document.getElementById('receipt-form').reset();
  document.getElementById('receipt-date').value = todayISO();
  // form.reset() resets the company select to empty; sync state accordingly
  selectedCompanyId   = null;
  selectedCompanyName = '';
  document.getElementById('receipt-number').value = '';
  renderItems();
  recalcTotals();
  renderReceiptAttachments();
}

// ── Delete receipt ────────────────────────────────────────────────────────
async function deleteReceipt(id) {
  if (!confirmAction('Delete this receipt? This cannot be undone.')) return;
  const { error } = await supabaseClient.from('receipts').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Receipt deleted', 'success');
  fetchReceipts();
}

// ── View receipt modal ────────────────────────────────────────────────────
async function openReceiptById(id) {
  const { data } = await supabaseClient.from('receipts').select('*').eq('id', id).single();
  if (data) renderReceiptModal(data);
}

function openReceiptView(id) {
  const r = receipts.find(x => x.id === id);
  if (r) renderReceiptModal(r);
}

function renderReceiptModal(r) {
  currentReceiptView = r;
  const itemRows = (r.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.desc}</td>
      <td style="text-align:right;">${it.qty}</td>
      <td style="text-align:right;">${formatCurrency(it.rate)}</td>
      <td style="text-align:right;font-weight:600;">${formatCurrency(it.qty * it.rate)}</td>
    </tr>`).join('');

  document.getElementById('receipt-modal-content').innerHTML = `
    <div class="print-doc" id="printable-receipt" style="background:#fff;padding:32px;font-family:inherit;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:2px solid #800020;padding-bottom:20px;">
        <div>
          <div style="font-size:1.5rem;font-weight:800;color:#1e293b;">Receipt</div>
          <div style="font-size:.9rem;color:#64748b;margin-top:4px;"># ${r.receipt_number}</div>
        </div>
        <div style="text-align:right;">
          <img src="images/logo200.png" alt="ERP System" style="height:36px;margin-bottom:4px;" />
          <div style="font-size:.8rem;color:#64748b;">Date: ${formatDate(r.date)}</div>
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">Bill To</div>
        <div style="font-weight:700;font-size:1rem;">${r.customer_name}</div>
        ${r.customer_phone ? `<div style="font-size:.875rem;color:#64748b;">${r.customer_phone}</div>` : ''}
        ${r.customer_email ? `<div style="font-size:.875rem;color:#64748b;">${r.customer_email}</div>` : ''}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:.875rem;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">#</th>
            <th style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Description</th>
            <th style="padding:10px;text-align:right;border:1px solid #e2e8f0;">Qty</th>
            <th style="padding:10px;text-align:right;border:1px solid #e2e8f0;">Rate</th>
            <th style="padding:10px;text-align:right;border:1px solid #e2e8f0;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
        <div style="min-width:240px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:.875rem;">
            <span>Subtotal</span><span>${formatCurrency(r.subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:.875rem;color:#64748b;">
            <span>Tax (${r.tax_percent || 0}%)</span><span>${formatCurrency(r.tax_amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:1.05rem;font-weight:800;color:#1e293b;">
            <span>Total</span><span>${formatCurrency(r.total)}</span>
          </div>
        </div>
      </div>

      ${r.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:.875rem;color:#475569;"><strong>Notes:</strong> ${r.notes}</div>` : ''}

      <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:.75rem;color:#94a3b8;text-align:center;">
        Thank you for your business.
      </div>
    </div>`;

  showModal('receipt-modal');
}

function printReceipt() {
  const content = document.getElementById('printable-receipt').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>body{font-family:system-ui,sans-serif;} * {box-sizing:border-box; margin:0; padding:0;}</style>
    </head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// ── Modal helpers ─────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}
function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ── Inline attachment handling ────────────────────────────────────────────
function initReceiptAttachments() {
  const input = document.getElementById('receipt-file-input');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const file of files) {
      showLoading(true);
      const att = await uploadAttachment(file);
      showLoading(false);
      if (att) {
        receiptAttachments.push(att);
        renderReceiptAttachments();
        showToast(`${file.name} attached`, 'success');
      }
    }
  });
}

function renderReceiptAttachments() {
  const list = document.getElementById('receipt-attachment-list');
  if (!list) return;
  if (!receiptAttachments.length) { list.innerHTML = ''; return; }
  list.innerHTML = receiptAttachments.map(a => {
    const ext = (a.name || '').split('.').pop().toUpperCase();
    const badgeCls = getFileBadgeClass(a.name);
    return `<div style="display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 10px;font-size:.8rem;">
      <span class="file-badge ${badgeCls}">${ext}</span>
      <a href="${escapeHtml(a.public_url)}" target="_blank" style="color:#800020;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</a>
      <button type="button" class="btn-close" onclick="removeReceiptAttachment('${escapeHtml(a.id)}','${escapeHtml(a.file_path)}')" title="Remove">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

async function removeReceiptAttachment(id, filePath) {
  showLoading(true);
  await deleteAttachmentById(id, filePath);
  showLoading(false);
  receiptAttachments = receiptAttachments.filter(a => a.id !== id);
  renderReceiptAttachments();
  showToast('Attachment removed', 'success');
}

// ── PDF download helpers ──────────────────────────────────────────────────
function _buildWatermarkDataURL() {
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

function _buildLogoDataURL() {
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

function _fmtPDF(amount) {
  return 'Rs.' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _datastamp() {
  const n = new Date();
  return n.getFullYear() + '-' +
    String(n.getMonth() + 1).padStart(2, '0') + '-' +
    String(n.getDate()).padStart(2, '0') + '_' +
    String(n.getHours()).padStart(2, '0') +
    String(n.getMinutes()).padStart(2, '0');
}

async function downloadReceiptPDF(r) {
  if (!r) return;
  if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - 2 * margin;

  // ── Watermark ──────────────────────────────────────────
  const wmDataURL = await _buildWatermarkDataURL();
  doc.addImage(wmDataURL, 'PNG', (pageW - 200) / 2, (pageH - 200) / 2, 200, 200);

  // ── Header bar ─────────────────────────────────────────
  doc.setFillColor(128, 0, 32);
  doc.rect(margin, margin, contentW, 2, 'F');

  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('RECEIPT', margin, margin + 32);

  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`# ${r.receipt_number}`, margin, margin + 48);

  // ── Company name / logo in header ──────────────────────
  const logoDataURL = await _buildLogoDataURL();
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
  doc.text(`Date: ${formatDate(r.date)}`, pageW - margin, margin + 76, { align: 'right' });

  // ── Bill To ────────────────────────────────────────────
  let y = margin + 100;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('BILL TO', margin, y); y += 15;

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(r.customer_name, margin, y); y += 15;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  if (r.customer_phone) { doc.text(r.customer_phone, margin, y); y += 13; }
  if (r.customer_email) { doc.text(r.customer_email, margin, y); y += 13; }

  y += 14;

  // ── Items Table ────────────────────────────────────────
  const colWidths = [30, contentW - 270, 50, 90, 90];
  const colX = [margin];
  colWidths.slice(0, -1).forEach((w, i) => colX.push(colX[i] + w));

  // Header row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 22, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  ['#', 'Description', 'Qty', 'Rate', 'Amount'].forEach((h, i) => {
    const align = i >= 2 ? 'right' : 'left';
    const xPos = i >= 2 ? colX[i] + colWidths[i] - 4 : colX[i] + 4;
    doc.text(h, xPos, y + 14, { align });
  });
  y += 22;

  // Data rows
  (r.items || []).forEach((it, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 20, 'F');
    }
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(String(i + 1), colX[0] + 4, y + 13);
    doc.text(String(it.desc || ''), colX[1] + 4, y + 13, { maxWidth: colWidths[1] - 8 });
    doc.text(String(it.qty), colX[2] + colWidths[2] - 4, y + 13, { align: 'right' });
    doc.text(_fmtPDF(it.rate), colX[3] + colWidths[3] - 4, y + 13, { align: 'right' });
    doc.text(_fmtPDF(it.qty * it.rate), colX[4] + colWidths[4] - 4, y + 13, { align: 'right' });
    y += 20;
  });

  // ── Totals ─────────────────────────────────────────────
  y += 12;
  const totX = pageW - margin - 200;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  doc.text('Subtotal', totX, y);
  doc.text(_fmtPDF(r.subtotal), pageW - margin, y, { align: 'right' }); y += 16;

  doc.text(`Tax (${r.tax_percent || 0}%)`, totX, y);
  doc.text(_fmtPDF(r.tax_amount), pageW - margin, y, { align: 'right' }); y += 12;

  doc.setDrawColor(226, 232, 240);
  doc.line(totX - 5, y, pageW - margin, y); y += 12;

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Total', totX, y);
  doc.text(_fmtPDF(r.total), pageW - margin, y, { align: 'right' }); y += 20;

  // ── Notes ──────────────────────────────────────────────
  if (r.notes) {
    y += 8;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentW, 28, 4, 4, 'FD');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Notes:', margin + 10, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(String(r.notes), margin + 10 + doc.getTextWidth('Notes:') + 4, y + 12,
      { maxWidth: contentW - 30 });
    y += 28;
  }

  // ── Footer ──────────────────────────────────────────────
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your business.', pageW / 2, pageH - 40, { align: 'center' });

  // ── Save ───────────────────────────────────────────────
  doc.save(`${r.customer_name} ${_datastamp()}.pdf`);
}
