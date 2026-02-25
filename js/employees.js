/**
 * Employees page logic — Create Employee TSE
 */

// Map from select-option values to canonical company names
const COMPANY_NAMES = {
  'twinstar-entertainers': 'Twinstar Entertainers LLP',
  'twinstar-datalytiks':   'Twinstar Datalytiks LLP'
};

async function initEmployees() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();
  await fetchEmployees();
}

// ── Save new employee ─────────────────────────────────────────────────────
async function saveEmployee() {
  const name       = document.getElementById('emp-name').value.trim();
  const empId      = document.getElementById('emp-id').value.trim();
  const doj        = document.getElementById('date-of-joining').value;
  const accountNum = document.getElementById('account-number').value.trim();
  const position   = document.getElementById('position').value.trim();
  const companyKey = document.getElementById('company-id').value;
  const email      = document.getElementById('emp-email').value.trim();
  const panNumber  = document.getElementById('pan-number').value.trim();

  // Validation
  if (!name || !empId || !doj || !accountNum || !position || !companyKey || !email) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    showToast('Please enter a valid email address.', 'warning');
    return;
  }

  // Resolve company_id from companies table
  showLoading(true);
  const companyName = COMPANY_NAMES[companyKey] || '';
  const { data: companies, error: cErr } = await supabaseClient
    .from('companies')
    .select('id')
    .eq('name', companyName)
    .limit(1);

  const companyId = (companies && companies.length > 0) ? companies[0].id : null;

  const { error } = await supabaseClient.from('employees').insert([{
    emp_name:        name,
    emp_id:          empId,
    date_of_joining: doj,
    account_number:  accountNum,
    position,
    company_name:    companyName,
    company_id:      companyId,
    pan_number:      panNumber || null,
    email
  }]);
  showLoading(false);

  if (cErr || error) {
    showToast('Error saving employee: ' + (error || cErr).message, 'error');
    return;
  }

  showToast('Employee saved successfully!', 'success');
  resetEmployeeForm();
  await fetchEmployees();
}

// ── Reset form ────────────────────────────────────────────────────────────
function resetEmployeeForm() {
  document.getElementById('employee-form').reset();
}

// ── Fetch and render employees ────────────────────────────────────────────
async function fetchEmployees(search = '') {
  let query = supabaseClient
    .from('employees')
    .select('*, companies(name)')
    .order('created_at', { ascending: false });
  if (search) {
    query = query.ilike('emp_name', `%${search}%`);
  }

  const { data, error } = await query;
  const el = document.getElementById('employee-list');

  if (error) {
    el.innerHTML = `<div class="empty-state" style="padding:40px;"><p style="color:#dc2626;">Failed to load employees: ${escapeHtml(error.message)}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:40px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <h3>No employees yet</h3>
      <p>Add your first employee using the form above</p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Emp ID</th>
      <th>Name</th>
      <th>Position</th>
      <th>Company</th>
      <th>Date of Joining</th>
      <th>Email</th>
      <th>Action</th>
    </tr></thead>
    <tbody>${data.map(emp => {
      const companyDisplay = (emp.companies && emp.companies.name) ? emp.companies.name : (emp.company_name || '—');
      return `<tr>
      <td style="font-weight:600;">${escapeHtml(emp.emp_id)}</td>
      <td>${escapeHtml(emp.emp_name)}</td>
      <td>${escapeHtml(emp.position)}</td>
      <td>${escapeHtml(companyDisplay)}</td>
      <td>${formatDate(emp.date_of_joining)}</td>
      <td>${escapeHtml(emp.email)}</td>
      <td>
        <button class="btn btn-sm btn-outline" style="color:#dc2626;border-color:#dc2626;"
          onclick="deleteEmployee('${emp.id}')">Delete</button>
      </td>
    </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── Delete employee ───────────────────────────────────────────────────────
async function deleteEmployee(id) {
  if (!confirmAction('Delete this employee record?')) return;
  showLoading(true);
  const { error } = await supabaseClient.from('employees').delete().eq('id', id);
  showLoading(false);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    return;
  }
  showToast('Employee deleted.', 'success');
  await fetchEmployees();
}
