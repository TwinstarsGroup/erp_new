// dynamic search functionality for attachments

// Function to filter attachments based on the search term
function searchAttachments(attachments, searchTerm) {
    return attachments.filter(attachment =>
        attachment.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
}

// Function to display attachments
function displayAttachments(attachments) {
    const attachmentsList = document.getElementById('attachments-list');
    attachmentsList.innerHTML = ''; // Clear previous results

    if (attachments.length === 0) {
        attachmentsList.innerHTML = '<p>No attachments found.</p>';
        return;
    }

    attachments.forEach(attachment => {
        const listItem = document.createElement('li');
        listItem.textContent = attachment.name;
        attachmentsList.appendChild(listItem);
    });
}

// Main function to handle search
function handleSearch() {
    const searchTerm = document.getElementById('search-input').value;
    const filteredAttachments = searchAttachments(window.attachments, searchTerm);
    displayAttachments(filteredAttachments);
}

// Add event listener to the search input
document.getElementById('search-input').addEventListener('input', handleSearch);

// Example usage (should be populated with real data):
// window.attachments = [{ name: 'file1.doc' }, { name: 'file2.pdf' }, { name: 'image.jpg' }];