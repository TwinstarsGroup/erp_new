async function _buildPDFBlob(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const stripH = 3.5; 

  const tableW = pageW * 0.65;
  const tableX = (pageW - tableW) / 2;

  const logoDataUrl = await _loadImageAsDataUrl('images/logo200.png');

  // ── Watermark ──────────────────────────────────────────────────────────
  if (logoDataUrl) {
    try {
      const wmSize = 80;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.35, 'fill-opacity': 0.35 }));
      doc.addImage(logoDataUrl, 'PNG', (pageW - wmSize) / 2, (pageH - wmSize) / 2, wmSize, wmSize);
      doc.restoreGraphicsState();
    } catch (e) { }
  }

  // ── Blue top strip ────────────────────────────────────────────────────
  doc.setFillColor(0, 70, 180);
  doc.rect(0, 0, pageW, stripH, 'F');

  // ── Maroon bottom strip (Now containing Address & Email) ──────────────
  doc.setFillColor(128, 0, 0);
  doc.rect(0, pageH - 12, pageW, 12, 'F'); // Increased height to fit text

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${d.companyName || 'Twinstar Group'}, 94/6 Model House Street, Basavanagudi, Bangalore 560004`,
    pageW / 2, pageH - 7, { align: 'center' }
  );
  doc.text(
    'Email: admin@twinstarsgroup.com',
    pageW / 2, pageH - 3, { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);

  let y = stripH + 6;

  // ── Logo in header ────────────────────────────────────────────────────
  if (logoDataUrl) {
    const logoSize = 18;
    doc.addImage(logoDataUrl, 'PNG', (pageW - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 4;
  }

  // ── Title & Employee Info ─────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((d.companyName || 'Twinstar Group') + ' - Payslip', pageW / 2, y, { align: 'center' });
  y += 8;

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
  
  // ── System Disclaimer (Moved here) ────────────────────────────────────
  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('This is a system generated document. Signature not required.', pageW / 2, y, { align: 'center' });

  return doc.output('blob');
}
