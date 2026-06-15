const express = require('express');
const router = express.Router();
const kafkaController = require('../controllers/kafkaController');

router.post('/api/kafka-onboarding', kafkaController.saveKafkaOnboarding);
router.get('/api/search-topic', kafkaController.searchTopic);
router.post('/api/update-kafka-dq', kafkaController.updateKafkaDq);

module.exports = router;
