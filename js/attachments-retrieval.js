// ============================================
// ATTACHMENT RETRIEVAL METHODS
// ============================================

// 1. Get attachments by Receipt Number
async function getAttachmentsByReceiptNumber(receiptNumber) {
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('receipt_number', receiptNumber)
        .order('created_at', { ascending: false });

    return { data, error };
}

// 2. Get attachments by Voucher Number
async function getAttachmentsByVoucherNumber(voucherNumber) {
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('voucher_number', voucherNumber)
        .order('created_at', { ascending: false });

    return { data, error };
}

// 3. Get ALL attachments
async function getAllAttachments() {
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .order('created_at', { ascending: false });

    return { data, error };
}

// 4. Search attachments by filename
async function searchAttachments(searchTerm) {
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,receipt_number.ilike.%${searchTerm}%,voucher_number.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

    return { data, error };
}

// 5. Get attachment by ID
async function getAttachmentById(attachmentId) {
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

    return { data, error };
}

// 6. Get attachments with pagination
async function getAttachmentsWithPagination(page = 1, pageSize = 10) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
        .from('attachments')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });

    return { data, error, count };
}

// Helper: Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Helper: Render attachments list HTML
function renderAttachmentsList(attachments) {
    if (!attachments || attachments.length === 0) {
        return `
            <div style="padding:16px;border-top:1px solid #e5e7eb;color:#9ca3af;">
                <p style="margin:0;font-size:14px;">No attachments</p>
            </div>
        `;
    }

    let html = `
        <div style="padding:16px;border-top:1px solid #e5e7eb;">
            <div style="font-weight:600;font-size:14px;margin-bottom:12px;color:#1f2937;">
                📎 Attachments (${attachments.length})
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
    `;

    attachments.forEach(att => {
        const fileSize = att.file_size ? formatFileSize(att.file_size) : 'Unknown';
        html += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:#f9fafb;border-radius:4px;border:1px solid #e5e7eb;">
                <div style="flex:1;">
                    <div style="font-size:14px;color:#374151;font-weight:500;">${att.name}</div>
                    <div style="font-size:12px;color:#9ca3af;margin-top:4px;">${fileSize}</div>
                </div>
                <a href="${att.public_url}" target="_blank" rel="noopener noreferrer" 
                   style="padding:6px 12px;background:#10b981;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;cursor:pointer;">
                    ⬇️ Download
                </a>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}