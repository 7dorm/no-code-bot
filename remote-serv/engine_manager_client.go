package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type EngineManagerClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewEngineManagerClient(baseURL string) *EngineManagerClient {
	return &EngineManagerClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *EngineManagerClient) NewConfig(config Config) (string, error) {
	url := fmt.Sprintf("%s/api/configs", c.baseURL)
	
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(config))
	if err != nil {
		return "", fmt.Errorf("failed to create config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create config: status %d, body: %s", resp.StatusCode, string(body))
	}

	var result struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return result.ID, nil
}

func (c *EngineManagerClient) ApplyPatches(patch []byte, token string) error {
	url := fmt.Sprintf("%s/api/configs/%s", c.baseURL, token)
	
	req, err := http.NewRequest("PATCH", url, bytes.NewReader(patch))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json-patch+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to apply patches: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to apply patches: status %d, body: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *EngineManagerClient) GetConfig(configId string) (Config, error) {
	url := fmt.Sprintf("%s/api/configs/%s", c.baseURL, configId)
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get config: status %d, body: %s", resp.StatusCode, string(body))
	}

	config, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return Config(config), nil
}

func (c *EngineManagerClient) DeleteConfig(configId uuid.UUID) error {
	url := fmt.Sprintf("%s/api/configs/%s", c.baseURL, configId.String())
	
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete config: status %d, body: %s", resp.StatusCode, string(body))
	}

	return nil
}
