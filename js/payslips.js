/**
 * Payslips page logic — Generate Payslip for Employees
 */

let _currentPayslipData = null;

// ── Period helpers ─────────────────────────────────────────────────────────
// Convert YYYY-MM (from <input type="month">) to "Month, Year" e.g. "February, 2026"
function _formatPeriodDisplay(yyyyMM) {
  if (!yyyyMM) return yyyyMM;
  const [year, month] = yyyyMM.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long' }) + ', ' + year;
}

// Convert YYYY-MM to "Month-Year" e.g. "February-2026"
function _formatPeriodFilename(yyyyMM) {
  if (!yyyyMM) return yyyyMM;
  const [year, month] = yyyyMM.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long' }) + '-' + year;
}

async function initPayslips() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  // Default date of issue to today
  document.getElementById('date-of-issue').value = todayISO();

  await loadEmployeeDropdown();
  // Reload history when employee selection changes
  document.getElementById('payslip-employee').addEventListener('change', fetchPayslips);
  await fetchPayslips();
}

// ── Load employees into the dropdown ─────────────────────────────────────
async function loadEmployeeDropdown() {
  const { data, error } = await supabaseClient
    .from('employees')
    .select('id, emp_id, emp_name, email, account_number, pan_number, companies(name)')
    .order('emp_name', { ascending: true });

  const sel = document.getElementById('payslip-employee');
  if (error || !data || data.length === 0) {
    sel.innerHTML = '<option value="">— No employees found —</option>';
    return;
  }

  sel.innerHTML = '<option value="">— Select Employee —</option>' +
    data.map(e => {
      const companyName = (e.companies && e.companies.name) ? e.companies.name : 'Twinstar Group';
      return `<option value="${e.id}"
        data-name="${escapeHtml(e.emp_name)}"
        data-empid="${escapeHtml(e.emp_id)}"
        data-email="${escapeHtml(e.email || '')}"
        data-account="${escapeHtml(e.account_number || '')}"
        data-pan="${escapeHtml(e.pan_number || '')}"
        data-company="${escapeHtml(companyName)}"
      >${escapeHtml(e.emp_name)} (${escapeHtml(e.emp_id)})</option>`;
    }).join('');
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

  const opt           = sel.options[sel.selectedIndex];
  const empName       = opt.dataset.name;
  const empCode       = opt.dataset.empid;
  const empEmail      = opt.dataset.email;
  const accountNumber = opt.dataset.account || '';
  const panNumber     = opt.dataset.pan || '';
  const companyName   = opt.dataset.company || 'Twinstar Group';
  const rawPeriod     = document.getElementById('salary-period').value; // YYYY-MM
  const issueDate     = document.getElementById('date-of-issue').value;
  const basic         = parseFloat(document.getElementById('basic-salary').value)     || 0;
  const hra           = parseFloat(document.getElementById('hra').value)               || 0;
  const allowances    = parseFloat(document.getElementById('other-allowances').value) || 0;
  const deductions    = parseFloat(document.getElementById('total-deductions').value) || 0;

  if (!rawPeriod) { showToast('Please enter a salary period.',    'warning'); return null; }
  if (!issueDate) { showToast('Please enter a date of issue.',    'warning'); return null; }
  if (!basic)     { showToast('Please enter the basic salary.',   'warning'); return null; }

  const period         = _formatPeriodDisplay(rawPeriod);   // "February, 2026"
  const periodFilename = _formatPeriodFilename(rawPeriod);  // "February-2026"
  const net = Math.max(0, basic + hra + allowances - deductions);

  return { empId, empName, empCode, empEmail, accountNumber, panNumber, companyName, period, periodFilename, issueDate, basic, hra, allowances, deductions, net };
}

// ── Generate PDF ──────────────────────────────────────────────────────────
async function generatePayslipPDF() {
  const d = _buildPayslipData();
  if (!d) return;
  _currentPayslipData = d;

  const pdfBlob = await _buildPDFBlob(d);
  const filename = `${d.empName.replace(/\s+/g, '')}_${d.periodFilename}.pdf`;

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


// ── Load an image URL and return a data URL (for jsPDF embedding) ─────────
function _loadImageAsDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Build PDF blob using jsPDF ────────────────────────────────────────────
async function _buildPDFBlob(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const stripH = 3.5; // ~10pt header/footer strips

  // Table occupies 65% of page width, centered
  const tableW = pageW * 0.65;
  const tableX = (pageW - tableW) / 2;

  // Load logo
  const logoDataUrl = await _loadImageAsDataUrl('images/logo200.png');

  // ── Watermark (behind content, 35% opacity) ───────────────────────────
  if (logoDataUrl) {
    try {
      const wmSize = 80;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.35, 'fill-opacity': 0.35 }));
      doc.addImage(logoDataUrl, 'PNG', (pageW - wmSize) / 2, (pageH - wmSize) / 2, wmSize, wmSize);
      doc.restoreGraphicsState();
    } catch (e) { /* GState not available — skip watermark opacity */ }
  }

  // ── Blue top strip ────────────────────────────────────────────────────
  doc.setFillColor(0, 70, 180);
  doc.rect(0, 0, pageW, stripH, 'F');

  // ── Company address above maroon strip (center aligned, grey) ───────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${d.companyName || 'Twinstar Group'}, 94/6 Model House Street, Basavanagudi, Bangalore 560004`,
    pageW / 2,
    pageH - stripH - 8,
    { align: 'center' }
  );
  doc.text(
    'admin@twinstarsgroup.com',
    pageW / 2,
    pageH - stripH - 4,
    { align: 'center' }
  );

  // ── Maroon bottom strip ───────────────────────────────────────────────
  doc.setFillColor(128, 0, 0);
  doc.rect(0, pageH - stripH, pageW, stripH, 'F');

  // Footer disclaimer text in maroon strip
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(
    'This is a system generated document. Signature not required.',
    pageW / 2, pageH - stripH / 2 + 1,
    { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);

  let y = stripH + 6;

  // ── Logo in header ────────────────────────────────────────────────────
  if (logoDataUrl) {
    const logoSize = 18;
    doc.addImage(logoDataUrl, 'PNG', (pageW - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 4;
  }

  // ── Title ─────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((d.companyName || 'Twinstar Group') + ' - Payslip', pageW / 2, y, { align: 'center' });
  y += 8;

  // ── Employee info (bold) ──────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(d.empName + ' (' + d.empCode + ')', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Salary Period: ' + d.period + '   |   Date of Issue: ' + formatDate(d.issueDate), pageW / 2, y, { align: 'center' });
  y += 6;
  if (d.accountNumber) {
    doc.text('Account Number: ' + d.accountNumber, pageW / 2, y, { align: 'center' });
    y += 6;
  }
  if (d.panNumber) {
    doc.text('PAN Number: ' + d.panNumber, pageW / 2, y, { align: 'center' });
    y += 6;
  }
  y += 4;

  doc.setDrawColor(200);
  doc.line(tableX, y, tableX + tableW, y);
  y += 8;

  // ── Earnings / Deductions table ───────────────────────────────────────
  const rows = [
    ['Basic Salary',     _fmt(d.basic)],
    ['HRA',              _fmt(d.hra)],
    ['Other Allowances', _fmt(d.allowances)],
    ['Total Deductions', '- ' + _fmt(d.deductions)],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Description', tableX, y);
  doc.text('Amount (Rs.)', tableX + tableW, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(180);
  doc.line(tableX, y, tableX + tableW, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.text(label, tableX, y);
    doc.text(value, tableX + tableW, y, { align: 'right' });
    y += 7;
  });

  doc.line(tableX, y, tableX + tableW, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Net Pay', tableX, y);
  doc.text(_fmt(d.net), tableX + tableW, y, { align: 'right' });

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
    const pdfBlob = await _buildPDFBlob(d);
    const base64  = await _blobToBase64(pdfBlob);
    const filename = `${d.empName.replace(/\s+/g, '')}_${d.periodFilename}.pdf`;

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

// ── Download/view a payslip regenerated from a stored record ─────────────
async function _downloadPayslipFromRecord(p) {
  const emp         = p.employees || {};
  const companyName = (emp.companies && emp.companies.name) ? emp.companies.name : 'Twinstar Group';
  // period is stored as "Month, Year"; derive filename version "Month-Year"
  const periodFilename = (p.period || '').replace(', ', '-');
  const d = {
    empId:          p.employee_id,
    empName:        emp.emp_name  || '—',
    empCode:        emp.emp_id    || '',
    empEmail:       emp.email     || '',
    accountNumber:  emp.account_number || '',
    panNumber:      emp.pan_number || '',
    companyName,
    period:         p.period,
    periodFilename,
    issueDate:      p.issue_date,
    basic:          parseFloat(p.basic_salary)     || 0,
    hra:            parseFloat(p.hra)               || 0,
    allowances:     parseFloat(p.other_allowances)  || 0,
    deductions:     parseFloat(p.total_deductions)  || 0,
    net:            parseFloat(p.net_pay)           || 0,
  };
  showLoading(true);
  try {
    const pdfBlob = await _buildPDFBlob(d);
    const filename = `${d.empName.replace(/\s+/g, '')}_${d.periodFilename}.pdf`;
    const url = URL.createObjectURL(pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('Failed to generate PDF: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Fetch payslip history ─────────────────────────────────────────────────
async function fetchPayslips() {
  const empSel       = document.getElementById('payslip-employee');
  const selectedEmpId = empSel ? empSel.value : '';

  // Calculate date 6 months ago for filtering
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoISO = sixMonthsAgo.toISOString().split('T')[0];

  let query = supabaseClient
    .from('payslips')
    .select('*, employees(emp_name, emp_id, email, account_number, pan_number, companies(name))')
    .gte('issue_date', sixMonthsAgoISO)
    .order('created_at', { ascending: false })
    .limit(50);

  if (selectedEmpId) {
    query = query.eq('employee_id', selectedEmpId);
  }

  const { data, error } = await query;
  const el = document.getElementById('payslip-list');

  if (error || !data || data.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:40px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      <h3>No payslips yet</h3>
      <p>Generate your first payslip using the form above</p>
    </div>`;
    return;
  }

  // Store data for inline access from onclick handlers
  window._payslipHistory = data;

  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Employee</th>
      <th>Period</th>
      <th>Issue Date</th>
      <th>Basic</th>
      <th>Net Pay</th>
      <th>Generated</th>
      <th>Action</th>
    </tr></thead>
    <tbody>${data.map((p, idx) => {
      const empName = p.employees ? escapeHtml(p.employees.emp_name) : '—';
      const empCode = p.employees ? escapeHtml(p.employees.emp_id)   : '';
      return `<tr>
        <td>${empName}${empCode ? ' <span style="color:#64748b;font-size:.8rem;">('+empCode+')</span>' : ''}</td>
        <td>${escapeHtml(p.period)}</td>
        <td>${formatDate(p.issue_date)}</td>
        <td>${formatCurrency(p.basic_salary)}</td>
        <td style="font-weight:600;">${formatCurrency(p.net_pay)}</td>
        <td style="color:#64748b;font-size:.82rem;">${formatDate(p.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="_downloadPayslipFromRecord(window._payslipHistory[${idx}])">Download</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}
