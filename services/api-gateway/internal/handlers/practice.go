package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

type PracticeSessionStatus string

const (
	PracticeSessionActive   PracticeSessionStatus = "active"
	PracticeSessionPaused   PracticeSessionStatus = "paused"
	PracticeSessionFinished PracticeSessionStatus = "finished"
)

const ironmanSecondsPerQuestion = 60

type PracticeQuestionChoice struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type PracticeQuestion struct {
	ID      string                  `json:"id"`
	Prompt  string                  `json:"prompt"`
	Choices []PracticeQuestionChoice `json:"choices"`
}

type CreatePracticeSessionRequest struct {
	PackageID *string `json:"packageId"`
	Timed     bool    `json:"timed"`
	Count     int     `json:"count"`
}

type PracticeSessionResponse struct {
	SessionID    string               `json:"sessionId"`
	Status       PracticeSessionStatus `json:"status"`
	CreatedAt    string               `json:"createdAt"`
	StartedAt    string               `json:"startedAt"`
	PackageID    *string              `json:"packageId"`
	IsTimed      bool                 `json:"isTimed"`
	TimeLimitSeconds *int             `json:"timeLimitSeconds,omitempty"`
	CurrentQuestionStartedAt *string  `json:"currentQuestionStartedAt,omitempty"`
	QuestionTimingsSeconds map[string]int `json:"questionTimingsSeconds,omitempty"`
	TargetCount  int                  `json:"targetCount"`
	CurrentIndex int                  `json:"currentIndex"`
	Total        int                  `json:"total"`
	CorrectCount int                  `json:"correctCount"`
	Question     *PracticeQuestion    `json:"question"`
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

type PracticeSessionReviewItem struct {
	Index            int              `json:"index"`
	Question         PracticeQuestion `json:"question"`
	SelectedChoiceID *string          `json:"selectedChoiceId,omitempty"`
	Correct          *bool            `json:"correct,omitempty"`
	Explanation      *string          `json:"explanation,omitempty"`
	TimeTakenSeconds int              `json:"timeTakenSeconds"`
	CorrectChoiceID  string           `json:"correctChoiceId"`
}

type PracticeSessionReviewResponse struct {
	SessionID string                    `json:"sessionId"`
	Items     []PracticeSessionReviewItem `json:"items"`
}

type PracticeSessionListItem struct {
	SessionID    string               `json:"sessionId"`
	Status       PracticeSessionStatus `json:"status"`
	CreatedAt    string               `json:"createdAt"`
	LastActivityAt string             `json:"lastActivityAt"`
	PackageID    *string              `json:"packageId"`
	IsTimed      bool                 `json:"isTimed"`
	TimeLimitSeconds *int             `json:"timeLimitSeconds,omitempty"`
	TimeRemainingSeconds *int         `json:"timeRemainingSeconds,omitempty"`
	TargetCount  int                  `json:"targetCount"`
	CorrectCount int                  `json:"correctCount"`
	Accuracy     float64              `json:"accuracy"`
}

type ListPracticeSessionsResponse struct {
	Items   []PracticeSessionListItem `json:"items"`
	Limit   int                       `json:"limit"`
	Offset  int                       `json:"offset"`
	HasMore bool                      `json:"hasMore"`
}

type bankItem struct {
	q           PracticeQuestion
	correctID   string
	explanation string
}

func demoBank() []bankItem {
	return []bankItem{
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

func findInBank(bank []bankItem, id string) (bankItem, bool) {
	for _, item := range bank {
		if item.q.ID == id {
			return item, true
		}
	}
	return bankItem{}, false
}

func RegisterPracticeRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.GET("/practice-sessions", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		limit, offset := parseListParams(c)
		status := c.Query("status")
		if status != "" && status != string(PracticeSessionActive) && status != string(PracticeSessionPaused) && status != string(PracticeSessionFinished) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid status"})
			return
		}

		ctx := context.Background()

		now := time.Now().UTC()

		args := []any{userID}
		query := `select id, status, created_at, last_activity_at, package_id, is_timed, time_limit_seconds, started_at, target_count, correct_count
			from practice_sessions where user_id=$1`
		if status != "" {
			query += " and status=$2"
			args = append(args, status)
			query += " order by last_activity_at desc, created_at desc limit $3 offset $4"
			args = append(args, limit+1, offset)
		} else {
			query += " order by last_activity_at desc, created_at desc limit $2 offset $3"
			args = append(args, limit+1, offset)
		}

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
			return
		}
		defer rows.Close()

		items := make([]PracticeSessionListItem, 0, limit)
		for rows.Next() {
			var id string
			var st string
			var createdAt time.Time
			var lastActivityAt time.Time
			var packageID *string
			var isTimed bool
			var timeLimitSeconds int
			var startedAt time.Time
			var targetCount int
			var correctCount int
			if err := rows.Scan(&id, &st, &createdAt, &lastActivityAt, &packageID, &isTimed, &timeLimitSeconds, &startedAt, &targetCount, &correctCount); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
				return
			}

			accuracy := 0.0
			if targetCount > 0 {
				accuracy = float64(correctCount) / float64(targetCount)
			}

			var timeLimitPtr *int
			var timeRemainingPtr *int
			if isTimed {
				copy := timeLimitSeconds
				timeLimitPtr = &copy
				if st == string(PracticeSessionActive) {
					elapsedSeconds := int(now.Sub(startedAt).Seconds())
					if elapsedSeconds >= timeLimitSeconds {
						// Force-finish Ironman when time is up so catalog/history doesn't show stale "in progress".
						_, _ = pool.Exec(ctx, `update practice_sessions set status=$1, last_activity_at=now() where id=$2 and user_id=$3 and status=$4`,
							string(PracticeSessionFinished), id, userID, string(PracticeSessionActive))
						st = string(PracticeSessionFinished)
						elapsedSeconds = timeLimitSeconds
					}
					remaining := timeLimitSeconds - elapsedSeconds
					if remaining < 0 {
						remaining = 0
					}
					copyRemaining := remaining
					timeRemainingPtr = &copyRemaining
				}
			}

			items = append(items, PracticeSessionListItem{
				SessionID:    id,
				Status:       PracticeSessionStatus(st),
				CreatedAt:    createdAt.UTC().Format(time.RFC3339),
				LastActivityAt: lastActivityAt.UTC().Format(time.RFC3339),
				PackageID:    packageID,
				IsTimed:      isTimed,
				TimeLimitSeconds: timeLimitPtr,
				TimeRemainingSeconds: timeRemainingPtr,
				TargetCount:  targetCount,
				CorrectCount: correctCount,
				Accuracy:     accuracy,
			})
			if len(items) == limit+1 {
				break
			}
		}

		hasMore := false
		if len(items) > limit {
			hasMore = true
			items = items[:limit]
		}

		c.JSON(http.StatusOK, ListPracticeSessionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
	})

	r.POST("/practice-sessions", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		var req CreatePracticeSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		count := req.Count
		if count <= 0 {
			count = 10
		}
		if count > 50 {
			count = 50
		}

		bank := demoBank()
		if count > len(bank) {
			count = len(bank)
		}

		order := make([]string, 0, count)
		for i := 0; i < count; i++ {
			order = append(order, bank[i].q.ID)
		}
		orderJSON, _ := json.Marshal(order)

		sessionID := util.NewID("ps")
		ctx := context.Background()
		_, err := pool.Exec(ctx, `insert into practice_sessions (id, user_id, package_id, is_timed, target_count, current_index, correct_count, status, question_order)
			values ($1,$2,$3,$4,$5,0,0,$6,$7)` ,
			sessionID, userID, req.PackageID, req.Timed, count, string(PracticeSessionActive), orderJSON)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create session"})
			return
		}

		now := time.Now().UTC()
		var timeLimitSeconds *int
		var currentQuestionStartedAt *string
		questionTimings := map[string]int{}
		if req.Timed {
			limit := count * ironmanSecondsPerQuestion
			_, _ = pool.Exec(ctx, `update practice_sessions set started_at=now(), time_limit_seconds=$1, current_question_started_at=now(), question_timings='{}'::jsonb where id=$2 and user_id=$3`,
				limit, sessionID, userID)
			timeLimitSeconds = &limit
		}
		// Always initialize timing fields so untimed sessions can show time-per-question in review.
		_, _ = pool.Exec(ctx, `update practice_sessions set started_at=now(), current_question_started_at=now(), question_timings='{}'::jsonb where id=$1 and user_id=$2`,
			sessionID, userID)
		startedAt := now.Format(time.RFC3339)
		currentQuestionStartedAt = &startedAt

		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionActive,
			CreatedAt:    now.Format(time.RFC3339),
			StartedAt:    now.Format(time.RFC3339),
			PackageID:    req.PackageID,
			IsTimed:      req.Timed,
			TimeLimitSeconds: timeLimitSeconds,
			CurrentQuestionStartedAt: currentQuestionStartedAt,
			QuestionTimingsSeconds: questionTimings,
			TargetCount:  count,
			CurrentIndex: 0,
			Total:        count,
			CorrectCount: 0,
			Question:     &bank[0].q,
		})
	})

	r.GET("/practice-sessions/:sessionId", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var status string
		var createdAt time.Time
		var startedAt time.Time
		var packageID *string
		var isTimed bool
		var timeLimitSeconds int
		var targetCount int
		var currentIndex int
		var correctCount int
		var orderRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, created_at, started_at, package_id, is_timed, time_limit_seconds, target_count, current_index, correct_count, question_order, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &createdAt, &startedAt, &packageID, &isTimed, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &currentQuestionStartedAt, &questionTimingsRaw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		now := time.Now().UTC()

		var order []string
		_ = json.Unmarshal(orderRaw, &order)

		questionTimings := map[string]int{}
		if len(questionTimingsRaw) > 0 {
			_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
		}
		if questionTimings == nil {
			questionTimings = map[string]int{}
		}

		if isTimed && status == string(PracticeSessionActive) {
			elapsedSeconds := int(now.Sub(startedAt).Seconds())
			if elapsedSeconds >= timeLimitSeconds {
				// Force-finish and persist the partial time for the current question.
				if currentIndex >= 0 && currentIndex < len(order) {
					qid := order[currentIndex]
					spent := int(now.Sub(currentQuestionStartedAt).Seconds())
					if spent < 0 {
						spent = 0
					}
					questionTimings[qid] = questionTimings[qid] + spent
				}
				questionTimingsJSON, _ := json.Marshal(questionTimings)
				_, _ = pool.Exec(ctx, `update practice_sessions set status=$1, question_timings=$2, last_activity_at=now() where id=$3 and user_id=$4`,
					string(PracticeSessionFinished), questionTimingsJSON, sessionID, userID)
				status = string(PracticeSessionFinished)
			}
		}

		var question *PracticeQuestion
		if status == string(PracticeSessionActive) && currentIndex >= 0 && currentIndex < len(order) {
			bank := demoBank()
			if item, ok := findInBank(bank, order[currentIndex]); ok {
				question = &item.q
			}
		}

		var timeLimitPtr *int
		var currentQuestionStartedAtPtr *string
		if isTimed {
			copy := timeLimitSeconds
			timeLimitPtr = &copy
		}
		if !currentQuestionStartedAt.IsZero() {
			v := currentQuestionStartedAt.UTC().Format(time.RFC3339)
			currentQuestionStartedAtPtr = &v
		}

		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionStatus(status),
			CreatedAt:    createdAt.UTC().Format(time.RFC3339),
			StartedAt:    startedAt.UTC().Format(time.RFC3339),
			PackageID:    packageID,
			IsTimed:      isTimed,
			TimeLimitSeconds: timeLimitPtr,
			CurrentQuestionStartedAt: currentQuestionStartedAtPtr,
			QuestionTimingsSeconds: questionTimings,
			TargetCount:  targetCount,
			CurrentIndex: currentIndex,
			Total:        targetCount,
			CorrectCount: correctCount,
			Question:     question,
		})
	})

	r.POST("/practice-sessions/:sessionId/pause", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var isTimed bool
		var status string
		var createdAt time.Time
		var startedAt time.Time
		var packageID *string
		var timeLimitSeconds int
		var targetCount int
		var currentIndex int
		var correctCount int
		var orderRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, created_at, started_at, package_id, is_timed, time_limit_seconds, target_count, current_index, correct_count, question_order, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &createdAt, &startedAt, &packageID, &isTimed, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &currentQuestionStartedAt, &questionTimingsRaw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if isTimed {
			c.JSON(http.StatusBadRequest, gin.H{"message": "pause is only available for untimed sessions"})
			return
		}
		if status == string(PracticeSessionFinished) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session is finished"})
			return
		}
		if status == string(PracticeSessionPaused) {
			// Idempotent.
		} else if status != string(PracticeSessionActive) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session not active"})
			return
		} else {
			// Persist time spent so far on the current question before pausing.
			var order []string
			_ = json.Unmarshal(orderRaw, &order)
			questionTimings := map[string]int{}
			if len(questionTimingsRaw) > 0 {
				_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
			}
			if questionTimings == nil {
				questionTimings = map[string]int{}
			}
			if currentIndex >= 0 && currentIndex < len(order) {
				qid := order[currentIndex]
				spent := int(time.Now().UTC().Sub(currentQuestionStartedAt).Seconds())
				if spent < 0 {
					spent = 0
				}
				questionTimings[qid] = questionTimings[qid] + spent
			}
			questionTimingsJSON, _ := json.Marshal(questionTimings)

			_, err := pool.Exec(ctx, `update practice_sessions set status=$1, paused_at=now(), question_timings=$2, last_activity_at=now() where id=$3 and user_id=$4`,
				string(PracticeSessionPaused), questionTimingsJSON, sessionID, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to pause session"})
				return
			}
			status = string(PracticeSessionPaused)
		}

		var currentQuestionStartedAtPtr *string
		if !currentQuestionStartedAt.IsZero() {
			v := currentQuestionStartedAt.UTC().Format(time.RFC3339)
			currentQuestionStartedAtPtr = &v
		}

		questionTimings := map[string]int{}
		if len(questionTimingsRaw) > 0 {
			_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
		}
		if questionTimings == nil {
			questionTimings = map[string]int{}
		}

		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionStatus(status),
			CreatedAt:    createdAt.UTC().Format(time.RFC3339),
			StartedAt:    startedAt.UTC().Format(time.RFC3339),
			PackageID:    packageID,
			IsTimed:      isTimed,
			TargetCount:  targetCount,
			CurrentIndex: currentIndex,
			Total:        targetCount,
			CorrectCount: correctCount,
			Question:     nil,
			CurrentQuestionStartedAt: currentQuestionStartedAtPtr,
			QuestionTimingsSeconds: questionTimings,
		})
	})

	r.POST("/practice-sessions/:sessionId/resume", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var isTimed bool
		var status string
		var createdAt time.Time
		var startedAt time.Time
		var packageID *string
		var timeLimitSeconds int
		var targetCount int
		var currentIndex int
		var correctCount int
		var orderRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, created_at, started_at, package_id, is_timed, time_limit_seconds, target_count, current_index, correct_count, question_order, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &createdAt, &startedAt, &packageID, &isTimed, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &currentQuestionStartedAt, &questionTimingsRaw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if isTimed {
			c.JSON(http.StatusBadRequest, gin.H{"message": "resume is only available for untimed sessions"})
			return
		}
		if status == string(PracticeSessionFinished) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session is finished"})
			return
		}
		if status != string(PracticeSessionPaused) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session is not paused"})
			return
		}

		_, err = pool.Exec(ctx, `update practice_sessions set status=$1, paused_at=null, current_question_started_at=now(), last_activity_at=now() where id=$2 and user_id=$3`,
			string(PracticeSessionActive), sessionID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to resume session"})
			return
		}

		var order []string
		_ = json.Unmarshal(orderRaw, &order)
		var question *PracticeQuestion
		if currentIndex >= 0 && currentIndex < len(order) {
			bank := demoBank()
			if item, ok := findInBank(bank, order[currentIndex]); ok {
				question = &item.q
			}
		}

		now := time.Now().UTC()
		v := now.Format(time.RFC3339)
		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionActive,
			CreatedAt:    createdAt.UTC().Format(time.RFC3339),
			StartedAt:    startedAt.UTC().Format(time.RFC3339),
			PackageID:    packageID,
			IsTimed:      isTimed,
			TargetCount:  targetCount,
			CurrentIndex: currentIndex,
			Total:        targetCount,
			CorrectCount: correctCount,
			Question:     question,
			CurrentQuestionStartedAt: &v,
		})
	})

	r.POST("/practice-sessions/:sessionId/answers", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		var req SubmitPracticeAnswerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		ctx := context.Background()
		var status string
		var isTimed bool
		var startedAt time.Time
		var timeLimitSeconds int
		var targetCount int
		var currentIndex int
		var correctCount int
		var orderRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, is_timed, started_at, time_limit_seconds, target_count, current_index, correct_count, question_order, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &isTimed, &startedAt, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &currentQuestionStartedAt, &questionTimingsRaw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if status != string(PracticeSessionActive) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session not active"})
			return
		}

		var order []string
		_ = json.Unmarshal(orderRaw, &order)
		if currentIndex < 0 || currentIndex >= len(order) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session is complete"})
			return
		}

		now := time.Now().UTC()
		if isTimed {
			elapsedSeconds := int(now.Sub(startedAt).Seconds())
			if elapsedSeconds >= timeLimitSeconds {
				// Force-finish and persist the partial time for the current question.
				questionTimings := map[string]int{}
				if len(questionTimingsRaw) > 0 {
					_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
				}
				if questionTimings == nil {
					questionTimings = map[string]int{}
				}
				qid := order[currentIndex]
				spent := int(now.Sub(currentQuestionStartedAt).Seconds())
				if spent < 0 {
					spent = 0
				}
				questionTimings[qid] = questionTimings[qid] + spent
				questionTimingsJSON, _ := json.Marshal(questionTimings)
				_, _ = pool.Exec(ctx, `update practice_sessions set status=$1, question_timings=$2, last_activity_at=now() where id=$3 and user_id=$4`,
					string(PracticeSessionFinished), questionTimingsJSON, sessionID, userID)
				c.JSON(http.StatusBadRequest, gin.H{"message": "time is up"})
				return
			}
		}

		expectedQuestionID := order[currentIndex]
		if req.QuestionID != expectedQuestionID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "questionId mismatch"})
			return
		}

		bank := demoBank()
		item, ok := findInBank(bank, expectedQuestionID)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"message": "unknown question"})
			return
		}

		isCorrect := req.ChoiceID == item.correctID
		newCorrect := correctCount
		if isCorrect {
			newCorrect++
		}

		newIndex := currentIndex + 1
		newStatus := status
		if newIndex >= targetCount {
			newStatus = string(PracticeSessionFinished)
		}

		questionTimings := map[string]int{}
		if len(questionTimingsRaw) > 0 {
			_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
		}
		if questionTimings == nil {
			questionTimings = map[string]int{}
		}
		spent := int(now.Sub(currentQuestionStartedAt).Seconds())
		if spent < 0 {
			spent = 0
		}
		questionTimings[expectedQuestionID] = questionTimings[expectedQuestionID] + spent
		questionTimingsJSON, _ := json.Marshal(questionTimings)

		_, err = pool.Exec(ctx, `update practice_sessions set current_index=$1, correct_count=$2, status=$3, current_question_started_at=now(), question_timings=$4, last_activity_at=now() where id=$5 and user_id=$6`,
			newIndex, newCorrect, newStatus, questionTimingsJSON, sessionID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update session"})
			return
		}

		_, _ = pool.Exec(ctx, `insert into practice_answers (session_id, user_id, question_id, choice_id, correct, explanation, ts) values ($1,$2,$3,$4,$5,$6,now())`,
			sessionID, userID, req.QuestionID, req.ChoiceID, isCorrect, item.explanation)

		c.JSON(http.StatusOK, SubmitPracticeAnswerResponse{
			Correct:     isCorrect,
			// Explanations are available after submitting an answer.
			Explanation: item.explanation,
			Done:        newStatus == string(PracticeSessionFinished),
		})
	})

	r.GET("/practice-sessions/:sessionId/review", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var status string
		var orderRaw []byte
		var questionTimingsRaw []byte
		err := pool.QueryRow(ctx, `select status, question_order, question_timings from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &orderRaw, &questionTimingsRaw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}
		if status != string(PracticeSessionFinished) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "review is only available for finished sessions"})
			return
		}

		var order []string
		_ = json.Unmarshal(orderRaw, &order)
		questionTimings := map[string]int{}
		if len(questionTimingsRaw) > 0 {
			_ = json.Unmarshal(questionTimingsRaw, &questionTimings)
		}
		if questionTimings == nil {
			questionTimings = map[string]int{}
		}

		type answerRow struct {
			QuestionID  string
			ChoiceID    string
			Correct     bool
			Explanation string
		}
		answers := map[string]answerRow{}
		rows, err := pool.Query(ctx, `select question_id, choice_id, correct, explanation from practice_answers where session_id=$1 and user_id=$2 order by ts asc`, sessionID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load review answers"})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var r answerRow
			if err := rows.Scan(&r.QuestionID, &r.ChoiceID, &r.Correct, &r.Explanation); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load review answers"})
				return
			}
			answers[r.QuestionID] = r
		}

		bank := demoBank()
		items := make([]PracticeSessionReviewItem, 0, len(order))
		for i, qid := range order {
			item, ok := findInBank(bank, qid)
			if !ok {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "unknown question in session"})
				return
			}

			var selectedChoiceID *string
			var correctPtr *bool
			var explanationPtr *string
			if ans, ok := answers[qid]; ok {
				selectedChoiceID = &ans.ChoiceID
				correctCopy := ans.Correct
				correctPtr = &correctCopy
				explCopy := ans.Explanation
				explanationPtr = &explCopy
			}

			items = append(items, PracticeSessionReviewItem{
				Index:            i,
				Question:         item.q,
				SelectedChoiceID: selectedChoiceID,
				Correct:          correctPtr,
				Explanation:      explanationPtr,
				TimeTakenSeconds: questionTimings[qid],
				CorrectChoiceID:  item.correctID,
			})
		}

		c.JSON(http.StatusOK, PracticeSessionReviewResponse{SessionID: sessionID, Items: items})
	})

	r.GET("/practice-sessions/:sessionId/summary", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var targetCount int
		var correctCount int
		err := pool.QueryRow(ctx, `select target_count, correct_count from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&targetCount, &correctCount)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		accuracy := 0.0
		if targetCount > 0 {
			accuracy = float64(correctCount) / float64(targetCount)
		}

		c.JSON(http.StatusOK, PracticeSessionSummaryResponse{
			SessionID:    sessionID,
			Total:        targetCount,
			CorrectCount: correctCount,
			Accuracy:     accuracy,
		})
	})
}
