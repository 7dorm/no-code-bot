package main

import (
	"log"
	"os"
	"time"
)

func parseSessionTTL() time.Duration {
	const defaultTTL = 90 * 24 * time.Hour // ~3 months

	raw := os.Getenv("SESSION_TTL")
	if raw == "" {
		return defaultTTL
	}

	ttl, err := time.ParseDuration(raw)
	if err != nil {
		log.Printf("Invalid SESSION_TTL %q, using default %s", raw, defaultTTL)
		return defaultTTL
	}

	if ttl <= 0 {
		log.Printf("SESSION_TTL must be positive, using default %s", defaultTTL)
		return defaultTTL
	}

	return ttl
}

func parseCleanupInterval() time.Duration {
	const defaultInterval = time.Hour

	raw := os.Getenv("SESSION_CLEANUP_INTERVAL")
	if raw == "" {
		return defaultInterval
	}

	interval, err := time.ParseDuration(raw)
	if err != nil {
		log.Printf("Invalid SESSION_CLEANUP_INTERVAL %q, using default %s", raw, defaultInterval)
		return defaultInterval
	}

	if interval <= 0 {
		return defaultInterval
	}

	return interval
}
