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
    // LOGIC: SOURCE LOCATION TOGGLE
    // ==========================================
    const sourceLocationRadios = document.querySelectorAll('input[name="sourceLocation"]');
    const remoteCredentialsContainer = document.getElementById('remoteCredentialsContainer');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const serverIp = document.getElementById('serverIp');
    const serverUsername = document.getElementById('serverUsername');
    const serverPassword = document.getElementById('serverPassword');
    const step1ConnectBtn = document.getElementById('step1ConnectBtn');

    sourceLocationRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'remote') {
                remoteCredentialsContainer.style.display = 'block';
                testConnectionBtn.style.display = 'inline-block';
                step1ConnectBtn.textContent = 'Connect & Proceed →';
                serverIp.required = true;
                serverUsername.required = true;
                serverPassword.required = true;
            } else {
                remoteCredentialsContainer.style.display = 'none';
                testConnectionBtn.style.display = 'none';
                step1ConnectBtn.textContent = 'Proceed →';
                serverIp.required = false;
                serverUsername.required = false;
                serverPassword.required = false;
            }
        });
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
    // LOGIC: TEST CONNECTION
    // ==========================================
    document.getElementById('testConnectionBtn').addEventListener('click', async () => {
        const ip = document.getElementById('serverIp').value.trim();
        const user = document.getElementById('serverUsername').value.trim();
        const pass = document.getElementById('serverPassword').value;
        if (!ip || !user || !pass) {
            step1Status.textContent = "Please enter Server IP, Username, and Password first.";
            step1Status.style.color = "#dc3545";
            return;
        }
        
        const originalText = document.getElementById('testConnectionBtn').textContent;
        document.getElementById('testConnectionBtn').textContent = "Testing...";
        document.getElementById('testConnectionBtn').disabled = true;
        step1Status.textContent = "Attempting to reach server via SFTP...";
        step1Status.style.color = "#0056b3";

        try {
            const response = await fetch('/api/test-sftp-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, username: user, password: pass })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Connection failed");
            }

            step1Status.textContent = "Connection Successful! Server is reachable.";
            step1Status.style.color = "#10b981";
        } catch (err) {
            step1Status.textContent = err.message;
            step1Status.style.color = "#dc3545";
        } finally {
            document.getElementById('testConnectionBtn').textContent = originalText;
            document.getElementById('testConnectionBtn').disabled = false;
        }
    });

    // ==========================================
    // LOGIC: STEP 1 -> STEP 2
    // ==========================================
    step1Form.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        const selectedLocation = document.querySelector('input[name="sourceLocation"]:checked').value;
        savedMetadata.source_location = selectedLocation;

        if (selectedLocation === 'remote') {
            savedMetadata.server_ip = document.getElementById('serverIp').value.trim();
            savedMetadata.server_username = document.getElementById('serverUsername').value.trim();
            savedMetadata.server_password = document.getElementById('serverPassword').value;
        } else {
            savedMetadata.server_ip = '';
            savedMetadata.server_username = '';
            savedMetadata.server_password = '';
        }

        step1Status.textContent = "";
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        indicatorStep1.classList.remove('active');
        indicatorStep1.classList.add('completed');
        indicatorStep2.classList.add('active');
    });

    // ==========================================
    // LOGIC: STEP 2 -> STEP 3
    // ==========================================
    step2Form.addEventListener('submit', (e) => {
        e.preventDefault(); 

        const fieldsErrorText = document.getElementById('fieldsError');
        
        if (!fileHasHeaderCheckbox.checked) {
            const isValidCommaList = /^[a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)*$/.test(sourceFieldsInput.value.trim());

            if (!isValidCommaList) {
                sourceFieldsInput.classList.add('input-error');
                fieldsErrorText.style.display = 'block';
                step2Status.textContent = "Please fix the format of the fields before proceeding.";
                step2Status.style.color = "#dc3545";
                return;
            }
        }

        sourceFieldsInput.classList.remove('input-error');
        fieldsErrorText.style.display = 'none';
        step2Status.textContent = "";

        savedMetadata.temp_source_dir = document.getElementById('sourceLandingDir').value.trim();
        
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

        let rawFileName = document.getElementById('sourceFile').value.trim();
        rawFileName = rawFileName.replace(/\.[^/.]+$/, ""); 
        const selectedExtension = document.getElementById('sourceExtension').value;

        // Gather all inputs
        savedMetadata = {
            ...savedMetadata,
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
            step3Status.textContent = "Processing...";
            step3Status.style.color = "#0056b3";
            
            if (savedMetadata.file_has_header) {
                try {
                    let response;
                    if (savedMetadata.source_location === 'remote') {
                        response = await fetch('/api/fetch-sftp-headers', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ip: savedMetadata.server_ip,
                                username: savedMetadata.server_username,
                                password: savedMetadata.server_password,
                                directory: savedMetadata.source_file_dir,
                                fileName: rawFileName,
                                extension: selectedExtension
                            })
                        });
                    } else {
                        const url = `/api/fetch-headers?directory=${encodeURIComponent(savedMetadata.source_file_dir)}&fileName=${encodeURIComponent(rawFileName)}&extension=${encodeURIComponent(selectedExtension)}`;
                        response = await fetch(url);
                    }
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to fetch headers");
                    }
                    const data = await response.json();
                    savedMetadata.source_fields = data.columns.join(',');
                } catch (err) {
                    step3Status.textContent = err.message;
                    step3Status.style.color = "#dc3545";
                    return;
                }
            }

            step3Status.textContent = "Generating Data Quality mapping...";
            
            indicatorStep3.classList.remove('active');
            indicatorStep3.classList.add('completed');
            indicatorStep4.classList.add('active');
            
            await buildStep4WithSourceFields(savedMetadata.source_fields);
        } else {
            document.getElementById('step3ProceedBtn').disabled = true;
            step3Status.textContent = "Saving pipeline directly to database...";
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
    // LOGIC: SMART BACK BUTTON (TOP LEFT)
    // ==========================================
    const smartBackBtn = document.getElementById('smartBackBtn');
    if (smartBackBtn) {
        smartBackBtn.addEventListener('click', (e) => {
            e.preventDefault(); 

            if (step4.style.display === 'block') {
                document.getElementById('backToStep3Btn').click();
            } else if (step3.style.display === 'block') {
                document.getElementById('backToStep2Btn').click();
            } else if (step2.style.display === 'block') {
                document.getElementById('backToStep1Btn').click();
            } else {
                window.location.href = '../index.html'; 
            }
        });
    }

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

            document.getElementById('displayTableName').textContent = "Parsed from input";
            step3.style.display = 'none';
            step4.style.display = 'block';
            step3Status.textContent = "";

            // --- AI Sidebar Logic ---
            document.querySelector('.form-container').classList.add('step4-active');
            
            const aiSidebarContent = document.getElementById('aiSidebarContent');
            const applyAiBtn = document.getElementById('applyAiBtn');
            
            aiSidebarContent.innerHTML = `
                <div class="ai-loading">
                    <div class="spinner"></div>
                    <p>Analyzing fields with AI...</p>
                </div>
            `;
            applyAiBtn.style.display = 'none';
            
            const checksList = availableDqChecks.map(c => c.dq_name);
            
            try {
                const aiRes = await fetch('/api/ai-suggest-dq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: fieldsArray, availableChecks: checksList })
                });
                const suggestions = await aiRes.json();
                
                if (suggestions && suggestions.length > 0) {
                    aiSidebarContent.innerHTML = '';
                    suggestions.forEach((sugg, idx) => {
                        const badges = sugg.suggested_checks.map(c => `<span class="ai-suggestion-badge">${c}</span>`).join('');
                        aiSidebarContent.innerHTML += `
                            <div class="ai-suggestion-item">
                                <div class="ai-suggestion-field">${sugg.field}</div>
                                <div>${badges || '<span style="color:#9ca3af; font-size:12px;">No checks</span>'}</div>
                            </div>
                        `;
                    });
                    
                    applyAiBtn.style.display = 'block';
                    applyAiBtn.onclick = () => {
                        suggestions.forEach(sugg => {
                            // Find the col-name div that matches the field name
                            const colDivs = Array.from(document.querySelectorAll('.col-name'));
                            const colDiv = colDivs.find(el => el.getAttribute('data-colname') === sugg.field);
                            
                            if (colDiv) {
                                // Traverse up to the row, then find the options container
                                const row = colDiv.closest('.column-row');
                                if (row) {
                                    const checkboxes = row.querySelectorAll('input[type="checkbox"]');
                                    
                                    sugg.suggested_checks.forEach(checkName => {
                                        // Find checkbox by value (which is dq_name)
                                        const matchedCb = Array.from(checkboxes).find(cb => cb.value === checkName);
                                        if (matchedCb && !matchedCb.checked) {
                                            matchedCb.checked = true;
                                            // Trigger change event to update badges automatically
                                            matchedCb.dispatchEvent(new Event('change'));
                                        }
                                    });
                                    
                                    // Expand the accordion so user sees the applied checks
                                    const optionsContainer = row.querySelector('.dq-options');
                                    const toggleIcon = row.querySelector('.toggle-icon');
                                    if (optionsContainer && !optionsContainer.classList.contains('expanded')) {
                                        optionsContainer.classList.add('expanded');
                                        if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
                                    }
                                }
                            }
                        });
                        alert('AI Suggestions Applied Successfully!');
                    };
                } else {
                    aiSidebarContent.innerHTML = '<p style="color:#6b7280; font-size:14px; text-align:center;">No AI suggestions found.</p>';
                }
            } catch (err) {
                console.error("Failed to load AI suggestions", err);
                aiSidebarContent.innerHTML = '<p style="color:#dc2626; font-size:14px; text-align:center;">Failed to connect to AI engine.</p>';
            }
            // --- End AI Sidebar Logic ---


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

        step4Status.textContent = "Saving pipeline configuration...";
        step4Status.style.color = "#0056b3";
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
                const targetStatus = metadata.dq_enable_flag ? step4Status : step3Status;
                targetStatus.textContent = "Success! Configuration saved to database.";
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

    async function loadDirectory(path = '.') {
        fileBrowserList.innerHTML = '<div style="padding: 20px; text-align: center;">Loading...</div>';
        try {
            let response;
            if (savedMetadata.source_location === 'remote') {
                const payload = {
                    ip: savedMetadata.server_ip,
                    username: savedMetadata.server_username,
                    password: savedMetadata.server_password,
                    path: path
                };

                response = await fetch('/api/list-sftp-directory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                const url = (path && path !== '.') ? `/api/list-directory?path=${encodeURIComponent(path)}` : '/api/list-directory';
                response = await fetch(url);
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load directory");
            }
            
            const data = await response.json();
            currentLoadedPath = data.currentPath;
            currentBrowserPath.textContent = currentLoadedPath;
            
            fileBrowserList.innerHTML = '';

            // Folders
            data.folders.forEach(folder => {
                const item = document.createElement('div');
                item.className = 'browser-item folder-item';
                item.innerHTML = `<span class="browser-icon">📁</span> ${folder.name}`;
                item.addEventListener('click', () => {
                    const separator = currentLoadedPath.endsWith('/') ? '' : '/';
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
        loadDirectory(sourceLandingDirInput.value.trim() || '.');
    });

    closeFileBrowserBtn.addEventListener('click', () => {
        fileBrowserModal.classList.remove('show');
    });

    selectCurrentFolderBtn.addEventListener('click', () => {
        sourceLandingDirInput.value = currentLoadedPath;
        fileBrowserModal.classList.remove('show');
    });

    const goUpFolderBtn = document.getElementById('goUpFolderBtn');
    if (goUpFolderBtn) {
        goUpFolderBtn.addEventListener('click', () => {
            const isWinLocal = savedMetadata.source_location === 'local' && currentLoadedPath.includes('\\');
            const sep = isWinLocal ? /[/\\]/ : '/';
            const parts = currentLoadedPath.split(sep).filter(p => p);
            
            if (parts.length > 1) {
                parts.pop();
                const newPath = isWinLocal ? parts.join('\\') + '\\' : '/' + parts.join('/');
                loadDirectory(newPath);
            } else if (parts.length === 1 && isWinLocal) {
                loadDirectory(parts[0] + '\\');
            } else {
                loadDirectory('/');
            }
        });
    }

});
