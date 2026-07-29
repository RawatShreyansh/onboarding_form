const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Active Pipelines
        const fileConfigRes = await pool.query('SELECT COUNT(*) FROM nifi_file_source_config');
        const kafkaConfigRes = await pool.query('SELECT COUNT(*) FROM nifi_kafka_source_config');
        const activePipelines = parseInt(fileConfigRes.rows[0].count) + parseInt(kafkaConfigRes.rows[0].count);

        // 2. DQ Rules Applied
        const fileDqRes = await pool.query('SELECT COUNT(*) FROM nifi_file_source_dq_config WHERE is_dq_active = 1');
        const kafkaDqRes = await pool.query('SELECT COUNT(*) FROM nifi_kafka_source_dq_config WHERE dq_flag = 1');
        const dqRulesApplied = parseInt(fileDqRes.rows[0].count) + parseInt(kafkaDqRes.rows[0].count);

        // 3. Total Records Processed
        let totalRecordsProcessed = 0;
        try {
            const fileExecRes = await pool.query("SELECT SUM(CAST(total_records AS INTEGER)) FROM nifi_dq_execution_summary");
            if (fileExecRes.rows[0].sum) {
                totalRecordsProcessed += parseInt(fileExecRes.rows[0].sum);
            }
        } catch (e) { console.error('Error fetching file execution summary:', e.message); }

        try {
            const kafkaExecRes = await pool.query("SELECT SUM(CAST(total_records AS INTEGER)) FROM nifi_kafka_dq_execution_summary");
            if (kafkaExecRes.rows[0].sum) {
                totalRecordsProcessed += parseInt(kafkaExecRes.rows[0].sum);
            }
        } catch (e) { console.error('Error fetching kafka execution summary:', e.message); }

        // Formatting records for UI
        const formattedRecords = totalRecordsProcessed >= 1000000 
            ? (totalRecordsProcessed / 1000000).toFixed(1) + 'M'
            : totalRecordsProcessed >= 1000 
                ? (totalRecordsProcessed / 1000).toFixed(1) + 'K'
                : totalRecordsProcessed.toString();

        res.status(200).json({
            activePipelines,
            totalRecordsProcessed: formattedRecords,
            dqRulesApplied
        });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
