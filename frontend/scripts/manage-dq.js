document.addEventListener('DOMContentLoaded', () => {
    
    // DOM Elements
    const searchBtn = document.getElementById('searchBtn');
    const searchFileName = document.getElementById('searchFileName');
    const statusMessage = document.getElementById('statusMessage');
    const dqEditorSection = document.getElementById('dqEditorSection');
    const dynamicContainer = document.getElementById('dynamicColumnsContainer');
    const displayTableName = document.getElementById('displayTableName');
    const updateBtn = document.getElementById('updateBtn');

    let currentSrcObjectKey = null;
    let availableDqChecks = [];

    // --- 1. SEARCH LOGIC (Updated to pass existing rules) ---
    searchBtn.addEventListener('click', async () => {
        const fileName = searchFileName.value.trim();
        if (!fileName) {
            statusMessage.textContent = "Please enter a file name.";
            statusMessage.style.color = "#dc3545";
            return;
        }

        statusMessage.textContent = "Searching database...";
        statusMessage.style.color = "#0056b3";

        try {
            // Fetch file metadata AND its existing rules
            const searchRes = await fetch(`http://localhost:5000/api/search-file?fileName=${fileName}`);
            if (!searchRes.ok) throw new Error("File not found in the database.");
            
            const fileData = await searchRes.json();
            currentSrcObjectKey = fileData.src_object_key;
            
            // Extract the existing rules we formatted in the backend
            const existingRules = fileData.existing_rules || {};

            // Fetch target table columns and all available DQ checks
            const [colRes, dqRes] = await Promise.all([
                fetch(`http://localhost:5000/api/columns?fileName=${fileData.tgt_table_name}`),
                fetch(`http://localhost:5000/api/dq-checks`)
            ]);

            const columns = await colRes.json();
            availableDqChecks = await dqRes.json();

            // Pass the existingRules to the accordion builder!
            buildAccordion(columns, fileData.tgt_table_name, existingRules);
            
            statusMessage.textContent = "File metadata loaded successfully.";
            statusMessage.style.color = "#28a745";

        } catch (error) {
            statusMessage.textContent = error.message;
            statusMessage.style.color = "#dc3545";
            dqEditorSection.style.display = 'none';
        }
    });

    // --- 2. RENDER ACCORDION UI (Updated to pre-check boxes) ---
    function buildAccordion(columns, tableName, existingRules) {
        dynamicContainer.innerHTML = ''; 
        displayTableName.textContent = tableName;

        columns.forEach(col => {
            
            // Generate checkboxes, checking if they exist in the database already
            let checkboxesHTML = availableDqChecks.map(check => {
                // Check if this column has rules, AND if this specific rule is in that list
                const isCurrentlyActive = existingRules[col.column_name] && 
                                          existingRules[col.column_name].includes(check.dq_name);
                
                // If it is active, add the 'checked' attribute to the HTML element
                const checkedAttribute = isCurrentlyActive ? 'checked' : '';
                
                return `
                    <label class="checkbox-label" style="${isCurrentlyActive ? 'border-color: #0056b3; background: #f0f7ff;' : ''}">
                        <input type="checkbox" value="${check.dq_name}" ${checkedAttribute}>
                        ${check.dq_name}
                    </label>
                `;
            }).join('');

            const row = document.createElement('div');
            row.className = 'column-row';
            
            const header = document.createElement('div');
            header.className = 'column-header';
            
            // Minor UI tweak: If a column has existing rules, show a little badge indicating it
            const activeCount = existingRules[col.column_name] ? existingRules[col.column_name].length : 0;
            const badgeHTML = activeCount > 0 ? `<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 10px;">${activeCount} Active</span>` : '';

            header.innerHTML = `
                <div class="col-name" data-colname="${col.column_name}">
                    ${col.column_name} ${badgeHTML} <br>
                    <span class="col-meta" style="margin-top: 4px;">Type: ${col.data_type}</span>
                </div>
                <div class="toggle-icon">+</div>
            `;

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'dq-options';
            optionsContainer.innerHTML = checkboxesHTML;

            header.addEventListener('click', () => {
                const isExpanded = optionsContainer.classList.toggle('expanded');
                header.querySelector('.toggle-icon').textContent = isExpanded ? '−' : '+';
            });

            row.appendChild(header);
            row.appendChild(optionsContainer);
            dynamicContainer.appendChild(row);
        });

        dqEditorSection.style.display = 'block';
    }

    // --- 3. UPDATE LOGIC (Updated with Popup) ---
    updateBtn.addEventListener('click', async () => {
        const columnRules = {};
        const rows = document.querySelectorAll('.column-row');
        
        rows.forEach(row => {
            const colName = row.querySelector('.col-name').getAttribute('data-colname');
            const checkedBoxes = row.querySelectorAll('input[type="checkbox"]:checked');
            if (checkedBoxes.length > 0) {
                columnRules[colName] = Array.from(checkedBoxes).map(cb => cb.value);
            }
        });

        updateBtn.textContent = "Updating Database...";
        updateBtn.disabled = true;

        const payload = {
            src_object_key: currentSrcObjectKey,
            dq_rules: columnRules
        };

        try {
            const response = await fetch('http://localhost:5000/api/update-dq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // 1. Clear any old loading text
                statusMessage.textContent = "";
                
                // 2. Trigger the Success Modal
                showSuccessPopup("Data Quality Rules successfully updated!");

                // 3. THE FIX: Wait exactly 3 seconds (3000ms), then refresh the page
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
                
            } else {
                throw new Error("Failed to save rules");
            }
        } catch (error) {
            statusMessage.textContent = "Error saving updates to the database.";
            statusMessage.style.color = "#dc3545";
            updateBtn.textContent = "Save Updated DQ Rules";
            updateBtn.disabled = false;
        }
    });

    // --- 4. POPUP GENERATOR FUNCTION ---
    function showSuccessPopup(message) {
        let overlay = document.getElementById('successOverlay');
        
        // If it doesn't exist yet, build the HTML structure on the fly
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'successOverlay';
            overlay.className = 'modal-overlay';
            
            const modal = document.createElement('div');
            modal.className = 'success-modal';
            
            // Using a sleek, professional SVG icon instead of a basic emoji
            modal.innerHTML = `
                <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h3>Success!</h3>
                <p>${message}</p>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        } else {
            // If it exists, just update the message
            overlay.querySelector('p').textContent = message;
        }
        
        // Slight delay ensures the CSS transition triggers properly
        setTimeout(() => {
            overlay.classList.add('show');
        }, 200);
    }
});