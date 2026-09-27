// Page Navigation
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(`${pageId}-page`).classList.add('active');
}

// Make SWOT list items editable
document.querySelectorAll('#strengths-list li, #weaknesses-list li, #opportunities-list li, #threats-list li').forEach(item => {
    item.setAttribute('contenteditable', 'true');
});

// Initialize with status page
showPage('status');