# API Testing Guide

## Environment Variables

The API loads values from `.env` through `dotenv`. The following four variables are required by the S3 client:

| Variable | Required | Used for |
| --- | --- | --- |
| `AWS_REGION` | Yes | AWS region for the S3 client |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials |
| `BUCKET_NAME` | Yes | S3 bucket used for test results |
| `PORT` | No | API server port; defaults to `7000` |

The trace viewer runs through the API server. These settings are optional:

| Variable | Default | Used for |
| --- | --- | --- |
| `PLAYWRIGHT_PORT` | `9323` | First port checked for a Playwright trace session; increments if occupied |
| `SESSION_TIMEOUT` | `360000` | Session lifetime in milliseconds (6 minutes) |

Example `.env` keys (provide the actual values for your environment):

```dotenv
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BUCKET_NAME=
PORT=7000
```

## Start the Servers

Start the API and trace viewer together from the project directory:

```bash
node server.js
```

The API and trace viewer use the same base URL, which defaults to `http://localhost:7000`.

## Test with the Current S3 Data

The following examples use the user and version shown in the S3 bucket: `kshitijshirsat1847/2704`.

Check that the API is running:

```powershell
Invoke-RestMethod "http://localhost:7000/api/health"
```

List the execution folders under that version. This endpoint returns folder names only; it does not return the files inside them:

```powershell
$folders = Invoke-RestMethod "http://localhost:7000/api/users/kshitijshirsat1847/2704/folders"
$folders.folders
```

Example response:

```json
{
  "user": "kshitijshirsat1847",
  "version": "2704",
  "folders": [
    "testexecution05aadd03bf1143",
    "testexecution3dd1e1f5959249",
    "testexecution46152de4fd6a48",
    "testexecution4a76950a4df74f"
  ]
}
```

To retrieve result files and their contents, call the version results endpoint. It returns results for **all users** for that version, so filter the response by user:

```powershell
$results = Invoke-RestMethod "http://localhost:7000/api/results/2704"
$userResults = $results.users | Where-Object { $_.user -eq "kshitijshirsat1847" }
$userResults | ConvertTo-Json -Depth 20
```

Each entry in `files` contains an S3 `key`, object `tags`, and `content`. To display only files from one execution folder:

```powershell
$userResults.files | Where-Object {
    $_.key -like "*/testexecution3dd1e1f5959249/*"
} | ConvertTo-Json -Depth 20
```

## API Routes

Requests do not require authentication in this application. All routes below are handled by `server.js`.

### `GET /`

Returns plain text:

```text
Hello, World!
```

### `GET /api/health`

Returns the API health status:

```json
{ "status": "ok" }
```

### `GET /api/users`

Lists the user folders in the configured S3 bucket.

```json
{ "users": ["shirsat1847"] }
```

### `POST /api/users/:user`

Creates a user folder. No request body is required. If it already exists, the response has `created: false`.

```json
{
  "user": "shirsat1847",
  "key": "shirsat1847/",
  "created": true,
  "result": {}
}
```

`result` contains the S3 `PutObject` response when a folder is created; it is omitted when the folder already exists.

### `GET /api/users/:user/versions`

Lists version folders for an existing user. A user with no versions gets an empty list.

```json
{
  "user": "shirsat1847",
  "count": 2,
  "versions": ["2607", "2704"]
}
```

Returns `404` with `{ "error": "No user found" }` if the user folder does not exist.

### `POST /api/users/:user/:version`

Creates a version folder for an existing user. No request body is required. Returns `404` with `{ "error": "No user found" }` if the user folder does not exist. If the version already exists, the response has `created: false`.

```json
{
  "user": "shirsat1847",
  "version": "2607",
  "key": "shirsat1847/2607/",
  "created": true,
  "result": {}
}
```

### `GET /api/results/:version`

Returns objects under the requested version for every user. Each file includes its S3 key, tags, and content. JSON objects are parsed; non-JSON content is returned as text.

```json
{
  "users": [
    {
      "user": "kshitijshirsat1847",
      "version": "2704",
      "files": [
        {
          "key": "kshitijshirsat1847/2704/testexecution3dd1e1f5959249/testexecution3dd1e1f5959249.html",
          "tags": {},
          "content": "<html>..."
        }
      ]
    }
  ]
}
```

### `GET /api/users/:user/:version/folders`

Lists only the immediate folder names under a user's version. It does not list or fetch files inside those folders. The older `/api/users/:user/:version/files` path is retained as an alias and returns the same response.

```json
{
  "user": "kshitijshirsat1847",
  "version": "2704",
  "folders": [
    "testexecution05aadd03bf1143",
    "testexecution3dd1e1f5959249",
    "testexecution46152de4fd6a48",
    "testexecution4a76950a4df74f"
  ]
}
```

### `GET /api/users/:user/:version/:testExecutionId`

Returns the execution HTML file as an HTML response. The filename is built from the execution ID, so the S3 key is `user/version/testExecutionId/testExecutionId.html`. For example:

```text
GET /api/users/kshitijshirsat1847/2704/testexecution3dd1e1f5959249
```

PowerShell request:

```powershell
$url = "http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution3dd1e1f5959249"
Invoke-WebRequest $url
```

Handler errors are returned as `404` JSON:

```json
{ "error": "<S3 error message>" }
```

### `GET /api/users/:user/:version/:testExecutionId/tags`

Returns the S3 tags for the execution HTML file. The filename is built from the execution ID as `<testExecutionId>.html`.

```powershell
$url = "http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution3dd1e1f5959249/tags"
Invoke-RestMethod $url
```

The response contains the S3 tag set:

```json
{
  "tags": [
    { "Key": "example-key", "Value": "example-value" }
  ]
}
```

If the S3 object is not found, the API returns `404` JSON:

```json
{ "error": "<S3 error message>" }
```

### `GET /api/users/:user/:version/:testExecutionId/trace`

Downloads the execution trace ZIP from `user/version/testExecutionId/testExecutionId.zip`. The API first saves a backend copy under `traces/<testExecutionId>-<uuid>.zip`, then returns the ZIP as an attachment named `<testExecutionId>.zip`. `-OutFile` selects where the client saves its downloaded copy.

```powershell
$url = "http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution05aadd03bf1143/trace"
Invoke-WebRequest $url -OutFile "testexecution05aadd03bf1143.zip"
```

The standalone downloader uses the sample user, version, and execution ID above and saves a uniquely named ZIP in the project `traces/` directory:

```powershell
node .\downloadTrace.js
```

## Trace Viewer

The trace viewer is integrated into the API server; no separate trace-viewer server or port is required. Open this URL in a browser, replacing the user, version, and execution ID with the target execution:

```text
http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution05aadd03bf1143/trace/viewer
```

The route performs these steps:

1. Downloads `user/version/testExecutionId/testExecutionId.zip` from S3.
2. Saves the ZIP under `traces/<sanitizedTestExecutionId>-<uuid>.zip` and returns that local path to the viewer handler.
3. Starts `npx playwright show-trace` on an available local port, starting with `PLAYWRIGHT_PORT` (default `9323`).
4. Returns a JSON response containing the `sessionId`, absolute viewer `url`, internal Playwright `port`, and a `reused` flag. The API proxies the returned URL to the matching Playwright process.

Each active execution has its own UUID `sessionId`. Different executions get different sessions; requesting the same user, version, and execution ID again reuses its active session. The same downloaded file under `traces/` is passed to Playwright, and remains there after the session expires. API clients receive JSON; use its `url` to open the viewer. For example, from PowerShell:

```powershell
$session = Invoke-RestMethod "http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution05aadd03bf1143/trace/viewer"
$session | ConvertTo-Json
Start-Process $session.url
```

Example response:

```json
{
  "sessionId": "<session-uuid>",
  "url": "http://localhost:7000/viewer/<session-uuid>/",
  "port": 9323,
  "reused": false
}
```

List active sessions with `GET /api/trace/sessions` (the `/sessions` path is an alias):

```powershell
Invoke-RestMethod "http://localhost:7000/api/trace/sessions" | ConvertTo-Json -Depth 5
```

Example response:

```json
{
  "totalSessions": 1,
  "sessions": [
    {
      "sessionId": "<session-uuid>",
      "traceName": "kshitijshirsat1847/2704/testexecution05aadd03bf1143",
      "port": 9323,
      "createdAt": "2026-09-28T12:00:00.000Z"
    }
  ]
}
```

The `port` is the internal Playwright port; access the viewer through `/viewer/:sessionId/` on the API port. If that session ID is no longer active, the viewer route returns `404 Session not found`. Sessions expire after `SESSION_TIMEOUT` milliseconds (default `360000`, six minutes); expiration stops Playwright. The downloaded ZIP remains in `traces/` after the viewer session closes. A missing S3 ZIP returns `404` JSON; viewer startup errors return `500` JSON.

## Example Requests

```bash
curl http://localhost:7000/api/health
curl http://localhost:7000/api/users
curl -X POST http://localhost:7000/api/users/shirsat1847
curl -X POST http://localhost:7000/api/users/shirsat1847/2607
curl http://localhost:7000/api/users/shirsat1847/versions
curl http://localhost:7000/api/results/2607
curl http://localhost:7000/api/users/shirsat1847/2607/folders
curl http://localhost:7000/api/users/kshitijshirsat1847/2704/testexecution3dd1e1f5959249
curl http://localhost:7000/api/trace/sessions
```

The API returns JSON for its data routes. Unexpected S3 errors are returned as `500` on most API routes; the file-content route currently maps handler errors to `404`.