## Stage 1

### What I am designing
A notification system for students where notifications are of 3 types:
- Placement
- Result
- Event

Main operations needed:
1. Create notification
2. Fetch notifications
3. Mark one notification as read
4. Mark all notifications as read
5. Get unread count

### API Contracts

#### 1) Create Notification
- Method: `POST`
- Endpoint: `/api/v1/notifications`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`

Request body (example):
```json
{
  "recipientIds": ["72309160K", "72309161K"],
  "type": "Placement",
  "title": "Placement Drive",
  "message": "ABC Corp hiring for SDE",
  "priority": "high"
}
```

Success response (201):
```json
{
  "id": "uuid",
  "recipientCount": 2,
  "createdAt": "2026-05-18T10:30:00.000Z"
}
```

#### 2) Get Notifications
- Method: `GET`
- Endpoint: `/api/v1/notifications?studentId=72309160K&limit=10&page=1&notification_type=Placement`
- Headers:
  - `Authorization: Bearer <token>`

Success response (200):
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "title": "Hiring Update",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 52
}
```

#### 3) Mark one as read
- Method: `PATCH`
- Endpoint: `/api/v1/notifications/:notificationId/read`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`

Request body:
```json
{
  "studentId": "72309160K"
}
```

#### 4) Mark all as read
- Method: `PATCH`
- Endpoint: `/api/v1/notifications/read-all`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`

Request body:
```json
{
  "studentId": "72309160K"
}
```

#### 5) Unread count
- Method: `GET`
- Endpoint: `/api/v1/notifications/unread-count?studentId=72309160K`
- Headers:
  - `Authorization: Bearer <token>`

### Notification object shape
```json
{
  "id": "uuid",
  "studentId": "string",
  "type": "Placement | Result | Event",
  "title": "string",
  "message": "string",
  "priority": "low | medium | high",
  "isRead": "boolean",
  "createdAt": "ISO timestamp",
  "readAt": "ISO timestamp | null"
}
```

### Real-time mechanism
I would use WebSocket for real-time updates.
- Client connects once user opens app
- Server pushes newly created notifications
- Client updates list instantly and increments unread badge
- If socket disconnects, client retries with backoff

---

## Stage 2

### DB choice
I would use PostgreSQL.
Reason: read/unread updates and filtering need strong consistency + good indexing.

### Schema (practical)
- `students`
- `notifications`
- `student_notifications` (mapping table with read status)

Minimal schema idea:
```sql
students(id, roll_no, name, email, created_at)
notifications(id, type, title, message, priority, created_at)
student_notifications(id, student_id, notification_id, is_read, read_at, created_at)
```

### Important indexes
- `(student_id, is_read, created_at DESC)`
- `(student_id, created_at DESC)`
- `(type, created_at DESC)`

### Scale issues as volume grows
- slow unread queries if indexes are missing
- offset pagination becomes expensive on deep pages
- notify-all inserts can spike DB writes

### Fixes
- composite indexes based on actual query patterns
- use keyset pagination for large pages
- do bulk insert via async queue for fanout
- archive very old notifications

---

## Stage 3

Given query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### Is it accurate?
Partially. It fetches unread notifications, but for inbox UX we usually need latest first, so `DESC` is more useful.

### Why is it slow?
- likely no composite index on `(studentID, isRead, createdAt)`
- `SELECT *` fetches unnecessary columns
- using wrong table design can force scans

### Better query
```sql
SELECT id, type, title, message, created_at
FROM student_notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```

### Should we add index on every column?
No. That increases write cost and storage. Add only query-driven indexes.

### Query: students who got Placement in last 7 days
```sql
SELECT DISTINCT s.roll_no
FROM students s
JOIN student_notifications sn ON sn.student_id = s.id
JOIN notifications n ON n.id = sn.notification_id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

Problem: Notifications are fetched on every page load, so DB is overloaded.

### Improvements
1. Add caching for recent pages/unread count (short TTL)
2. Use keyset pagination instead of large offsets
3. Fetch only required fields
4. Add read replicas for heavy read traffic
5. Push notifications in real-time so client doesn’t poll aggressively

### Tradeoffs
- cache improves speed but adds invalidation complexity
- replicas improve reads but add replication lag
- keyset pagination is faster but slightly more complex in frontend state

---

## Stage 5

Given flow:
`send_email -> save_to_db -> push_to_app`

### Issues
- if email fails midway, consistency breaks
- notify-all is too slow if done sequentially
- no retry strategy shown

### Better design
Use async job queues and make DB write first (source of truth).

Revised flow:
1. create notification record once
2. create fanout records in batches
3. push jobs to email queue + app push queue
4. workers process with retries and dead-letter queue
5. track per-channel status (`pending/sent/failed`)

Why DB first?
Because notification must exist even if external channel (email) fails temporarily.

---

## Stage 6

### Priority logic used
- weight by type: `Placement > Result > Event`
- apply recency score so latest gets preference
- final score = weighted type + recency

### Implementation done
Code file used:
- `notification_app_be/src/stage6_priority.ts`

What it does:
- calls protected notifications API
- fetches pages
- computes score
- sorts descending
- prints top 10 in console table

### Keeping top 10 updated as new notifications arrive
Use min-heap of size 10:
- if heap size < 10, push
- else compare with min element and replace if higher priority
This avoids re-sorting the full list every time.

---

## Stage 7

### Frontend requirement summary
Build responsive React/Next app on `http://localhost:3000`.
Use Material UI only (no ShadCN/custom CSS frameworks).

### Pages planned
1. All Notifications page
   - list with pagination
   - filter by notification type
2. Priority Inbox page
   - shows top N (default 10)

### Mandatory behaviors
- show unread vs read clearly
- robust API error handling
- loading and empty states
- mobile + desktop responsive layout

### API used
`GET http://4.224.186.213/evaluation-service/notifications`
with query params:
- `limit`
- `page`
- `notification_type`

### Submission items for this stage
- frontend source code in repository
- screenshots (desktop + mobile)
- short demo video

---

## Logging Middleware Integration
All modules use custom logging middleware package instead of console logs.

Used log fields:
- `stack`: backend/frontend
- `level`: debug/info/warn/error/fatal
- `package`: allowed package values from problem statement
- `message`: meaningful context

This logging is integrated in backend routes/services and stage scripts.
