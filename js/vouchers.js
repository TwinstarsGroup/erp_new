/**
 * Cash Vouchers page logic
 */

let vouchers = [];
let editingVoucherId = null;
let nextVoucherNum   = 1;

// ── Initialise ────────────────────────────────────────────────────────────
async function initVouchers() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  document.getElementById('voucher-date').value = todayISO();
  await fetchVouchers();
  await setNextVoucherNumber();

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
      <th>Voucher #</th><th>Date</th><th>Payee</th><th>Purpose</th>
      <th>Payment Mode</th><th>Amount</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${vouchers.map(v => `<tr>
        <td style="font-weight:600;color:#2563eb;">${v.voucher_number}</td>
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

// ── Next number ───────────────────────────────────────────────────────────
async function setNextVoucherNumber() {
  const { count } = await supabaseClient.from('cash_vouchers').select('*', { count: 'exact', head: true });
  nextVoucherNum = (count || 0) + 1;
  document.getElementById('voucher-number').value = generateRef('CVR', nextVoucherNum);
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
  resetVoucherForm();
  await fetchVouchers();
  await setNextVoucherNumber();
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetVoucherForm() {
  editingVoucherId = null;
  document.getElementById('voucher-form').reset();
  document.getElementById('voucher-date').value = todayISO();
  document.getElementById('amount-words').textContent = '—';
  setNextVoucherNumber();
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
  document.getElementById('voucher-modal-content').innerHTML = `
    <div class="print-doc" id="printable-voucher" style="background:#fff;padding:32px;font-family:inherit;">

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #16a34a;padding-bottom:16px;">
        <div>
          <div style="font-size:1.4rem;font-weight:800;color:#1e293b;">Cash Payment Voucher</div>
          <div style="font-size:.9rem;color:#64748b;"># ${v.voucher_number}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem;font-weight:700;color:#16a34a;">ERP System</div>
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

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }
