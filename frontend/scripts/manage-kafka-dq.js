document.addEventListener('DOMContentLoaded', () => {
    
    // DOM Elements
    const searchBtn = document.getElementById('searchBtn');
    // NOTE: Make sure your HTML input has id="searchTopicName" instead of searchFileName!
    const searchTopicName = document.getElementById('searchTopicName'); 
    const statusMessage = document.getElementById('statusMessage');
    const dqEditorSection = document.getElementById('dqEditorSection');
    const dynamicContainer = document.getElementById('dynamicColumnsContainer');
    const displayTableName = document.getElementById('displayTableName');
    const updateBtn = document.getElementById('updateBtn');

    let currentSrcObjectKey = null;
    let availableDqChecks = [];

    // --- 1. SEARCH LOGIC (Kafka Topics) ---
    searchBtn.addEventListener('click', async () => {
        const topicName = searchTopicName.value.trim();
        if (!topicName) {
            statusMessage.textContent = "Please enter a Kafka topic name.";
            statusMessage.style.color = "#dc3545";
            return;
        }

        statusMessage.textContent = "Searching database...";
        statusMessage.style.color = "#0056b3";

        try {
            // Fetch topic metadata AND its existing rules using the new route
            const searchRes = await fetch(`/api/search-topic?topicName=${topicName}`);
            if (!searchRes.ok) throw new Error("Topic not found in the database.");
            
            const topicData = await searchRes.json();
            currentSrcObjectKey = topicData.src_object_key;
            
            // Extract the existing rules we formatted in the backend
            const existingRules = topicData.existing_rules || {};

            // Fetch target table columns and all available DQ checks
            // (Assuming your column API still expects the parameter to be called fileName)
            const [colRes, dqRes] = await Promise.all([
                fetch(`/api/columns?fileName=${topicData.tgt_table_name}`),
                fetch(`/api/dq-checks`)
            ]);

            const columns = await colRes.json();
            availableDqChecks = await dqRes.json();

            // Pass the existingRules to the accordion builder!
            buildAccordion(columns, topicData.tgt_table_name, existingRules);
            
            statusMessage.textContent = "Topic metadata loaded successfully.";
            statusMessage.style.color = "#28a745";

        } catch (error) {
            statusMessage.textContent = error.message;
            statusMessage.style.color = "#dc3545";
            dqEditorSection.style.display = 'none';
        }
    });

    // --- 2. RENDER ACCORDION UI ---
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

    // --- 3. UPDATE LOGIC (Updated to Kafka Route) ---
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
            // UPDATED to the Kafka specific route
            const response = await fetch('/api/update-kafka-dq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                statusMessage.textContent = "";
                showSuccessPopup("Kafka Data Quality Rules successfully updated!");

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
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'successOverlay';
            overlay.className = 'modal-overlay';
            
            const modal = document.createElement('div');
            modal.className = 'success-modal';
            
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
            overlay.querySelector('p').textContent = message;
        }
        
        setTimeout(() => {
            overlay.classList.add('show');
        }, 200);
    }
});