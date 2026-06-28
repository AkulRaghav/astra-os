package services

import (
	"testing"
)

func TestCreateFolderInput(t *testing.T) {
	input := CreateFolderInput{
		Name:    "Documents",
		OwnerID: "user-123",
	}

	if input.Name != "Documents" {
		t.Errorf("expected name 'Documents', got '%s'", input.Name)
	}
	if input.ParentID != nil {
		t.Error("expected nil ParentID")
	}
}

func TestUploadFileInput(t *testing.T) {
	input := UploadFileInput{
		Name:       "report.pdf",
		MimeType:   "application/pdf",
		Size:       1024,
		StorageKey: "files/user-123/report.pdf",
		OwnerID:    "user-123",
	}

	if input.Size != 1024 {
		t.Errorf("expected size 1024, got %d", input.Size)
	}
}
