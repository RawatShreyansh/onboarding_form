const KafkaModel = require('../models/kafkaModel');

exports.saveKafkaOnboarding = async (req, res) => {
    try {
        const { metadata, dq_rules } = req.body;
        await KafkaModel.saveKafkaOnboarding(metadata, dq_rules);
        res.status(201).json({ message: "Kafka pipeline successfully saved." });
    } catch (err) {
        console.error("Kafka Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to save Kafka configuration." });
    }
};

exports.searchTopic = async (req, res) => {
    try {
        const { topicName } = req.query;
        const data = await KafkaModel.searchTopic(topicName);

        if (!data) {
            return res.status(404).json({ error: "Topic not found" });
        }

        res.json(data);
    } catch (err) {
        console.error("Error searching topic:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.updateKafkaDq = async (req, res) => {
    try {
        const { src_object_key, dq_rules } = req.body;
        await KafkaModel.updateKafkaDq(src_object_key, dq_rules);
        res.status(200).json({ message: "Kafka DQ Rules updated successfully." });
    } catch (err) {
        console.error("Update Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to update rules." });
    }
};
