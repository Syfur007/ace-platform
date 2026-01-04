Software Design Document

**Online Exam Preparation Platform**

Version 1.3

January 2026

# Table of Contents

- 1\. Introduction
- 2\. System Architecture
- 3\. Technology Stack
- 4\. Core Features & Modules
- 5\. Database Design
- 6\. API Design
- 7\. User Interface Specifications
- 8\. Security & Authentication
- 9\. Analytics & Reporting
- 10\. Deployment & DevOps
- 11\. Testing Strategy
- 12\. Future Enhancements

# 1\. Introduction

## 1.1 Purpose

This Software Design Document (SDD) provides a comprehensive technical specification for building an online exam preparation platform inspired by Magoosh. The platform aims to deliver affordable, flexible, and engaging test preparation through a modern web and mobile application.

## 1.2 Scope

The platform will provide:

- Self-paced video lessons covering all exam topics
- Extensive practice question banks with detailed explanations
- Full-length adaptive mock tests
- Personalized study plans and progress tracking
- AI-powered analytics and score prediction
- Expert support and community features
- Cross-platform access (web, iOS, Android)

## 1.3 Target Users

- Students preparing for standardized exams (GRE, IELTS, SAT, etc.)
- Self-directed learners seeking flexible study schedules
- Cost-conscious students looking for affordable alternatives
- International students requiring accessible online preparation

## 1.4 Key Success Metrics

- User engagement (daily active users, session duration)
- Practice completion rates
- Score improvement tracking
- Subscription conversion and retention rates
- User satisfaction scores

# 2\. System Architecture

## 2.1 High-Level Architecture

The platform follows a modern microservices architecture with the following layers:

- Presentation Layer: React web app (Vite + TypeScript), mobile app placeholder (Flutter)
- API Gateway: Go (Gin) service for routing/auth/rate limiting (initial baseline)
- Service Layer: Microservices for different business domains
- Data Layer: PostgreSQL (relational) and Redis (caching/sessions) in local dev; MongoDB planned for questions/analytics
- Storage Layer: AWS S3 (videos, media), CDN for content delivery
- Infrastructure: Docker Compose for local development; Kubernetes is a planned production target

## 2.2 Architecture Diagram Components

| **Component** | **Description** | **Technology** |
| --- | --- | --- |
| Web Client | Responsive web application | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 3.4 |
| Mobile Apps | Native mobile applications | Flutter (placeholder directory) |
| API Gateway | Entry point for HTTP APIs | Go 1.24, Gin 1.11 |
| Auth Service | User authentication & authorization | Planned (TBD) |
| Content Service | Video lessons, materials management | Planned (TBD) |
| Question Service | Practice questions, explanations | Planned (TBD) |
| Test Service | Mock tests, adaptive testing engine | Planned (TBD) |
| Analytics Service | Progress tracking, predictions | Planned (TBD) |
| Payment Service | Subscription, billing | Planned (TBD) |
| Notification Service | Email, push notifications | Planned (TBD) |
| Database | Primary relational data | PostgreSQL (dev: postgres:15-alpine via Docker Compose) |
| NoSQL DB | Questions, user activity logs | Planned (MongoDB) |
| Cache | Session, frequently accessed data | Redis (dev: redis:alpine via Docker Compose) |
| Object Storage | Videos, images, documents | Planned (e.g., S3-compatible) |
| CDN | Content delivery network | Planned (e.g., CloudFront/Cloudflare) |
| Message Queue | Async processing | Planned (TBD) |

## 2.3 Design Patterns

- Microservices Architecture: Independent, scalable services
- Repository Pattern: Data access abstraction
- Factory Pattern: Dynamic question generation
- Observer Pattern: Real-time progress updates
- Strategy Pattern: Different exam algorithms
- Singleton Pattern: Configuration management

# 3\. Technology Stack

## 3.1 Frontend Technologies

| **Technology** | **Purpose** | **Version** |
| --- | --- | --- |
| React | Web UI library | 19.x |
| TypeScript | Type-safe JavaScript | 5.9.x |
| Vite | Frontend tooling/dev server/build | 7.x |
| Tailwind CSS | Utility-first styling | 3.4.x |
| React Router | Client-side routing | 7.x |
| TanStack React Query | Server state management | 5.x |
| Axios | HTTP client | 1.x |
| Framer Motion | Animations | 12.x |
| Lucide React | Icon set | 0.x |
| ESLint | Linting | 9.x |
| openapi-typescript | Generate typed API schemas from OpenAPI | 7.x |

## 3.2 Backend Technologies

| **Technology** | **Purpose** | **Version** |
| --- | --- | --- |
| Go | API gateway/service runtime | 1.24.x |
| Gin | HTTP router/middleware | 1.11.x |
| pgx/v5 | PostgreSQL driver | 5.8.x |
| golang-jwt/jwt/v5 | JWT signing/verification | 5.3.x |
| Node.js | Planned backend runtime for future services | TBD |
| Python + FastAPI | Planned analytics/testing services | TBD |

## 3.3 Database & Storage

| **Technology** | **Purpose** | **Version** |
| --- | --- | --- |
| PostgreSQL | Primary relational database (local dev via Docker Compose) | 15.x |
| Redis | Cache/session/rate-limit store (local dev via Docker Compose) | 7.x (image: redis:alpine) |
| MongoDB | Questions, logs, analytics data | Planned |
| Object Storage | Videos, images, documents | Planned (e.g., S3-compatible) |
| Elasticsearch | Search & logging | Planned |

## 3.4 DevOps & Infrastructure

| **Technology** | **Purpose** | **Version** |
| --- | --- | --- |
| Docker Desktop + Docker Engine | Container runtime for local dev | Latest |
| Docker Compose | Local orchestration (db/redis/api/web) | Latest |
| Containerized toolchain | Run Node/Go without host installs | node:24-alpine, golang:1.24-alpine |
| GitHub Actions | CI/CD pipelines | Planned |
| Kubernetes | Container orchestration | Planned |
| Terraform | Infrastructure as Code | Planned |

## 3.5 Third-Party Services

- Stripe: Payment processing and subscription management
- SendGrid: Transactional email service
- Firebase: Push notifications for mobile
- AWS Transcribe: Video transcription and captions
- OpenAI API: AI-powered features (essay grading, question generation)
- Cloudinary: Image optimization and transformations
- Sentry: Error tracking and monitoring

# 4\. Core Features & Modules

## 4.1 User Management Module

**Features:**

- User registration with email verification
- Social login (Google, Facebook, Apple)
- Multi-factor authentication (2FA)
- Password reset and account recovery
- User profile management (photo, preferences, timezone)
- Role-based access control (Student, Admin, Instructor)

**Technical Implementation:**

- Cookie-based authentication with server-side session tracking:
	- `ace_access` (HttpOnly cookie): short-lived JWT access token
	- `ace_refresh` (HttpOnly cookie): refresh token bound to a server-side session
	- `ace_csrf` (non-HttpOnly cookie): CSRF double-submit token for unsafe requests
	- Role-based portals (Student/Instructor/Admin) with portal-specific auth routes
	- JWT claims include `role`, `aud`, and `sid` and are enforced by middleware
	- Web stores only the “active portal” hint in localStorage (not tokens)
	- Instructor/Admin accounts are provisioned in dev via bootstrap environment variables
- Planned evolution:
	- OAuth2 social login (Google/Facebook/Apple)
	- MFA (TOTP)
- OAuth2 integration for social logins
- Password hashing with bcrypt (cost factor: 12)
- Session management with Redis
- RBAC middleware for API endpoints

## 4.2 Content Management Module

**Features:**

- 290+ video lessons per exam (like Magoosh GRE)
- Lessons organized by topic, difficulty, and section
- Interactive video player with playback controls
- Video transcripts and closed captions
- Adjustable playback speed (0.5x to 2x)
- Offline video downloads (mobile app)
- Bookmarking and note-taking on videos
- Progress tracking (watched/unwatched)

**Technical Implementation:**

- Video encoding in multiple resolutions (480p, 720p, 1080p)
- HLS/DASH adaptive streaming protocol
- AWS S3 storage with CloudFront CDN
- Video.js player with custom controls
- AWS Transcribe for automatic caption generation
- Progress tracking events sent to analytics service

## 4.3 Question Bank Module

**Features:**

- 1,600+ practice questions per exam (like Magoosh)
- Multiple question types: MCQ, multiple select, numeric entry, fill-in-blank
- Detailed text explanations for each question
- Question tagging by topic, difficulty, and concept
- Randomized question selection
- All questions are distributed across multiple question banks per exam
- Practice session creation from predefined templates
- Custom practice sessions by topic/difficulty
- Timed vs. untimed practice modes
- Similar question generation after mistakes
- Flagging and reviewing questions
- Question history and performance analytics

**Technical Implementation:**

### Domain Terminology (Package vs. Question Bank)

To avoid ambiguity, this document uses the following domain model:

- **Exam Package**: the exam a student is preparing for (e.g., IELTS, SAT, GRE). A user can be enrolled in one or more exam packages.
- **Question Bank**: a curated collection of questions within an exam package (e.g., “GRE Quant Bank”, “GRE Verbal Bank”, or a bank per section/version).

Intended relationships:

- One **Exam Package** contains one or more **Question Banks**.
- One **Question Bank** contains many questions.
- Users can enroll in one or more **Exam Packages**; enrollment drives what content is available in Practice/Tests.

### Current MVP Implementation (Jan 2026)

The current codebase implements an MVP practice workflow inside the Go API gateway and Postgres. This is intentionally a stepping stone toward a dedicated Question Service (planned).

- Practice sessions are persisted in PostgreSQL and are API-backed (no longer purely client-side).
- Practice question source: **DB-backed** question bank tables in PostgreSQL (`question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`). The practice session creator selects **published** questions mapped to the selected exam package via `exam_package_question_bank_packages`.
- Enrollment/entitlement gating (MVP): students must be enrolled in an exam package to start practice.
	- If `examPackageId` is provided, the API rejects session creation unless the user is enrolled in that package.
	- If `examPackageId` is omitted, the API infers the package only when the user has exactly one enrollment; otherwise it rejects.
- Practice test templates (catalog items) are supported:
	- Instructors/admins create reusable templates per exam package (e.g., “IELTS Reading Test 1”, “IELTS Listening - Hard Set”).
	- Templates define `section`, optional `topicId`/`difficultyId`, `isTimed`, `targetCount`, ordering, and publication status.
	- Students see only **published** templates for the exam packages they are enrolled in.
	- Students can start a practice session from a template by sending `templateId` in the create-session request; the server validates enrollment and overrides runtime settings from the template.
- An Admin “Question Bank” workflow exists and persists content in PostgreSQL (draft/publish review workflow; choices + correct choice).
- Two practice modes are supported:
	- Untimed: can be paused/resumed.
	- Ironman (Timed): server-enforced time limit and automatic force-finish when time runs out.
- Per-question timing is recorded for both modes (seconds spent per question).
- Explanations are returned after answer submission and are also available in review.
- Review mode exists for finished practice sessions and displays question-by-question breakdown including:
	- Selected answer
	- Correct/incorrect verdict
	- Explanation (if available)
	- Time taken for that question
	- Correct answer

### Planned Target Architecture (Future)

- MongoDB document database for flexible question schema
- Full-text search with Elasticsearch
- Question randomization algorithms
- Spaced repetition algorithm (SM-2) for optimal review
- AI-based similar question generation (GPT-4 API)
- Rich text editor for admin question creation
- LaTeX rendering for mathematical expressions

## 4.4 Mock Test Module

**Features:**

- 6-10 full-length mock tests per exam (matching Magoosh)
- Computer-adaptive testing (CAT) algorithm
- Realistic exam interface and timing
- Section-wise and overall scoring
- Detailed performance breakdown by topic
- Comparison with average test-taker performance
- Test history and score progression tracking
- Review mode with explanations
- Test pause and resume functionality

**Technical Implementation:**

### Current MVP Implementation (Jan 2026)

The current codebase implements a minimal “test session” lifecycle inside the Go API gateway and Postgres.

- Exam sessions are persisted in PostgreSQL as `exam_sessions` keyed by `(user_id, id)`.
- Exam sessions can optionally be associated with an exam package (`exam_package_id`) and are subject to enrollment gating.
- The web client sends periodic heartbeats containing a JSON snapshot to persist progress.
- A "Submit Test" action is implemented to finalize a session (`status=finished`, `submitted_at` set).
- The student Tests catalog page includes a “Previous tests” list with in-progress/review behavior.

Note: the exam UI is still a “snapshot session” MVP, but it is now package-aware and can enforce enrollment during session creation.

### Planned Target Architecture (Future)

- Python FastAPI service for adaptive algorithm
- IRT (Item Response Theory) model for question selection
- Real-time state management during test
- Automatic test submission on timeout
- Immediate scoring engine
- Statistical analysis for percentile calculation
- MongoDB for storing test attempts and responses

## 4.5 Analytics & Score Prediction Module

**Features:**

- Personalized dashboard with progress metrics
- Strength/weakness analysis by topic and section
- Score predictor based on practice performance
- Time spent statistics (videos, practice, tests)
- Accuracy trends over time
- Predicted score confidence intervals
- Study streak tracking
- Goal-setting and achievement tracking

**Technical Implementation:**

- Python-based analytics service
- Machine learning models (Random Forest, XGBoost) for score prediction
- TensorFlow/PyTorch for advanced modeling
- Feature engineering from user activity data
- Redis caching for real-time dashboard queries
- Scheduled batch processing for model updates
- Chart.js/D3.js for interactive visualizations

## 4.6 Study Plan Module

**Features:**

- Pre-built study plans (1 week to 6 months)
- Custom study plan creation
- Daily task lists with lessons and practice
- Calendar view of study schedule
- Email and push notification reminders
- Plan pause/resume functionality
- Progress tracking against plan
- Plan adjustment based on performance

**Technical Implementation:**

- Template-based plan generation algorithm
- Dynamic scheduling based on user availability
- Cron jobs for daily task generation
- Push notification service integration
- PostgreSQL for plan templates and user plans

## 4.7 Speaking & Writing Assessment Module

**Features:**

- Essay submission interface with rich text editor
- Audio recording for speaking assessments
- AI-powered automated grading
- Human expert review (premium feature)
- Detailed feedback and suggestions
- Rubric-based scoring (like IELTS bands)
- Sample answers and model responses
- Assessment history and improvement tracking

**Technical Implementation:**

- OpenAI GPT-4 API for essay analysis
- AWS Transcribe for speech-to-text conversion
- NLP models for grammar, coherence, vocabulary analysis
- Audio file storage in AWS S3
- Queue system for expert review assignments
- Rich text editor (Draft.js or Quill)

## 4.8 Flashcard Module

**Features:**

- Pre-built flashcard decks for each exam
- Custom flashcard creation
- Spaced repetition system (SRS)
- Audio pronunciation (for vocabulary)
- Images and examples on cards
- Progress tracking (new/learning/mastered)
- Daily review recommendations
- Mobile app for on-the-go study

**Technical Implementation:**

- SM-2 or Anki-style spaced repetition algorithm
- MongoDB for flashcard storage
- Text-to-speech API for pronunciation
- Offline support with local storage
- Sync across web and mobile

## 4.9 Support & Community Module

**Features:**

- Ask-an-Expert email support (24-hour response)
- Live chat support
- Community forum/discussion board
- Private study groups (Facebook integration)
- User testimonials and success stories
- FAQ and help center
- Blog with study tips and resources

**Technical Implementation:**

- Ticketing system for support requests
- Real-time chat using Socket.io
- Forum built with Node.js backend
- Facebook Graph API for group integration
- CMS (Strapi/Contentful) for blog management

## 4.10 Payment & Subscription Module

**Features:**

- Multiple subscription tiers (1-month, 6-month, premium)
- Free trial period (7 days)
- Stripe integration for payments
- Multiple payment methods (cards, PayPal, Alipay)
- Installment payment options
- Subscription management (upgrade, pause, cancel)
- Automatic renewal with email reminders
- Invoice generation and history
- 7-day money-back guarantee
- Score improvement guarantee with refund process

**Technical Implementation:**

- Stripe Checkout and Billing Portal
- Webhook handlers for payment events
- Subscription status tracking in database
- Automated refund processing
- Tax calculation integration

# 5\. Database Design

## 5.1 PostgreSQL Schema

Primary relational database for core entities.

### 5.1.1 Current Implemented Schema (Jan 2026 MVP)

The MVP schema is created idempotently by the Go API gateway at startup.

**users**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | TEXT | Primary key (generated ID) |
| email | TEXT | Unique email |
| password_hash | TEXT | Bcrypt hash |
| role | TEXT | student / instructor / admin |
| created_at | TIMESTAMPTZ | Created timestamp |

**practice_sessions**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | TEXT | Primary key (session id) |
| user_id | TEXT | FK to users(id) |
| package_id | UUID (nullable) | References the selected exam package (`exam_packages.id`) for this session. Current implementation does not enforce a FK constraint, but the API enforces enrollment when creating sessions. |
| template_id | UUID (nullable) | Optional link to a published practice template (`practice_test_templates.id`) when the session is started from a template. |
| is_timed | BOOLEAN | Ironman vs Untimed |
| started_at | TIMESTAMPTZ | Session start timestamp |
| time_limit_seconds | INTEGER | Total allowed time for Ironman; 0 for untimed |
| target_count | INTEGER | Total questions in session |
| current_index | INTEGER | Current question index |
| current_question_started_at | TIMESTAMPTZ | Start time of the current question |
| question_timings | JSONB | Map of question_id -> seconds spent |
| correct_count | INTEGER | Total correct |
| status | TEXT | active / paused / finished |
| paused_at | TIMESTAMPTZ (nullable) | Pause timestamp (untimed only) |
| question_order | JSONB | Ordered list of question IDs |
| created_at | TIMESTAMPTZ | Created timestamp |
| last_activity_at | TIMESTAMPTZ | Activity timestamp for ordering/history |

**practice_test_templates**

Catalog items that define reusable practice configurations per exam package.

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | UUID | Primary key |
| exam_package_id | UUID | FK to exam_packages(id) |
| name | TEXT | Display name (e.g., “Reading Test 1”) |
| section | TEXT | Section label (e.g., Reading/Listening/Quant) |
| topic_id | TEXT (nullable) | Optional FK to question_bank_topics(id) |
| difficulty_id | TEXT (nullable) | Optional FK to question_bank_difficulties(id) |
| is_timed | BOOLEAN | Template timing flag |
| target_count | INTEGER | Template question count |
| sort_order | INTEGER | Ordering within a package/section |
| is_published | BOOLEAN | Published templates are visible to students |
| created_by_user_id | TEXT | FK to users(id) |
| updated_by_user_id | TEXT | FK to users(id) |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

**practice_answers**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id | BIGSERIAL | Primary key |
| session_id | TEXT | FK to practice_sessions(id) |
| user_id | TEXT | FK to users(id) |
| question_id | TEXT | Question identifier |
| choice_id | TEXT | Selected choice identifier |
| correct | BOOLEAN | Verdict |
| explanation | TEXT | Explanation text (captured at submission time) |
| ts | TIMESTAMPTZ | Submission time |

**exam_sessions**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| user_id | TEXT | FK to users(id) |
| id | TEXT | Session id (composite primary key with user_id) |
| status | TEXT | active / finished |
| exam_package_id | UUID (nullable) | Optional selected exam package for this session (enrollment is enforced when creating sessions). |
| snapshot | JSONB | Persisted client snapshot |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |
| last_heartbeat_at | TIMESTAMPTZ | Last heartbeat |
| submitted_at | TIMESTAMPTZ (nullable) | Submit timestamp |
| terminated_at | TIMESTAMPTZ (nullable) | Admin termination timestamp |
| invalidated_at | TIMESTAMPTZ (nullable) | Admin invalidation timestamp |

**Additional implemented tables (Jan 2026)**

The current codebase also includes the following major entity groups (implemented in PostgreSQL), which are not exhaustively listed above:

- **Authentication / sessions**: `auth_sessions`, `auth_refresh_tokens`, `auth_session_limits_role`, `auth_session_limits_user`, `auth_session_groups`, `auth_session_group_memberships`, `auth_session_limits_group`.
- **Audit trail**: `audit_log`.
- **Exam integrity**: `exam_session_events`, `exam_session_flags`.
- **Exam packages + enrollments**: `exam_packages`, `user_exam_package_enrollments`, `exam_package_question_bank_packages`.
- **Question Bank (admin-managed content)**: `question_bank_packages`, `question_bank_topics`, `question_bank_difficulties`, `question_bank_questions`, `question_bank_choices`, `question_bank_correct_choice`.
- **Practice template catalog**: `practice_test_templates`.

**Important alignment note (Packages / Enrollment)**

The intended product model is: **Exam Package → one-or-more Question Banks → Questions**, and users enroll into one-or-more exam packages.

The current implementation now includes:

- `exam_packages` (UUID PK + stable `code`) and `user_exam_package_enrollments` (composite PK `(user_id, exam_package_id)`).
- `exam_package_question_bank_packages` to map exam packages to one-or-more question bank packages.
- Enrollment checks are enforced when creating practice sessions and exam sessions.
- Published practice templates are restricted to enrolled packages (student catalog endpoint).

Practically, this means the current implementation effectively collapses concepts:

- `question_bank_packages` currently behaves like a top-level container for questions, but it does not model “one package contains multiple question banks”.
- `practice_sessions.package_id` is not a foreign key, so referential integrity is not enforced at the database layer.

Student-side enrollment UI is implemented: students can enroll from the Courses page and package details, and the Practice page is driven off enrollments.

### 5.1.2 Planned/Target Schema (Future)

**Users Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| email | VARCHAR(255) | Unique email |
| password_hash | VARCHAR(255) | Bcrypt hash |
| first_name | VARCHAR(100) | User first name |
| last_name | VARCHAR(100) | User last name |
| role | ENUM | student, admin, instructor |
| profile_picture_url | TEXT | S3 URL |
| timezone | VARCHAR(50) | User timezone |
| created_at | TIMESTAMP | Registration date |
| updated_at | TIMESTAMP | Last update |
| last_login | TIMESTAMP | Last login time |
| is_active | BOOLEAN | Account active status |
| email_verified | BOOLEAN | Email verification status |

**Subscriptions Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| user_id | UUID | FK to users |
| exam_type | VARCHAR(50) | GRE, IELTS, etc. |
| plan_type | VARCHAR(50) | 1-month, 6-month, premium |
| status | ENUM | active, paused, cancelled, expired |
| start_date | TIMESTAMP | Subscription start |
| end_date | TIMESTAMP | Subscription end |
| auto_renew | BOOLEAN | Auto renewal enabled |
| stripe_subscription_id | VARCHAR(255) | Stripe sub ID |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**Courses Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| exam_type | VARCHAR(50) | Exam name |
| title | VARCHAR(255) | Course title |
| description | TEXT | Course description |
| thumbnail_url | TEXT | Course image |
| total_lessons | INTEGER | Number of lessons |
| total_questions | INTEGER | Number of questions |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**Lessons Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| course_id | UUID | FK to courses |
| title | VARCHAR(255) | Lesson title |
| description | TEXT | Lesson description |
| video_url | TEXT | S3 video URL |
| duration_seconds | INTEGER | Video duration |
| transcript | TEXT | Video transcript |
| section | VARCHAR(100) | e.g., Quantitative, Verbal |
| topic | VARCHAR(100) | Specific topic |
| difficulty | ENUM | easy, medium, hard |
| order_index | INTEGER | Display order |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**User_Progress Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| user_id | UUID | FK to users |
| lesson_id | UUID | FK to lessons (nullable) |
| question_id | UUID | FK to questions (nullable) |
| completed | BOOLEAN | Completed status |
| time_spent_seconds | INTEGER | Time spent |
| last_position_seconds | INTEGER | Video progress |
| created_at | TIMESTAMP | First access |
| updated_at | TIMESTAMP | Last update |

**Study_Plans Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| user_id | UUID | FK to users |
| course_id | UUID | FK to courses |
| plan_name | VARCHAR(255) | Plan name |
| duration_weeks | INTEGER | Plan duration |
| start_date | DATE | Plan start |
| target_score | INTEGER | Goal score |
| status | ENUM | active, paused, completed |
| created_at | TIMESTAMP | Created timestamp |
| updated_at | TIMESTAMP | Updated timestamp |

**Mock_Tests Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| course_id | UUID | FK to courses |
| test_name | VARCHAR(255) | Test name |
| total_questions | INTEGER | Number of questions |
| duration_minutes | INTEGER | Test duration |
| is_adaptive | BOOLEAN | CAT enabled |
| created_at | TIMESTAMP | Created timestamp |

**Test_Attempts Table:**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | UUID | Primary key |
| user_id | UUID | FK to users |
| test_id | UUID | FK to mock_tests |
| status | ENUM | in_progress, completed, abandoned |
| started_at | TIMESTAMP | Test start time |
| submitted_at | TIMESTAMP | Test submit time |
| total_score | INTEGER | Overall score |
| section_scores | JSONB | Scores by section |
| percentile | FLOAT | Percentile rank |
| created_at | TIMESTAMP | Created timestamp |

## 5.2 MongoDB Collections

Flexible document storage for questions and activity.

**Questions Collection:**

- Document structure includes: question_id, course_id, question_text, question_type, options, correct_answer, explanation_text, explanation_video_url, tags, difficulty, topic, created_at
- Indexed fields: course_id, tags, difficulty, topic
- Supports rich text, LaTeX, and embedded media

**User_Activity_Logs Collection:**

- Tracks all user interactions: logins, video views, question attempts, test sessions
- Document structure: log_id, user_id, activity_type, metadata (flexible), timestamp
- Used for analytics and ML model training

**Flashcards Collection:**

- Document structure: card_id, course_id, front, back, image_url, audio_url, tags, created_at
- User flashcard progress stored separately

## 5.3 Redis Cache

- Session storage: user:session:{user_id}
- Frequently accessed data: course:{course_id}, lesson:{lesson_id}
- Real-time leaderboards: sorted sets
- Rate limiting: user requests per hour
- TTL: 1 hour for most cached data, 7 days for sessions

# 6\. API Design

## 6.1 API Architecture

RESTful API design with cookie-based authentication (JWT access token in HttpOnly cookie + refresh + CSRF token for unsafe requests).

- Local dev base URL: http://localhost:8080
- Source-of-truth contract (local dev): `packages/shared-proto/openapi.yaml` (web types generated via `openapi-typescript`)

### 6.1.1 Current Implemented API (Jan 2026 MVP)

The API surface is OpenAPI-first. The web app generates TypeScript types from the OpenAPI spec and uses those types for its client.

**Practice Sessions (implemented)**

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /practice-sessions | List practice sessions (supports status filtering; includes history ordering) |
| POST | /practice-sessions | Create a new session (timed or untimed) |
| GET | /practice-sessions/{sessionId} | Get session state (question, timing fields, status) |
| POST | /practice-sessions/{sessionId}/answers | Submit answer (records correctness + explanation; records per-question time) |
| POST | /practice-sessions/{sessionId}/pause | Pause session (untimed only) |
| POST | /practice-sessions/{sessionId}/resume | Resume session (untimed only) |
| GET | /practice-sessions/{sessionId}/summary | Summary stats (correct/total/accuracy) |
| GET | /practice-sessions/{sessionId}/review | Ordered review breakdown (finished only) |

Notes:

- `POST /practice-sessions` supports starting from a published template by including `templateId`. When `templateId` is present, the server applies the template settings and validates enrollment for the template’s exam package.

**Practice Templates (implemented)**

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /practice-templates | Student catalog: published templates for enrolled packages (optionally filter by `examPackageId`) |
| GET | /instructor/practice-templates | Instructor/admin list (supports `includeUnpublished` and `examPackageId`) |
| POST | /instructor/practice-templates | Create template |
| PATCH | /instructor/practice-templates/{templateId} | Update template |
| DELETE | /instructor/practice-templates/{templateId} | Delete template |
| POST | /instructor/practice-templates/{templateId}/publish | Publish template |
| POST | /instructor/practice-templates/{templateId}/unpublish | Unpublish template |

**Exam Sessions (implemented)**

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /exam-sessions | List exam sessions |
| GET | /exam-sessions/{sessionId} | Get exam session state |
| POST | /exam-sessions/{sessionId}/heartbeat | Persist snapshot heartbeat |
| POST | /exam-sessions/{sessionId}/submit | Submit/finalize an exam session |

**Exam Packages + Enrollments (implemented)**

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /exam-packages | List visible exam packages (reference data) |
| GET | /student/enrollments | List current student enrollments (exam package ids) |
| POST | /student/enrollments | Enroll student into an exam package |

**Admin (implemented)**

Admin endpoints are protected by the admin portal auth (cookie-based in the web app; Bearer token supported for backwards compatibility).

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /admin/dashboard | Admin dashboard stats (lifetime totals) |
| GET | /admin/users | List users (supports role filtering + includeDeleted) |
| POST | /admin/users | Create user |
| GET | /admin/users/{userId} | Get user |
| PATCH | /admin/users/{userId} | Update user (email/password/role) |
| POST | /admin/users/{userId}/restore | Restore deleted user |
| GET | /admin/exam-sessions | List exam sessions |
| GET | /admin/exam-sessions/{userId}/{sessionId} | Get exam session details (includes snapshot) |
| POST | /admin/exam-sessions/{userId}/{sessionId}/force-submit | Force submit exam session |
| POST | /admin/exam-sessions/{userId}/{sessionId}/terminate | Terminate exam session |
| POST | /admin/exam-sessions/{userId}/{sessionId}/invalidate | Invalidate exam session |
| POST | /admin/exam-sessions/{userId}/{sessionId}/flags | Create exam integrity flag |
| GET | /admin/exam-sessions/{userId}/{sessionId}/events | List exam session events |
| POST | /admin/questions/{questionId}/approve | Approve question (review workflow) |
| POST | /admin/questions/{questionId}/request-changes | Request changes on question (review workflow) |

## 6.2 Authentication Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| POST | /student/auth/register | Student registration (local dev) |
| POST | /student/auth/login | Student login |
| GET | /student/auth/me | Current student |
| POST | /instructor/auth/login | Instructor login (bootstrap-provisioned in dev) |
| GET | /instructor/auth/me | Current instructor |
| POST | /admin/auth/login | Admin login (bootstrap-provisioned in dev) |
| GET | /admin/auth/me | Current admin |
| POST | /auth/register | Legacy alias for student registration (deprecated) |
| POST | /auth/login | Legacy alias for student login (deprecated) |
| GET | /auth/me | Legacy alias for student me (deprecated) |

Planned (not implemented yet): logout, refresh tokens, forgot/reset password, verify email, social login.

## 6.3 User Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /users/me | Get current user profile |
| PUT | /users/me | Update user profile |
| GET | /users/me/subscriptions | Get user subscriptions |
| GET | /users/me/progress | Get overall progress |
| GET | /users/me/analytics | Get analytics dashboard data |
| POST | /users/me/avatar | Upload profile picture |

## 6.4 Course & Content Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /courses | List all courses |
| GET | /courses/{id} | Get course details |
| GET | /courses/{id}/lessons | Get lessons for a course |
| GET | /lessons/{id} | Get lesson details |
| POST | /lessons/{id}/progress | Update lesson progress |
| GET | /lessons/{id}/transcript | Get video transcript |
| POST | /lessons/{id}/bookmark | Bookmark a lesson |

## 6.5 Practice & Questions Endpoints

This section distinguishes what exists today vs what remains planned.

Implemented (current MVP):

- Practice sessions: see **Practice Sessions (implemented)** above.
- Instructor/admin question bank workflows are exposed under `/instructor/questions` and `/admin/questions/*` in the OpenAPI contract.

Planned (future):

- Student-facing “browse/search questions” endpoints like `GET /questions` and a dedicated “submit answer” endpoint outside the practice session workflow.

## 6.6 Mock Test Endpoints

Planned (future): the traditional “test catalog / test attempts / results” endpoints below.

Implemented (current MVP): exam session snapshot endpoints under **Exam Sessions (implemented)** above.

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /tests | List available tests |
| GET | /tests/{id} | Get test details |
| POST | /tests/{id}/start | Start a test attempt |
| GET | /test-attempts/{id} | Get attempt details |
| POST | /test-attempts/{id}/answer | Submit answer during test |
| POST | /test-attempts/{id}/submit | Submit completed test |
| GET | /test-attempts/{id}/results | Get test results |
| GET | /test-attempts/{id}/review | Review test with answers |

## 6.7 Study Plan Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /study-plans/templates | Get plan templates |
| POST | /study-plans | Create custom study plan |
| GET | /study-plans/{id} | Get plan details |
| PUT | /study-plans/{id} | Update plan |
| POST | /study-plans/{id}/pause | Pause plan |
| POST | /study-plans/{id}/resume | Resume plan |
| GET | /study-plans/{id}/tasks | Get daily tasks |

## 6.8 Assessment Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| POST | /assessments/essays | Submit essay for grading |
| POST | /assessments/speaking | Upload speaking recording |
| GET | /assessments/{id} | Get assessment details |
| GET | /assessments/{id}/feedback | Get grading feedback |
| GET | /assessments/history | Get assessment history |

## 6.9 Payment Endpoints

| **Method** | **Endpoint** | **Description** |
| --- | --- | --- |
| GET | /subscriptions/plans | List subscription plans |
| POST | /subscriptions/checkout | Create checkout session |
| POST | /subscriptions/webhook | Stripe webhook handler |
| POST | /subscriptions/{id}/cancel | Cancel subscription |
| POST | /subscriptions/{id}/pause | Pause subscription |
| GET | /invoices | Get invoice history |
| POST | /refunds | Request refund |

## 6.10 API Response Format

**Success Response (200 OK):**

{  
"success": true,  
"data": { ... },  
"message": "Operation successful"  
}

**Error Response (4xx/5xx):**

{  
"success": false,  
"error": {  
"code": "ERROR_CODE",  
"message": "Human readable error message",  
"details": { ... }  
}  
}

## 6.11 API Security

- Cookie-based authentication required for protected endpoints (access/refresh cookies); Bearer auth is supported for compatibility
- CSRF protection for unsafe requests via double-submit token (`ace_csrf`)
- Rate limiting: 100 requests per minute per user
- CORS configuration for allowed origins
- Request validation using Joi/Zod schemas
- Input sanitization to prevent injection attacks
- HTTPS only in production

# 7\. User Interface Specifications

## 7.1 Design Principles

- Clean, modern, and intuitive interface
- Responsive design (mobile-first approach)
- Consistent color scheme and typography
- Accessibility compliance (WCAG 2.1 Level AA)
- Fast loading times and optimized performance
- Progressive enhancement

## 7.2 Color Palette

| **Color** | **Hex Code** | **Usage** |
| --- | --- | --- |
| Primary Blue | #2563EB | CTA buttons, links, highlights |
| Secondary Teal | #14B8A6 | Success states, progress |
| Accent Orange | #F59E0B | Important notifications |
| Dark Gray | #1F2937 | Text, headers |
| Light Gray | #F3F4F6 | Backgrounds, cards |
| White | #FFFFFF | Primary background |
| Error Red | #EF4444 | Error states, warnings |
| Success Green | #10B981 | Success messages |

## 7.3 Typography

- Primary Font: Inter (sans-serif) for UI elements
- Secondary Font: Merriweather (serif) for long-form content
- Monospace: Fira Code for code snippets
- Font sizes: 12px (small), 14px (body), 16px (large), 20px-32px (headings)
- Line height: 1.5 for body text, 1.2 for headings

## 7.4 Key Pages & Components

**7.4.1 Landing Page**

- Hero section: Headline, subheading, CTA button (Start Free Trial)
- Features section: Grid of 6-8 key features with icons
- Pricing comparison table
- Testimonials carousel
- Statistics: Students served, questions answered, average score improvement
- Footer: Links, social media, copyright

**7.4.2 Authentication Pages**

- Login: Email/password fields, social login buttons, "Forgot password" link
- Registration: Name, email, password, terms acceptance, exam selection
- Email verification: Success message, resend link
- Password reset: Email input, confirmation message

**7.4.3 Dashboard (Student Home)**

- Top navigation: Logo, Dashboard, Practice, Tests, Study Plan, Profile
- Welcome message with user name
- Progress overview: Lessons completed, questions answered, tests taken
- Study streak widget
- Predicted score display with confidence interval
- Today's tasks from study plan
- Recent activity timeline
- Quick action buttons: Continue watching, Practice questions, Take test

**7.4.4 Course Content Page**

- Sidebar: Course sections and topics (collapsible tree)
- Main area: Lesson list with thumbnails, duration, completion status
- Filters: Topic, difficulty, completion status
- Search bar for finding specific lessons
- Progress bar showing overall course completion

**7.4.5 Video Lesson Player**

- Full-width video player with controls (play, pause, seek, volume, fullscreen)
- Playback speed selector (0.5x to 2x)
- Transcript sidebar (auto-scroll, clickable timestamps)
- Note-taking panel (below video)
- Next/previous lesson buttons
- Bookmark button
- Related lessons suggestions

**7.4.6 Practice Questions Page**

- Question card: Question text, options, submit button
- Timer (if timed mode)
- Question counter (e.g., "5 of 20")
- Flag for review checkbox
- After submission: Correct/incorrect indicator, explanation panel
- Explanation tabs: Text, Video
- Similar questions button
- Navigation: Previous, Next, Review flagged, End session

Current MVP notes (implemented):

- Practice landing page shows a per-course catalog based on student enrollments.
- Each enrolled course section lists published Practice Templates (created by instructors/admins), and students start sessions from these templates.
- Untimed sessions can be paused/resumed.
- Ironman sessions show time remaining (server-enforced time limit).
- Per-question timing is tracked and shown.
- Finished sessions include an ordered Review section listing each question with selected answer, verdict, explanation (if available), time taken, and correct answer.

**7.4.7 Mock Test Interface**

- Full-screen mode with minimal distractions
- Section tabs (e.g., Quantitative, Verbal)
- Timer prominently displayed
- Question navigator sidebar (question numbers, flagged status)
- Mark for review functionality
- Submit test confirmation dialog
- Auto-submit on timeout

Current MVP notes (implemented):

- Test sessions persist progress via periodic heartbeats.
- A "Submit Test" action finalizes the attempt and transitions it to review state.
- The Tests catalog page includes a “Previous tests” section with in-progress and review behavior.

**7.4.8 Test Results Page**

- Overall score (large, prominent display)
- Percentile rank
- Section-wise scores (bar chart)
- Performance breakdown by topic (radar chart)
- Comparison with previous attempts (line graph)
- Strengths and weaknesses summary
- Review answers button
- Share results (social media)

**7.4.9 Analytics Dashboard**

- Time period selector (last 7 days, 30 days, all time)

**7.4.10 Admin Portal (implemented)**

- Admin Dashboard: lifetime totals (users, question bank counts, exam sessions, events, flags).

- Separate admin pages (routes) with shared page component:
	- Users: create/update/soft-delete/restore users.
	- Question Bank: manage packages/topics/difficulties and the question review workflow.
	- Exam Integrity: review sessions, inspect events/snapshots, and take actions (force submit/terminate/invalidate/flag).
	- Practice Templates: create/edit/publish/unpublish/delete reusable practice tests per exam package.
	- Session Management (within Users):
		- View active + historic auth sessions for the selected user (including IP, user agent, last seen, expiry, revoked reason).
		- Revoke one session or revoke all sessions for a user.
		- View effective session limit and contributing overrides (role / group / user).
		- Set/clear per-user max active sessions.
		- Manage session groups: create groups, set group limit, add/remove users to groups.

**Instructor Portal (implemented)**

- Instructor dashboard (scaffolded) and a Practice Templates manager page to create/edit/publish/unpublish/delete reusable practice tests per exam package.
- Study time chart (bar graph)
- Questions answered by topic (pie chart)
- Accuracy trends (line graph)
- Score progression (line graph)
- Predicted vs. actual score comparison
- Weak areas identification
- Recommendations based on performance

**7.4.10 Study Plan Page**

- Calendar view of study schedule
- Daily task list with checkboxes
- Plan overview: Start date, end date, target score, progress
- Pause/resume plan buttons
- Adjust plan button (opens wizard)
- Upcoming milestones

**7.4.11 Profile & Settings**

- Profile picture upload
- Personal information form
- Email preferences (notifications, newsletters)
- Password change
- Subscription details and management
- Payment methods
- Invoice history
- Account deletion option

Current MVP notes (implemented):

- Student Profile shows enrolled courses and recent practice/test history.

**7.4.12 Mobile App Screens**

- Bottom tab navigation: Home, Practice, Tests, More
- Simplified dashboard for smaller screens
- Offline mode indicator
- Push notification settings
- Mobile-optimized video player
- Flashcard swipe interface

## 7.5 Responsive Breakpoints

| **Device** | **Width** | **Layout Changes** |
| --- | --- | --- |
| Mobile | < 640px | Single column, hamburger menu, bottom nav |
| Tablet | 640px - 1024px | Two columns, collapsible sidebar |
| Desktop | \> 1024px | Full layout, persistent sidebar, multi-column |
| Large Desktop | \> 1440px | Max content width, more whitespace |

## 7.6 Accessibility Features

- Keyboard navigation support
- ARIA labels for screen readers
- High contrast mode option
- Adjustable font sizes
- Video captions and transcripts
- Focus indicators for interactive elements
- Alt text for all images

# 8\. Security & Authentication

## 8.1 Authentication Strategy

Current implementation (Jan 2026, local dev):

- Cookie-based authentication with server-side session tracking:
	- `ace_access` (HttpOnly cookie): JWT access token (15 minutes).
	- `ace_refresh` (HttpOnly cookie): opaque refresh token (rotated) bound to a server-side session (30 days).
	- `ace_csrf` (non-HttpOnly cookie): CSRF double-submit token.
- Server-side session store (Postgres):
	- `auth_sessions`: one row per login/device, includes `expires_at`, `revoked_at`, `last_seen_at`, `ip`, `user_agent`.
	- `auth_refresh_tokens`: hashed refresh tokens with rotation (old token revoked and linked to replacement).
- JWT claims include `role`, `aud`, and `sid` (session id) and are enforced server-side.
- Backwards compatibility: the API auth middleware can accept either a Bearer token (`Authorization: Bearer ...`) or the `ace_access` cookie.

Session/device limits (implemented):

- Default max active sessions per user is 3.
- Overrides are supported via DB tables and enforced by revoking the oldest sessions when over limit:
	- Per-user override: `auth_session_limits_user`
	- Group override (most restrictive of all groups): `auth_session_limits_group` + memberships in `auth_session_group_memberships`
	- Per-role override: `auth_session_limits_role`
- Precedence: user override > group limit > role limit > default.

Planned evolution:

- OAuth2 social login (Google/Facebook/Apple)
- MFA (TOTP)

## 8.2 Password Security

- Bcrypt hashing with cost factor 12
- Minimum password requirements: 8 characters, 1 uppercase, 1 number, 1 special character
- Password strength indicator during registration
- Password reset via secure email tokens (expires in 1 hour)
- Password history to prevent reuse of last 5 passwords

## 8.3 Data Encryption

- TLS 1.3 for all data in transit
- Database encryption at rest (AWS RDS encryption)
- Sensitive data encryption using AES-256
- Environment variables for secrets (never hardcoded)

## 8.4 Authorization

- Role-based access control (RBAC): Student, Instructor, Admin
- Resource-level permissions (e.g., access to specific courses)
- Subscription-based feature gating
- API endpoint authorization middleware

## 8.5 Security Best Practices

- Input validation and sanitization on all endpoints
- SQL injection prevention (parameterized queries, ORM)
- XSS prevention (Content Security Policy, output encoding)
- CSRF protection (implemented): double-submit cookie using `ace_csrf` and `X-CSRF-Token` on unsafe methods (login/register endpoints are exempt because they mint the CSRF cookie).
- Rate limiting to prevent brute force attacks
- Security headers (Helmet.js)
- Regular security audits and penetration testing
- Dependency scanning for vulnerabilities (Snyk, Dependabot)
- Logging and monitoring for suspicious activity
- GDPR compliance for user data handling

## 8.6 Payment Security

- PCI DSS compliance through Stripe
- No storage of credit card details on servers
- Stripe webhook signature verification
- Fraud detection using Stripe Radar

# 9\. Analytics & Reporting

## 9.1 User Analytics

- Study time tracking (daily, weekly, monthly)
- Content consumption metrics (videos watched, questions attempted)
- Performance metrics (accuracy, speed, improvement)
- Engagement metrics (login frequency, session duration, feature usage)
- Learning path analysis

## 9.2 Score Prediction Algorithm

- Features used: Practice accuracy, test scores, time spent, topics covered, difficulty progression
- Model: Ensemble of Random Forest and XGBoost
- Training data: Historical user performance and actual exam scores
- Confidence interval calculation
- Model retraining: Monthly with new data
- Prediction display: Score range with confidence percentage

## 9.3 Recommendation Engine

- Weak topic identification based on performance
- Personalized lesson recommendations
- Next-best-question selection using collaborative filtering
- Study plan adjustments based on progress
- Content similarity using NLP embeddings

## 9.4 Admin Analytics Dashboard

- User acquisition and retention metrics
- Subscription conversion funnel analysis
- Content engagement metrics (most viewed lessons, hardest questions)
- Revenue analytics (MRR, churn rate, LTV)
- Support ticket analysis
- A/B test results

## 9.5 Reporting Tools

- PDF report generation for student progress
- Email summaries (weekly progress reports)
- Exportable data (CSV, Excel)
- Shareable achievement certificates

# 10\. Deployment & DevOps

## 10.0 Local Development & Containerization (Current)

Local development is container-first: Node.js and Go are run inside Docker containers (so contributors do not need Node/Go installed on the host OS). The project ships a `docker-compose.yml` at the repository root.

**Local services (Docker Compose):**

| **Service** | **Image** | **Ports (host → container)** | **Notes** |
| --- | --- | --- | --- |
| db | postgres:15-alpine | 5432 → 5432 | Persistent data via a named Docker volume |
| redis | redis:alpine | 6379 → 6379 | Persistent data via a named Docker volume |
| api-gateway | golang:1.24-alpine | 8080 → 8080 | Runs `go run ./cmd/api-gateway` |
| web | node:24-alpine | 5173 → 5173 | Runs `npm install` then `vite dev` bound to 0.0.0.0 |

**Environment variables:**

- A `.env` file can be created from `.env.example`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- `REDIS_PORT`
- `API_PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
- `WEB_PORT`, `VITE_API_BASE_URL`

**Common commands:**

- `docker compose up -d` starts all local services.
- `docker compose logs -f api-gateway` tails API logs.
- `docker compose logs -f web` tails frontend logs.
- `make install`, `make dev-web`, `make dev-api` provide a shorthand workflow.

## 10.1 Infrastructure

- Current (local dev): Docker Compose and containerized toolchain
- Target (staging/production): Cloud provider (AWS or GCP), Docker, Kubernetes (e.g., EKS)
- Infrastructure as Code: Terraform
- Load Balancer: AWS ALB / NGINX
- CDN: CloudFront for global content delivery
- DNS: Route 53

## 10.2 CI/CD Pipeline

- Version Control: GitHub
- CI/CD: GitHub Actions
- Pipeline stages: Lint → Test → Build → Deploy
- Automated testing: Unit, integration, E2E (Playwright)
- Code coverage threshold: 80%
- Deployment strategy: Blue-green deployment
- Rollback capability

## 10.3 Environment Strategy

| **Environment** | **Purpose** | **Deployment** |
| --- | --- | --- |
| Development | Local development | Docker Compose |
| Staging | Testing & QA | Kubernetes (staging cluster) |
| Production | Live users | Kubernetes (production cluster) |

## 10.4 Monitoring & Observability

- Application monitoring: Prometheus + Grafana
- Logging: ELK Stack (Elasticsearch, Logstash, Kibana)
- Error tracking: Sentry
- APM: New Relic or DataDog
- Uptime monitoring: UptimeRobot or Pingdom
- Custom alerts for critical metrics (Slack/PagerDuty integration)

## 10.5 Backup & Disaster Recovery

- Database backups: Daily automated snapshots (retained for 30 days)
- Point-in-time recovery enabled for PostgreSQL
- S3 versioning and lifecycle policies
- Multi-region replication for critical data
- Disaster recovery plan with RTO < 4 hours, RPO < 1 hour

## 10.6 Scaling Strategy

- Horizontal Pod Autoscaling (HPA) in Kubernetes
- Database read replicas for read-heavy operations
- Redis cluster for distributed caching
- CDN for static assets and videos
- Message queue (RabbitMQ) for async processing
- Serverless functions (Lambda) for sporadic tasks

# 11\. Testing Strategy

## 11.1 Testing Pyramid

- Unit Tests: 70% - Test individual functions and components
- Integration Tests: 20% - Test API endpoints and database interactions
- E2E Tests: 10% - Test critical user flows

## 11.2 Unit Testing

- Frontend: Jest + React Testing Library
- Backend: Jest (Node.js), Pytest (Python)
- Coverage target: 80% minimum
- Test naming convention: describe-what-should-happen
- Mocking external dependencies

## 11.3 Integration Testing

- API testing with Supertest (Node.js)
- Database integration tests with test database
- Stripe webhook testing with mock events
- Authentication flow testing

## 11.4 End-to-End Testing

- Tool: Playwright or Cypress
- Critical flows: Registration → Login → Take test → View results
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsive testing

## 11.5 Performance Testing

- Load testing with k6 or JMeter
- Target: Handle 1000 concurrent users
- API response time: < 200ms (p95)
- Page load time: < 3 seconds
- Lighthouse CI for frontend performance

## 11.6 Security Testing

- OWASP ZAP for vulnerability scanning
- Dependency audits (npm audit, Snyk)
- Penetration testing (quarterly)
- Security headers validation

# 12\. Future Enhancements

## 12.1 Short-term (3-6 months)

- Live webinars with instructors
- Peer-to-peer study groups and forums
- Gamification: Badges, leaderboards, achievements
- Mobile app offline mode for all content
- Advanced AI essay grading with more detailed feedback
- Integration with official test booking platforms

## 12.2 Medium-term (6-12 months)

- Multi-language support (Spanish, Mandarin, Hindi)
- Live 1-on-1 tutoring marketplace
- Collaborative study rooms (video chat)
- AI chatbot for instant Q&A
- Personalized learning paths using deep learning
- Integration with learning management systems (LMS)

## 12.3 Long-term (1-2 years)

- VR/AR study experiences
- Expansion to more exam types (MCAT, LSAT, GMAT)
- B2B offerings for schools and coaching centers
- Advanced analytics using predictive AI
- Blockchain-based certification system
- Voice-based learning assistant

## 12.4 Innovation Ideas

- Adaptive difficulty that matches real-time performance
- Emotion detection during study (for stress management)
- Social learning features (study with friends)
- Integration with productivity tools (Calendar, Notion)
- Marketplace for user-generated content
- Career counseling and university admissions support

# Appendix A: Glossary

| **Term** | **Definition** |
| --- | --- |
| CAT | Computer Adaptive Testing - Test adapts difficulty based on responses |
| IRT | Item Response Theory - Statistical model for test question difficulty |
| JWT | JSON Web Token - Secure authentication token format |
| RBAC | Role-Based Access Control - Permission system based on user roles |
| SRS | Spaced Repetition System - Learning technique for optimal review timing |
| CDN | Content Delivery Network - Distributed servers for fast content delivery |
| ORM | Object-Relational Mapping - Database abstraction layer |
| API | Application Programming Interface - Interface for software interaction |
| CI/CD | Continuous Integration/Continuous Deployment - Automated development pipeline |

# Appendix B: Technical Requirements

| **Category** | **Requirement** |
| --- | --- |
| Browser Support | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Mobile OS | iOS 14+, Android 10+ |
| Internet Speed | Minimum 2 Mbps for video streaming |
| Screen Resolution | Minimum 1024x768 for web, 375x667 for mobile |
| Server Requirements | 4 vCPU, 16GB RAM per service (production) |
| Database | PostgreSQL 15+ (dev compose uses 15), Redis 7+; MongoDB planned |
| Storage | Minimum 500GB for initial deployment |

# Appendix C: Project Timeline Estimate

| **Phase** | **Duration** | **Deliverables** |
| --- | --- | --- |
| Planning & Design | 4 weeks | Wireframes, mockups, architecture docs |
| MVP Development | 12 weeks | Core features: Auth, content, practice, tests |
| Testing & QA | 3 weeks | Bug fixes, performance optimization |
| Beta Launch | 2 weeks | Limited user testing, feedback collection |
| Full Launch | 2 weeks | Marketing, full user access |
| Post-Launch Support | Ongoing | Bug fixes, feature additions |

# Appendix D: Team Structure

| **Role** | **Count** | **Responsibilities** |
| --- | --- | --- |
| Product Manager | 1   | Product vision, roadmap, stakeholder management |
| UI/UX Designer | 1-2 | Design mockups, user research, prototyping |
| Frontend Developer | 2-3 | React web app (Vite + TypeScript), Flutter mobile app (planned) |
| Backend Developer | 2-3 | APIs, microservices, database design |
| ML Engineer | 1   | Analytics, score prediction, recommendation engine |
| DevOps Engineer | 1   | Infrastructure, CI/CD, monitoring |
| QA Engineer | 1-2 | Testing, quality assurance |
| Content Creator | 2-3 | Video lessons, question bank, explanations |

# Document Control

| **Version** | **Date** | **Author** | **Changes** |
| --- | --- | --- | --- |
| 1.0 | Dec 2025 | Development Team | Initial release |
| 1.1 | Dec 2025 | Development Team | Documented implemented practice modes (Ironman/Untimed), pause/resume gating, per-question timing + review breakdown, exam submit flow, and the MVP Postgres/OpenAPI schema/API/UI updates |
| 1.2 | Jan 2026 | Development Team | Added exam packages + enrollments model and wired student enrollments into practice/test entitlement enforcement and UI |
| 1.3 | Jan 2026 | Development Team | Added practice template catalog (DB + OpenAPI + handlers), template-driven practice session creation, student per-course practice catalog UI, and admin/instructor practice template management UI |

**End of Document**