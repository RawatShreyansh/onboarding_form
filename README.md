# Data Engineering Portal

Welcome to the **Data Engineering Portal**! This platform provides a centralized, user-friendly interface for managing data pipelines, ingestion processes, and data quality (DQ) validations.

## 🌟 Overview

The Data Engineering Portal allows data engineers and administrators to easily onboard new data sources (such as batch files or real-time Kafka streams) and define strict data quality rules before data is ingested into target PostgreSQL tables. The portal is built with a Node.js Express backend and a responsive Next.js (React) frontend styled with Tailwind CSS v4, communicating with a PostgreSQL database to store configuration and metadata.

---

## 🚀 Features

- **Source Onboarding**: Configure new file-based batch pipelines or Kafka streaming topics using a guided step-by-step wizard.
- **✨ AI Auto-Suggest DQ Checks**: Leverage the power of LLMs (via Groq API) to automatically scan incoming source fields and instantly suggest and apply the most appropriate Data Quality rules.
- **Remote SFTP File Browser**: Seamlessly browse remote SFTP servers with a beautiful UI to pick files for onboarding without manually typing paths.
- **Kafka Schema Auto-Discovery**: Automatically connects to your Kafka brokers to fetch a sample message and intelligently parse out all the JSON keys to use as pipeline fields.
- **Dynamic Schema Discovery**: Automatically fetches and displays available PostgreSQL schemas, tables, and primary keys.
- **Data Quality (DQ) Rule Mapping**: Assign specific data quality checks (e.g., Null Check, Unique Check) to individual columns for both files and Kafka topics.
- **Manage Existing DQ Rules**: Search for existing file or Kafka pipeline configurations and toggle or modify their active Data Quality rules seamlessly with soft-delete capabilities.
- **Premium UI/UX**: Enjoy a fully responsive, visually stunning interface designed with modern web aesthetics, interactive sidebars, and slick micro-animations.

---

## 🏗️ Architecture

The application follows a standard three-tier architecture, utilizing the MVC pattern on the backend:

```mermaid
graph TD
    subgraph Frontend
        UI[Next.js React Frontend]
        FileOnboarding[File Onboarding Wizard]
        KafkaOnboarding[Kafka Onboarding Wizard]
        DQManage[Manage DQ Rules]
        UI --> FileOnboarding
        UI --> KafkaOnboarding
        UI --> DQManage
    end

    subgraph Backend
        API[Node.js Express Server]
        Routes[API Routes]
        Controllers[Controllers]
        Models[Models]
        AI[Groq AI SDK]
        API --> Routes
        Routes --> Controllers
        Controllers --> Models
        Controllers --> AI
    end

    subgraph Database
        PG[(PostgreSQL Database)]
    end

    FileOnboarding -- HTTP POST/GET --> API
    KafkaOnboarding -- HTTP POST/GET --> API
    DQManage -- HTTP POST/GET --> API
    Models -- pg connection --> PG
    AI -- Groq API Request --> GroqCloud
```

---

## 🗄️ Database Entity-Relationship (ER) Diagram

The system stores pipeline metadata and data quality configurations across several relational tables for both Files and Kafka:

```mermaid
erDiagram
    nifi_file_source_config ||--o{ nifi_file_src_metadata : "has fields"
    nifi_file_source_config ||--o{ nifi_file_source_dq_config : "has dq rules"

    nifi_kafka_source_config ||--o{ nifi_kafka_src_metadata : "has fields"
    nifi_kafka_source_config ||--o{ nifi_kafka_source_dq_config : "has dq rules"

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

    nifi_kafka_source_config {
        int src_object_key PK
        string source_system
        string topic_name
        string message_format
        string tgt_schema_name
        string tgt_table_name
        string primary_key
        int dq_enable_flag
    }

    nifi_file_src_metadata {
        int src_object_key FK
        string source_file_name
        string field_name
    }

    nifi_kafka_src_metadata {
        int src_object_key FK
        string topic_name
        string field_name
    }

    nifi_file_source_dq_config {
        int src_obj_key FK
        string dq_column_name
        string dq_rule_name
        int is_dq_active
    }

    nifi_kafka_source_dq_config {
        int src_obj_key FK
        string dq_column_name
        string dq_rule_name
        int dq_flag
    }
```

---

## 🔄 Core Workflows

### 1. Source Onboarding Process (File & Kafka)

The onboarding wizards guide users through configuring a new data pipeline (either File or Kafka):

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend Wizard
    participant API as Backend API
    participant Groq as Groq AI Cloud
    participant DB as Postgres Database

    User->>UI: Enter Source Details, Topic/File, Fields
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
    User->>UI: Click "AI Auto-Suggest DQ Checks"
    UI->>API: POST /api/ai-suggest-dq
    API->>Groq: Request Mapping Suggestions
    Groq-->>API: JSON Field mappings
    API-->>UI: Display Sidebar AI Suggestions
    User->>UI: Assign DQ Rules to Fields / Apply AI Suggestions
    UI->>API: POST /api/file-onboarding OR /api/kafka-onboarding
    API->>DB: INSERT into Config Table
    API->>DB: INSERT into Metadata Table
    API->>DB: INSERT into DQ Rules Table
    DB-->>API: COMMIT
    API-->>UI: Success Message
    UI-->>User: "Pipeline configuration successfully saved"
```

### 2. Managing Data Quality (DQ) Rules

Engineers can update rules for existing File or Kafka pipelines safely using a soft-delete mechanism:

```mermaid
flowchart TD
    A[User inputs File or Topic Name] --> B{Source Exists?}
    B -- No --> C[Display Error]
    B -- Yes --> D[Fetch Config & Active Rules]
    D --> E[User modifies/adds rules in UI]
    E --> F[Submit Changes]
    F --> G[BEGIN DB TRANSACTION]
    G --> H[Soft Delete: UPDATE active flag = 0]
    H --> I[Reactivate existing rules: UPDATE active flag = 1]
    I --> J[Insert brand new rules]
    J --> K[Update master dq_enable_flag]
    K --> L[COMMIT TRANSACTION]
    L --> M[Success Response]
```

---

## 🛠️ Technology Stack

- **Frontend**: Next.js (React), Tailwind CSS v4, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express.js (MVC Architecture).
- **Database**: PostgreSQL (pg module).
- **AI/LLM**: Groq SDK (llama-3.1-8b-instant model)
- **Environment**: dotenv for environment variable management.
- **Middleware**: CORS for cross-origin resource sharing.

---

## 💻 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL Database
- Groq API Key (for AI features)

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
   Copy the example environment file in the backend directory and configure it with your database and AI credentials:

   ```bash
   cp backend/.env.example backend/.env
   ```
   *Edit `backend/.env` with your actual Postgres details and your `GROQ_API_KEY`.*

4. **Run the backend:**
   Open a terminal in the `backend` folder and start the API server:

   ```bash
   cd backend
   npm run dev
   ```

5. **Run the frontend:**
   Open a new terminal in the `frontend` folder and start the Next.js development server:

   ```bash
   cd frontend
   npm run dev
   ```

6. **Access the Portal:**
   Open your browser and navigate to `http://localhost:3000`

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
