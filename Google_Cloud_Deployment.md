# Deployment and Cloud Data Integration Report

## Executive Summary

This document provides a formal technical overview of the successful containerization, continuous integration, and production-grade deployment of the Image Search API service. The system utilizes a serverless architecture via **Google Cloud Run (GCR)** coupled with a highly scalable, distributed **TiDB Cloud Serverless** database layer.

All communications between the application layer and the persistence layer are fully encrypted, satisfying standard enterprise security compliances for data-in-transit.

---

## Technical Architecture & Dependency Matrix

* **Application Framework:** Node.js with Apollo Server
* **Database Driver:**`mysql2` (Connection Pooling Mode)
* **Data Persistence Layer:** TiDB Cloud Serverless
* **Containerization Engine:** Docker (OCI-compliant Image)
* **CI/CD Pipeline:** GitHub Actions
* **Hosting Platform:** Google Cloud Run (Fully Managed Serverless Container Platform)

---

## Artifact & Deployment Registry

For auditing and deployment tracking, the target infrastructure and build artifacts are cataloged below:

* **Production Service Gateway (Demo URL):**`https://image-search-api-272311020444.asia-east2.run.app`
* **Target Container Image URI (Docker Hub):**`index.docker.io/xev0lx/image-search-api:latest`

## Engineering Implementation Details

### 1. Transport Layer Security (TLS/SSL) & Database Integration

In compliance with cloud security frameworks, TiDB Cloud Serverless strictly enforces encrypted transport layers, prohibiting unencrypted connections (`Insecure Transport`).

To eliminate the operational overhead and security risks associated with managing local certificate authority (`.pem`) files within the repository or image layers, the database pool configuration utilizes standard **System-Trusted Certificate Chain Validation**.

**JavaScript**

```
/**
 * Database Connection Pool Configuration
 * Location: /config/db.js
 */
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,         // Enterprise Database Gateway Endpoint
  user: process.env.DB_USER,         // Database Authentication User
  password: process.env.DB_PASSWORD, // Database Authentication Password (Injected via Secrets)
  database: process.env.DB_NAME,     // Target Schema (Target: 'test')
  port: 4000,                        // Standard TiDB Distributed Port
  waitForConnections: true,
  connectionLimit: 10,               // Optimized connection ceiling per container instance
  queueLimit: 0,
  
  // Enforce Enterprise-Grade TLS/SSL Encryption
  ssl: {
    rejectUnauthorized: true         // Mandates strict server certificate verification against Root CA
  }
});

module.exports = pool.promise();
```

*Architecture Note: The production environment on Google Cloud Run includes standard Root CAs (including ISRG Root X1, which signs TiDB certificates). Setting `rejectUnauthorized: true` allows the runtime environment to validate the remote database certificate chain natively, ensuring cryptographic safety without manual key rotation.*

### 2. CI/CD Pipeline Automation

The deployment workflow is fully automated through a GitHub Actions pipeline. Code integrations pushed to the `main` branch trigger isolated virtual runners to build, optimize, and push the compliant image to the registry.

**YAML**

```
# Workflow Descriptor: .github/workflows/docker-build.yml
name: Build and Push Docker Image

on:
  push:
    branches: [ "main" ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/image-search-api:latest
```

### 3. Google Cloud Run Infrastructure Provisioning

The validated image is deployed to Google Cloud Run under the following production parameters:

* **Region Allocation:**`asia-east2` (Hong Kong, selected for high regional availability and ultra-low latency).
* **Auto-Scaling Policy:** Minimum instances set to `0` (cost-optimized cold start capability); maximum scale threshold capped at `20` concurrent instances to throttle resource allocation and prevent horizontal budget spikes.
* **Network & Ingress:** Exposes internal port `8080`, wrapped externally by Google’s automated HTTPS load balancing layer.
* **Secrets Management:** Sensitive database credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD` and API keys) are decoupled from the code and safely injected via environment variables at the container runtime level.

### 4. Database Schema and DDL Execution

To accommodate the API's registration entity requirements, the corresponding target relational schema was initialized within the database instance:

**SQL**

```
-- Target Database Context Selection
USE test;

-- User Master Ledger Table Creation
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## QA Verification & Integration Testing Guide

Internal QA engineers and frontend teams can verify endpoint availability and database transaction compliance using Postman via the following protocol:

### Test Case: User Registration Interface Validation

1. **Protocol and Endpoint Setup:**
   * **Method:**`POST`
   * **URL:**`https://image-search-api-272311020444.asia-east2.run.app/graphql`
   * **Headers:**`Content-Type: application/json`
2. **GraphQL Payload Structure:**
   Select the **GraphQL** body type in Postman (or pass as raw JSON) using the following Mutation payload:

**GraphQL**

```
mutation RegisterUser($username: String!, $email: String!, $password: String!) {
  register(username: $username, email: $email, password: $password) {
    id
    username
    email
    createdAt
  }
}
```

3. **GraphQL Variables:**

**JSON**

```
{
  "username": "testuser01",
  "email": "testuser01@enterprise.local",
  "password": "SecurePassword123!"
}
```

### Expected Architectural Lifecycle & Behavior:

* **Inbound Traffic:** The load balancer forwards the HTTPS payload to the active Cloud Run instance on port `8080`.
* **Database TLS Handshake:** The application creates a connection thread via connection pool, forcing an encrypted TLS session to `DB_HOST`.
* **Execution:** The SQL record is successfully committed into the `test.users` ledger.
* **Response Client:** Returns a HTTP `200 OK` status with the structured JSON metadata containing the generated user ID.

---

## Diagnostic Audit Matrix


| **Audit Layer**                        | **Method**                      | **Observed Behavior**                                                                                                                                          | **Status** |
| -------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Ingress Network**                    | Public HTTPS`GET`Request        | Server returns standard Express`Cannot GET /`error, validating that the routing layer and firewall policies are completely open to legitimate gateway traffic. | **PASSED** |
| **API Parsing**                        | Postman GraphQL`POST`Payload    | The Apollo server successfully intercepts inbound mutations at the`/graphql`route.                                                                             | **PASSED** |
| **Secure Inter-Service Communication** | Mutation Execution (`register`) | Server performs a secure TLS handshake, connects to TiDB Cloud, writes the database row payload, and returns a sanitized`200 OK`JSON response.                 | **PASSED** |

## Conclusion

The application stack conforms to standard enterprise decoupling practices: stateless application execution on Google Cloud Run, secure network tunnels via Native TLS, and a cloud-native distributed storage engine on TiDB Cloud. The pipeline is fully integrated and ready for operational use.
