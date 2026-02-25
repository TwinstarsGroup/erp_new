/**
 * Payslips page logic — Generate Payslip for Employees
 */

let _currentPayslipData = null;

async function initPayslips() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  // Default date of issue to today
  document.getElementById('date-of-issue').value = todayISO();

  await loadEmployeeDropdown();
  await fetchPayslips();
}

// ── Load employees into the dropdown ─────────────────────────────────────
async function loadEmployeeDropdown() {
  const { data, error } = await supabaseClient
    .from('employees')
    .select('id, emp_id, emp_name, email')
    .order('emp_name', { ascending: true });

  const sel = document.getElementById('payslip-employee');
  if (error || !data || data.length === 0) {
    sel.innerHTML = '<option value="">— No employees found —</option>';
    return;
  }

  sel.innerHTML = '<option value="">— Select Employee —</option>' +
    data.map(e => `<option value="${e.id}" data-name="${escapeHtml(e.emp_name)}" data-empid="${escapeHtml(e.emp_id)}" data-email="${escapeHtml(e.email)}">${escapeHtml(e.emp_name)} (${escapeHtml(e.emp_id)})</option>`).join('');
}

// ── Recalculate net pay on input change ───────────────────────────────────
function recalcNetPay() {
  const basic      = parseFloat(document.getElementById('basic-salary').value)      || 0;
  const hra        = parseFloat(document.getElementById('hra').value)                || 0;
  const allowances = parseFloat(document.getElementById('other-allowances').value)  || 0;
  const deductions = parseFloat(document.getElementById('total-deductions').value)  || 0;
  const net        = basic + hra + allowances - deductions;

  document.getElementById('net-basic').textContent      = formatCurrency(basic);
  document.getElementById('net-hra').textContent        = formatCurrency(hra);
  document.getElementById('net-allowances').textContent = formatCurrency(allowances);
  document.getElementById('net-deductions').textContent = '— ' + formatCurrency(deductions);
  document.getElementById('net-pay-display').textContent = formatCurrency(net < 0 ? 0 : net);

  return net < 0 ? 0 : net;
}

// ── Calculate button handler ──────────────────────────────────────────────
function calculatePayslip() {
  const net = recalcNetPay();
  showToast('Net Pay: ' + formatCurrency(net), 'info');
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetPayslipForm() {
  document.getElementById('payslip-form').reset();
  document.getElementById('date-of-issue').value = todayISO();
  recalcNetPay();
  _currentPayslipData = null;
}

// ── Build payslip data object from form ───────────────────────────────────
function _buildPayslipData() {
  const sel      = document.getElementById('payslip-employee');
  const empId    = sel.value;
  if (!empId) { showToast('Please select an employee.', 'warning'); return null; }

  const opt        = sel.options[sel.selectedIndex];
  const empName    = opt.dataset.name;
  const empCode    = opt.dataset.empid;
  const empEmail   = opt.dataset.email;
  const period     = document.getElementById('salary-period').value;
  const issueDate  = document.getElementById('date-of-issue').value;
  const basic      = parseFloat(document.getElementById('basic-salary').value)     || 0;
  const hra        = parseFloat(document.getElementById('hra').value)               || 0;
  const allowances = parseFloat(document.getElementById('other-allowances').value) || 0;
  const deductions = parseFloat(document.getElementById('total-deductions').value) || 0;

  if (!period)    { showToast('Please enter a salary period.',    'warning'); return null; }
  if (!issueDate) { showToast('Please enter a date of issue.',    'warning'); return null; }
  if (!basic)     { showToast('Please enter the basic salary.',   'warning'); return null; }

  const net = Math.max(0, basic + hra + allowances - deductions);

  return { empId, empName, empCode, empEmail, period, issueDate, basic, hra, allowances, deductions, net };
}

// ── Generate PDF ──────────────────────────────────────────────────────────
async function generatePayslipPDF() {
  const d = _buildPayslipData();
  if (!d) return;
  _currentPayslipData = d;

  const pdfBlob = _buildPDFBlob(d);
  const filename = `${d.empName.replace(/\s+/g, '_')}_${d.period}.pdf`;

  // Trigger download
  const url = URL.createObjectURL(pdfBlob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Persist to Supabase
  await _savePayslipRecord(d, null);
  showToast('PDF downloaded: ' + filename, 'success');
  await fetchPayslips();
}

// ── Build PDF blob using jsPDF ────────────────────────────────────────────
function _buildPDFBlob(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(d.empName + ' (' + d.empCode + ')', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.text('Salary Period: ' + d.period + '   |   Date of Issue: ' + formatDate(d.issueDate), pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(200);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  // Earnings / Deductions table
  const rows = [
    ['Basic Salary',     _fmt(d.basic)],
    ['HRA',              _fmt(d.hra)],
    ['Other Allowances', _fmt(d.allowances)],
    ['Total Deductions', '- ' + _fmt(d.deductions)],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Description', 14, y);
  doc.text('Amount (₹)', pageW - 14, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(180);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.text(label, 14, y);
    doc.text(value, pageW - 14, y, { align: 'right' });
    y += 7;
  });

  doc.line(14, y, pageW - 14, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Net Pay', 14, y);
  doc.text(_fmt(d.net), pageW - 14, y, { align: 'right' });

  return doc.output('blob');
}

function _fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n || 0);
}

// ── Email payslip via Supabase Edge Function ──────────────────────────────
async function emailPayslip() {
  const d = _buildPayslipData();
  if (!d) return;

  if (!d.empEmail) {
    showToast('No email address found for this employee.', 'warning');
    return;
  }

  showLoading(true);
  try {
    // Convert PDF to base64 for the edge function
    const pdfBlob = _buildPDFBlob(d);
    const base64  = await _blobToBase64(pdfBlob);
    const filename = `${d.empName.replace(/\s+/g, '_')}_${d.period}.pdf`;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const supabaseUrl = supabaseClient.supabaseUrl;

    const resp = await fetch(`${supabaseUrl}/functions/v1/send-payslip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({
        to:           d.empEmail,
        empName:      d.empName,
        period:       d.period,
        pdfBase64:    base64,
        pdfFilename:  filename
      })
    });

    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(msg || resp.statusText);
    }

    showToast('Payslip emailed to ' + d.empEmail, 'success');
    await _savePayslipRecord(d, null);
    await fetchPayslips();
  } catch (err) {
    showToast('Email failed: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Persist payslip metadata to Supabase ─────────────────────────────────
async function _savePayslipRecord(d, pdfUrl) {
  const { error } = await supabaseClient.from('payslips').insert([{
    employee_id:      d.empId,
    period:           d.period,
    issue_date:       d.issueDate,
    basic_salary:     d.basic,
    hra:              d.hra,
    other_allowances: d.allowances,
    total_deductions: d.deductions,
    net_pay:          d.net,
    pdf_url:          pdfUrl || null
  }]);
  if (error) console.error('Failed to save payslip record:', error.message);
}

// ── Fetch payslip history ─────────────────────────────────────────────────
async function fetchPayslips() {
  const { data, error } = await supabaseClient
    .from('payslips')
    .select('*, employees(emp_name, emp_id)')
    .order('created_at', { ascending: false })
    .limit(50);

  const el = document.getElementById('payslip-list');

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:40px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      <h3>No payslips yet</h3>
      <p>Generate your first payslip using the form above</p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Employee</th>
      <th>Period</th>
      <th>Issue Date</th>
      <th>Basic</th>
      <th>Net Pay</th>
      <th>Generated</th>
    </tr></thead>
    <tbody>${data.map(p => {
      const empName = p.employees ? escapeHtml(p.employees.emp_name) : '—';
      const empCode = p.employees ? escapeHtml(p.employees.emp_id)   : '';
      return `<tr>
        <td>${empName}${empCode ? ' <span style="color:#64748b;font-size:.8rem;">('+empCode+')</span>' : ''}</td>
        <td>${escapeHtml(p.period)}</td>
        <td>${formatDate(p.issue_date)}</td>
        <td>${formatCurrency(p.basic_salary)}</td>
        <td style="font-weight:600;">${formatCurrency(p.net_pay)}</td>
        <td style="color:#64748b;font-size:.82rem;">${formatDate(p.created_at)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}
