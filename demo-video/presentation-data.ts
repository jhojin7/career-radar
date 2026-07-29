export const PRESENTATION_FPS = 30;
export const PRESENTATION_DURATION_SECONDS = 175;
export const PRESENTATION_DURATION_FRAMES = PRESENTATION_DURATION_SECONDS * PRESENTATION_FPS;

export type PresentationScene = {
  id: string;
  label: string;
  start: number;
  end: number;
};

export const presentationScenes: PresentationScene[] = [
  {id: "intro", label: "Career Radar", start: 0, end: 10},
  {id: "problem", label: "Problem", start: 10, end: 25},
  {id: "scope", label: "Product", start: 25, end: 40},
  {id: "journey", label: "Flow", start: 40, end: 60},
  {id: "architecture", label: "GCP Architecture", start: 60, end: 85},
  {id: "design", label: "Core Design", start: 85, end: 105},
  {id: "collection", label: "Live Product", start: 105, end: 116},
  {id: "recommendations", label: "Recommendations", start: 116, end: 128},
  {id: "evidence", label: "Evidence", start: 128, end: 143},
  {id: "guardrails", label: "Guardrails", start: 143, end: 154},
  {id: "roadmap", label: "Next", start: 154, end: 167},
  {id: "outro", label: "Career Radar", start: 167, end: 175},
];

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export const subtitleCues: SubtitleCue[] = [
  {start: 1, end: 5.4, text: "Career Radar는 이력서와 희망 조건을 기준으로 채용공고를 분석합니다."},
  {start: 5.4, end: 9.4, text: "그리고 어떤 공고가 더 적합한지, 점수와 판단 근거를 함께 보여줍니다."},
  {start: 10.4, end: 15.3, text: "구직자는 공고마다 기술, 경력, 지역과 근무 조건을 반복해서 비교해야 합니다."},
  {start: 15.3, end: 20.1, text: "단순한 AI 추천만으로는 왜 이 결과가 나왔는지 다시 확인하기 어렵습니다."},
  {start: 20.1, end: 24.5, text: "그래서 비교 과정을 줄이되, 최종 판단은 사용자가 검증할 수 있게 만들었습니다."},
  {start: 25.4, end: 30.2, text: "현재는 PDF 이력서에서 프로필 초안을 만들고 사용자가 직접 확정할 수 있습니다."},
  {start: 30.2, end: 35.1, text: "희망 직무와 조건을 설정하고, TXT·PDF 공고와 제한적인 공개 소스를 수집합니다."},
  {start: 35.1, end: 39.5, text: "그 결과를 적합도, 제외 조건, 검토 필요 상태와 원문 근거로 제공합니다."},
  {start: 40.4, end: 45.1, text: "첫 단계는 이력서 업로드입니다. Gemini가 경력과 기술을 구조화합니다."},
  {start: 45.1, end: 49.8, text: "사용자는 추출 결과를 검토한 뒤 Candidate Profile로 확정합니다."},
  {start: 49.8, end: 54.8, text: "희망 직무, 지역, 근무 형태를 Search Target으로 설정합니다."},
  {start: 54.8, end: 59.5, text: "수집된 공고는 정규화와 중복 제거를 거쳐 Fit Score와 근거로 연결됩니다."},
  {start: 60.5, end: 65.4, text: "React와 Vite 웹 화면, Hono API는 Cloud Run 서비스로 배포할 수 있습니다."},
  {start: 65.4, end: 70.8, text: "Vertex AI Gemini는 이력서와 공고에서 구조화된 사실과 근거를 추출합니다."},
  {start: 70.8, end: 76.0, text: "구조화 데이터는 Firestore에, 원본 PDF와 공고 파일은 Cloud Storage에 저장합니다."},
  {start: 76.0, end: 80.7, text: "예약 수집은 Cloud Scheduler가 Cloud Run Job을 실행합니다."},
  {start: 80.7, end: 84.6, text: "수동 실행과 예약 실행은 같은 Collection Run 처리 로직을 공유합니다."},
  {start: 85.5, end: 90.7, text: "핵심 설계는 AI의 추출과 애플리케이션의 최종 판단을 분리한 것입니다."},
  {start: 90.7, end: 96.2, text: "Gemini는 사실을 추출하지만, 제외 조건과 Fit Score를 직접 결정하지 않습니다."},
  {start: 96.2, end: 100.8, text: "점수와 순위는 규칙으로 계산해 같은 입력에는 같은 결과를 제공합니다."},
  {start: 100.8, end: 104.6, text: "근거가 모호하면 자동 제외하지 않고 Review Required로 남깁니다."},
  {start: 105.4, end: 110.6, text: "실제 화면에서는 완료된 Collection Run과 정규화된 Job Pool을 확인할 수 있습니다."},
  {start: 110.6, end: 115.6, text: "발견, 신규, 중복, 검토 필요, 실패 상태가 같은 화면에 집계됩니다."},
  {start: 116.5, end: 122.2, text: "추천 공고는 Fit Score 순서로 정렬되고 네 가지 점수의 가중치를 조정할 수 있습니다."},
  {start: 122.2, end: 127.6, text: "이 미리보기는 저장된 구성 점수만 다시 계산하며 Gemini를 호출하지 않습니다."},
  {start: 128.5, end: 133.5, text: "상위 공고를 열면 종합 점수뿐 아니라 기술, 경력, 방향, 근무 조건을 분리해 볼 수 있습니다."},
  {start: 133.5, end: 138.7, text: "각 강점과 부족한 점에는 프로필 또는 공고의 실제 문구가 연결됩니다."},
  {start: 138.7, end: 142.6, text: "사용자는 원문 근거를 읽고 추천 결과를 다시 판단할 수 있습니다."},
  {start: 143.5, end: 148.5, text: "근무 형태처럼 정보가 모호한 공고는 Review Required로 분류합니다."},
  {start: 148.5, end: 153.6, text: "계약직처럼 명확한 제외 조건을 위반한 공고는 점수가 높아도 Excluded가 됩니다."},
  {start: 154.5, end: 159.0, text: "다음 단계는 지원서 맞춤화와 면접 준비, 지원 상태 관리입니다."},
  {start: 159.0, end: 163.1, text: "안정적인 채용 API와 기술 격차 분석으로 데이터 활용을 넓힐 수 있습니다."},
  {start: 163.1, end: 166.6, text: "BigQuery 분석과 Cloud Monitoring으로 추천 이력, 오류와 비용도 관찰할 계획입니다."},
  {start: 167.5, end: 171.2, text: "Career Radar는 AI의 속도와 사용자의 판단을 연결합니다."},
  {start: 171.2, end: 174.6, text: "근거가 보이고, 결과가 반복 가능하며, 최종 결정권은 사용자에게 있습니다."},
];
