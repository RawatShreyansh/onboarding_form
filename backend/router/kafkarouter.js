const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// POST: KAFKA ONBOARDING API (3-Table Transaction)
// ==========================================
router.post('/api/kafka-onboarding', async (req, res) => {
    const client = await pool.connect(); 

    try {
        const { metadata, dq_rules } = req.body;
        await client.query('BEGIN'); 

        // ---------------------------------------------------------
        // TABLE 1: INSERT CONFIG (nifi_kafka_source_config)
        // ---------------------------------------------------------
        const dqFlagInt = metadata.dq_enable_flag ? 1 : 0;

        const insertConfigQuery = `
            INSERT INTO nifi_kafka_source_config (
                source_system, topic_name, kafka_brokers, message_format,
                tgt_schema_name, tgt_table_name, primary_key, dq_enable_flag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING src_object_key;
        `;

        const configValues = [
            metadata.source_system_name, 
            metadata.topic_name, 
            metadata.kafka_brokers, 
            metadata.message_format,
            metadata.target_table_schema, 
            metadata.target_table_name, 
            metadata.primary_key_column,
            dqFlagInt
        ];

        const configResult = await client.query(insertConfigQuery, configValues);
        const newRecordKey = configResult.rows[0].src_object_key; 

        // ---------------------------------------------------------
        // TABLE 2: INSERT SOURCE FIELDS (nifi_kafka_src_metadata) NEW!
        // ---------------------------------------------------------
        // Split the comma-separated string into an array, cleaning up whitespace
        const sourceFieldsString = metadata.source_fields || "";
        const fieldsArray = sourceFieldsString.split(',').map(f => f.trim()).filter(f => f);

        // Loop and insert each JSON Key/Field as its own row
        for (const field of fieldsArray) {
            const insertMetadataQuery = `
                INSERT INTO nifi_kafka_src_metadata (
                    src_object_key,
                    topic_name,
                    field_name
                ) VALUES ($1, $2, $3);
            `;
            await client.query(insertMetadataQuery, [
                newRecordKey,                 // Fetched from Table 1
                metadata.topic_name,          // User entered in UI
                field                         // Individual parsed field
            ]);
        }

        // ---------------------------------------------------------
        // TABLE 3: INSERT DQ RULES (nifi_kafka_source_dq_config)
        // ---------------------------------------------------------
        if (metadata.dq_enable_flag && Object.keys(dq_rules).length > 0) {
            for (const [columnName, rulesArray] of Object.entries(dq_rules)) {
                for (const ruleName of rulesArray) {
                    const insertDqQuery = `
                        INSERT INTO nifi_kafka_source_dq_config (
                            src_obj_key, dq_column_name, dq_rule_name, is_dq_active
                        ) VALUES ($1, $2, $3, 1);
                    `;
                    await client.query(insertDqQuery, [newRecordKey, columnName, ruleName]);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Kafka pipeline successfully saved." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Kafka Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to save Kafka configuration." });
    } finally {
        client.release();
    }
});

module.exports = router;