package util

import "strings"

// SlugifyLower returns a simple lowercase slug suitable for identifiers.
// It keeps [a-z0-9] and turns other runs into a single '-'.
func SlugifyLower(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}

	var b strings.Builder
	b.Grow(len(s))
	lastDash := false
	for _, r := range s {
		isAZ := r >= 'a' && r <= 'z'
		is09 := r >= '0' && r <= '9'
		if isAZ || is09 {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}

	out := b.String()
	out = strings.Trim(out, "-")
	return out
}
