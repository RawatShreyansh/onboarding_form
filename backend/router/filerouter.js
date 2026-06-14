const express = require('express');
const router = express.Router();
const pool = require('../config/db'); 

// Test Database Connection Route
router.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()'); 
        res.json({
            status: "Success",
            message: "Database is connected!",
            database_time: result.rows[0].now
        });
    } catch (err) {
        console.error("Database connection failed:", err.message);
        res.status(500).json({ 
            status: "Error", 
            message: "Database connection failed",
            error: err.message 
        });
    }
});

// ==========================================
// 1. GET COLUMNS API
// The frontend calls this when the user finishes typing the file name
// ==========================================
router.get('/api/columns', async (req, res) => {
    try {
        const { fileName } = req.query;
        
        const columns = await pool.query(`
            SELECT 
                column_name FROM information_schema.columns WHERE table_name = $1
        `, [fileName]);
        
        res.json(columns.rows);
    } catch (err) {
        console.error("Error fetching columns:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});


// ==========================================
// 2. GET DQ CHECKS API
// The frontend calls this at the exact same time to build the checkboxes
// ==========================================
router.get('/api/dq-checks', async (req, res) => {
    try {
        const checks = await pool.query("select dq_name from public.dq_rule_definition;");
        res.json(checks.rows);
    } catch (err) {
        console.error("Error fetching DQ checks:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
// POST ONBOARDING API (Final Production Version)
// ==========================================
// router.post('/api/file-onboarding', async (req, res) => {
//     const client = await pool.connect(); 

//     try {
//         const { metadata, dq_rules } = req.body;

//         await client.query('BEGIN'); 

//         // ---------------------------------------------------------
//         // TABLE 1: INSERT METADATA (nifi_file_source_config)
//         // ---------------------------------------------------------
//         const dqFlagInt = metadata.dq_enable_flag ? 1 : 0;
        
//         // Dynamic file paths based on the file name the user entered
//         const generatedArchivePath = `$BASEDIR/archive_files/${metadata.source_file_name}`;
//         const generatedRejectedPath = `$BASEDIR/rejected_files/${metadata.source_file_name}`;

//         const insertConfigQuery = `
//             INSERT INTO nifi_file_source_config (
//                 source_system,
//                 source_file_directory,
//                 source_file_name,
//                 tgt_schema_name,
//                 tgt_table_name,
//                 dq_enable_flag,
//                 archive_file_path,
//                 rejected_file_path,
//                 primary_key
//             ) VALUES (
//                 $1, $2, $3, $4, $5, $6, $7, $8, $9
//             ) 
//             RETURNING src_object_key; -- DB generates this, we capture it instantly
//         `;

//         const configValues = [
//             metadata.source_system_name,
//             metadata.source_file_dir,
//             metadata.source_file_name,
//             metadata.target_table_schema,
//             metadata.target_table_name,
//             dqFlagInt,
//             generatedArchivePath,
//             generatedRejectedPath,
//             metadata.primary_key_column
//         ];

//         const configResult = await client.query(insertConfigQuery, configValues);
//         const newRecordKey = configResult.rows[0].src_object_key; 

//         // ---------------------------------------------------------
//         // TABLE 2: INSERT DQ RULES (nifi_file_source_dq_config)
//         // ---------------------------------------------------------
//         if (metadata.dq_enable_flag && Object.keys(dq_rules).length > 0) {
            
//             // Loop through each column the user mapped
//             for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                
//                 // Loop through the specific rules checked for that column
//                 for (const ruleName of rulesArray) {
                    
//                     const insertDqQuery = `
//                         INSERT INTO nifi_file_source_dq_config (
//                             src_obj_key,
//                             dq_column_name,
//                             dq_rule_name,
//                             is_dq_active
//                         ) VALUES ($1, $2, $3, $4);
//                     `;
                    
//                     await client.query(insertDqQuery, [
//                         newRecordKey, // The FK we captured from Table 1
//                         columnName,   // 'dq_column_name'
//                         ruleName,     // 'dq_rule_name'
//                         1             // 'is_dq_active' set to 1 (True)
//                     ]);
//                 }
//             }
//         }

//         // Commit the transaction
//         await client.query('COMMIT');
//         res.status(201).json({ message: "Pipeline configuration successfully saved." });

//     } catch (err) {
//         // Rollback if anything fails
//         await client.query('ROLLBACK');
//         console.error("Transaction Error:", err.message);
//         res.status(500).json({ error: "Failed to save configuration. Changes rolled back." });
        
//     } finally {
//         client.release();
//     }
// });

// ==========================================
// POST ONBOARDING API (3-Table Transaction)
// ==========================================
router.post('/api/file-onboarding', async (req, res) => {
    const client = await pool.connect(); 

    try {
        const { metadata, dq_rules } = req.body;
        await client.query('BEGIN'); 

        // ---------------------------------------------------------
        // TABLE 1: INSERT CONFIG (nifi_file_source_config)
        // ---------------------------------------------------------
        const dqFlagInt = metadata.dq_enable_flag ? 1 : 0;
        const generatedArchivePath = `/data/archive/${metadata.source_file_name}`;
        const generatedRejectedPath = `/data/reject/${metadata.source_file_name}`;

        const insertConfigQuery = `
            INSERT INTO nifi_file_source_config (
                source_system, source_file_directory, source_file_name,
                tgt_schema_name, tgt_table_name, dq_enable_flag,
                archive_file_path, rejected_file_path, primary_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING src_object_key;
        `;

        const configValues = [
            metadata.source_system_name, metadata.source_file_dir, metadata.source_file_name,
            metadata.target_table_schema, metadata.target_table_name, dqFlagInt,
            generatedArchivePath, generatedRejectedPath, metadata.primary_key_column
        ];

        const configResult = await client.query(insertConfigQuery, configValues);
        const newRecordKey = configResult.rows[0].src_object_key; 

        // ---------------------------------------------------------
        // TABLE 2: INSERT SOURCE FIELDS (nifi_file_src_metadata) NEW!
        // ---------------------------------------------------------
        // Split the comma-separated string into an array, cleaning up whitespace
        const sourceFieldsString = metadata.source_fields || "";
        const fieldsArray = sourceFieldsString.split(',').map(f => f.trim()).filter(f => f);

        // Loop and insert each field as its own row
        for (const field of fieldsArray) {
            const insertMetadataQuery = `
                INSERT INTO nifi_file_src_metadata (
                    src_object_key,
                    source_file_name,
                    field_name
                ) VALUES ($1, $2, $3);
            `;
            await client.query(insertMetadataQuery, [
                newRecordKey,                 // Fetched from Table 1
                metadata.source_file_name,    // User entered
                field                         // Individual field from the comma list
            ]);
        }

        // ---------------------------------------------------------
        // TABLE 3: INSERT DQ RULES (nifi_file_source_dq_config)
        // ---------------------------------------------------------
        if (metadata.dq_enable_flag && Object.keys(dq_rules).length > 0) {
            for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                for (const ruleName of rulesArray) {
                    const insertDqQuery = `
                        INSERT INTO nifi_file_source_dq_config (
                            src_obj_key, dq_column_name, dq_rule_name, is_dq_active
                        ) VALUES ($1, $2, $3, 1);
                    `;
                    await client.query(insertDqQuery, [newRecordKey, columnName, ruleName]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Pipeline configuration successfully saved." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to save configuration." });
    } finally {
        client.release();
    }
});

// ==========================================
// GET: SEARCH EXISTING FILE (Updated to fetch rules)
// ==========================================
router.get('/api/search-file', async (req, res) => {
    try {
        const { fileName } = req.query;
        
        // 1. Find the file in the master configuration table
        const fileQuery = `
            SELECT src_object_key, tgt_table_name, dq_enable_flag 
            FROM nifi_file_source_config 
            WHERE source_file_name = $1
        `;
        const fileResult = await pool.query(fileQuery, [fileName]);

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: "File not found" });
        }

        const fileData = fileResult.rows[0];

        // 2. Fetch all existing, active DQ rules for this specific file
        const dqQuery = `
            SELECT dq_column_name, dq_rule_name 
            FROM nifi_file_source_dq_config 
            WHERE src_obj_key = $1 AND is_dq_active = 1
        `;
        const dqResult = await pool.query(dqQuery, [fileData.src_object_key]);

        // 3. Transform the rules into a clean mapping object for the frontend
        // Example output: { "employee_id": ["Null Check"], "email": ["Unique Check"] }
        const existingRules = {};
        dqResult.rows.forEach(row => {
            if (!existingRules[row.dq_column_name]) {
                existingRules[row.dq_column_name] = [];
            }
            existingRules[row.dq_column_name].push(row.dq_rule_name);
        });

        // 4. Send the combined data back to the UI
        res.json({
            ...fileData,
            existing_rules: existingRules
        });

    } catch (err) {
        console.error("Error searching file:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});


// ==========================================
// POST: UPDATE EXISTING DQ RULES 
// ==========================================
router.post('/api/update-dq', async (req, res) => {
    const client = await pool.connect(); 

    try {
        const { src_object_key, dq_rules } = req.body;
        await client.query('BEGIN'); 

        // 1. SOFT DELETE: Set ALL existing rules for this file to inactive (0)
        await client.query(
            'UPDATE nifi_file_source_dq_config SET is_dq_active = 0 WHERE src_obj_key = $1', 
            [src_object_key]
        );

        // 2. Reactivate existing ones, or Insert if they are brand new
        if (Object.keys(dq_rules).length > 0) {
            for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                for (const ruleName of rulesArray) {
                    
                    // THE FIX: We use TRIM() in the SQL to prevent database space-padding 
                    // from ruining the match.
                    const updateRes = await client.query(`
                        UPDATE nifi_file_source_dq_config 
                        SET is_dq_active = 1 
                        WHERE src_obj_key = $1 
                          AND TRIM(dq_column_name) = TRIM($2) 
                          AND TRIM(dq_rule_name) = TRIM($3)
                        RETURNING *;
                    `, [src_object_key, columnName, ruleName]);

                    if (!updateRes.rows || updateRes.rows.length === 0) {
                        await client.query(`
                            INSERT INTO nifi_file_source_dq_config (
                                src_obj_key, dq_column_name, dq_rule_name, is_dq_active
                            ) VALUES ($1, $2, $3, 1);
                        `, [src_object_key, columnName, ruleName]);
                    }
                }
            }
        }

        // 3. Keep the master table perfectly in sync
        const masterDqFlag = Object.keys(dq_rules).length > 0 ? 1 : 0;
        await client.query(
            'UPDATE nifi_file_source_config SET dq_enable_flag = $2 WHERE src_object_key = $1',
            [src_object_key, masterDqFlag]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: "DQ Rules updated successfully." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Update Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to update rules." });
    } finally {
        client.release();
    }
});

// ==========================================
// GET: FETCH ALL POSTGRES SCHEMAS
// ==========================================
router.get('/api/schemas', async (req, res) => {
    try {
        const schemaQuery = `
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog') 
            AND schema_name NOT LIKE 'pg_toast%'
            ORDER BY schema_name ASC;
        `;
        const result = await pool.query(schemaQuery);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching schemas:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
// GET: FETCH TABLES FOR A SPECIFIC SCHEMA
// ==========================================
router.get('/api/tables', async (req, res) => {
    try {
        const { schemaName } = req.query;
        
        const tableQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 AND table_type = 'BASE TABLE'
            ORDER BY table_name ASC;
        `;
        const result = await pool.query(tableQuery, [schemaName]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching tables:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
// GET: FETCH PRIMARY KEY FOR A TABLE
// ==========================================
router.get('/api/primary-key', async (req, res) => {
    try {
        const { schemaName, tableName } = req.query;
        
        // This query specifically hunts down the Primary Key constraint 
        // and returns the column names in the correct order
        const pkQuery = `
            SELECT kcu.column_name
            FROM information_schema.table_constraints tco
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = tco.constraint_name 
              AND kcu.constraint_schema = tco.constraint_schema
            WHERE tco.constraint_type = 'PRIMARY KEY'
              AND tco.table_schema = $1
              AND tco.table_name = $2
            ORDER BY kcu.ordinal_position;
        `;
        
        const result = await pool.query(pkQuery, [schemaName, tableName]);
        
        // If the table doesn't have a primary key setup in Postgres
        if (result.rows.length === 0) {
            return res.json({ primaryKey: "NO_PRIMARY_KEY" });
        }

        // Map through the results and join them with a pipe '|'
        // If it's a single key, it just returns 'id'. 
        // If composite, it returns 'emp_id|dept_id'
        const pkColumns = result.rows.map(row => row.column_name);
        const compositeKey = pkColumns.join('|');
        
        res.json({ primaryKey: compositeKey });

    } catch (err) {
        console.error("Error fetching primary key:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;