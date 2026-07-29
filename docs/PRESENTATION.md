# Career Radar 최종 발표 영상

> NIPA/KSTA Google Study Jam PBL 개인 프로젝트
>
> 최종 영상 길이: 2분 55초
>
> 형식: 1920×1080, 30fps, H.264, 화면 내 한국어 자막

## 영상 구성

### 0:00–0:10 — 프로젝트 소개

Career Radar는 이력서와 희망 조건을 기준으로 채용공고를 분석하고, 어떤 공고가 더 적합한지 점수와 판단 근거를 함께 보여주는 개인용 웹 애플리케이션이다.

**영상 자막**

> Career Radar는 이력서와 희망 조건을 기준으로 채용공고를 분석합니다.
>
> 그리고 어떤 공고가 더 적합한지, 점수와 판단 근거를 함께 보여줍니다.

### 0:10–0:25 — 해결하려는 문제

- 공고마다 기술, 경력, 지역과 근무 조건을 반복해서 비교해야 하는 부담
- 추천 결과만으로는 판단 과정과 근거를 다시 확인하기 어려운 문제
- 비교 과정은 줄이되 최종 판단은 사용자가 검증할 수 있도록 설계

**영상 자막**

> 구직자는 공고마다 기술, 경력, 지역과 근무 조건을 반복해서 비교해야 합니다.
>
> 단순한 AI 추천만으로는 왜 이 결과가 나왔는지 다시 확인하기 어렵습니다.
>
> 그래서 비교 과정을 줄이되, 최종 판단은 사용자가 검증할 수 있게 만들었습니다.

### 0:25–0:40 — 현재 제품 범위

- PDF 이력서에서 Profile Draft 생성 후 사용자 확인
- 희망 직무, 지역, 근무 형태를 Search Target으로 설정
- TXT·PDF 공고와 제한적인 공개 소스 수집
- 수집 결과를 정규화하고 중복 제거
- Fit Score, 제외 조건, Review Required 상태와 원문 근거 제공

이 구간에서는 실제 워크스페이스 화면을 위에서 아래로 스크롤하며 프로필 설정부터 Job Pool과 추천 영역까지 보여준다.

### 0:40–1:00 — 핵심 사용 흐름

1. PDF 이력서 업로드
2. Gemini가 경력과 기술을 구조화해 Profile Draft 생성
3. 사용자가 결과를 확인하고 Candidate Profile로 확정
4. 희망 직무, 지역, 근무 형태를 Search Target으로 설정
5. 공고를 수집하고 정규화·중복 제거
6. Fit Score와 판단 근거가 포함된 추천 생성

**영상 자막**

> 첫 단계는 이력서 업로드입니다. Gemini가 경력과 기술을 구조화합니다.
>
> 사용자는 추출 결과를 검토한 뒤 Candidate Profile로 확정합니다.
>
> 희망 직무, 지역, 근무 형태를 Search Target으로 설정합니다.
>
> 수집된 공고는 정규화와 중복 제거를 거쳐 Fit Score와 근거로 연결됩니다.

### 1:00–1:25 — GCP 아키텍처

```text
사용자 Browser
  │
  ▼
Cloud Run Service
  ├─ React / Vite 화면
  ├─ Hono API
  └─ 수동 실행 ───────────────┐
                              ▼
Cloud Scheduler ───────▶ Cloud Run Job
                         Collection worker

Cloud Run Service와 Cloud Run Job이 공유:
  ├─ Vertex AI Gemini ── 이력서·공고의 사실과 근거 추출
  ├─ Firestore ───────── 프로필·공고·Collection Run·추천 저장
  └─ Cloud Storage ───── 이력서 PDF와 공고 원본 저장
```

- 웹 화면과 Hono API는 Cloud Run Service로 배포
- 웹에서 수동 수집을 요청하면 Cloud Run Job 실행
- 예약 수집은 Cloud Scheduler가 동일한 Cloud Run Job 실행
- 웹 서비스와 배치 작업은 Vertex AI, Firestore, Cloud Storage를 공유

**영상 자막**

> React와 Vite 웹 화면, Hono API는 Cloud Run 서비스로 배포할 수 있습니다.
>
> Vertex AI Gemini는 이력서와 공고에서 구조화된 사실과 근거를 추출합니다.
>
> 구조화 데이터는 Firestore에, 원본 PDF와 공고 파일은 Cloud Storage에 저장합니다.
>
> 예약 수집은 Cloud Scheduler가 Cloud Run Job을 실행합니다.
>
> 수동 실행과 예약 실행은 같은 Collection Run 처리 로직을 공유합니다.

### 1:25–1:45 — 핵심 설계

Gemini의 역할과 애플리케이션 규칙의 역할을 분리했다.

- Gemini: 비정형 문장에서 구조화된 사실과 원문 근거 추출
- 애플리케이션 규칙: 제외 조건, 네 가지 구성 점수, Fit Score와 순위 계산
- 동일한 입력에는 동일한 점수와 순위 제공
- 근거가 모호한 경우 자동 제외하지 않고 Review Required로 분류

**영상 자막**

> 핵심 설계는 AI의 추출과 애플리케이션의 최종 판단을 분리한 것입니다.
>
> Gemini는 사실을 추출하지만, 제외 조건과 Fit Score를 직접 결정하지 않습니다.
>
> 점수와 순위는 규칙으로 계산해 같은 입력에는 같은 결과를 제공합니다.
>
> 근거가 모호하면 자동 제외하지 않고 Review Required로 남깁니다.

### 1:45–1:56 — Collection Run과 Job Pool

완료된 Collection Run 화면에서 발견, 신규, 중복, 정규화, 검토 필요와 실패 상태를 확인한다. 같은 화면에서 정규화된 Job Pool과 공고 파일 가져오기 기능을 보여준다.

**영상 자막**

> 실제 화면에서는 완료된 Collection Run과 정규화된 Job Pool을 확인할 수 있습니다.
>
> 발견, 신규, 중복, 검토 필요, 실패 상태가 같은 화면에 집계됩니다.

### 1:56–2:08 — 추천 목록과 Fit Weights

- 추천 공고를 Fit Score 순서로 표시
- Technical fit, Experience fit, Career direction, Work conditions 가중치 조정
- 미리보기는 저장된 구성 점수만 다시 계산하며 Gemini나 새 Collection Run을 호출하지 않음

### 2:08–2:23 — 추천 상세와 원문 근거

- 종합 Fit Score와 네 가지 구성 점수를 분리해 표시
- 강점과 부족한 점을 항목별로 제공
- 프로필 또는 공고의 실제 문구를 근거로 연결
- 사용자가 원문을 읽고 추천 결과를 다시 판단할 수 있도록 구성

### 2:23–2:34 — 판단 안전장치

- 근무 형태처럼 정보가 모호하면 Review Required
- 계약직처럼 명확한 제외 조건을 위반하면 점수가 높아도 Excluded
- AI가 불확실한 내용을 단정하지 않도록 최종 상태를 규칙으로 결정

### 2:34–2:47 — 확장 방향

- 지원서 맞춤화, 면접 준비와 지원 상태 관리
- 안정적인 채용 API 연동과 기술 격차 분석
- BigQuery를 이용한 추천 이력 분석
- Cloud Monitoring을 이용한 수집 오류, 성공률과 비용 관찰

### 2:47–2:55 — 마무리

**영상 자막**

> Career Radar는 AI의 속도와 사용자의 판단을 연결합니다.
>
> 근거가 보이고, 결과가 반복 가능하며, 최종 결정권은 사용자에게 있습니다.

## 최종 제출 파일

- 영상: `artifacts/presentation/career-radar-presentation.mp4`
- 별도 자막: `artifacts/presentation/career-radar-presentation.ko.srt`
- 대표 이미지: `artifacts/presentation/career-radar-presentation-thumbnail.png`

최종 MP4에는 한국어 자막이 화면에 포함되어 있으므로 영상 파일 하나만으로 재생할 수 있다.
