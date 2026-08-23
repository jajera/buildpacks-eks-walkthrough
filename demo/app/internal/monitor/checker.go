package monitor

import (
	"context"
	"net/http"
	"time"
)

type Checker struct {
	client  *http.Client
	store   *Store
	interval time.Duration
}

func NewChecker(store *Store, timeout, interval time.Duration) *Checker {
	return &Checker{
		store: store,
		interval: interval,
		client: &http.Client{
			Timeout: timeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (c *Checker) Run(ctx context.Context) {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	c.runOnce()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.runOnce()
		}
	}
}

func (c *Checker) runOnce() {
	for _, m := range c.store.EnabledMonitors() {
		c.check(m)
	}
}

func (c *Checker) check(m Monitor) {
	start := time.Now()
	result := CheckResult{
		MonitorID: m.ID,
		CheckedAt: start.UTC(),
	}

	req, err := http.NewRequest(http.MethodGet, m.URL, nil)
	if err != nil {
		result.Status = StatusDown
		result.Error = err.Error()
		_, _ = c.store.RecordCheck(m.ID, result)
		return
	}
	req.Header.Set("User-Agent", "Pulse/1.0 (buildpacks-eks-eval)")

	resp, err := c.client.Do(req)
	result.LatencyMs = time.Since(start).Milliseconds()
	if err != nil {
		result.Status = StatusDown
		result.Error = err.Error()
		_, _ = c.store.RecordCheck(m.ID, result)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		result.Status = StatusUp
	} else {
		result.Status = StatusDown
		result.Error = resp.Status
	}
	_, _ = c.store.RecordCheck(m.ID, result)
}
