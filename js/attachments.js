/**
 * Attachments Management - Upload, Search, and Delete Files
 * Integrates with Supabase storage and database for file management
 */

let attachmentsData = [];

// Initialize attachments page
async function initAttachments() {
    setActiveNav();
    wireSidebarAutoClose();
    wireSidebarEscapeClose();

    setupDragDropZone();
    setupFileInput();
    await loadAttachments();
}

// Setup drag and drop zone
function setupDragDropZone() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
}

// Setup file input element
function setupFileInput() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
}

// Prevent default drag/drop behavior
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle file upload
async function handleFiles(files) {
    showLoading(true);

    try {
        for (let file of files) {
            const uploadedFile = await uploadAttachment(file);
            if (uploadedFile) {
                showToast(`${file.name} uploaded successfully`, 'success');
                attachmentsData.push(uploadedFile);
            }
        }
        await loadAttachments();
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error uploading files: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Load attachments from Supabase
async function loadAttachments(searchFilter = '') {
    try {
        showLoading(true);

        let query = supabaseClient.from('attachments').select('*');

        if (searchFilter) {
            query = query.or(`name.ilike.%${searchFilter}%,receipt_number.ilike.%${searchFilter}%,voucher_number.ilike.%${searchFilter}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        attachmentsData = data || [];
        renderAttachmentsList(attachmentsData);
        updateFileCount();
    } catch (error) {
        console.error('Load attachments error:', error);
        showToast('Error loading attachments: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Fetch attachments with search filter
async function fetchAttachments(searchTerm) {
    await loadAttachments(searchTerm);
}

// Render attachments list
function renderAttachmentsList(attachments) {
    const attachmentList = document.getElementById('attachment-list');
    if (!attachmentList) return;

    attachmentList.innerHTML = '';

    if (!attachments || attachments.length === 0) {
        attachmentList.innerHTML = `
            <div class="empty-state" style="padding:40px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <h3>No files yet</h3>
                <p>Upload files using the drop zone above</p>
            </div>
        `;
        return;
    }

    const table = document.createElement('table');
    table.className = 'attachments-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>File Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    const tbody = table.querySelector('tbody');

    attachments.forEach(attachment => {
        const row = document.createElement('tr');
        const uploadDate = formatDate(attachment.created_at);
        const fileSize = formatFileSize(attachment.file_size);
        const fileBadge = getFileBadgeClass(attachment.name);

        row.innerHTML = `
            <td>
                <div class="file-info">
                    <span class="file-badge ${fileBadge}">${(attachment.name || '').split('.').pop().toUpperCase()}</span>
                    ${escapeHtml(attachment.name)}
                </div>
            </td>
            <td>${fileSize}</td>
            <td>${escapeHtml(attachment.mime_type || 'Unknown')}</td>
            <td>${uploadDate}</td>
            <td>
                <div class="action-buttons">
                    <a href="${escapeHtml(attachment.public_url)}" target="_blank" class="btn btn-sm btn-download">Download</a>
                    <button class="btn btn-sm btn-delete" onclick="deleteAttachment(${attachment.id}, '${escapeHtml(attachment.file_path)}')">Delete</button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });

    attachmentList.appendChild(table);
}

// Delete attachment
async function deleteAttachment(id, filePath) {
    if (!confirmAction('Are you sure you want to delete this file?')) {
        return;
    }

    showLoading(true);

    try {
        await deleteAttachmentById(id, filePath);
        showToast('File deleted successfully', 'success');
        attachmentsData = attachmentsData.filter(a => a.id !== id);
        renderAttachmentsList(attachmentsData);
        updateFileCount();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error deleting file: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Update file count display
function updateFileCount() {
    const fileCount = document.getElementById('file-count');
    if (fileCount) {
        fileCount.textContent = `${attachmentsData.length} file${attachmentsData.length !== 1 ? 's' : ''}`;
    }
}
