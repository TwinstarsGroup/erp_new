function renderAttachmentList(attachments) {
    const list = document.createElement('ul');
    attachments.forEach(attachment => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${escapeHtml(attachment.fileName)}</span>
            <span>${escapeHtml(attachment.receiptOrVoucher)}</span>
            <a href="${escapeHtml(attachment.downloadUrl)}" class="btn btn-download">Download</a>
            <button class="btn btn-view">View</button>
            <button class="btn btn-delete">Delete</button>
        `;
        list.appendChild(listItem);
    });
    return list;
}