package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	CheckInterval   time.Duration
	RequestTimeout  time.Duration
	MaxHistory      int
	ShutdownTimeout time.Duration
}

func Load() Config {
	return Config{
		Port:            env("PORT", "8080"),
		CheckInterval:   durationEnv("PULSE_CHECK_INTERVAL", 30*time.Second),
		RequestTimeout:  durationEnv("PULSE_REQUEST_TIMEOUT", 5*time.Second),
		MaxHistory:      intEnv("PULSE_MAX_HISTORY", 20),
		ShutdownTimeout: durationEnv("PULSE_SHUTDOWN_TIMEOUT", 10*time.Second),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
