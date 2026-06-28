package services

import "strings"

func joinStrings(strs []string, sep string) string {
	return strings.Join(strs, sep)
}
