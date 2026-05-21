# daily-tasks

일일 업무를 정리하는 스킬. 슬랙 채널에서 업무 관련 메시지를 수집하여 DM으로 전송한다.

## 사용법

`/daily-tasks` 또는 "일일 업무 정리해줘"라고 요청하면 실행된다.

## 환경변수 (필수)

로컬 환경에서 다음 환경변수를 설정해야 한다:

```bash
export SLACK_BOT_TOKEN="xoxb-..."  # 슬랙 봇 토큰
export SLACK_USER_ID="U..."        # 본인 슬랙 사용자 ID
```

## 실행 절차

이 스킬이 호출되면 다음 단계를 수행한다:

### 1. 환경변수 확인

```bash
if [ -z "$SLACK_BOT_TOKEN" ]; then
  echo "SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다."
  exit 1
fi
```

### 2. 슬랙 채널 메시지 조회

채널 ID: `C087HTW9HH7`

최근 24시간 메시지를 조회한다:

```bash
OLDEST=$(date -d '24 hours ago' +%s)
curl -s "https://slack.com/api/conversations.history?channel=C087HTW9HH7&oldest=$OLDEST" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. 업무 메시지 필터링

다음 조건으로 필터링:
- 작성자가 본인 (`user == $SLACK_USER_ID`)인 메시지 우선
- 업무 관련 키워드 포함: TODO, 할 일, 해야 할, 요청, 확인, 검토, 마감, 까지, deadline, 기한, 긴급, 급함, 중요

### 4. 스레드 내용 수집

업무 메시지에 스레드가 있으면 스레드 내용도 조회:

```bash
curl -s "https://slack.com/api/conversations.replies?channel=C087HTW9HH7&ts=$THREAD_TS" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

### 5. 슬랙 리스트 조회 (선택)

리스트 ID: `F0AP6MU29TR`

Bot Token으로 리스트 접근이 가능하면 조회, 안 되면 스킵.

### 6. 결과 정리 및 DM 전송

정리된 업무 목록을 본인 DM으로 전송:

```bash
curl -s "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "'$SLACK_USER_ID'",
    "text": "📋 오늘의 업무 정리...",
    "mrkdwn": true
  }'
```

## 출력 형식

```
📋 오늘의 업무 정리 (YYYY-MM-DD)

📝 내가 작성한 업무 메시지:
• [메시지 내용] - HH:MM
• [메시지 내용] - HH:MM

📊 사업팀 리스트:
• [리스트 항목]
```

## 업무 식별 키워드

| 분류 | 키워드 |
|------|--------|
| 할 일 | TODO, 할 일, 해야 할, 해야할 |
| 요청 | 요청, 부탁, 확인 필요, 검토 |
| 마감 | 마감, 까지, deadline, 기한 |
| 중요도 | 긴급, 급함, 중요 |

## 추후 확장 예정

- Outlook 캘린더 연동
- 이모지 리액션 기반 업무 식별
- 업무 우선순위 자동 분류
