package monitor

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"sync"
	"time"
)

var (
	ErrNotFound      = errors.New("monitor not found")
	ErrInvalidInput  = errors.New("name and url are required")
	ErrInvalidURL    = errors.New("url must start with http:// or https://")
)

type Store struct {
	mu       sync.RWMutex
	monitors map[string]*Monitor
	history  map[string][]CheckResult
	maxHist  int
}

func NewStore(maxHistory int) *Store {
	return &Store{
		monitors: make(map[string]*Monitor),
		history:  make(map[string][]CheckResult),
		maxHist:  maxHistory,
	}
}

func (s *Store) List() []Monitor {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Monitor, 0, len(s.monitors))
	for _, m := range s.monitors {
		out = append(out, *m)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out
}

func (s *Store) Get(id string) (Monitor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, ok := s.monitors[id]
	if !ok {
		return Monitor{}, ErrNotFound
	}
	return *m, nil
}

func (s *Store) Create(in CreateInput) (Monitor, error) {
	if in.Name == "" || in.URL == "" {
		return Monitor{}, ErrInvalidInput
	}
	if !validURL(in.URL) {
		return Monitor{}, ErrInvalidURL
	}

	now := time.Now().UTC()
	m := Monitor{
		ID:        newID(),
		Name:      in.Name,
		URL:       in.URL,
		Enabled:   true,
		Status:    StatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.monitors[m.ID] = &m
	return m, nil
}

func (s *Store) Update(id string, in UpdateInput) (Monitor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, ok := s.monitors[id]
	if !ok {
		return Monitor{}, ErrNotFound
	}

	if in.Name != nil {
		if *in.Name == "" {
			return Monitor{}, ErrInvalidInput
		}
		m.Name = *in.Name
	}
	if in.URL != nil {
		if !validURL(*in.URL) {
			return Monitor{}, ErrInvalidURL
		}
		m.URL = *in.URL
		m.Status = StatusPending
	}
	if in.Enabled != nil {
		m.Enabled = *in.Enabled
		if !m.Enabled {
			m.Status = StatusDisabled
			m.LastError = ""
		} else if m.Status == StatusDisabled {
			m.Status = StatusPending
		}
	}
	m.UpdatedAt = time.Now().UTC()
	return *m, nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.monitors[id]; !ok {
		return ErrNotFound
	}
	delete(s.monitors, id)
	delete(s.history, id)
	return nil
}

func (s *Store) RecordCheck(id string, result CheckResult) (Monitor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, ok := s.monitors[id]
	if !ok {
		return Monitor{}, ErrNotFound
	}

	m.Status = result.Status
	m.LastChecked = result.CheckedAt
	m.LastLatency = result.LatencyMs
	m.LastError = result.Error
	m.UpdatedAt = result.CheckedAt

	h := append(s.history[id], result)
	if len(h) > s.maxHist {
		h = h[len(h)-s.maxHist:]
	}
	s.history[id] = h
	return *m, nil
}

func (s *Store) History(id string) ([]CheckResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := s.monitors[id]; !ok {
		return nil, ErrNotFound
	}
	out := append([]CheckResult(nil), s.history[id]...)
	return out, nil
}

func (s *Store) Summary() Summary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var sum Summary
	for _, m := range s.monitors {
		sum.Total++
		switch m.Status {
		case StatusUp:
			sum.Up++
		case StatusDown:
			sum.Down++
		default:
			sum.Pending++
		}
	}
	return sum
}

func (s *Store) EnabledMonitors() []Monitor {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Monitor, 0)
	for _, m := range s.monitors {
		if m.Enabled {
			out = append(out, *m)
		}
	}
	return out
}

func validURL(u string) bool {
	return len(u) > 8 && (u[:7] == "http://" || u[:8] == "https://")
}

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
