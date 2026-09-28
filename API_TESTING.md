# API Testing Guide

## Base URL

```
http://localhost:7000
```

`PORT` is read from `.env` (defaults to `7000`).

## Headers

No authentication headers are required. For requests that would send a JSON body, set:

```
Content-Type: application/json
```

(None of the current routes require a body — they use only URL params — but this header is safe to include on every request.)

## Endpoints

### 1. List all users
- **Method:** `GET`
- **Route:** `/api/users`
- **Body:** none
- **Response:**
```json
{ "users": ["shirsat1847", "..."] }
```

### 2. Create a user folder
- **Method:** `POST`
- **Route:** `/api/users/:user`
- **Example:** `POST /api/users/kshitijshirsat1847`
- **Body:** none
- **Behavior:** creates `user/` in the bucket if missing.
- **Response:**
```json
{
  "user": "kshitijshirsat1847",
  "key": "kshitijshirsat1847/",
  "created": true,
  "result": { "...": "S3 PutObject response" }
}
```
- **If the user already exists:**
```json
{
  "user": "kshitijshirsat1847",
  "key": "kshitijshirsat1847/",
  "created": false,
  "message": "User already exists"
}
```

### 3. Create a version folder for a user
- **Method:** `POST`
- **Route:** `/api/users/:user/:version`
- **Example:** `POST /api/users/shirsat1847/2607`
- **Body:** none
- **Behavior:** creates `user/version/` in the bucket. The user folder must already exist.
- **Response:**
```json
{
  "user": "shirsat1847",
  "version": "2607",
  "key": "shirsat1847/2607/",
  "created": true,
  "result": { "...": "S3 PutObject response" }
}
```
- **If the version already exists:**
```json
{
  "user": "shirsat1847",
  "version": "2607",
  "key": "shirsat1847/2607/",
  "created": false,
  "message": "Version already exists"
}
```
- **Errors:** `404` with `{ "error": "No user found" }` if the user folder doesn't exist

### 4. List versions under a user
- **Method:** `GET`
- **Route:** `/api/users/:user/versions`
- **Example:** `GET /api/users/kshitijshirsat1847/versions`
- **Body:** none
- **Response:**
```json
{
  "user": "kshitijshirsat1847",
  "count": 2,
  "versions": ["2607", "2704"]
}
```
- **If the user exists but has no versions:**
```json
{
  "user": "kshitijshirsat1847",
  "count": 0,
  "versions": []
}
```
- **Errors:** `404` with `{ "error": "No user found" }` if the user folder doesn't exist

### 5. Get results across all users for a version
- **Method:** `GET`
- **Route:** `/api/results/:version`
- **Example:** `GET /api/results/2607`
- **Body:** none
- **Response:**
```json
{
  "users": [
    {
      "user": "shirsat1847",
      "version": "2607",
      "files": [
        {
          "key": "...",
          "tags": { "TransactionType": "MoveTransaction" },
          "content": {}
        }
      ]
    }
  ]
}
```

Each file entry includes `tags` — the S3 object tags (e.g. `TransactionType`) retrieved via `GetObjectTaggingCommand`.

### 6. List result file names under a user's version (no content)
- **Method:** `GET`
- **Route:** `/api/users/:user/:version/files`
- **Example:** `GET /api/users/shirsat1847/2607/files`
- **Body:** none
- **Response:**
```json
{
  "user": "shirsat1847",
  "version": "2607",
  "files": ["result.json1789310773941", "result.html", "result1.html"]
}
```

### 7. Get a test result file by name (HTML)
- **Method:** `GET`
- **Route:** `/api/users/:user/:version/:fileName`
- **Example:** `GET /api/users/shirsat1847/2607/result.html`
- **Body:** none
- **Response:** raw HTML file content (`Content-Type: text/html`)
- **Errors:** `404` with `{ "error": "File \"result.html\" not found" }` if the file doesn't exist

## Testing with Postman / curl

```bash
curl http://localhost:7000/api/users
curl -X POST http://localhost:7000/api/users/kshitijshirsat1847
curl -X POST http://localhost:7000/api/users/kshitijshirsat1847/2607
curl http://localhost:7000/api/users/kshitijshirsat1847/versions
curl http://localhost:7000/api/results/2607
curl http://localhost:7000/api/users/shirsat1847/2607/files
curl http://localhost:7000/api/users/shirsat1847/2607/result.html
```

## Errors

Error responses use this format:
```json
{ "error": "message" }
```

Validation errors return `400`, missing users or files return `404`, and unexpected S3 errors return `500`.
