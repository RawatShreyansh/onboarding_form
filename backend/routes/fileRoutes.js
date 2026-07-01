const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

router.get('/api/test-db', fileController.testDbConnection);
router.get('/api/columns', fileController.getColumns);
router.get('/api/dq-checks', fileController.getDqChecks);
router.post('/api/file-onboarding', fileController.saveFileOnboarding);
router.get('/api/search-file', fileController.searchFile);
router.post('/api/update-dq', fileController.updateDq);
router.get('/api/schemas', fileController.getSchemas);
router.get('/api/tables', fileController.getTables);
router.get('/api/primary-key', fileController.getPrimaryKey);
router.get('/api/fetch-headers', fileController.fetchHeaders);
router.get('/api/list-directory', fileController.listDirectory);

router.post('/api/test-sftp-connection', fileController.testSftpConnection);
router.post('/api/list-sftp-directory', fileController.listSftpDirectory);
router.post('/api/fetch-sftp-headers', fileController.fetchSftpHeaders);
router.post('/api/ai-suggest-dq', fileController.aiSuggestDqChecks);

module.exports = router;
