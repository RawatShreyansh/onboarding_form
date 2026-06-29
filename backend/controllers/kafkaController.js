const KafkaModel = require('../models/kafkaModel');
const { Kafka } = require('kafkajs');

// Helper to configure Kafka client based on auth parameters
const createKafkaClient = (clientId, brokers, authType, username, password) => {
    const brokersList = brokers.split(',').map(b => b.trim());
    const config = {
        clientId: clientId,
        brokers: brokersList,
    };

    if (authType === 'sasl_plain' || authType === 'sasl_scram_256' || authType === 'sasl_scram_512') {
        const mechanismMap = {
            'sasl_plain': 'plain',
            'sasl_scram_256': 'scram-sha-256',
            'sasl_scram_512': 'scram-sha-512'
        };
        config.sasl = {
            mechanism: mechanismMap[authType],
            username: username,
            password: password
        };
        // Typically SASL goes over SSL, but we can enable SSL if SASL is provided 
        // depending on strictness. We will default to true if sasl is used, 
        // or we can add a specific SSL checkbox. For simplicity, let's enable SSL if SASL is present.
        config.ssl = true; 
    }
    
    return new Kafka(config);
};

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

exports.testKafkaConnection = async (req, res) => {
    try {
        const { brokers, authType, username, password } = req.body;
        if (!brokers) return res.status(400).json({ error: "Brokers are required" });

        const kafka = createKafkaClient('test-client', brokers, authType, username, password);
        const admin = kafka.admin();

        await admin.connect();
        const clusterInfo = await admin.describeCluster();
        await admin.disconnect();

        res.json({ message: "Successfully connected to Kafka cluster", clusterInfo });
    } catch (err) {
        console.error("Kafka connection failed:", err.message);
        res.status(500).json({ error: "Connection failed: " + err.message });
    }
};

exports.fetchKafkaFields = async (req, res) => {
    try {
        const { brokers, authType, username, password, topicName, format } = req.body;
        if (!brokers || !topicName) return res.status(400).json({ error: "Brokers and topic are required" });

        const kafka = createKafkaClient('fetch-fields-client', brokers, authType, username, password);
        
        // We use a random group ID, so we don't interfere with real consumers
        // Setting fromBeginning: true ensures we immediately get the oldest available message
        // This is the fastest and most robust way to infer the schema in KafkaJS
        const consumer = kafka.consumer({ groupId: 'onboarding-fetch-' + Date.now() });

        await consumer.connect();
        await consumer.subscribe({ topic: topicName, fromBeginning: true });

        let fields = [];
        let messageReceived = false;

        return new Promise(async (resolve, reject) => {
            // Setup timeout
            const timeout = setTimeout(async () => {
                if (!messageReceived) {
                    await consumer.disconnect();
                    res.status(404).json({ error: "Timed out waiting for message from topic" });
                    resolve();
                }
            }, 10000); // 10 second timeout

            try {
                await consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        if (messageReceived) return; // Ignore subsequent messages
                        messageReceived = true;
                        clearTimeout(timeout);

                        try {
                            const val = message.value.toString();
                            
                            if (format === 'JSON') {
                                const parsed = JSON.parse(val);
                                fields = Object.keys(parsed);
                            } else {
                                // Default fallback (maybe just one field representing the whole payload)
                                // In the future, parse CSV or Avro
                                fields = ["payload"];
                            }

                            if (fields.length === 0) {
                                res.status(400).json({ error: "No valid fields found in the message" });
                            } else {
                                res.json({ columns: fields });
                            }
                        } catch (e) {
                            res.status(400).json({ error: "Failed to parse message: " + e.message });
                        } finally {
                            await consumer.disconnect();
                            resolve();
                        }
                    },
                });
            } catch (err) {
                clearTimeout(timeout);
                await consumer.disconnect();
                res.status(500).json({ error: "Failed to read from topic: " + err.message });
                resolve();
            }
        });
    } catch (err) {
        console.error("Fetch fields error:", err.message);
        res.status(500).json({ error: "Failed to connect: " + err.message });
    }
};
