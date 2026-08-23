package monitor

import "time"

type Status string

const (
	StatusUp       Status = "up"
	StatusDown     Status = "down"
	StatusPending  Status = "pending"
	StatusDisabled Status = "disabled"
)

type Monitor struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	URL         string    `json:"url"`
	Enabled     bool      `json:"enabled"`
	Status      Status    `json:"status"`
	LastChecked time.Time `json:"lastChecked,omitempty"`
	LastLatency int64     `json:"lastLatencyMs,omitempty"`
	LastError   string    `json:"lastError,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CheckResult struct {
	MonitorID string    `json:"monitorId"`
	Status    Status    `json:"status"`
	LatencyMs int64     `json:"latencyMs,omitempty"`
	Error     string    `json:"error,omitempty"`
	CheckedAt time.Time `json:"checkedAt"`
}

type Summary struct {
	Total   int `json:"total"`
	Up      int `json:"up"`
	Down    int `json:"down"`
	Pending int `json:"pending"`
}

type CreateInput struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type UpdateInput struct {
	Name    *string `json:"name,omitempty"`
	URL     *string `json:"url,omitempty"`
	Enabled *bool   `json:"enabled,omitempty"`
}
