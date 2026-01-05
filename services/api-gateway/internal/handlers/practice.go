package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
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
	ExamPackageID *string `json:"examPackageId"`
	TemplateID *string `json:"templateId"`
	Timed     bool    `json:"timed"`
	Count     int     `json:"count"`
}

type PracticeSessionResponse struct {
	SessionID    string               `json:"sessionId"`
	Status       PracticeSessionStatus `json:"status"`
	CreatedAt    string               `json:"createdAt"`
	StartedAt    string               `json:"startedAt"`
	ExamPackageID    *string              `json:"examPackageId"`
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
	ExamPackageID    *string              `json:"examPackageId"`
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

type practiceQuestionSnapshot struct {
	ID             string                  `json:"id"`
	Prompt         string                  `json:"prompt"`
	Choices        []PracticeQuestionChoice `json:"choices"`
	CorrectChoiceID string                 `json:"correctChoiceId"`
	Explanation    string                  `json:"explanation"`
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

func loadSnapshotQuestion(snapshot []practiceQuestionSnapshot, idx int) *PracticeQuestion {
	if idx < 0 || idx >= len(snapshot) {
		return nil
	}
	q := snapshot[idx]
	return &PracticeQuestion{ID: q.ID, Prompt: q.Prompt, Choices: q.Choices}
}

func RegisterPracticeRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	registerPracticeTemplateRoutes(r, pool)
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
				ExamPackageID:    packageID,
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

		ctx := context.Background()

		var templateID *string
		var templateTopicID *string
		var templateDifficultyID *string

		// Resolve exam package selection.
		var packageID string
		var tierID string
		if req.TemplateID != nil && strings.TrimSpace(*req.TemplateID) != "" {
			// Template-driven session. Template must be published and user must be enrolled in its package.
			tid := strings.TrimSpace(*req.TemplateID)
			templateID = &tid

			var enrolled bool
			var isPublished bool
			var isTimed bool
			var targetCount int
			var enrollmentTierID *string
			if err := pool.QueryRow(ctx, `
				select
					t.exam_package_id,
					t.topic_id,
					t.difficulty_id,
					t.is_published,
					t.is_timed,
					t.target_count,
					e.tier_id,
					e.user_id is not null
				from practice_test_templates t
				left join user_exam_package_enrollments e on e.exam_package_id=t.exam_package_id and e.user_id=$2
				where t.id=$1`, tid, userID).
				Scan(&packageID, &templateTopicID, &templateDifficultyID, &isPublished, &isTimed, &targetCount, &enrollmentTierID, &enrolled); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "template not found"})
				return
			}
			if !isPublished {
				c.JSON(http.StatusForbidden, gin.H{"message": "template is not published"})
				return
			}
			if !enrolled {
				c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
				return
			}
			if enrollmentTierID == nil || strings.TrimSpace(*enrollmentTierID) == "" {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "enrollment has no tier"})
				return
			}
			tierID = strings.TrimSpace(*enrollmentTierID)

			req.Timed = isTimed
			count = targetCount
			if count <= 0 {
				count = 10
			}
			if count > 50 {
				count = 50
			}
		} else if req.ExamPackageID != nil && strings.TrimSpace(*req.ExamPackageID) != "" {
			packageID = strings.TrimSpace(*req.ExamPackageID)
			// Require enrollment in the selected package and snapshot the current tier.
			if err := pool.QueryRow(ctx, `select coalesce(tier_id::text,'') from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2`, userID, packageID).Scan(&tierID); err != nil || strings.TrimSpace(tierID) == "" {
				c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
				return
			}
		} else {
			// If package isn't specified, infer only when user has exactly 1 enrollment.
			rows, err := pool.Query(ctx, `select exam_package_id::text, coalesce(tier_id::text,'') from user_exam_package_enrollments where user_id=$1 order by created_at asc`, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to resolve enrollment"})
				return
			}
			defer rows.Close()
			ids := []string{}
			tiers := []string{}
			for rows.Next() {
				var id string
				var t string
				if err := rows.Scan(&id, &t); err == nil {
					ids = append(ids, id)
					tiers = append(tiers, t)
				}
			}
			if len(ids) == 0 {
				c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
				return
			}
			if len(ids) > 1 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required when enrolled in multiple packages"})
				return
			}
			packageID = ids[0]
			tierID = strings.TrimSpace(tiers[0])
			if tierID == "" {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "enrollment has no tier"})
				return
			}
		}

		// Select published questions from the DB-backed question bank for this exam package.
		args := []any{string(QuestionPublished), packageID}
		query := `
			select q.id, q.prompt, q.explanation_text, cc.choice_id
			from question_bank_questions q
			join question_bank_packages p on p.id=q.package_id
			join exam_package_question_bank_packages m on m.question_bank_package_id=p.id
			join question_bank_correct_choice cc on cc.question_id=q.id
			where q.status=$1 and p.is_hidden=false and m.exam_package_id=$2`
		if templateTopicID != nil && strings.TrimSpace(*templateTopicID) != "" {
			args = append(args, strings.TrimSpace(*templateTopicID))
			query += " and q.topic_id=$" + strconv.Itoa(len(args))
		}
		if templateDifficultyID != nil && strings.TrimSpace(*templateDifficultyID) != "" {
			args = append(args, strings.TrimSpace(*templateDifficultyID))
			query += " and q.difficulty_id=$" + strconv.Itoa(len(args))
		}
		args = append(args, count)
		query += " order by random() limit $" + strconv.Itoa(len(args))

		rows, err := pool.Query(ctx, query,
			args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to select questions"})
			return
		}
		defer rows.Close()

		type picked struct {
			ID        string
			Prompt    string
			Explain   string
			CorrectID string
		}
		pickedQs := make([]picked, 0, count)
		for rows.Next() {
			var p picked
			if err := rows.Scan(&p.ID, &p.Prompt, &p.Explain, &p.CorrectID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to select questions"})
				return
			}
			pickedQs = append(pickedQs, p)
		}
		if len(pickedQs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "no published questions available for this package"})
			return
		}
		if count > len(pickedQs) {
			count = len(pickedQs)
		}

		// Load choices for all selected questions.
		qIDs := make([]string, 0, len(pickedQs))
		for _, q := range pickedQs {
			qIDs = append(qIDs, q.ID)
		}
		choicesRows, err := pool.Query(ctx, `
			select question_id, id, text
			from question_bank_choices
			where question_id = any($1)
			order by question_id asc, order_index asc`, qIDs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
			return
		}
		defer choicesRows.Close()

		choicesByQ := map[string][]PracticeQuestionChoice{}
		for choicesRows.Next() {
			var qid, cid, text string
			if err := choicesRows.Scan(&qid, &cid, &text); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
				return
			}
			choicesByQ[qid] = append(choicesByQ[qid], PracticeQuestionChoice{ID: cid, Text: text})
		}

		snapshot := make([]practiceQuestionSnapshot, 0, count)
		order := make([]string, 0, count)
		for i := 0; i < count; i++ {
			q := pickedQs[i]
			chs := choicesByQ[q.ID]
			if len(chs) < 2 {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "question has insufficient choices"})
				return
			}
			snapshot = append(snapshot, practiceQuestionSnapshot{
				ID:              q.ID,
				Prompt:          q.Prompt,
				Choices:         chs,
				CorrectChoiceID: q.CorrectID,
				Explanation:     q.Explain,
			})
			order = append(order, q.ID)
		}
		orderJSON, _ := json.Marshal(order)
		snapshotJSON, _ := json.Marshal(snapshot)

		sessionID := util.NewID("ps")
		_, err = pool.Exec(ctx, `insert into practice_sessions (id, user_id, package_id, tier_id, template_id, is_timed, target_count, current_index, correct_count, status, question_order, questions_snapshot)
			values ($1,$2,$3,$4,$5,$6,$7,0,0,$8,$9,$10)` ,
			sessionID, userID, packageID, tierID, templateID, req.Timed, count, string(PracticeSessionActive), orderJSON, snapshotJSON)
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
		pkgPtr := &packageID

		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionActive,
			CreatedAt:    now.Format(time.RFC3339),
			StartedAt:    now.Format(time.RFC3339),
			ExamPackageID:    pkgPtr,
			IsTimed:      req.Timed,
			TimeLimitSeconds: timeLimitSeconds,
			CurrentQuestionStartedAt: currentQuestionStartedAt,
			QuestionTimingsSeconds: questionTimings,
			TargetCount:  count,
			CurrentIndex: 0,
			Total:        count,
			CorrectCount: 0,
			Question:     loadSnapshotQuestion(snapshot, 0),
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
		var snapshotRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, created_at, started_at, package_id, is_timed, time_limit_seconds, target_count, current_index, correct_count, question_order, questions_snapshot, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &createdAt, &startedAt, &packageID, &isTimed, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &snapshotRaw, &currentQuestionStartedAt, &questionTimingsRaw)
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

		var snapshot []practiceQuestionSnapshot
		_ = json.Unmarshal(snapshotRaw, &snapshot)

		var question *PracticeQuestion
		if status == string(PracticeSessionActive) {
			question = loadSnapshotQuestion(snapshot, currentIndex)
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
			ExamPackageID:    packageID,
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
			ExamPackageID:    packageID,
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
		var snapshotRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, created_at, started_at, package_id, is_timed, time_limit_seconds, target_count, current_index, correct_count, question_order, questions_snapshot, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &createdAt, &startedAt, &packageID, &isTimed, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &snapshotRaw, &currentQuestionStartedAt, &questionTimingsRaw)
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

		var snapshot []practiceQuestionSnapshot
		_ = json.Unmarshal(snapshotRaw, &snapshot)
		question := loadSnapshotQuestion(snapshot, currentIndex)

		now := time.Now().UTC()
		v := now.Format(time.RFC3339)
		c.JSON(http.StatusOK, PracticeSessionResponse{
			SessionID:    sessionID,
			Status:       PracticeSessionActive,
			CreatedAt:    createdAt.UTC().Format(time.RFC3339),
			StartedAt:    startedAt.UTC().Format(time.RFC3339),
			ExamPackageID:    packageID,
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
		var snapshotRaw []byte
		var currentQuestionStartedAt time.Time
		var questionTimingsRaw []byte

		err := pool.QueryRow(ctx, `select status, is_timed, started_at, time_limit_seconds, target_count, current_index, correct_count, question_order, questions_snapshot, current_question_started_at, question_timings
			from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &isTimed, &startedAt, &timeLimitSeconds, &targetCount, &currentIndex, &correctCount, &orderRaw, &snapshotRaw, &currentQuestionStartedAt, &questionTimingsRaw)
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

		var snapshot []practiceQuestionSnapshot
		_ = json.Unmarshal(snapshotRaw, &snapshot)
		if currentIndex < 0 || currentIndex >= len(snapshot) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "unknown question"})
			return
		}
		q := snapshot[currentIndex]
		if q.ID != expectedQuestionID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "questionId mismatch"})
			return
		}
		// Validate choice belongs to the snapshotted question.
		choiceOK := false
		for _, ch := range q.Choices {
			if ch.ID == req.ChoiceID {
				choiceOK = true
				break
			}
		}
		if !choiceOK {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid choice"})
			return
		}

		isCorrect := req.ChoiceID == q.CorrectChoiceID
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
			sessionID, userID, req.QuestionID, req.ChoiceID, isCorrect, q.Explanation)

		c.JSON(http.StatusOK, SubmitPracticeAnswerResponse{
			Correct:     isCorrect,
			// Explanations are available after submitting an answer.
			Explanation: q.Explanation,
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
		var snapshotRaw []byte
		err := pool.QueryRow(ctx, `select status, question_order, questions_snapshot, question_timings from practice_sessions where id=$1 and user_id=$2`, sessionID, userID).
			Scan(&status, &orderRaw, &snapshotRaw, &questionTimingsRaw)
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

		var snapshot []practiceQuestionSnapshot
		_ = json.Unmarshal(snapshotRaw, &snapshot)
		snapByID := map[string]practiceQuestionSnapshot{}
		for _, s := range snapshot {
			snapByID[s.ID] = s
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

		items := make([]PracticeSessionReviewItem, 0, len(order))
		for i, qid := range order {
			s, ok := snapByID[qid]
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
				Question:         PracticeQuestion{ID: s.ID, Prompt: s.Prompt, Choices: s.Choices},
				SelectedChoiceID: selectedChoiceID,
				Correct:          correctPtr,
				Explanation:      explanationPtr,
				TimeTakenSeconds: questionTimings[qid],
				CorrectChoiceID:  s.CorrectChoiceID,
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
