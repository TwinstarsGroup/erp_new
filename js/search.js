/**
 * Search functionality for receipts and vouchers
 * Integrates with Supabase to search across tables
 

// Perform search across receipts and vouchers
async function performSearch(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        showToast('Please enter a search term', 'warning');
        return;
    }

    showLoading(true);

    try {
        // Search in receipts table
        const { data: receipts, error: receiptsError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${searchTerm}%`);

        if (receiptsError) throw receiptsError;

        // Search in vouchers table
        const { data: vouchers, error: vouchersError } = await supabaseClient
            .from('vouchers')
            .select('*')
            .ilike('voucher_number', `%${searchTerm}%`);

        if (vouchersError) throw vouchersError;

        // Combine results
        const combinedResults = [
            ...(receipts || []).map(r => ({ ...r, type: 'Receipt' })),
            ...(vouchers || []).map(v => ({ ...v, type: 'Voucher' }))
        ];

        displayResults(combinedResults);

        if (combinedResults.length === 0) {
            showToast('No results found', 'info');
        } else {
            showToast(`Found ${combinedResults.length} result(s)`, 'success');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Error performing search: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Display search results
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '';

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No results found.</p>';
        return;
    }

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-container';

    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const number = result.type === 'Receipt' ? result.receipt_number : result.voucher_number;
        const amount = formatCurrency(result.amount || 0);
        const date = formatDate(result.created_at || result.date);
        const description = result.description || result.remarks || 'N/A';

        resultItem.innerHTML = `
            <div class="result-header">
                <span class="result-badge ${result.type.toLowerCase()}">${result.type}</span>
                <h3>${escapeHtml(number)}</h3>
            </div>
            <div class="result-details">
                <p><strong>Amount:</strong> ${amount}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Description:</strong> ${escapeHtml(description)}</p>
            </div>
        `;

        resultsContainer.appendChild(resultItem);
    });*/


async function performSearch(searchTerm) {
    const term = searchTerm ? searchTerm.trim() : '';
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    // In a real app, showLoading(true) would trigger a spinner
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div style="padding:40px; text-align:center;">Searching...</div>';

    try {
        // 1. Search Receipts (Uses 'total' column)
        const { data: receipts, error: rError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${term}%`);

        if (rError) throw rError;

        // 2. Search Vouchers (Table name must match 'cash_vouchers')
        const { data: vouchers, error: vError } = await supabaseClient
            .from('cash_vouchers')
            .select('*')
            .ilike('voucher_number', `%${term}%`);

        if (vError) throw vError;

        const combined = [
            ...(receipts || []).map(r => ({ ...r, type: 'Receipt', display_no: r.receipt_number, amt: r.total })),
            ...(vouchers || []).map(v => ({ ...v, type: 'Voucher', display_no: v.voucher_number, amt: v.amount }))
        ];

        displayResults(combined);
    } catch (error) {
        showToast('Search failed: ' + error.message, 'error');
    }
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state" style="padding:40px;"><p>No records found.</p></div>';
        return;
    }

    resultsDiv.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Number</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th style="text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(item => `
                        <tr>
                            <td><span class="badge ${item.type.toLowerCase()}">${item.type}</span></td>
                            <td style="font-weight:600;">${item.display_no}</td>
                            <td>${formatCurrency(item.amt)}</td>
                            <td>${formatDate(item.date || item.created_at)}</td>
                            <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
                                <button class="btn btn-sm btn-outline" onclick="viewRecord('${item.type}', '${item.id}')">
                                    View
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="downloadRecord('${item.type}', '${item.id}')">
                                    Download
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

// Navigation Logic for Buttons
function viewRecord(type, id) {
    const page = type === 'Receipt' ? 'receipts.html' : 'vouchers.html';
    window.location.href = `${page}?id=${id}&mode=view`;
}

function downloadRecord(type, id) {
    // This assumes your receipts.html/vouchers.html has a print/PDF trigger
    const page = type === 'Receipt' ? 'receipts.html' : 'vouchers.html';
    window.location.href = `${page}?id=${id}&action=download`;
}

    resultsDiv.appendChild(resultsContainer);
}

// Initialize search page
function initSearch() {
    setActiveNav();
    wireSidebarAutoClose();
    wireSidebarEscapeClose();

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput ? searchInput.value : '';
            performSearch(searchTerm);
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initSearch);
