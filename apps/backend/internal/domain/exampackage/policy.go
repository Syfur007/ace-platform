package exampackage

import (
	"encoding/json"
)

// TierPolicy represents parsed policy for a tier. Fields mirror the JSON stored in DB.
type TierPolicy struct {
	AllowPractice bool `json:"allowPractice"`
	// Limits: 0 means no explicit limit defined.
	MaxPracticeSessionsPerWeek int `json:"maxPracticeSessionsPerWeek"`
	MaxExamSessionsPerWeek     int `json:"maxExamSessionsPerWeek"`
}

// NewTierPolicy parses raw JSON policy into TierPolicy and returns defaults where appropriate.
func NewTierPolicy(raw json.RawMessage) (*TierPolicy, error) {
	if len(raw) == 0 {
		raw = []byte(`{}`)
	}
	var p TierPolicy
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (p *TierPolicy) CanCreatePracticeSession() bool {
	return p.AllowPractice
}

func (p *TierPolicy) GetMaxPracticeSessionsPerWeek() int {
	if p.MaxPracticeSessionsPerWeek <= 0 {
		return 0
	}
	return p.MaxPracticeSessionsPerWeek
}

func (p *TierPolicy) GetMaxExamSessionsPerWeek() int {
	if p.MaxExamSessionsPerWeek <= 0 {
		return 0
	}
	return p.MaxExamSessionsPerWeek
}
