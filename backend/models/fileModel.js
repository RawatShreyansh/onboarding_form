const pool = require('../config/db');

class FileModel {
    static async testDbConnection() {
        const result = await pool.query('SELECT NOW()');
        return result.rows[0].now;
    }

    static async getColumns(fileName) {
        const columns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1
        `, [fileName]);
        return columns.rows;
    }

    static async getDqChecks() {
        const checks = await pool.query("select dq_name from public.dq_rule_definition;");
        return checks.rows;
    }

    static async saveFileOnboarding(metadata, dq_rules) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Insert Config
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

            // 2. Insert Source Fields
            const sourceFieldsString = metadata.source_fields || "";
            const fieldsArray = sourceFieldsString.split(',').map(f => f.trim()).filter(f => f);

            for (const field of fieldsArray) {
                const insertMetadataQuery = `
                    INSERT INTO nifi_file_src_metadata (
                        src_object_key, source_file_name, field_name
                    ) VALUES ($1, $2, $3);
                `;
                await client.query(insertMetadataQuery, [newRecordKey, metadata.source_file_name, field]);
            }

            // 3. Insert DQ Rules
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
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async searchFile(fileName) {
        // 1. Find file
        const fileQuery = `
            SELECT src_object_key, tgt_table_name, dq_enable_flag 
            FROM nifi_file_source_config 
            WHERE source_file_name = $1
        `;
        const fileResult = await pool.query(fileQuery, [fileName]);

        if (fileResult.rows.length === 0) return null;
        
        const fileData = fileResult.rows[0];

        // 2. Fetch DQ rules
        const dqQuery = `
            SELECT dq_column_name, dq_rule_name 
            FROM nifi_file_source_dq_config 
            WHERE src_obj_key = $1 AND is_dq_active = 1
        `;
        const dqResult = await pool.query(dqQuery, [fileData.src_object_key]);

        // 3. Transform rules
        const existingRules = {};
        dqResult.rows.forEach(row => {
            if (!existingRules[row.dq_column_name]) {
                existingRules[row.dq_column_name] = [];
            }
            existingRules[row.dq_column_name].push(row.dq_rule_name);
        });

        return {
            ...fileData,
            existing_rules: existingRules
        };
    }

    static async updateFileDq(src_object_key, dq_rules) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Soft delete
            await client.query(
                'UPDATE nifi_file_source_dq_config SET is_dq_active = 0 WHERE src_obj_key = $1', 
                [src_object_key]
            );

            // 2. Reactivate or insert
            if (Object.keys(dq_rules).length > 0) {
                for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                    for (const ruleName of rulesArray) {
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

            // 3. Update master table
            const masterDqFlag = Object.keys(dq_rules).length > 0 ? 1 : 0;
            await client.query(
                'UPDATE nifi_file_source_config SET dq_enable_flag = $2 WHERE src_object_key = $1',
                [src_object_key, masterDqFlag]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async getSchemas() {
        const schemaQuery = `
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog') 
            AND schema_name NOT LIKE 'pg_toast%'
            ORDER BY schema_name ASC;
        `;
        const result = await pool.query(schemaQuery);
        return result.rows;
    }

    static async getTables(schemaName) {
        const tableQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 AND table_type = 'BASE TABLE'
            ORDER BY table_name ASC;
        `;
        const result = await pool.query(tableQuery, [schemaName]);
        return result.rows;
    }

    static async getPrimaryKey(schemaName, tableName) {
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
        
        if (result.rows.length === 0) {
            return "NO_PRIMARY_KEY";
        }

        const pkColumns = result.rows.map(row => row.column_name);
        return pkColumns.join('|');
    }
}

module.exports = FileModel;
