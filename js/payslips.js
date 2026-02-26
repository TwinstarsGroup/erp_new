// Update the PDF generation script in js/payslips.js to change the footer layout and disclaimer placement

// Constants
const companyName = getCompanyName();
const address = document.getElementById('company-address') ? document.getElementById('company-address').innerText : '';
const email = document.getElementById('company-email') ? document.getElementById('company-email').innerText : '';

// Function to generate PDF
function generatePDF() {
    // ... existing PDF generation code ...

    // Footer content