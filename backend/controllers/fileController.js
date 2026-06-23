const FileModel = require('../models/fileModel');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const os = require('os');

exports.testDbConnection = async (req, res) => {
    try {
        const time = await FileModel.testDbConnection();
        res.json({
            status: "Success",
            message: "Database is connected!",
            database_time: time
        });
    } catch (err) {
        console.error("Database connection failed:", err.message);
        res.status(500).json({ 
            status: "Error", 
            message: "Database connection failed",
            error: err.message 
        });
    }
};

exports.getColumns = async (req, res) => {
    try {
        const { fileName } = req.query;
        const columns = await FileModel.getColumns(fileName);
        res.json(columns);
    } catch (err) {
        console.error("Error fetching columns:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.getDqChecks = async (req, res) => {
    try {
        const checks = await FileModel.getDqChecks();
        res.json(checks);
    } catch (err) {
        console.error("Error fetching DQ checks:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.saveFileOnboarding = async (req, res) => {
    try {
        const { metadata, dq_rules } = req.body;
        await FileModel.saveFileOnboarding(metadata, dq_rules);
        res.status(201).json({ message: "Pipeline configuration successfully saved." });
    } catch (err) {
        console.error("Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to save configuration." });
    }
};

exports.searchFile = async (req, res) => {
    try {
        const { fileName } = req.query;
        const data = await FileModel.searchFile(fileName);
        
        if (!data) {
            return res.status(404).json({ error: "File not found" });
        }

        res.json(data);
    } catch (err) {
        console.error("Error searching file:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.updateDq = async (req, res) => {
    try {
        const { src_object_key, dq_rules } = req.body;
        await FileModel.updateFileDq(src_object_key, dq_rules);
        res.status(200).json({ message: "DQ Rules updated successfully." });
    } catch (err) {
        console.error("Update Transaction Error:", err.message);
        res.status(500).json({ error: "Failed to update rules." });
    }
};

exports.getSchemas = async (req, res) => {
    try {
        const schemas = await FileModel.getSchemas();
        res.json(schemas);
    } catch (err) {
        console.error("Error fetching schemas:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.getTables = async (req, res) => {
    try {
        const { schemaName } = req.query;
        const tables = await FileModel.getTables(schemaName);
        res.json(tables);
    } catch (err) {
        console.error("Error fetching tables:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.getPrimaryKey = async (req, res) => {
    try {
        const { schemaName, tableName } = req.query;
        const primaryKey = await FileModel.getPrimaryKey(schemaName, tableName);
        res.json({ primaryKey });
    } catch (err) {
        console.error("Error fetching primary key:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
};

exports.fetchHeaders = async (req, res) => {
    try {
        const { directory, fileName, extension } = req.query;
        if (!directory || !fileName || !extension) {
            return res.status(400).json({ error: "Missing required parameters: directory, fileName, or extension" });
        }
        
        const fullPath = path.join(directory, fileName + extension);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: `File not found at: ${fullPath}` });
        }
        
        const fileStream = fs.createReadStream(fullPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        let firstLine = null;
        for await (const line of rl) {
            firstLine = line;
            break; // Stop reading after first line
        }
        
        rl.close();
        fileStream.destroy();
        
        if (!firstLine) {
            return res.status(400).json({ error: "File is empty" });
        }
        
        // Since we only support CSV with comma delimiter for now
        const columns = firstLine.split(',').map(col => col.trim()).filter(col => col.length > 0);
        
        if (columns.length === 0) {
            return res.status(400).json({ error: "No valid columns found in the header" });
        }
        
        res.json({ columns });
    } catch (err) {
        console.error("Error fetching headers:", err.message);
        res.status(500).json({ error: "Failed to read file headers" });
    }
};

exports.listDirectory = async (req, res) => {
    try {
        let dirPath = req.query.path || os.homedir();
        
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: "Directory not found" });
        }

        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: "Path is not a directory" });
        }

        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        const folders = [];
        const files = [];

        items.forEach(item => {
            try {
                if (item.isDirectory()) {
                    folders.push({ name: item.name, isDirectory: true });
                } else if (item.isFile()) {
                    files.push({ name: item.name, isDirectory: false });
                }
            } catch (e) {
                // Ignore items that can't be accessed
            }
        });

        res.json({
            currentPath: dirPath,
            folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
            files: files.sort((a, b) => a.name.localeCompare(b.name))
        });

    } catch (err) {
        console.error("Error listing directory:", err.message);
        res.status(500).json({ error: "Failed to list directory contents" });
    }
};
