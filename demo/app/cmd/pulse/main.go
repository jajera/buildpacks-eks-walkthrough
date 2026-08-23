package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/buildpacks-eks-eval/pulse/internal/config"
	"github.com/buildpacks-eks-eval/pulse/internal/httpapi"
	"github.com/buildpacks-eks-eval/pulse/internal/monitor"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	store := monitor.NewStore(cfg.MaxHistory)
	checker := monitor.NewChecker(store, cfg.RequestTimeout, cfg.CheckInterval)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go checker.Run(ctx)

	seedDemoMonitors(store, logger)

	router := httpapi.NewRouter(store)
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("pulse listening", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Info("shutting down")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
		os.Exit(1)
	}
}

func seedDemoMonitors(store *monitor.Store, logger *slog.Logger) {
	demos := []monitor.CreateInput{
		{Name: "Example.com", URL: "https://example.com"},
		{Name: "JSONPlaceholder", URL: "https://jsonplaceholder.typicode.com/todos/1"},
	}
	for _, d := range demos {
		if _, err := store.Create(d); err != nil {
			logger.Warn("demo seed skipped", "name", d.Name, "error", err)
		}
	}
}
