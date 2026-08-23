package httpapi

import (
	"html/template"
	"net/http"
)

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	monitors := h.store.List()
	summary := h.store.Summary()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = dashboardTemplate.Execute(w, map[string]any{
		"Monitors": monitors,
		"Summary":  summary,
	})
}

var dashboardTemplate = template.Must(template.New("dashboard").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pulse — Service Monitor</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #0b1020; color: #e8ecf4; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    h1 { font-size: 1.75rem; margin: 0 0 .25rem; letter-spacing: -0.02em; }
    .sub { color: #9aa7bd; margin-bottom: 1.5rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; margin-bottom: 1.5rem; }
    .card { background: #141b31; border: 1px solid #24304f; border-radius: 12px; padding: 1rem; }
    .card .label { color: #8fa0bf; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
    .card .value { font-size: 1.6rem; font-weight: 700; margin-top: .35rem; }
    table { width: 100%; border-collapse: collapse; background: #141b31; border: 1px solid #24304f; border-radius: 12px; overflow: hidden; }
    th, td { padding: .85rem 1rem; text-align: left; border-bottom: 1px solid #24304f; }
    th { color: #8fa0bf; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; }
    tr:last-child td { border-bottom: 0; }
    .badge { display: inline-block; padding: .2rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 600; text-transform: uppercase; }
    .up { background: #12361f; color: #6ee7a8; }
    .down { background: #3a1414; color: #fca5a5; }
    .pending { background: #2a2414; color: #fcd34d; }
    .disabled { background: #1f2430; color: #94a3b8; }
    code { font-size: .85rem; color: #cbd5e1; }
    .footer { margin-top: 1.25rem; color: #7c8aa3; font-size: .85rem; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Pulse</h1>
    <p class="sub">HTTP service monitor — built with Cloud Native Buildpacks on EKS</p>

    <div class="cards">
      <div class="card"><div class="label">Total</div><div class="value">{{.Summary.Total}}</div></div>
      <div class="card"><div class="label">Up</div><div class="value">{{.Summary.Up}}</div></div>
      <div class="card"><div class="label">Down</div><div class="value">{{.Summary.Down}}</div></div>
      <div class="card"><div class="label">Pending</div><div class="value">{{.Summary.Pending}}</div></div>
    </div>

    {{if .Monitors}}
    <table>
      <thead>
        <tr><th>Name</th><th>URL</th><th>Status</th><th>Latency</th><th>Last check</th></tr>
      </thead>
      <tbody>
        {{range .Monitors}}
        <tr>
          <td>{{.Name}}</td>
          <td><code>{{.URL}}</code></td>
          <td><span class="badge {{.Status}}">{{.Status}}</span></td>
          <td>{{if .LastLatency}}{{.LastLatency}} ms{{else}}—{{end}}</td>
          <td>{{if .LastChecked}}{{.LastChecked.Format "15:04:05 UTC"}}{{else}}—{{end}}</td>
        </tr>
        {{end}}
      </tbody>
    </table>
    {{else}}
    <p>No monitors yet. Seed one via the API:</p>
    <pre><code>curl -s -X POST localhost:8080/api/v1/monitors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example","url":"https://example.com"}'</code></pre>
    {{end}}

    <p class="footer">API: <a href="/api/v1/meta">/api/v1/meta</a> · <a href="/api/v1/monitors">/api/v1/monitors</a> · probes: /healthz, /readyz</p>
  </div>
</body>
</html>`))
