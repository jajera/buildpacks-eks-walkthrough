package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/buildpacks-eks-eval/pulse/internal/monitor"
)

type Handler struct {
	store *monitor.Store
	start time.Time
}

func NewHandler(store *monitor.Store) *Handler {
	return &Handler{store: store, start: time.Now().UTC()}
}

func (h *Handler) Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) Readyz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (h *Handler) Meta(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"name":    "Pulse",
		"version": "1.0.0",
		"uptime":  time.Since(h.start).Round(time.Second).String(),
		"summary": h.store.Summary(),
	})
}

func (h *Handler) ListMonitors(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"monitors": h.store.List(),
		"summary":  h.store.Summary(),
	})
}

func (h *Handler) CreateMonitor(w http.ResponseWriter, r *http.Request) {
	var in monitor.CreateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	m, err := h.store.Create(in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

func (h *Handler) GetMonitor(w http.ResponseWriter, r *http.Request, id string) {
	m, err := h.store.Get(id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (h *Handler) UpdateMonitor(w http.ResponseWriter, r *http.Request, id string) {
	var in monitor.UpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	m, err := h.store.Update(id, in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (h *Handler) DeleteMonitor(w http.ResponseWriter, r *http.Request, id string) {
	if err := h.store.Delete(id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) MonitorHistory(w http.ResponseWriter, r *http.Request, id string) {
	history, err := h.store.History(id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"history": history})
}

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, monitor.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, monitor.ErrInvalidInput), errors.Is(err, monitor.ErrInvalidURL):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
