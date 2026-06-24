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

        let currentlyExpandedOptions = null;
        let currentlyExpandedIcon = null;

        columns.forEach(col => {
            
            let checkboxesHTML = availableDqChecks.map(check => {
                const isCurrentlyActive = existingRules[col.column_name] && 
                                          existingRules[col.column_name].includes(check.dq_name);
                
                const checkedAttribute = isCurrentlyActive ? 'checked' : '';
                
                return `
                    <label class="styled-checkbox-label" data-dqname="${check.dq_name.toLowerCase()}">
                        <input type="checkbox" value="${check.dq_name}" ${checkedAttribute}>
                        ${check.dq_name}
                    </label>
                `;
            }).join('');

            const row = document.createElement('div');
            row.className = 'column-row';
            
            const header = document.createElement('div');
            header.className = 'column-header';
            
            const activeCount = existingRules[col.column_name] ? existingRules[col.column_name].length : 0;
            
            const badge = document.createElement('span');
            badge.className = 'rule-badge';
            badge.textContent = `${activeCount} Rule${activeCount !== 1 ? 's' : ''}`;
            if (activeCount > 0) {
                badge.classList.add('active');
            }

            const colNameDiv = document.createElement('div');
            colNameDiv.className = 'col-name';
            colNameDiv.setAttribute('data-colname', col.column_name);
            colNameDiv.innerHTML = `
                ${col.column_name}
                <span class="col-meta" style="margin-top: 0;">Type: ${col.data_type}</span>
            `;
            colNameDiv.appendChild(badge);

            const toggleIcon = document.createElement('div');
            toggleIcon.className = 'toggle-icon';
            toggleIcon.textContent = '+';
            toggleIcon.style.transition = 'transform 0.3s ease';

            header.appendChild(colNameDiv);
            header.appendChild(toggleIcon);

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'dq-options';
            optionsContainer.innerHTML = `
                <input type="text" class="dq-search-input" placeholder="Search Data Quality rules...">
                <div class="dq-checkbox-list">
                    ${checkboxesHTML}
                </div>
            `;

            const searchInput = optionsContainer.querySelector('.dq-search-input');
            const checkboxList = optionsContainer.querySelector('.dq-checkbox-list');
            const allLabels = checkboxList.querySelectorAll('.styled-checkbox-label');

            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                allLabels.forEach(label => {
                    const ruleName = label.getAttribute('data-dqname');
                    if (ruleName.includes(query)) {
                        label.style.display = 'flex';
                    } else {
                        label.style.display = 'none';
                    }
                });
            });

            const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const checkedCount = optionsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
                    badge.textContent = `${checkedCount} Rule${checkedCount !== 1 ? 's' : ''}`;
                    if (checkedCount > 0) {
                        badge.classList.add('active');
                    } else {
                        badge.classList.remove('active');
                    }
                });
            });

            header.addEventListener('click', () => {
                const isExpanded = optionsContainer.classList.contains('expanded');
                
                if (currentlyExpandedOptions && currentlyExpandedOptions !== optionsContainer) {
                    currentlyExpandedOptions.classList.remove('expanded');
                    if (currentlyExpandedIcon) currentlyExpandedIcon.style.transform = 'rotate(0deg)';
                }

                if (isExpanded) {
                    optionsContainer.classList.remove('expanded');
                    toggleIcon.style.transform = 'rotate(0deg)';
                    currentlyExpandedOptions = null;
                    currentlyExpandedIcon = null;
                } else {
                    optionsContainer.classList.add('expanded');
                    toggleIcon.style.transform = 'rotate(45deg)';
                    currentlyExpandedOptions = optionsContainer;
                    currentlyExpandedIcon = toggleIcon;
                }
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