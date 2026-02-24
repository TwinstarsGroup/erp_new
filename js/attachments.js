/**
 * Attachments page logic
 * Uses Supabase Storage bucket: "attachments"
 */

const BUCKET = 'attachments';
let attachments = [];

// ── Initialise ────────────────────────────────────────────────────────────
async function initAttachments() {
  const session = await requireAuth();
  if (!session) return;
  populateSidebarUser(session);
  setActiveNav();

  await fetchAttachments();
  setupDropZone();
}

// ── Fetch all attachment records ──────────────────────────────────────────
async function fetchAttachments(search = '') {
  let query = supabaseClient.from('attachments').select('*').order('created_at', { ascending: false });
  if (search) query = query.ilike('name', `%${search}%`);
  const { data, error } = await query;
  if (error) { showToast('Failed to load attachments', 'error'); return; }
  attachments = data || [];
  renderAttachmentList();
}

// ── Drag-and-drop upload zone ─────────────────────────────────────────────
function setupDropZone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  zone.addEventListener('click', () => document.getElementById('file-input').click());

  document.getElementById('file-input').addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
}

// ── Handle file upload ────────────────────────────────────────────────────
async function handleFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of files) {
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_SIZE) {
    showToast(`${file.name}: file too large (max 50 MB)`, 'warning');
    return;
  }

  showToast(`Uploading ${file.name}…`, 'info', 60000);
  showLoading(true);

  const filePath = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

  const { error: storageError } = await supabaseClient.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: false });

  if (storageError) {
    showLoading(false);
    showToast('Upload failed: ' + storageError.message, 'error');
    return;
  }

  // Get public URL
  const { data: { publicUrl } } = supabaseClient.storage.from(BUCKET).getPublicUrl(filePath);

  // Save metadata to DB
  const { error: dbError } = await supabaseClient.from('attachments').insert([{
    name:       file.name,
    file_path:  filePath,
    file_size:  file.size,
    mime_type:  file.type,
    public_url: publicUrl
  }]);

  showLoading(false);

  if (dbError) {
    showToast('Metadata save failed: ' + dbError.message, 'error');
    return;
  }

  showToast(`${file.name} uploaded successfully!`, 'success');
  fetchAttachments();
}

// ── Render list ───────────────────────────────────────────────────────────
function renderAttachmentList() {
  const el = document.getElementById('attachment-list');
  if (!attachments.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      <h3>No attachments yet</h3>
      <p>Drag & drop files or click the upload zone above</p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>File Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${attachments.map(a => {
        const badgeCls = getFileBadgeClass(a.name);
        const ext = (a.name || '').split('.').pop().toUpperCase();
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="file-badge ${badgeCls}">${ext}</span>
              <span style="font-weight:500;">${a.name}</span>
            </div>
          </td>
          <td style="color:#64748b;font-size:.82rem;">${a.mime_type || '—'}</td>
          <td style="color:#64748b;font-size:.82rem;">${formatFileSize(a.file_size)}</td>
          <td>${formatDate(a.created_at)}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <a href="${a.public_url}" target="_blank" class="btn btn-sm btn-outline">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download
              </a>
              <button class="btn btn-sm btn-danger" onclick="deleteAttachment('${a.id}','${a.file_path}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

// ── Delete attachment ─────────────────────────────────────────────────────
async function deleteAttachment(id, filePath) {
  if (!confirmAction('Delete this file? This cannot be undone.')) return;

  showLoading(true);

  // Remove from storage
  await supabaseClient.storage.from(BUCKET).remove([filePath]);

  // Remove DB record
  const { error } = await supabaseClient.from('attachments').delete().eq('id', id);
  showLoading(false);

  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('File deleted', 'success');
  fetchAttachments();
}
