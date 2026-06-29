document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    
    const step1Form = document.getElementById('step1Form');
    const step2Form = document.getElementById('step2Form');
    const step3Form = document.getElementById('step3Form');
    
    const indicatorStep1 = document.getElementById('indicator-step1');
    const indicatorStep2 = document.getElementById('indicator-step2');
    const indicatorStep3 = document.getElementById('indicator-step3');
    const indicatorStep4 = document.getElementById('indicator-step4');
    
    const step1Status = document.getElementById('step1Status');
    const step2Status = document.getElementById('step2Status');
    const step3Status = document.getElementById('step3Status');
    const step4Status = document.getElementById('step4Status');

    const authTypeSelect = document.getElementById('authType');
    const authFields = document.querySelectorAll('.auth-field');

    const targetSchemaSelect = document.getElementById('targetSchema');
    const targetTableSelect = document.getElementById('targetTable');
    const primaryKeyInput = document.getElementById('primaryKey');

    let availableDqChecks = [];
    let savedMetadata = {}; 

    // ==========================================
    // TOGGLE AUTH FIELDS
    // ==========================================
    authTypeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'none') {
            authFields.forEach(f => f.style.display = 'none');
        } else {
            authFields.forEach(f => f.style.display = 'block');
        }
    });

    // ==========================================
    // CASCADING DROPDOWNS (TARGET SCHEMA -> TABLE -> PK)
    // ==========================================
    async function loadSchemas() {
        try {
            const response = await fetch('/api/schemas'); 
            const schemas = await response.json();
            
            targetSchemaSelect.innerHTML = '<option value="" disabled selected>Select Schema...</option>';
            schemas.forEach(schema => {
                targetSchemaSelect.innerHTML += `<option value="${schema.schema_name}">${schema.schema_name}</option>`;
            });
        } catch (error) {
            console.error("Failed to load schemas:", error);
            targetSchemaSelect.innerHTML = '<option value="" disabled>Error loading schemas</option>';
        }
    }
    
    loadSchemas();

    targetSchemaSelect.addEventListener('change', async (e) => {
        const selectedSchema = e.target.value;
        
        targetTableSelect.innerHTML = '<option value="" disabled selected>Loading tables...</option>';
        targetTableSelect.disabled = true;
        targetTableSelect.style.backgroundColor = "#f8f9fa";

        try {
            const response = await fetch(`/api/tables?schemaName=${selectedSchema}`);
            const tables = await response.json();
            
            targetTableSelect.innerHTML = '<option value="" disabled selected>Select Table...</option>';
            
            if (tables.length === 0) {
                targetTableSelect.innerHTML = '<option value="" disabled>No tables found in this schema</option>';
            } else {
                tables.forEach(table => {
                    targetTableSelect.innerHTML += `<option value="${table.table_name}">${table.table_name}</option>`;
                });
                targetTableSelect.disabled = false;
                targetTableSelect.style.backgroundColor = "#ffffff"; 
            }
        } catch (error) {
            console.error("Failed to load tables:", error);
            targetTableSelect.innerHTML = '<option value="" disabled>Error loading tables</option>';
        }
    });

    targetTableSelect.addEventListener('change', async (e) => {
        const selectedTable = e.target.value;
        const selectedSchema = targetSchemaSelect.value;
        
        primaryKeyInput.value = "Fetching PK from database...";
        primaryKeyInput.style.backgroundColor = "#e9ecef";
        primaryKeyInput.readOnly = true;

        try {
            const response = await fetch(`/api/primary-key?schemaName=${selectedSchema}&tableName=${selectedTable}`);
            const data = await response.json();
            
            if (data.primaryKey === "NO_PRIMARY_KEY") {
                primaryKeyInput.value = "";
                primaryKeyInput.placeholder = "No PK found in DB. Enter manually...";
                primaryKeyInput.readOnly = false; 
                primaryKeyInput.style.backgroundColor = "#ffffff";
                primaryKeyInput.style.cursor = "text";
                primaryKeyInput.style.color = "#2b2b2b";
            } else {
                primaryKeyInput.value = data.primaryKey;
                primaryKeyInput.readOnly = true;
                primaryKeyInput.style.backgroundColor = "#e9ecef";
                primaryKeyInput.style.cursor = "not-allowed";
                primaryKeyInput.style.color = "#0056b3";
            }
        } catch (error) {
            console.error("Failed to load PK:", error);
            primaryKeyInput.value = "Error fetching PK";
        }
    });


    // ==========================================
    // API: TEST CONNECTION
    // ==========================================
    document.getElementById('testConnectionBtn').addEventListener('click', async () => {
        const brokers = document.getElementById('kafkaBrokers').value.trim();
        const authType = document.getElementById('authType').value;
        const username = document.getElementById('kafkaUsername').value.trim();
        const password = document.getElementById('kafkaPassword').value;

        if (!brokers) {
            step1Status.textContent = "Please provide Kafka Brokers.";
            step1Status.style.color = "#dc3545";
            return;
        }

        step1Status.textContent = "Testing connection...";
        step1Status.style.color = "#0056b3";

        try {
            const response = await fetch('/api/test-kafka-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brokers, authType, username, password })
            });

            const data = await response.json();
            if (response.ok) {
                step1Status.textContent = "Connection Successful! ✅";
                step1Status.style.color = "#28a745";
            } else {
                step1Status.textContent = data.error || "Connection Failed ❌";
                step1Status.style.color = "#dc3545";
            }
        } catch (err) {
            step1Status.textContent = "Network error: " + err.message;
            step1Status.style.color = "#dc3545";
        }
    });

    // ==========================================
    // LOGIC: STEP 1 -> STEP 2
    // ==========================================
    step1Form.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        indicatorStep1.classList.remove('active');
        indicatorStep1.classList.add('completed');
        indicatorStep2.classList.add('active');
    });

    // ==========================================
    // API: FETCH FIELDS
    // ==========================================
    document.getElementById('fetchFieldsBtn').addEventListener('click', async () => {
        const brokers = document.getElementById('kafkaBrokers').value.trim();
        const authType = document.getElementById('authType').value;
        const username = document.getElementById('kafkaUsername').value.trim();
        const password = document.getElementById('kafkaPassword').value;
        const topicName = document.getElementById('topicName').value.trim();
        const format = document.getElementById('messageFormat').value;

        if (!topicName) {
            step2Status.textContent = "Please enter a Topic Name first.";
            step2Status.style.color = "#dc3545";
            return;
        }

        step2Status.textContent = "Connecting to Kafka and fetching latest fields...";
        step2Status.style.color = "#0056b3";

        try {
            const response = await fetch('/api/fetch-kafka-fields', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brokers, authType, username, password, topicName, format })
            });

            const data = await response.json();
            if (response.ok) {
                document.getElementById('sourceFields').value = data.columns.join(', ');
                document.getElementById('sourceFieldsContainer').style.display = 'block';
                step2Status.textContent = "Successfully fetched fields ✅";
                step2Status.style.color = "#28a745";
            } else {
                document.getElementById('sourceFieldsContainer').style.display = 'block';
                step2Status.textContent = (data.error || "Failed to fetch fields") + " - Please enter fields manually.";
                step2Status.style.color = "#dc3545";
            }
        } catch (err) {
            document.getElementById('sourceFieldsContainer').style.display = 'block';
            step2Status.textContent = "Network error: " + err.message + " - Please enter fields manually.";
            step2Status.style.color = "#dc3545";
        }
    });

    // ==========================================
    // LOGIC: STEP 2 -> STEP 3
    // ==========================================
    step2Form.addEventListener('submit', (e) => {
        e.preventDefault(); 

        const sourceFieldsInput = document.getElementById('sourceFields');
        const fieldsErrorText = document.getElementById('fieldsError');
        const isValidCommaList = /^[a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)*$/.test(sourceFieldsInput.value.trim());

        if (!isValidCommaList) {
            sourceFieldsInput.classList.add('input-error');
            fieldsErrorText.style.display = 'block';
            step2Status.textContent = "Please fix the format of the fields before proceeding.";
            step2Status.style.color = "#dc3545";
            return;
        } else {
            sourceFieldsInput.classList.remove('input-error');
            fieldsErrorText.style.display = 'none';
            step2Status.textContent = "";
        }

        // Proceed straight to Step 3
        step2.style.display = 'none';
        step3.style.display = 'block';
        
        indicatorStep2.classList.remove('active');
        indicatorStep2.classList.add('completed');
        indicatorStep3.classList.add('active');
    });

    // ==========================================
    // LOGIC: STEP 3 -> STEP 4 (OR SAVE DIRECTLY)
    // ==========================================
    step3Form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Gather all inputs from previous steps
        savedMetadata = {
            source_system_name: document.getElementById('sourceSystem').value.trim(),
            topic_name: document.getElementById('topicName').value.trim(),
            message_format: document.getElementById('messageFormat').value,
            source_fields: document.getElementById('sourceFields').value.trim(),
            target_table_schema: document.getElementById('targetSchema').value,
            target_table_name: document.getElementById('targetTable').value,
            primary_key_column: document.getElementById('primaryKey').value.trim(),
            dq_enable_flag: document.getElementById('dqEnable').checked
        };

        if (savedMetadata.dq_enable_flag) {
            step3Status.textContent = "Generating Data Quality mapping...";
            step3Status.style.color = "#0056b3";
            
            indicatorStep3.classList.remove('active');
            indicatorStep3.classList.add('completed');
            indicatorStep4.classList.add('active');
            
            await buildStep4WithSourceFields(savedMetadata.source_fields);
        } else {
            document.getElementById('step3ProceedBtn').disabled = true;
            step3Status.textContent = "Saving Kafka pipeline directly to database...";
            step3Status.style.color = "#0056b3";
            await sendFinalPayload(savedMetadata, {}); 
        }
    });

    // ==========================================
    // LOGIC: BACK BUTTONS
    // ==========================================
    document.getElementById('backToStep1Btn').addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
        step2Status.textContent = "";
        indicatorStep2.classList.remove('active');
        indicatorStep1.classList.remove('completed');
        indicatorStep1.classList.add('active');
    });

    document.getElementById('backToStep2Btn').addEventListener('click', () => {
        step3.style.display = 'none';
        step2.style.display = 'block';
        step3Status.textContent = "";
        indicatorStep3.classList.remove('active');
        indicatorStep2.classList.remove('completed');
        indicatorStep2.classList.add('active');
    });

    document.getElementById('backToStep3Btn').addEventListener('click', () => {
        step4.style.display = 'none';
        step3.style.display = 'block';
        step4Status.textContent = "";
        indicatorStep4.classList.remove('active');
        indicatorStep3.classList.remove('completed');
        indicatorStep3.classList.add('active');
    });

    // ==========================================
    // LOGIC: BUILD STEP 4 ACCORDION
    // ==========================================
    async function buildStep4WithSourceFields(commaSeparatedFields) {
        try {
            const response = await fetch('/api/dq-checks');
            availableDqChecks = await response.json();

            const fieldsArray = commaSeparatedFields.split(',').map(f => f.trim()).filter(f => f);
            const dynamicContainer = document.getElementById('dynamicColumnsContainer');
            dynamicContainer.innerHTML = ''; 

            let currentlyExpandedOptions = null;
            let currentlyExpandedIcon = null;

            fieldsArray.forEach(fieldName => {
                let checkboxesHTML = availableDqChecks.map(check => `
                    <label class="styled-checkbox-label" data-dqname="${check.dq_name.toLowerCase()}">
                        <input type="checkbox" value="${check.dq_name}">
                        ${check.dq_name}
                    </label>
                `).join('');

                const row = document.createElement('div');
                row.className = 'column-row';
                
                const header = document.createElement('div');
                header.className = 'column-header';
                
                const badge = document.createElement('span');
                badge.className = 'rule-badge';
                badge.textContent = '0 Rules';

                const colNameDiv = document.createElement('div');
                colNameDiv.className = 'col-name';
                colNameDiv.setAttribute('data-colname', fieldName);
                colNameDiv.textContent = fieldName;
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

            const diagnosticBox = document.createElement('div');
            diagnosticBox.className = 'diagnostic-box';
            diagnosticBox.innerHTML = `
                <div class="diagnostic-icon">ℹ️</div>
                <div>
                    <strong>Pipeline Ready for Validation</strong><br>
                    Configure your data quality assertions above. Once complete, your pipeline will be pre-validated and ready to run.
                </div>
            `;
            dynamicContainer.appendChild(diagnosticBox);

            document.getElementById('displayTableName').textContent = "Parsed from Kafka Message";
            step3.style.display = 'none';
            step4.style.display = 'block';
            step3Status.textContent = "";

        } catch (error) {
            console.error("Error:", error);
            step3Status.textContent = "Error loading DQ rules from server.";
            step3Status.style.color = "#dc3545";
        }
    }

    // ==========================================
    // LOGIC: FINAL SAVE FROM STEP 4
    // ==========================================
    document.getElementById('saveFinalBtn').addEventListener('click', async () => {
        const columnRules = {};
        const rows = document.querySelectorAll('.column-row');
        
        rows.forEach(row => {
            const colName = row.querySelector('.col-name').getAttribute('data-colname');
            const checkedBoxes = row.querySelectorAll('input[type="checkbox"]:checked');
            if (checkedBoxes.length > 0) {
                columnRules[colName] = Array.from(checkedBoxes).map(cb => cb.value);
            }
        });

        if (Object.keys(columnRules).length === 0) {
            step4Status.textContent = "Please select at least one DQ check before saving.";
            step4Status.style.color = "#dc3545";
            return;
        }

        step4Status.textContent = "Saving Kafka pipeline configuration...";
        step4Status.style.color = "#0056b3";
        document.getElementById('saveFinalBtn').disabled = true;

        await sendFinalPayload(savedMetadata, columnRules);
    });

    // ==========================================
    // MAIN API CALL ROUTINE (KAFKA ENDPOINT)
    // ==========================================
    async function sendFinalPayload(metadata, dqRules) {
        const payload = {
            metadata: metadata,
            dq_rules: dqRules 
        };

        try {
            const response = await fetch('/api/kafka-onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const targetStatus = metadata.dq_enable_flag ? step4Status : step3Status;
                targetStatus.textContent = "Success! Kafka configuration saved to database.";
                targetStatus.style.color = "#28a745";
                
                setTimeout(() => window.location.reload(), 2000); 
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            console.error(error);
            const targetStatus = metadata.dq_enable_flag ? step4Status : step3Status;
            targetStatus.textContent = "Error saving configuration.";
            targetStatus.style.color = "#dc3545";
            if (metadata.dq_enable_flag) document.getElementById('saveFinalBtn').disabled = false;
            if (!metadata.dq_enable_flag) document.getElementById('step3ProceedBtn').disabled = false;
        }
    }
});