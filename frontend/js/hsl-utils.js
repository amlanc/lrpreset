/**
 * HSL Utilities Module
 * Handles HSL data display and manipulation
 */

/**
 * Populates the HSL tab with color adjustments
 * @param {string} tabId - ID of the tab
 * @param {Object} hslData - HSL data with color adjustments
 */
function populateHSLTab(tabId, hslData) {
    const tbody = document.querySelector(`#${tabId} tbody`);
    if (!tbody) {
        console.error(`[Preset] HSL tab content element not found: ${tabId}`);
        return;
    }

    tbody.innerHTML = ''; // Clear existing content

    // Define color order and their display names
    const colorOrder = [
        { key: 'red', label: 'Red' },
        { key: 'orange', label: 'Orange' },
        { key: 'yellow', label: 'Yellow' },
        { key: 'green', label: 'Green' },
        { key: 'aqua', label: 'Aqua' },
        { key: 'blue', label: 'Blue' },
        { key: 'purple', label: 'Purple' },
        { key: 'magenta', label: 'Magenta' }
    ];

    // Create header row for HSL columns
    const headerRow = document.createElement('tr');
    headerRow.className = 'hsl-header-row';
    
    // Color name column header
    const colorHeader = document.createElement('th');
    colorHeader.textContent = 'Color';
    headerRow.appendChild(colorHeader);
    
    // HSL component headers
    const hslHeaders = ['Hue', 'Saturation', 'Luminance'];
    hslHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    tbody.appendChild(headerRow);

    // Add rows for each color
    colorOrder.forEach(({ key, label }) => {
        const colorData = hslData[key] || {};
        const row = document.createElement('tr');
        
        // Color name cell
        const colorCell = document.createElement('td');
        colorCell.textContent = label;
        row.appendChild(colorCell);
        
        // HSL value cells
        ['hue', 'saturation', 'luminance'].forEach(component => {
            const cell = document.createElement('td');
            cell.textContent = window.utils.formatValue(colorData[component] || 0);
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
}

// Export functions for use in other modules
window.hslUtils = {
    populateHSLTab
};
