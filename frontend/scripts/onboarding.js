document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    
    const step1Form = document.getElementById('step1Form');
    const step2Form = document.getElementById('step2Form');
    
    const indicatorStep1 = document.getElementById('indicator-step1');
    const indicatorStep2 = document.getElementById('indicator-step2');
    const indicatorStep3 = document.getElementById('indicator-step3');
    
    const step1Status = document.getElementById('step1Status');
    const step2Status = document.getElementById('step2Status');
    const step3Status = document.getElementById('step3Status');

    const targetSchemaSelect = document.getElementById('targetSchema');
    const targetTableSelect = document.getElementById('targetTable');
    const primaryKeyInput = document.getElementById('primaryKey');

    let availableDqChecks = [];
    let savedMetadata = {}; 

    // ==========================================
    // CASCADING DROPDOWNS (TARGET SCHEMA -> TABLE -> PK)
    // ==========================================
    async function loadSchemas() {
        try {
            const response = await fetch('/api/schemas'); // Updated to relative path
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
    // LOGIC: STEP 1 -> DIRECTORY POPUP -> STEP 2
    // ==========================================
    step1Form.addEventListener('submit', (e) => {
        e.preventDefault(); 

        const sourceFieldsInput = document.getElementById('sourceFields');
        const fieldsErrorText = document.getElementById('fieldsError');
        const isValidCommaList = /^[a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)*$/.test(sourceFieldsInput.value.trim());

        if (!isValidCommaList) {
            sourceFieldsInput.classList.add('input-error');
            fieldsErrorText.style.display = 'block';
            step1Status.textContent = "Please fix the format of the fields before proceeding.";
            step1Status.style.color = "#dc3545";
            return;
        } else {
            sourceFieldsInput.classList.remove('input-error');
            fieldsErrorText.style.display = 'none';
            step1Status.textContent = "";
        }

        // Generate the mandatory directory path
        const sysName = document.getElementById('sourceSystem').value.trim().toLowerCase();
        const generatedDir = `/data/landing/${sysName}`;
        
        // Show Modal
        document.getElementById('displayDirectory').textContent = generatedDir;
        document.getElementById('directoryModal').classList.add('show');
        
        savedMetadata.temp_source_dir = generatedDir;
    });

    document.getElementById('confirmDirectoryBtn').addEventListener('click', () => {
        document.getElementById('directoryModal').classList.remove('show');
        
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        indicatorStep1.classList.remove('active');
        indicatorStep1.classList.add('completed');
        indicatorStep2.classList.add('active');
    });

    // ==========================================
    // LOGIC: STEP 2 -> STEP 3 (OR SAVE DIRECTLY)
    // ==========================================
    step2Form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let rawFileName = document.getElementById('sourceFile').value.trim();
        rawFileName = rawFileName.replace(/\.[^/.]+$/, ""); 
        const selectedExtension = document.getElementById('sourceExtension').value;

        // Gather all inputs from Step 1 and Step 2
        savedMetadata = {
            source_system_name: document.getElementById('sourceSystem').value.trim(),
            source_file_dir: savedMetadata.temp_source_dir,
            source_file_name: rawFileName + selectedExtension,
            source_fields: document.getElementById('sourceFields').value.trim(),
            target_table_schema: document.getElementById('targetSchema').value,
            target_table_name: document.getElementById('targetTable').value,
            primary_key_column: document.getElementById('primaryKey').value.trim(),
            dq_enable_flag: document.getElementById('dqEnable').checked
        };

        if (savedMetadata.dq_enable_flag) {
            step2Status.textContent = "Generating Data Quality mapping...";
            step2Status.style.color = "#0056b3";
            
            indicatorStep2.classList.remove('active');
            indicatorStep2.classList.add('completed');
            indicatorStep3.classList.add('active');
            
            await buildStep3WithSourceFields(savedMetadata.source_fields);
        } else {
            document.getElementById('step2ProceedBtn').disabled = true;
            step2Status.textContent = "Saving pipeline directly to database...";
            step2Status.style.color = "#0056b3";
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

    // ==========================================
    // LOGIC: SMART BACK BUTTON (TOP LEFT)
    // ==========================================
    document.getElementById('smartBackBtn').addEventListener('click', (e) => {
        e.preventDefault(); // Stop the link from jumping the page around

        // If Step 3 is currently visible, trigger the Step 3 -> Step 2 back button
        if (step3.style.display === 'block') {
            document.getElementById('backToStep2Btn').click();
        } 
        // If Step 2 is currently visible, trigger the Step 2 -> Step 1 back button
        else if (step2.style.display === 'block') {
            document.getElementById('backToStep1Btn').click();
        } 
        // If we are already on Step 1, go back to the main portal menu!
        else {
            window.location.href = '../index.html'; // Change to 'source-select.html' if you prefer!
        }
    });

    // ==========================================
    // LOGIC: BUILD STEP 3 ACCORDION
    // ==========================================
    async function buildStep3WithSourceFields(commaSeparatedFields) {
        try {
            const response = await fetch('/api/dq-checks');
            availableDqChecks = await response.json();

            const fieldsArray = commaSeparatedFields.split(',').map(f => f.trim()).filter(f => f);
            const dynamicContainer = document.getElementById('dynamicColumnsContainer');
            dynamicContainer.innerHTML = ''; 

            fieldsArray.forEach(fieldName => {
                let checkboxesHTML = availableDqChecks.map(check => `
                    <label class="checkbox-label">
                        <input type="checkbox" value="${check.dq_name}">
                        ${check.dq_name}
                    </label>
                `).join('');

                const row = document.createElement('div');
                row.className = 'column-row';
                
                const header = document.createElement('div');
                header.className = 'column-header';
                header.innerHTML = `
                    <div class="col-name" data-colname="${fieldName}">${fieldName}</div>
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

            document.getElementById('displayTableName').textContent = "Parsed from input";
            step2.style.display = 'none';
            step3.style.display = 'block';
            step2Status.textContent = "";

        } catch (error) {
            console.error("Error:", error);
            step2Status.textContent = "Error loading DQ rules from server.";
            step2Status.style.color = "#dc3545";
        }
    }

    // ==========================================
    // LOGIC: FINAL SAVE FROM STEP 3
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
            step3Status.textContent = "Please select at least one DQ check before saving.";
            step3Status.style.color = "#dc3545";
            return;
        }

        step3Status.textContent = "Saving pipeline configuration...";
        step3Status.style.color = "#0056b3";
        document.getElementById('saveFinalBtn').disabled = true;

        await sendFinalPayload(savedMetadata, columnRules);
    });

    // ==========================================
    // MAIN API CALL ROUTINE
    // ==========================================
    async function sendFinalPayload(metadata, dqRules) {
        const payload = {
            metadata: metadata,
            dq_rules: dqRules 
        };

        try {
            const response = await fetch('/api/file-onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const targetStatus = metadata.dq_enable_flag ? step3Status : step2Status;
                targetStatus.textContent = "Success! Configuration saved to database.";
                targetStatus.style.color = "#28a745";
                
                setTimeout(() => window.location.reload(), 2000); 
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            console.error(error);
            const targetStatus = metadata.dq_enable_flag ? step3Status : step2Status;
            targetStatus.textContent = "Error saving configuration.";
            targetStatus.style.color = "#dc3545";
            if (metadata.dq_enable_flag) document.getElementById('saveFinalBtn').disabled = false;
            if (!metadata.dq_enable_flag) document.getElementById('step2ProceedBtn').disabled = false;
        }
    }
});
