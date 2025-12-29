package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

type HeartbeatRequest struct {
	SessionID string          `json:"sessionId"`
	TS        string          `json:"ts"`
	Snapshot  json.RawMessage `json:"snapshot"`
}

type HeartbeatResponse struct {
	Ok       bool   `json:"ok"`
	ServerTS string `json:"serverTs"`
}

type HeartbeatStore struct {
	mu   sync.Mutex
	data map[string]HeartbeatRequest
}

func NewHeartbeatStore() *HeartbeatStore {
	return &HeartbeatStore{data: make(map[string]HeartbeatRequest)}
}

func (s *HeartbeatStore) Put(sessionID string, hb HeartbeatRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[sessionID] = hb
}

type PracticeSessionStatus string

const (
	PracticeSessionActive   PracticeSessionStatus = "active"
	PracticeSessionFinished PracticeSessionStatus = "finished"
)

type PracticeQuestionChoice struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type PracticeQuestion struct {
	ID      string                 `json:"id"`
	Prompt  string                 `json:"prompt"`
	Choices []PracticeQuestionChoice `json:"choices"`
}

type CreatePracticeSessionRequest struct {
	PackageID *string `json:"packageId"`
	Timed     bool    `json:"timed"`
	Count     int     `json:"count"`
}

type PracticeSessionResponse struct {
	SessionID     string               `json:"sessionId"`
	Status        PracticeSessionStatus `json:"status"`
	CreatedAt     string               `json:"createdAt"`
	PackageID     *string              `json:"packageId"`
	IsTimed       bool                 `json:"isTimed"`
	TargetCount   int                  `json:"targetCount"`
	CurrentIndex  int                  `json:"currentIndex"`
	Total         int                  `json:"total"`
	CorrectCount  int                  `json:"correctCount"`
	Question      *PracticeQuestion    `json:"question"`
}

type SubmitPracticeAnswerRequest struct {
	QuestionID string  `json:"questionId"`
	ChoiceID   string  `json:"choiceId"`
	TS         *string `json:"ts"`
}

type SubmitPracticeAnswerResponse struct {
	Correct     bool   `json:"correct"`
	Explanation string `json:"explanation"`
	Done        bool   `json:"done"`
}

type PracticeSessionSummaryResponse struct {
	SessionID    string  `json:"sessionId"`
	Total        int     `json:"total"`
	CorrectCount int     `json:"correctCount"`
	Accuracy     float64 `json:"accuracy"`
}

type practiceQuestionBankItem struct {
	q           PracticeQuestion
	correctID   string
	explanation string
}

type PracticeSession struct {
	SessionID    string
	CreatedAt    time.Time
	PackageID    *string
	IsTimed      bool
	TargetCount  int
	CurrentIndex int
	CorrectCount int
	Status       PracticeSessionStatus

	items []practiceQuestionBankItem
}

type PracticeStore struct {
	mu       sync.Mutex
	sessions map[string]*PracticeSession
}

func NewPracticeStore() *PracticeStore {
	return &PracticeStore{sessions: make(map[string]*PracticeSession)}
}

func (s *PracticeStore) Create(req CreatePracticeSessionRequest) *PracticeSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := req.Count
	if count <= 0 {
		count = 10
	}
	if count > 50 {
		count = 50
	}

	sessionID := fmt.Sprintf("ps-%d", time.Now().UTC().UnixNano())
	bank := demoPracticeBank()
	if count > len(bank) {
		count = len(bank)
	}

	ps := &PracticeSession{
		SessionID:    sessionID,
		CreatedAt:    time.Now().UTC(),
		PackageID:    req.PackageID,
		IsTimed:      req.Timed,
		TargetCount:  count,
		CurrentIndex: 0,
		CorrectCount: 0,
		Status:       PracticeSessionActive,
		items:        bank[:count],
	}

	s.sessions[sessionID] = ps
	return ps
}

func (s *PracticeStore) Get(sessionID string) (*PracticeSession, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ps, ok := s.sessions[sessionID]
	return ps, ok
}

func (s *PracticeStore) Submit(sessionID string, req SubmitPracticeAnswerRequest) (*SubmitPracticeAnswerResponse, *PracticeSession, bool, string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ps, ok := s.sessions[sessionID]
	if !ok {
		return nil, nil, false, "session not found"
	}
	if ps.Status != PracticeSessionActive {
		return nil, ps, false, "session not active"
	}
	if ps.CurrentIndex < 0 || ps.CurrentIndex >= len(ps.items) {
		ps.Status = PracticeSessionFinished
		return &SubmitPracticeAnswerResponse{Correct: false, Explanation: "Session complete.", Done: true}, ps, true, ""
	}

	item := ps.items[ps.CurrentIndex]
	if req.QuestionID != item.q.ID {
		return nil, ps, false, "questionId mismatch"
	}

	correct := req.ChoiceID == item.correctID
	if correct {
		ps.CorrectCount++
	}

	// Move to next question immediately; the client can fetch updated session state.
	ps.CurrentIndex++
	if ps.CurrentIndex >= ps.TargetCount {
		ps.Status = PracticeSessionFinished
	}

	resp := &SubmitPracticeAnswerResponse{
		Correct:     correct,
		Explanation: item.explanation,
		Done:        ps.Status == PracticeSessionFinished,
	}

	return resp, ps, true, ""
}

func demoPracticeBank() []practiceQuestionBankItem {
	return []practiceQuestionBankItem{
		{
			q: PracticeQuestion{
				ID:     "q1",
				Prompt: "If x = 3, what is 2x + 1?",
				Choices: []PracticeQuestionChoice{
					{ID: "a", Text: "5"},
					{ID: "b", Text: "7"},
					{ID: "c", Text: "9"},
					{ID: "d", Text: "11"},
				},
			},
			correctID:   "b",
			explanation: "Substitute x = 3: 2(3) + 1 = 6 + 1 = 7.",
		},
		{
			q: PracticeQuestion{
				ID:     "q2",
				Prompt: "Which is the synonym of \"rapid\"?",
				Choices: []PracticeQuestionChoice{
					{ID: "a", Text: "Slow"},
					{ID: "b", Text: "Careful"},
					{ID: "c", Text: "Quick"},
					{ID: "d", Text: "Weak"},
				},
			},
			correctID:   "c",
			explanation: "\"Rapid\" means fast/quick.",
		},
		{
			q: PracticeQuestion{
				ID:     "q3",
				Prompt: "Choose the correct option: \"She ___ to the store yesterday.\"",
				Choices: []PracticeQuestionChoice{
					{ID: "a", Text: "go"},
					{ID: "b", Text: "goes"},
					{ID: "c", Text: "went"},
					{ID: "d", Text: "going"},
				},
			},
			correctID:   "c",
			explanation: "Yesterday indicates past tense: \"went\".",
		},
	}
}

func toPracticeSessionResponse(ps *PracticeSession) PracticeSessionResponse {
	var q *PracticeQuestion
	if ps.Status == PracticeSessionActive && ps.CurrentIndex >= 0 && ps.CurrentIndex < len(ps.items) {
		q = &ps.items[ps.CurrentIndex].q
	}

	return PracticeSessionResponse{
		SessionID:    ps.SessionID,
		Status:       ps.Status,
		CreatedAt:    ps.CreatedAt.Format(time.RFC3339),
		PackageID:    ps.PackageID,
		IsTimed:      ps.IsTimed,
		TargetCount:  ps.TargetCount,
		CurrentIndex: ps.CurrentIndex,
		Total:        ps.TargetCount,
		CorrectCount: ps.CorrectCount,
		Question:     q,
	}
}

func main() {
	_ = context.Background()
	_ = jwt.RegisteredClaims{}
	_ = pgx.ConnConfig{}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.New()
	r.Use(gin.Recovery())

	// Minimal CORS for local dev: web runs on localhost:5173 and API on localhost:8080.
	// This keeps the gateway usable from the browser without requiring extra deps.
	r.Use(func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type,Accept,Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	store := NewHeartbeatStore()
	practiceStore := NewPracticeStore()

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"ts":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.POST("/exam-sessions/:sessionId/heartbeat", func(c *gin.Context) {
		sessionID := c.Param("sessionId")
		var req HeartbeatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "invalid json body",
				"error":   err.Error(),
			})
			return
		}

		// Trust the path param as the canonical session id.
		if req.SessionID == "" {
			req.SessionID = sessionID
		}

		store.Put(sessionID, req)

		c.JSON(http.StatusOK, HeartbeatResponse{
			Ok:       true,
			ServerTS: time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.POST("/practice-sessions", func(c *gin.Context) {
		var req CreatePracticeSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "invalid json body",
				"error":   err.Error(),
			})
			return
		}

		ps := practiceStore.Create(req)
		c.JSON(http.StatusOK, toPracticeSessionResponse(ps))
	})

	r.GET("/practice-sessions/:sessionId", func(c *gin.Context) {
		sessionID := c.Param("sessionId")
		ps, ok := practiceStore.Get(sessionID)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		c.JSON(http.StatusOK, toPracticeSessionResponse(ps))
	})

	r.POST("/practice-sessions/:sessionId/answers", func(c *gin.Context) {
		sessionID := c.Param("sessionId")
		var req SubmitPracticeAnswerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "invalid json body",
				"error":   err.Error(),
			})
			return
		}

		resp, ps, ok, errMsg := practiceStore.Submit(sessionID, req)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"message": errMsg})
			return
		}
		_ = ps
		c.JSON(http.StatusOK, resp)
	})

	r.GET("/practice-sessions/:sessionId/summary", func(c *gin.Context) {
		sessionID := c.Param("sessionId")
		ps, ok := practiceStore.Get(sessionID)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		accuracy := 0.0
		if ps.TargetCount > 0 {
			accuracy = float64(ps.CorrectCount) / float64(ps.TargetCount)
		}

		c.JSON(http.StatusOK, PracticeSessionSummaryResponse{
			SessionID:    ps.SessionID,
			Total:        ps.TargetCount,
			CorrectCount: ps.CorrectCount,
			Accuracy:     accuracy,
		})
	})

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
