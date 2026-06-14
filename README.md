# Data Engineering Portal

Welcome to the **Data Engineering Portal**! This platform provides a centralized, user-friendly interface for managing data pipelines, ingestion processes, and data quality (DQ) validations.

## 🌟 Overview

The Data Engineering Portal allows data engineers and administrators to easily onboard new data sources (such as files or Kafka streams) and define strict data quality rules before data is ingested into target PostgreSQL tables. The portal is built with a Node.js Express backend and a responsive Vanilla HTML/CSS/JS frontend, communicating with a PostgreSQL database to store configuration and metadata.

---

## 🚀 Features

- **Source Onboarding**: Configure new file-based ingestion pipelines with a guided step-by-step wizard.
- **Dynamic Schema Discovery**: Automatically fetches and displays available PostgreSQL schemas, tables, and primary keys.
- **Data Quality (DQ) Rule Mapping**: Assign specific data quality checks (e.g., Null Check, Unique Check) to individual columns.
- **Manage Existing DQ Rules**: Search for existing pipeline configurations and toggle or modify their active Data Quality rules seamlessly with soft-delete capabilities.

---

## 🏗️ Architecture

The application follows a standard three-tier architecture:

```mermaid
graph TD
    subgraph Frontend
        UI[Web UI HTML/CSS/JS]
        FileOnboarding[File Onboarding Wizard]
        DQManage[Manage DQ Rules]
        UI --> FileOnboarding
        UI --> DQManage
    end

    subgraph Backend
        API[Node.js Express Server]
        Router[API Router]
        API --> Router
    end

    subgraph Database
        PG[(PostgreSQL Database)]
    end

    FileOnboarding -- HTTP POST/GET --> API
    DQManage -- HTTP POST/GET --> API
    Router -- pg connection --> PG
```

---

## 🗄️ Database Entity-Relationship (ER) Diagram

The system stores pipeline metadata and data quality configurations across several relational tables:

```mermaid
erDiagram
    nifi_file_source_config ||--o{ nifi_file_src_metadata : "has fields"
    nifi_file_source_config ||--o{ nifi_file_source_dq_config : "has dq rules"

    nifi_file_source_config {
        int src_object_key PK
        string source_system
        string source_file_directory
        string source_file_name
        string tgt_schema_name
        string tgt_table_name
        int dq_enable_flag
        string archive_file_path
        string rejected_file_path
        string primary_key
    }

    nifi_file_src_metadata {
        int src_object_key FK
        string source_file_name
        string field_name
    }

    nifi_file_source_dq_config {
        int src_obj_key FK
        string dq_column_name
        string dq_rule_name
        int is_dq_active
    }
```

---

## 🔄 Core Workflows

### 1. File Source Onboarding Process

The onboarding wizard guides users through configuring a new data pipeline:

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend Wizard
    participant API as Backend API
    participant DB as Postgres Database

    User->>UI: Enter Source Name, File, Fields
    UI->>API: Fetch Target Schemas
    API->>DB: Query information_schema.schemata
    DB-->>API: Return Schemas
    API-->>UI: Display Schemas
    User->>UI: Select Schema
    UI->>API: Fetch Tables for Schema
    API->>DB: Query information_schema.tables
    DB-->>API: Return Tables
    API-->>UI: Display Tables
    User->>UI: Select Table
    UI->>API: Fetch Primary Key
    API->>DB: Query table_constraints
    DB-->>API: Return Primary Key
    API-->>UI: Auto-populate Primary Key
    User->>UI: Assign DQ Rules to Fields
    UI->>API: POST /api/file-onboarding (Transaction)
    API->>DB: INSERT into nifi_file_source_config
    API->>DB: INSERT into nifi_file_src_metadata
    API->>DB: INSERT into nifi_file_source_dq_config
    DB-->>API: COMMIT
    API-->>UI: Success Message
    UI-->>User: "Pipeline configuration successfully saved"
```

### 2. Managing Data Quality (DQ) Rules

Engineers can update rules for existing pipelines safely using a soft-delete mechanism:

```mermaid
flowchart TD
    A[User inputs File Name] --> B{File Exists?}
    B -- No --> C[Display Error]
    B -- Yes --> D[Fetch File Config & Active Rules]
    D --> E[User modifies/adds rules in UI]
    E --> F[Submit Changes]
    F --> G[BEGIN DB TRANSACTION]
    G --> H[Soft Delete: UPDATE is_dq_active = 0]
    H --> I[Reactivate existing rules: UPDATE is_dq_active = 1]
    I --> J[Insert brand new rules]
    J --> K[Update master dq_enable_flag]
    K --> L[COMMIT TRANSACTION]
    L --> M[Success Response]
```

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Fetch API).
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (pg module).
- **Environment**: dotenv for environment variable management.
- **Middleware**: CORS for cross-origin resource sharing.

---

## 💻 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL Database

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd onboarding_form
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `backend/` directory with your database credentials:

   ```env
   DB_USER=your_postgres_user
   DB_HOST=localhost
   DB_DATABASE=your_database_name
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   PORT=5000
   ```

4. **Run the application:**
   For development (uses nodemon):

   ```bash
   npm run dev
   ```

   For production:

   ```bash
   npm start
   ```

5. **Access the Portal:**
   Open your browser and navigate to `http://localhost:5000`

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
