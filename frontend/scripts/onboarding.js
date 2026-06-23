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

    const fileHasHeaderCheckbox = document.getElementById('fileHasHeader');
    const sourceFieldsContainer = document.getElementById('sourceFieldsContainer');
    const sourceFieldsInput = document.getElementById('sourceFields');

    let availableDqChecks = [];
    let savedMetadata = {};

    fileHasHeaderCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            sourceFieldsContainer.style.display = 'none';
            sourceFieldsInput.removeAttribute('required');
        } else {
            sourceFieldsContainer.style.display = 'flex';
            sourceFieldsInput.setAttribute('required', 'required');
        }
    });

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
    // LOGIC: STEP 1 -> STEP 2
    // ==========================================
    step1Form.addEventListener('submit', (e) => {
        e.preventDefault(); 

        const fieldsErrorText = document.getElementById('fieldsError');
        
        if (!fileHasHeaderCheckbox.checked) {
            const isValidCommaList = /^[a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)*$/.test(sourceFieldsInput.value.trim());

            if (!isValidCommaList) {
                sourceFieldsInput.classList.add('input-error');
                fieldsErrorText.style.display = 'block';
                step1Status.textContent = "Please fix the format of the fields before proceeding.";
                step1Status.style.color = "#dc3545";
                return;
            }
        }

        sourceFieldsInput.classList.remove('input-error');
        fieldsErrorText.style.display = 'none';
        step1Status.textContent = "";

        savedMetadata.temp_source_dir = document.getElementById('sourceLandingDir').value.trim();
        
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
            dq_enable_flag: document.getElementById('dqEnable').checked,
            file_has_header: document.getElementById('fileHasHeader').checked
        };

        if (savedMetadata.dq_enable_flag) {
            step2Status.textContent = "Processing...";
            step2Status.style.color = "#0056b3";
            
            if (savedMetadata.file_has_header) {
                try {
                    const response = await fetch(`/api/fetch-headers?directory=${encodeURIComponent(savedMetadata.source_file_dir)}&fileName=${encodeURIComponent(rawFileName)}&extension=${encodeURIComponent(selectedExtension)}`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to fetch headers");
                    }
                    const data = await response.json();
                    savedMetadata.source_fields = data.columns.join(',');
                } catch (err) {
                    step2Status.textContent = err.message;
                    step2Status.style.color = "#dc3545";
                    return;
                }
            }

            step2Status.textContent = "Generating Data Quality mapping...";
            
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
    const smartBackBtn = document.getElementById('smartBackBtn');
    if (smartBackBtn) {
        smartBackBtn.addEventListener('click', (e) => {
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
    }

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
                    <label class="checkbox-label" data-dqname="${check.dq_name.toLowerCase()}">
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

    // ==========================================
    // LOGIC: CUSTOM FILE BROWSER MODAL
    // ==========================================
    const browseDirBtn = document.getElementById('browseDirBtn');
    const fileBrowserModal = document.getElementById('fileBrowserModal');
    const closeFileBrowserBtn = document.getElementById('closeFileBrowserBtn');
    const fileBrowserList = document.getElementById('fileBrowserList');
    const currentBrowserPath = document.getElementById('currentBrowserPath');
    const selectCurrentFolderBtn = document.getElementById('selectCurrentFolderBtn');
    const sourceLandingDirInput = document.getElementById('sourceLandingDir');
    const sourceFileInput = document.getElementById('sourceFile');
    const sourceExtensionSelect = document.getElementById('sourceExtension');

    let currentLoadedPath = '';

    async function loadDirectory(path = '') {
        fileBrowserList.innerHTML = '<div style="padding: 20px; text-align: center;">Loading...</div>';
        try {
            const url = path ? `/api/list-directory?path=${encodeURIComponent(path)}` : '/api/list-directory';
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to load directory");
            
            const data = await response.json();
            currentLoadedPath = data.currentPath;
            currentBrowserPath.textContent = currentLoadedPath;
            
            fileBrowserList.innerHTML = '';

            // Parent directory ".." button
            const parentItem = document.createElement('div');
            parentItem.className = 'browser-item folder-item';
            parentItem.innerHTML = `<span class="browser-icon">🔙</span> .. (Go Up)`;
            parentItem.addEventListener('click', () => {
                // simple parent path calculation (handles both \ and /)
                const parts = currentLoadedPath.split(/[/\\]/).filter(p => p);
                if (parts.length > 1) {
                    parts.pop();
                    const newPath = currentLoadedPath.includes('\\') ? parts.join('\\') + '\\' : '/' + parts.join('/');
                    loadDirectory(newPath);
                } else if (parts.length === 1 && currentLoadedPath.includes('\\')) {
                    // Windows root (e.g., C:\)
                    loadDirectory(parts[0] + '\\');
                }
            });
            fileBrowserList.appendChild(parentItem);

            // Folders
            data.folders.forEach(folder => {
                const item = document.createElement('div');
                item.className = 'browser-item folder-item';
                item.innerHTML = `<span class="browser-icon">📁</span> ${folder.name}`;
                item.addEventListener('click', () => {
                    const separator = currentLoadedPath.endsWith('\\') || currentLoadedPath.endsWith('/') ? '' : (currentLoadedPath.includes('\\') ? '\\' : '/');
                    loadDirectory(currentLoadedPath + separator + folder.name);
                });
                fileBrowserList.appendChild(item);
            });

            // Files
            data.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'browser-item file-item';
                item.innerHTML = `<span class="browser-icon">📄</span> ${file.name}`;
                item.addEventListener('click', () => {
                    // Split extension
                    const lastDot = file.name.lastIndexOf('.');
                    if (lastDot > 0) {
                        const name = file.name.substring(0, lastDot);
                        const ext = file.name.substring(lastDot);
                        sourceFileInput.value = name;
                        
                        // Try to select extension
                        const extOption = Array.from(sourceExtensionSelect.options).find(opt => opt.value === ext);
                        if (extOption) sourceExtensionSelect.value = ext;
                    } else {
                        sourceFileInput.value = file.name;
                    }
                    
                    sourceLandingDirInput.value = currentLoadedPath;
                    fileBrowserModal.classList.remove('show');
                });
                fileBrowserList.appendChild(item);
            });
            
        } catch (error) {
            console.error(error);
            fileBrowserList.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
        }
    }

    browseDirBtn.addEventListener('click', () => {
        fileBrowserModal.classList.add('show');
        loadDirectory(sourceLandingDirInput.value.trim() || '');
    });

    closeFileBrowserBtn.addEventListener('click', () => {
        fileBrowserModal.classList.remove('show');
    });

    selectCurrentFolderBtn.addEventListener('click', () => {
        sourceLandingDirInput.value = currentLoadedPath;
        fileBrowserModal.classList.remove('show');
    });

});
