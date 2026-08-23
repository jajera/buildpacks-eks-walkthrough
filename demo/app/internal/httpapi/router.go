package httpapi

import (
	"net/http"

	"github.com/buildpacks-eks-eval/pulse/internal/monitor"
)

func NewRouter(store *monitor.Store) http.Handler {
	h := NewHandler(store)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", h.Healthz)
	mux.HandleFunc("GET /readyz", h.Readyz)
	mux.HandleFunc("GET /api/v1/meta", h.Meta)
	mux.HandleFunc("GET /api/v1/monitors", h.ListMonitors)
	mux.HandleFunc("POST /api/v1/monitors", h.CreateMonitor)
	mux.HandleFunc("GET /api/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.GetMonitor(w, r, r.PathValue("id"))
	})
	mux.HandleFunc("PATCH /api/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.UpdateMonitor(w, r, r.PathValue("id"))
	})
	mux.HandleFunc("DELETE /api/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request) {
		h.DeleteMonitor(w, r, r.PathValue("id"))
	})
	mux.HandleFunc("GET /api/v1/monitors/{id}/history", func(w http.ResponseWriter, r *http.Request) {
		h.MonitorHistory(w, r, r.PathValue("id"))
	})
	mux.HandleFunc("GET /{$}", h.Dashboard)

	return mux
}
