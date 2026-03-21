/**
 * Search functionality for receipts and vouchers
 * Integrates with Supabase to search across tables
 */

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
    });

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
