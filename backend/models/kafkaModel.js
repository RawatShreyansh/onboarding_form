const pool = require('../config/db');

class KafkaModel {
    static async saveKafkaOnboarding(metadata, dq_rules) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Insert Config
            const dqFlagInt = metadata.dq_enable_flag ? 1 : 0;
            const insertConfigQuery = `
                INSERT INTO nifi_kafka_source_config (
                    source_system, src_kafka_topic_name,
                    tgt_schema_name, tgt_table_name, primary_key, dq_enable_flag
                ) VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING src_object_key;
            `;

            const configValues = [
                metadata.source_system_name, 
                metadata.topic_name, 
                metadata.target_table_schema, 
                metadata.target_table_name, 
                metadata.primary_key_column,
                dqFlagInt
            ];

            const configResult = await client.query(insertConfigQuery, configValues);
            const newRecordKey = configResult.rows[0].src_object_key; 

            // 2. Insert Source Fields
            const sourceFieldsString = metadata.source_fields || "";
            const fieldsArray = sourceFieldsString.split(',').map(f => f.trim()).filter(f => f);

            for (const field of fieldsArray) {
                const insertMetadataQuery = `
                    INSERT INTO nifi_kafka_src_metadata (
                        src_object_key,
                        src_kafka_topic_name,
                        field_name
                    ) VALUES ($1, $2, $3);
                `;
                await client.query(insertMetadataQuery, [newRecordKey, metadata.topic_name, field]);
            }

            // 3. Insert DQ Rules
            if (metadata.dq_enable_flag && Object.keys(dq_rules).length > 0) {
                for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                    for (const ruleName of rulesArray) {
                        const insertDqQuery = `
                            INSERT INTO nifi_kafka_source_dq_config (
                                src_obj_key, dq_column_name, dq_rule_name, dq_flag
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

    static async searchTopic(topicName) {
        // 1. Find topic
        const topicQuery = `
            SELECT src_object_key, tgt_schema_name, tgt_table_name, dq_enable_flag, src_kafka_topic_name AS topic_name
            FROM nifi_kafka_source_config 
            WHERE src_kafka_topic_name = $1
        `;
        const topicResult = await pool.query(topicQuery, [topicName]);

        if (topicResult.rows.length === 0) return null;

        const topicData = topicResult.rows[0];

        // 2. Fetch DQ rules
        const dqQuery = `
            SELECT dq_column_name, dq_rule_name, dq_flag 
            FROM nifi_kafka_source_dq_config 
            WHERE src_obj_key = $1
        `;
        const dqResult = await pool.query(dqQuery, [topicData.src_object_key]);

        return {
            ...topicData,
            dqRules: dqResult.rows
        };
    }

    static async updateKafkaDq(src_object_key, dq_rules) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Soft Delete
            await client.query(
                'UPDATE nifi_kafka_source_dq_config SET dq_flag = 0 WHERE src_obj_key = $1', 
                [src_object_key]
            );

            // 2. Reactivate or insert
            if (Object.keys(dq_rules).length > 0) {
                for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                    for (const ruleName of rulesArray) {
                        const updateRes = await client.query(`
                            UPDATE nifi_kafka_source_dq_config 
                            SET dq_flag = 1 
                            WHERE src_obj_key = $1 
                              AND TRIM(dq_column_name) = TRIM($2) 
                              AND TRIM(dq_rule_name) = TRIM($3)
                            RETURNING *;
                        `, [src_object_key, columnName, ruleName]);

                        if (!updateRes.rows || updateRes.rows.length === 0) {
                            await client.query(`
                                INSERT INTO nifi_kafka_source_dq_config (
                                    src_obj_key, dq_column_name, dq_rule_name, dq_flag
                                ) VALUES ($1, $2, $3, 1);
                            `, [src_object_key, columnName, ruleName]);
                        }
                    }
                }
            }

            // 3. Keep master table synced
            const masterDqFlag = Object.keys(dq_rules).length > 0 ? 1 : 0;
            await client.query(
                'UPDATE nifi_kafka_source_config SET dq_enable_flag = $2 WHERE src_object_key = $1',
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
}

module.exports = KafkaModel;
