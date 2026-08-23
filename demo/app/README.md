# Pulse

Small HTTP service monitor used as the buildpacks evaluation app.

## Run locally

```bash
go run ./cmd/pulse
```

Open http://localhost:8080 for the dashboard.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness probe |
| GET | `/readyz` | Readiness probe |
| GET | `/api/v1/meta` | Service metadata + summary |
| GET | `/api/v1/monitors` | List monitors |
| POST | `/api/v1/monitors` | Create monitor |
| GET | `/api/v1/monitors/{id}` | Get monitor |
| PATCH | `/api/v1/monitors/{id}` | Update monitor |
| DELETE | `/api/v1/monitors/{id}` | Delete monitor |
| GET | `/api/v1/monitors/{id}/history` | Recent check results |

### Example

```bash
curl -s -X POST localhost:8080/api/v1/monitors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Docs","url":"https://buildpacks.io"}' | jq
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP port (set by buildpacks at runtime) |
| `PULSE_CHECK_INTERVAL` | `30s` | Background check interval |
| `PULSE_REQUEST_TIMEOUT` | `5s` | Per-check HTTP timeout |
| `PULSE_MAX_HISTORY` | `20` | Check results kept per monitor |

## Buildpacks

No Dockerfile. Paketo `go` buildpack builds `./cmd/pulse` via `project.toml`.

```bash
pack build pulse \
  --builder paketobuildpacks/builder-jammy-base \
  --path .
```

Two demo monitors are seeded on startup so the dashboard is useful immediately.
