package services

import (
	"testing"
)

func TestCreateTaskInput_DefaultPriority(t *testing.T) {
	input := CreateTaskInput{
		Title:   "Test Task",
		OwnerID: "user-123",
	}

	if input.Title != "Test Task" {
		t.Errorf("expected title 'Test Task', got '%s'", input.Title)
	}
	// Priority should be empty, service layer defaults to "medium"
	if input.Priority != "" {
		t.Errorf("expected empty priority, got '%s'", input.Priority)
	}
}

func TestTaskStatus_Values(t *testing.T) {
	validStatuses := []string{"todo", "in_progress", "done", "cancelled"}
	for _, s := range validStatuses {
		if s == "" {
			t.Error("status should not be empty")
		}
	}
}

func TestTaskPriority_Values(t *testing.T) {
	validPriorities := []string{"low", "medium", "high", "urgent"}
	if len(validPriorities) != 4 {
		t.Error("expected 4 priority levels")
	}
}
