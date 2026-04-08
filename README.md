# ai-news-kr

해외 AI 뉴스를 자동으로 수집, 번역, 요약하여 한국어로 제공하는 뉴스 큐레이션 사이트 MVP.

## 기술 스택

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **DB**: Supabase (PostgreSQL) + Prisma ORM
- **AI**: OpenAI API (번역 + 요약)
- **배포**: Vercel (Cron Job 포함)

## 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
# .env.local 파일을 열어 실제 값으로 채워넣기
```

필요한 서비스:
- [Supabase](https://supabase.com) — 프로젝트 생성 후 URL/API 키 복사
- [OpenAI](https://platform.openai.com) — API 키 발급

### 3. DB 스키마 적용

Supabase 프로젝트 생성 후 SQL Editor에서 실행:

```bash
# supabase/migrations/20260408000001_initial_schema.sql 내용을 Supabase SQL Editor에 붙여넣기
```

또는 Prisma 마이그레이션 사용 (DATABASE_URL 설정 후):

```bash
npx prisma migrate dev --name initial
```

### 4. 개발 서버 실행

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## 프로젝트 구조

```
src/
  app/           # Next.js App Router 페이지
    api/
      cron/      # Vercel Cron Jobs
  lib/
    prisma.ts    # Prisma 클라이언트 싱글턴
prisma/
  schema.prisma  # DB 스키마 정의
supabase/
  migrations/    # SQL 마이그레이션 파일
```

## 주요 명령어

```bash
npm run dev        # 개발 서버 (localhost:3000)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 검사
npx prisma studio  # DB GUI 도구
```

## DB 스키마

| 테이블 | 역할 |
|--------|------|
| `articles` | 수집된 뉴스 기사 (원문 + 번역 + 요약) |
| `settings` | 앱 설정 키-값 저장소 |
| `collection_logs` | RSS 수집 실행 로그 |
