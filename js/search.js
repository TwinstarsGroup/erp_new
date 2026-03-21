/**
 * Final search.js for Twinstar Group ERP
 * Searches Receipts, Cash Vouchers, and pulls Public URLs from Attachments
 */

// 1. Core Search Function
async function performSearch(searchTerm) {
    const term = searchTerm ? searchTerm.toString().trim() : '';
    
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    const resultsDiv = document.getElementById('results');
    // Show loading state
    resultsDiv.innerHTML = `
        <div class="empty-state" style="padding:60px;">
            <div class="spinner" style="margin-bottom:20px;"></div>
            <p style="color:#64748b;">Searching database for "${term}"...</p>
        </div>`;

    try {
        // Search Receipts
        const { data: receipts, error: rError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${term}%`);

        if (rError) throw rError;

        // Search Cash Vouchers
        const { data: vouchers, error: vError } = await supabaseClient
            .from('cash_vouchers')
            .select('*')
            .ilike('voucher_number', `%${term}%`);

        if (vError) throw vError;

        // Combine and normalize results
        const combined = [
            ...(receipts || []).map(r => ({ 
                ...r, type: 'Receipt', display_no: r.receipt_number, amt: r.total 
            })),
            ...(vouchers || []).map(v => ({ 
                ...v, type: 'Voucher', display_no: v.voucher_number, amt: v.amount 
            }))
        ];

        displayResults(combined);

    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed: ' + error.message, 'error');
        resultsDiv.innerHTML = '<div class="empty-state"><p>Error connecting to database.</p></div>';
    }
}

// 2. Fetch Attachments using the exact column names from your DB
async function getAttachments(type, recordNumber) {
    try {
        // Map search to the correct column in the attachments table
        const searchColumn = type === 'Receipt' ? 'receipt_number' : 'voucher_number';
        
        const { data, error } = await supabaseClient
            .from('attachments')
            .select('name, public_url') // Fetching the public URL
            .eq(searchColumn, recordNumber);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Attachment error:', err);
        return [];
    }
}

// 3. Render Results Table
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="empty-state" style="padding:60px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>No records found</h3>
                <p>Check the number and try again.</p>
            </div>`;
        return;
    }

    resultsDiv.innerHTML = `
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th>TYPE</th>
                    <th>NUMBER</th>
                    <th>AMOUNT</th>
                    <th>DATE</th>
                    <th>FILES</th>
                    <th style="text-align:right;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(item => {
                    // Create a sanitized ID for the file container
                    const safeId = item.display_no.replace(/[^a-zA-Z0-9]/g, '');
                    return `
                    <tr>
                        <td><span class="badge ${item.type.toLowerCase()}" style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600;">${item.type}</span></td>
                        <td style="font-weight:600; color:#800020;">${item.display_no}</td>
                        <td>${formatCurrency(item.amt)}</td>
                        <td>${formatDate(item.date || item.created_at)}</td>
                        <td>
                            <div id="file-link-${safeId}" style="font-size:12px; color:#94a3b8;">
                                Checking...
                            </div>
                        </td>
                        <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
                            <button class="btn btn-sm btn-outline" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}'">View</button>
                            <button class="btn btn-sm btn-primary" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}&download=true'">Download</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>`;

    // 4. Async Load Files for each row
    results.forEach(async (item) => {
        const safeId = item.display_no.replace(/[^a-zA-Z0-9]/g, '');
        const files = await getAttachments(item.type, item.display_no);
        const container = document.getElementById(`file-link-${safeId}`);
        
        if (container) {
            if (files && files.length > 0) {
                container.innerHTML = files.map(f => `
                    <a href="${f.public_url}" target="_blank" style="color:#800020; font-weight:600; text-decoration:none; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        ${f.name || 'View File'}
                    </a>
                `).join('');
            } else {
                container.innerHTML = '<span style="color:#cbd5e1;">None</span>';
            }
        }
    });
}

// 5. Page Initialization
function initSearch() {
    if (typeof setActiveNav === 'function') setActiveNav();
    if (typeof wireSidebarAutoClose === 'function') wireSidebarAutoClose();

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            const input = document.getElementById('searchInput');
            if (input) performSearch(input.value);
        });
    }
}

document.addEventListener('DOMContentLoaded', initSearch);



/**
 * Search functionality for Twinstar Group ERP
 * Searches Receipts, Cash Vouchers, and associated Attachments
 

// 1. Core Search Function
async function performSearch(searchTerm) {
    const term = searchTerm ? searchTerm.toString().trim() : '';
    
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    const resultsDiv = document.getElementById('results');
    // Show searching state
    resultsDiv.innerHTML = `
        <div class="empty-state" style="padding:60px;">
            <div class="spinner" style="margin-bottom:20px;"></div>
            <p style="color:#64748b;">Searching database for "${term}"...</p>
        </div>`;

    try {
        // A. Search in 'receipts' table
        const { data: receipts, error: rError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${term}%`);

        if (rError) throw rError;

        // B. Search in 'cash_vouchers' table
        const { data: vouchers, error: vError } = await supabaseClient
            .from('cash_vouchers')
            .select('*')
            .ilike('voucher_number', `%${term}%`);

        if (vError) throw vError;

        // C. Combine and normalize results
        const combined = [
            ...(receipts || []).map(r => ({ 
                ...r, type: 'Receipt', display_no: r.receipt_number, amt: r.total 
            })),
            ...(vouchers || []).map(v => ({ 
                ...v, type: 'Voucher', display_no: v.voucher_number, amt: v.amount 
            }))
        ];

        displayResults(combined);

    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed: ' + error.message, 'error');
        resultsDiv.innerHTML = '<div class="empty-state"><p>Error connecting to database.</p></div>';
    }
}

// 1. Fetch Attachments using receipt_number or voucher_number
async function getAttachments(type, recordNumber) {
    try {
        const column = type === 'Receipt' ? 'receipt_number' : 'voucher_number'; //
        
        const { data, error } = await supabaseClient
            .from('attachments') //
            .select('*')
            .eq(column, recordNumber); // Matches the 'RCP-TSE...' or 'CVR-TSE...' string

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Attachment fetch error:', err);
        return [];
    }
}

// 2. Updated Display Logic for Attachments
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    // ... (rest of table header code remains same as previous full version)

    // Inside the results.map loop:
    // Change the ID of the file container to use the display number
    /*
    <td>
        <div id="attach-list-${item.display_no}" style="font-size:12px;">
            Loading...
        </div>
    </td>
    */

    // 3. Post-render: Load files using the record number
    results.forEach(async (item) => {
        const files = await getAttachments(item.type, item.display_no); //
        const container = document.getElementById(`attach-list-${item.display_no}`);
        
        if (files && files.length > 0) {
            container.innerHTML = files.map(f => `
                <a href="${f.public_url}" target="_blank" style="color:#800020; text-decoration:underline; display:block; margin-bottom:4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    ${f.name || 'View File'}
                </a>
            `).join('');
        } else {
            container.innerHTML = '<span style="color:#cbd5e1;">No files</span>';
        }
    });
}

// 3. Render Results Table
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="empty-state" style="padding:60px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>No records found</h3>
                <p>Check the number and try again.</p>
            </div>`;
        return;
    }

    resultsDiv.innerHTML = `
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Number</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Files</th>
                    <th style="text-align:right;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(item => `
                    <tr>
                        <td><span class="badge ${item.type.toLowerCase()}" style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600;">${item.type}</span></td>
                        <td style="font-weight:600; color:#800020;">${item.display_no}</td>
                        <td>${formatCurrency(item.amt)}</td>
                        <td>${formatDate(item.date || item.created_at)}</td>
                        <td>
                            <div id="attach-list-${item.id}" style="font-size:12px; color:#94a3b8;">
                                Loading files...
                            </div>
                        </td>
                        <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
                            <button class="btn btn-sm btn-outline" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}'">View</button>
                            <button class="btn btn-sm btn-primary" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}&download=true'">Download</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;

    // 4. Post-render: Load Attachments for each row
    results.forEach(async (item) => {
        const files = await getAttachments(item.id);
        const container = document.getElementById(`attach-list-${item.id}`);
        
        if (files && files.length > 0) {
            container.innerHTML = files.map(f => `
                <a href="${f.file_url}" target="_blank" style="color:#800020; text-decoration:underline; display:block;">
                    ${f.file_name || 'View Attachment'}
                </a>
            `).join('');
        } else {
            container.innerHTML = '<span style="color:#cbd5e1;">None</span>';
        }
    });
}

// 5. Page Initialization
function initSearch() {
    // Standard Sidebar/UI logic
    if (typeof setActiveNav === 'function') setActiveNav();
    if (typeof wireSidebarAutoClose === 'function') wireSidebarAutoClose();

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Stop page reload
            const input = document.getElementById('searchInput');
            if (input) performSearch(input.value);
        });
    }
}

// Listen for DOM ready
document.addEventListener('DOMContentLoaded', initSearch);


/**
 * Search functionality for receipts and cash_vouchers
 

// 1. Core Search Function
async function performSearch(searchTerm) {
    const term = searchTerm ? searchTerm.toString().trim() : '';
    
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    // Update UI to show searching state
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div style="padding:40px; text-align:center;"><div class="spinner"></div><p>Searching database...</p></div>';

    try {
        // Search in 'receipts' table
        const { data: receipts, error: rError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${term}%`);

        if (rError) throw rError;

        // Search in 'cash_vouchers' table (Ensure name matches your Supabase)
        const { data: vouchers, error: vError } = await supabaseClient
            .from('cash_vouchers')
            .select('*')
            .ilike('voucher_number', `%${term}%`);

        if (vError) throw vError;

        // Combine and format for display
        const combined = [
            ...(receipts || []).map(r => ({ 
                ...r, type: 'Receipt', display_no: r.receipt_number, amt: r.total 
            })),
            ...(vouchers || []).map(v => ({ 
                ...v, type: 'Voucher', display_no: v.voucher_number, amt: v.amount 
            }))
        ];

        displayResults(combined);
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed: ' + error.message, 'error');
        resultsDiv.innerHTML = '<div class="empty-state"><p>Error connecting to database.</p></div>';
    }
}

// 2. Display Results with View/Download Buttons
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state" style="padding:40px;"><p>No records found matching that number.</p></div>';
        return;
    }

    resultsDiv.innerHTML = `
    <div class="table-container">
        <table class="table">
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
                        <td><span class="badge ${item.type.toLowerCase()}" style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600;">${item.type}</span></td>
                        <td style="font-weight:600;">${item.display_no}</td>
                        <td>${formatCurrency(item.amt)}</td>
                        <td>${formatDate(item.date || item.created_at)}</td>
                        <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
                            <button class="btn btn-sm btn-outline" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}'">View</button>
                            <button class="btn btn-sm btn-primary" onclick="location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}&download=true'">Download</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// 3. Form Initialization
function initSearch() {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        // Intercept form submission
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            const input = document.getElementById('searchInput');
            performSearch(input ? input.value : '');
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initSearch);


/**
 * Search functionality for receipts and cash_vouchers
 * Integrates with Supabase to search across tables
 

// Perform search across receipts and cash_vouchers
async function performSearch(searchTerm) {
    // Sanitize input to prevent errors if empty
    const term = searchTerm ? searchTerm.toString().trim() : '';
    
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }

    // Show loading state in the results div
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="empty-state" style="padding:40px;">
            <div class="spinner" style="margin-bottom:15px;"></div>
            <p>Searching database for "${term}"...</p>
        </div>`;

    try {
        // 1. Search in receipts table (matches receipt_number)
        const { data: receipts, error: receiptsError } = await supabaseClient
            .from('receipts')
            .select('*')
            .ilike('receipt_number', `%${term}%`);

        if (receiptsError) throw receiptsError;

        // 2. Search in cash_vouchers table (matches voucher_number)
        const { data: vouchers, error: vouchersError } = await supabaseClient
            .from('cash_vouchers')
            .select('*')
            .ilike('voucher_number', `%${term}%`);

        if (vouchersError) throw vouchersError;

        // 3. Combine and Normalize Results for the UI
        const combinedResults = [
            ...(receipts || []).map(r => ({ 
                ...r, 
                type: 'Receipt', 
                display_no: r.receipt_number, 
                display_amt: r.total // Receipts use 'total'
            })),
            ...(vouchers || []).map(v => ({ 
                ...v, 
                type: 'Voucher', 
                display_no: v.voucher_number, 
                display_amt: v.amount // Vouchers use 'amount'
            }))
        ];

        displayResults(combinedResults);

        if (combinedResults.length === 0) {
            showToast('No records found matching that number.', 'info');
        } else {
            showToast(`Found ${combinedResults.length} result(s)`, 'success');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Error: ' + error.message, 'error');
        resultsDiv.innerHTML = '<div class="empty-state"><p>Error performing search.</p></div>';
    }
}

// Display search results in a clean table with action buttons
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="empty-state" style="padding:40px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>No results found</h3>
                <p>Try searching for a different receipt or voucher number.</p>
            </div>`;
        return;
    }

    // Build the results table
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
                        <td>
                            <span class="badge ${item.type.toLowerCase()}" style="padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">
                                ${item.type}
                            </span>
                        </td>
                        <td style="font-weight:600; color:#800020;">${item.display_no}</td>
                        <td>${formatCurrency(item.display_amt)}</td>
                        <td>${formatDate(item.date || item.created_at)}</td>
                        <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
                            <button class="btn btn-sm btn-outline" 
                                onclick="window.location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}'">
                                View
                            </button>
                            <button class="btn btn-sm btn-primary" 
                                onclick="window.location.href='${item.type === 'Receipt' ? 'receipts.html' : 'vouchers.html'}?id=${item.id}&download=true'">
                                Download
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}

// Initialize search page
function initSearch() {
    // Standard UI setup
    if (typeof setActiveNav === 'function') setActiveNav();
    if (typeof wireSidebarAutoClose === 'function') wireSidebarAutoClose();

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Grabs the input value from the main search box
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput ? searchInput.value : '';
            performSearch(searchTerm);
        });
    }
}

// Start initialization when the DOM is ready
document.addEventListener('DOMContentLoaded', initSearch);


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
    });


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


// Function to handle View/Download actions
function handleAction(type, id, action) {
    // Maps 'Receipt' to 'receipts.html' and 'Voucher' to 'vouchers.html'
    const page = type === 'Receipt' ? 'receipts.html' : 'vouchers.html';
    
    // Redirects with parameters so the target page knows what to load
    window.location.href = `${page}?id=${id}&mode=${action}`;
}

// Updated Display Logic to include buttons
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state"><p>No results found.</p></div>';
        return;
    }

    resultsDiv.innerHTML = `
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Number</th>
                    <th>Date</th>
                    <th style="text-align:right;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(item => `
                    <tr>
                        <td><span class="badge ${item.type.toLowerCase()}">${item.type}</span></td>
                        <td style="font-weight:600;">${item.type === 'Receipt' ? item.receipt_number : item.voucher_number}</td>
                        <td>${formatDate(item.date || item.created_at)}</td>
                        <td style="text-align:right;">
                            <button class="btn btn-sm btn-outline" onclick="handleAction('${item.type}', '${item.id}', 'view')">View</button>
                            <button class="btn btn-sm btn-primary" onclick="handleAction('${item.type}', '${item.id}', 'download')">Download</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
}
*/
