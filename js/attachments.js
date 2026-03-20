/*function renderAttachmentList(attachments) {
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
}*/

// Fetches attachments based on receipt/voucher number
function fetchAttachments(receiptNumber) {
    return fetch(`/api/attachments?receiptNumber=${receiptNumber}`)
        .then(response => response.json())
        .catch(error => console.error('Error fetching attachments:', error));
}

// Initializes attachment logic and binds search functionality
function initAttachments() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearch);
}

// Handles search input and displays filtered results
function handleSearch(event) {
    const searchValue = event.target.value;
    displayLogic(searchValue);
}

// Displays attachments grouped by receipt number
function displayLogic(filter) {
    fetchAttachments(filter).then(attachments => {
        const grouped = groupByReceiptNumber(attachments);
        renderAttachments(grouped);
    });
}

// Group attachments by receipt/voucher number
function groupByReceiptNumber(attachments) {
    return attachments.reduce((groups, attachment) => {
        const key = attachment.receiptNumber;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(attachment);
        return groups;
    }, {});
}

// Renders attachments to the page
function renderAttachments(groupedAttachments) {
    const container = document.getElementById('attachmentsContainer');
    container.innerHTML = ''; // Clear existing content
    for (const receiptNumber in groupedAttachments) {
        const attachments = groupedAttachments[receiptNumber];
        const receiptDiv = document.createElement('div');
        receiptDiv.className = 'receipt-group';
        receiptDiv.innerHTML = `<h3>Receipt Number: ${receiptNumber}</h3>`;
        attachments.forEach(att => {
            const attItem = document.createElement('div');
            attItem.textContent = att.description; // Display attachment description
            receiptDiv.appendChild(attItem);
        });
        container.appendChild(receiptDiv);
    }
} 

// Initialize the attachments functionality on page load
document.addEventListener('DOMContentLoaded', initAttachments);

// Example when uploading from receipts.html
await supabase.from('attachments').insert({
    name: file.name,
    file_path: path,
    file_size: file.size,
    mime_type: file.type,
    public_url: publicUrl,
    receipt_number: 'RCP-TSE-0001'  // Add this
});
