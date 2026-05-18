# Image Search API

A GraphQL-based image search backend that aggregates results from Unsplash, Pixabay, and Storyblocks while enforcing user authentication and MySQL-backed registration/login.

## Features

- GraphQL API served at `/graphql`
- User registration and login with JWT authentication
- Search across three image providers:
  - Unsplash
  - Pixabay
  - Storyblocks
- Fault-tolerant provider aggregation: failed provider requests do not break the entire search
- MySQL/TiDB-backed user storage via `mysql2`
- Docker-ready container image
- Structured logging with `winston`

## Tech stack

- Node.js + Express
- Apollo Server GraphQL
- MySQL-compatible database using `mysql2`
- `bcryptjs` for password hashing
- `jsonwebtoken` for JWT authentication
- `axios` for third-party API requests
- `dotenv` for environment configuration
- Docker for containerization

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/image-search-api.git
cd image-search-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root with the following variables:

```dotenv
PORT=3000
JWT_SECRET=your_jwt_secret

DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PIXABAY_API_KEY=your_pixabay_api_key
STORYBLOCKS_PUBLIC_KEY=your_storyblocks_public_key
STORYBLOCKS_PRIVATE_KEY=your_storyblocks_private_key
```

Optional provider base URLs for local development or proxying:

```dotenv
UNSPLASH_BASE_URL=https://api.unsplash.com/
PIXABAY_BASE_URL=https://pixabay.com/api/
STORYBLOCKS_BASE_URL=https://api.storyblocks.com/
```

### 4. Run the server locally

```bash
node server.js
```

By default, the server listens on `http://localhost:3000/graphql`.

## GraphQL API

### Endpoint

`POST /graphql`

### Schema summary

#### Types

- `AuthPayload`
  - `message: String!`
  - `token: String`
- `ImageResult`
  - `image_ID: String!`
  - `source: String!`
  - `thumbnails: String`
  - `preview: String`
  - `title: String`
  - `tags: [String!]`

#### Queries

- `searchImages(keyword: String!): [ImageResult!]!`

#### Mutations

- `register(username: String!, password: String!): AuthPayload!`
- `login(username: String!, password: String!): AuthPayload!`

## Example usage

### Register a new user

```graphql
mutation {
  register(username: "demoUser", password: "demoPass") {
    message
    token
  }
}
```

Expected response:

```json
{
  "data": {
    "register": {
      "message": "Registration successful",
      "token": null
    }
  }
}
```

### Login and receive a token

```graphql
mutation {
  login(username: "demoUser", password: "demoPass") {
    message
    token
  }
}
```

Expected response:

```json
{
  "data": {
    "login": {
      "message": "Login successful",
      "token": "Bearer eyJhbGciOi..."
    }
  }
}
```

### Search images

Use the returned `token` in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOi...
```

GraphQL query:

```graphql
query {
  searchImages(keyword: "mountain") {
    image_ID
    source
    thumbnails
    preview
    title
    tags
  }
}
```

Example response shape:

```json
{
  "data": {
    "searchImages": [
      {
        "image_ID": "12345",
        "source": "Unsplash",
        "thumbnails": "https://...",
        "preview": "https://...",
        "title": "Mountain landscape",
        "tags": ["mountain", "nature"]
      }
    ]
  }
}
```

## Authentication

- `register` creates a new user and stores hashed passwords in the database.
- `login` verifies credentials and returns a JWT token.
- `searchImages` requires a valid JWT token in the `Authorization` header.

### Authorization header format

```http
Authorization: Bearer <token>
```

## Database

The app uses a MySQL-compatible connection pool configured in `config/db.js`.

Required tables:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Docker

### Build

```bash
docker build -t image-search-api:latest .
```

### Run

```bash
docker run -p 3000:3000 --env-file .env image-search-api:latest
```

## Logging

The server uses `winston` via `logger.js` to capture:

- GraphQL errors
- database errors
- third-party API request failures

Logs are emitted to the console and can be redirected by container platforms or log collectors.

## Deployment notes

- The Dockerfile exposes port `3000` and starts the app with `node server.js`.
- In cloud environments, make sure `DB_HOST`, DB credentials, and provider keys are supplied as secrets.
- The code is designed to continue serving search results even if one external provider fails.

## Project structure

- `server.js` - Express and Apollo Server setup
- `schema.js` - GraphQL schema and resolvers
- `config/db.js` - MySQL/TiDB database pool configuration
- `services/` - provider-specific image search adapters
- `logger.js` - central logging utility
- `Dockerfile` - container build instructions
- `Google_Cloud_Deployment.md` - deployment and architecture notes

## Notes

- The JWT secret must be kept secure in production.
- Missing or invalid provider credentials will cause the corresponding provider to return no results, but the API remains available.
- Search results are aggregated from all configured services and normalized into a common image schema.
