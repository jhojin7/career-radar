import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, Database, FileText, LoaderCircle, MapPin, Plus, Radar, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CollectionRun, JobPoolSummary } from "../../server/collection.js";
import type {
  CandidateProfile,
  ProfileData,
  ProfileDraft,
  SearchTargetDraft,
  SearchTargetDraftSet,
  SearchTargetSet,
} from "../../server/onboarding.js";
import { DEFAULT_FIT_WEIGHTS, WORK_MODES } from "../../server/onboarding-values.js";
import type { JobRecommendation } from "../../server/recommendation.js";
import { activateCandidateProfile, type OnboardingState } from "./onboarding-state.js";
import { isSupportedResumeMetadata } from "./resume-upload.js";

type WorkMode = ProfileData["workModes"][number];
type Evidence = ProfileData["experience"][number]["evidence"][number];
type CollectionState = { latestRun: CollectionRun | null; jobPoolSummary: JobPoolSummary };
const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function App() {
  const [state, setState] = useState<OnboardingState>({
    draft: null,
    candidateProfile: null,
    searchTargetDraft: null,
    searchTargets: null,
  });
  const [loading, setLoading] = useState(true);
  const [collectionState, setCollectionState] = useState<CollectionState>({
    latestRun: null,
    jobPoolSummary: { activePostings: 0, reviewRequired: 0, totalRevisions: 0, lastUpdatedAt: null },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "extracting">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    let active = true;
    const refreshCollection = () => api<CollectionState>("/api/collection/state")
      .then((next) => { if (active) setCollectionState(next); });
    Promise.all([
      api<OnboardingState>("/api/onboarding/state").then((next) => { if (active) setState(next); }),
      refreshCollection(),
    ])
      .catch((caught: unknown) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
    const interval = window.setInterval(() => { void refreshCollection().catch(() => undefined); }, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const weightTotal = state.draft
    ? Object.values(state.draft.profile.fitWeights).reduce((total, value) => total + value, 0)
    : 0;

  function updateProfile(update: (profile: ProfileData) => ProfileData) {
    setState((current) =>
      current.draft ? { ...current, draft: { ...current.draft, profile: update(current.draft.profile) } } : current,
    );
  }

  async function uploadResume() {
    setError(null);
    setMessage(null);
    if (!selectedResume || !isSupportedResumeMetadata(selectedResume)) {
      setError("Choose a PDF resume. Other formats are not supported.");
      return;
    }
    const form = new FormData();
    form.set("resume", selectedResume);
    setBusy("upload");
    setUploadPhase("uploading");
    setUploadProgress(0);
    try {
      const result = await uploadResumeRequest(form, (progress) => {
        setUploadProgress(progress);
        if (progress === 1) setUploadPhase("extracting");
      });
      setState({ draft: result.draft, candidateProfile: null, searchTargetDraft: null, searchTargets: null });
      setMessage("Profile Draft extracted. Review every field before confirming.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
      setUploadPhase("idle");
    }
  }

  async function saveDraft() {
    if (!state.draft) return;
    await perform("save-draft", async () => {
      const result = await api<{ draft: ProfileDraft }>(`/api/profile-draft/${state.draft?.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: state.draft?.profile }),
      });
      setState((current) => ({ ...current, draft: result.draft }));
      setMessage("Profile Draft saved.");
    });
  }

  async function confirmProfile() {
    if (!state.draft) return;
    await perform("confirm-profile", async () => {
      const result = await api<{ candidateProfile: CandidateProfile }>(
        `/api/profile-draft/${state.draft?.id}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile: state.draft?.profile }),
        },
      );
      setState((current) => activateCandidateProfile(current, result.candidateProfile));
      setMessage(`Candidate Profile v${result.candidateProfile.version} is active and immutable.`);
    });
  }

  async function suggestTargets() {
    await perform("suggest-targets", async () => {
      const result = await api<{ searchTargetDraft: SearchTargetDraftSet }>("/api/search-targets/suggest", { method: "POST" });
      setState((current) => ({ ...current, searchTargetDraft: result.searchTargetDraft, searchTargets: null }));
      setMessage("Search Target suggestions are ready to edit.");
    });
  }

  async function saveTargets() {
    if (!state.searchTargetDraft) return;
    await perform("save-targets", async () => {
      const result = await api<{ searchTargetDraft: SearchTargetDraftSet }>("/api/search-targets", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drafts: state.searchTargetDraft?.drafts }),
      });
      setState((current) => ({ ...current, searchTargetDraft: result.searchTargetDraft }));
      setMessage("Search Target draft saved.");
    });
  }

  async function confirmTargets() {
    if (!state.searchTargetDraft) return;
    await perform("confirm-targets", async () => {
      const result = await api<{ searchTargets: SearchTargetSet }>("/api/search-targets/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drafts: state.searchTargetDraft?.drafts }),
      });
      setState((current) => ({ ...current, searchTargetDraft: null, searchTargets: result.searchTargets }));
      setMessage("Onboarding complete. Your Search Targets are confirmed.");
    });
  }

  async function perform(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <CenteredStatus icon={<LoaderCircle className="size-6 animate-spin" />} label="Loading your onboarding workspace…" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Radar className="size-5" /></span>
            Career Radar
          </div>
          <Badge variant={state.searchTargets ? "success" : "outline"}>
            {state.searchTargets ? "Onboarding complete" : "Candidate Profile onboarding"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-10 max-w-3xl">
          <Badge className="mb-4" variant="outline"><Sparkles className="mr-1.5 size-3.5 text-accent" />Evidence first</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Build the Candidate Profile that will rank your Job Pool.</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">Gemini structures your resume. You own every ranking input and nothing becomes active until you confirm it.</p>
        </div>

        <ol className="mb-8 grid gap-3 sm:grid-cols-3">
          <Step number="1" label="Upload & extract" done={Boolean(state.draft)} active={!state.draft} />
          <Step number="2" label="Confirm Candidate Profile" done={Boolean(state.candidateProfile)} active={Boolean(state.draft && !state.candidateProfile)} />
          <Step number="3" label="Confirm targets" done={Boolean(state.searchTargets)} active={Boolean(state.candidateProfile && !state.searchTargets)} />
        </ol>

        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        {!state.draft && (
          <Card className="border-border/70">
            <CardHeader><CardTitle>Upload your resume</CardTitle><CardDescription>Use a text-extractable PDF up to 15 MB. DOCX, image, and text files are not supported.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/35 p-8 text-center transition hover:border-primary/50 hover:bg-muted/60">
                <FileText className="mb-3 size-8 text-primary" />
                <span className="font-medium">{selectedResume?.name ?? "Choose a PDF resume"}</span>
                <span className="mt-1 text-sm text-muted-foreground">Your source PDF is stored separately from structured profile data.</span>
                <input className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => { setSelectedResume(event.target.files?.[0] ?? null); setError(null); }} />
              </label>
              {busy === "upload" && (
                <div className="rounded-xl bg-primary/7 p-4 text-sm" role="status">
                  <div className="flex items-center gap-3"><LoaderCircle className="size-4 animate-spin text-primary" /><span className="font-medium">{uploadPhase === "uploading" ? `Uploading resume… ${Math.round(uploadProgress * 100)}%` : "Gemini is extracting career facts and evidence…"}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className={`h-full rounded-full bg-primary transition-all ${uploadPhase === "extracting" ? "animate-pulse" : ""}`} style={{ width: `${Math.max(uploadProgress * 100, uploadPhase === "extracting" ? 100 : 4)}%` }} /></div>
                </div>
              )}
              <Button disabled={!selectedResume || busy !== null} onClick={uploadResume} size="lg">Extract Profile Draft</Button>
            </CardContent>
          </Card>
        )}

        {state.draft && (
          <ProfileEditor
            draft={state.draft}
            weightTotal={weightTotal}
            busy={busy}
            updateProfile={updateProfile}
            saveDraft={saveDraft}
            confirmProfile={confirmProfile}
          />
        )}

        {state.candidateProfile && !state.draft && (
          <div className="space-y-6">
            <SearchTargetsEditor
              activeProfile={state.candidateProfile}
              targetDraft={state.searchTargetDraft}
              confirmedSet={state.searchTargets}
              busy={busy}
              onSuggest={suggestTargets}
              onChange={(searchTargetDraft) => setState((current) => ({ ...current, searchTargetDraft }))}
              onSave={saveTargets}
              onConfirm={confirmTargets}
            />
            {state.searchTargets && <CollectionOverview state={collectionState} />}
            {state.searchTargets && <RecommendationExplorer />}
          </div>
        )}
      </main>
    </div>
  );
}

function CollectionOverview({ state }: { state: CollectionState }) {
  const { latestRun, jobPoolSummary } = state;
  const counters = latestRun ? [
    ["Discovered", latestRun.counts.discovered],
    ["New", latestRun.counts.new],
    ["Revised", latestRun.counts.revised],
    ["Duplicate", latestRun.counts.duplicate],
    ["Normalized", latestRun.counts.normalized],
    ["Review Required", latestRun.counts.reviewRequired],
    ["Failed", latestRun.counts.failed],
  ] as const : [];
  return (
    <Section
      title="Job Pool"
      description="The local and scheduled worker publish the same Collection Run progress and normalized Job Posting inventory."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Active Job Postings" value={jobPoolSummary.activePostings} />
        <Metric label="Review Required" value={jobPoolSummary.reviewRequired} />
        <Metric label="Stored revisions" value={jobPoolSummary.totalRevisions} />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><Database className="size-4 text-primary" />Latest Collection Run</div>
          <Badge variant={latestRun?.status === "completed" ? "success" : "outline"}>
            {latestRun?.status ?? "Not run yet"}
          </Badge>
        </div>
        {latestRun ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {counters.map(([label, value]) => <Metric compact key={label} label={label} value={value} />)}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Started {new Date(latestRun.startedAt).toLocaleString()}
              {latestRun.completedAt ? ` · Finished ${new Date(latestRun.completedAt).toLocaleString()}` : " · In progress"}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Add TXT or PDF files under the configured corpus directory, then run <code>pnpm collect</code>.</p>
        )}
      </div>
    </Section>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return <div className={`rounded-xl bg-muted/45 ${compact ? "p-3" : "p-4"}`}><div className="text-xs text-muted-foreground">{label}</div><div className={compact ? "mt-1 text-xl font-semibold" : "mt-1 text-3xl font-semibold"}>{value}</div></div>;
}

type RecommendationView = "eligible" | "review-required" | "excluded" | "failed";
type RecommendationListResponse = {
  view: RecommendationView;
  counts: { eligible: number; reviewRequired: number; excluded: number; failed: number };
  recommendations: JobRecommendation[];
  failedPostings: Array<{ sourceKey: string; message: string }>;
};

function RecommendationExplorer() {
  const [view, setView] = useState<RecommendationView>("eligible");
  const [result, setResult] = useState<RecommendationListResponse | null>(null);
  const [selected, setSelected] = useState<JobRecommendation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<RecommendationListResponse>(`/api/recommendations?view=${view}`)
      .then((next) => { if (active) setResult(next); })
      .catch((caught: unknown) => { if (active) setLoadError(errorMessage(caught)); });
    return () => { active = false; };
  }, [view]);

  const tabs: Array<{ value: RecommendationView; label: string; count: number }> = [
    { value: "eligible", label: "Eligible", count: result?.counts.eligible ?? 0 },
    { value: "review-required", label: "Review Required", count: result?.counts.reviewRequired ?? 0 },
    { value: "excluded", label: "Excluded", count: result?.counts.excluded ?? 0 },
    { value: "failed", label: "Failed", count: result?.counts.failed ?? 0 },
  ];

  return (
    <Section title="Job Recommendations" description="Deterministic Fit Scores and evidence-backed explanations from the active Candidate Profile and Job Pool.">
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Recommendation views">
        {tabs.map((tab) => (
          <Button key={tab.value} size="sm" variant={view === tab.value ? "default" : "outline"} onClick={() => { setView(tab.value); setSelected(null); setResult(null); setLoadError(null); }}>
            {tab.label}<span className="rounded-full bg-black/8 px-1.5 py-0.5 text-[11px]">{tab.count}</span>
          </Button>
        ))}
      </div>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {!result && !loadError && <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Ranking the Job Pool…</div>}
      {result && view === "failed" && (
        <div className="space-y-3">
          {result.failedPostings.map((failure) => <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4" key={failure.sourceKey}><div className="font-semibold text-rose-900">{failure.sourceKey}</div><p className="mt-1 text-sm text-rose-800">{failure.message}</p></div>)}
          {result.failedPostings.length === 0 && <EmptyView>There are no failed Job Postings in the latest Collection Run.</EmptyView>}
        </div>
      )}
      {result && view !== "failed" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {result.recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} onOpen={() => setSelected(recommendation)} />)}
          {result.recommendations.length === 0 && <EmptyView>No Job Postings are in this view.</EmptyView>}
        </div>
      )}
      {selected && <RecommendationDetail recommendation={selected} onClose={() => setSelected(null)} />}
    </Section>
  );
}

function RecommendationCard({ recommendation, onOpen }: { recommendation: JobRecommendation; onOpen: () => void }) {
  return (
    <button className="rounded-2xl border border-border bg-background p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" onClick={onOpen} type="button">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">{recommendation.employer}</p><h3 className="mt-1 text-lg font-semibold">{recommendation.role}</h3></div>
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><div className="text-center"><div className="text-2xl font-semibold leading-none">{recommendation.fitScore}</div><div className="mt-1 text-[10px] uppercase tracking-wide">Fit</div></div></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{recommendation.locations.join(", ") || "Location unknown"}</span>
        <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" />{recommendation.workModes.join(", ") || "Work mode unknown"}</span>
        {recommendation.closingAt && <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Date(recommendation.closingAt).toLocaleDateString()}</span>}
      </div>
      <div className="mt-5 flex items-center justify-between"><RecommendationBadge recommendation={recommendation} /><span className="text-sm font-medium text-primary">View evidence</span></div>
    </button>
  );
}

function RecommendationDetail({ recommendation, onClose }: { recommendation: JobRecommendation; onClose: () => void }) {
  const scores = [
    ["Technical fit", recommendation.componentScores.technical],
    ["Experience fit", recommendation.componentScores.experience],
    ["Career direction", recommendation.componentScores.careerDirection],
    ["Work conditions", recommendation.componentScores.workConditions],
  ] as const;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/35 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`${recommendation.role} recommendation details`}>
      <div className="mx-auto max-w-3xl rounded-3xl bg-card p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{recommendation.employer}</p><h2 className="mt-1 text-2xl font-semibold">{recommendation.role}</h2><div className="mt-3"><RecommendationBadge recommendation={recommendation} /></div></div><Button aria-label="Close details" size="icon" variant="ghost" onClick={onClose}><X className="size-5" /></Button></div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{scores.map(([label, score]) => <Metric compact key={label} label={label} value={score} />)}</div>
        <div className="mt-7 grid gap-6 sm:grid-cols-2"><InsightList title="Strengths" values={recommendation.strengths} /><InsightList title="Gaps & uncertainties" values={recommendation.gaps} /></div>
        {recommendation.disqualifyingConditions.length > 0 && <div className="mt-7"><h3 className="font-semibold">Disqualifying Conditions</h3><div className="mt-3 space-y-2">{recommendation.disqualifyingConditions.map((condition) => <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900" key={condition.conditionId}><div className="font-medium">{condition.description}</div><div className="mt-1 text-rose-700">Evidence: {condition.evidence ?? "no evidence"}</div></div>)}</div></div>}
        <div className="mt-7"><h3 className="font-semibold">Job Posting evidence</h3><div className="mt-3 space-y-2">{recommendation.evidence.map((item, index) => <blockquote className="rounded-xl border-l-4 border-primary/30 bg-muted/35 p-3 text-sm" key={`${item.field}-${index}`}><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.field}</div><p className="mt-1">“{item.quote}”</p></blockquote>)}{recommendation.evidence.length === 0 && <p className="rounded-xl bg-muted/35 p-3 text-sm text-muted-foreground">no evidence</p>}</div></div>
        {recommendation.originalUrl && <a className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href={recommendation.originalUrl} rel="noreferrer" target="_blank">Open original Job Posting <ArrowUpRight className="size-4" /></a>}
      </div>
    </div>
  );
}

function InsightList({ title, values }: { title: string; values: JobRecommendation["strengths"] }) {
  return <div><h3 className="font-semibold">{title}</h3><ul className="mt-3 space-y-3">{values.map((value, index) => <li className="rounded-xl bg-muted/35 p-3 text-sm" key={index}><p>{value.text}</p><p className="mt-1.5 text-xs text-muted-foreground">Evidence: {value.evidence ?? "no evidence"}</p></li>)}</ul></div>;
}

function RecommendationBadge({ recommendation }: { recommendation: JobRecommendation }) {
  const label = recommendation.status === "eligible" ? recommendation.verdict : recommendation.status === "excluded" ? "Excluded" : "Review Required";
  return <Badge variant={recommendation.status === "eligible" && recommendation.fitScore >= 60 ? "success" : "outline"}>{label}</Badge>;
}

function EmptyView({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">{children}</div>;
}

function ProfileEditor({ draft, weightTotal, busy, updateProfile, saveDraft, confirmProfile }: {
  draft: ProfileDraft;
  weightTotal: number;
  busy: string | null;
  updateProfile: (update: (profile: ProfileData) => ProfileData) => void;
  saveDraft: () => void;
  confirmProfile: () => void;
}) {
  const profile = draft.profile;
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => updateProfile((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-6">
      <Section title="Profile Draft" description={`Extracted with ${draft.extraction.model}. Every field below remains editable until confirmation.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className={fieldClass} value={profile.fullName} onChange={(event) => set("fullName", event.target.value)} /></Field>
          <Field label="Email"><input className={fieldClass} type="email" value={profile.email} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Phone"><input className={fieldClass} value={profile.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="Headline"><input className={fieldClass} value={profile.headline} onChange={(event) => set("headline", event.target.value)} /></Field>
          <Field label="Summary" wide><textarea className={`${fieldClass} min-h-28`} value={profile.summary} onChange={(event) => set("summary", event.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Experience" description="Correct roles, dates, summaries, and the resume evidence behind them.">
        <EntryList
          values={profile.experience}
          onChange={(experience) => set("experience", experience)}
          empty={() => ({ id: crypto.randomUUID(), employer: "", role: "", startDate: "", endDate: "", summary: "", evidence: [] })}
          render={(entry, change) => <>
            <TwoColumns>
              <Field label="Employer"><input className={fieldClass} value={entry.employer} onChange={(e) => change({ ...entry, employer: e.target.value })} /></Field>
              <Field label="Role"><input className={fieldClass} value={entry.role} onChange={(e) => change({ ...entry, role: e.target.value })} /></Field>
              <Field label="Start"><input className={fieldClass} value={entry.startDate} onChange={(e) => change({ ...entry, startDate: e.target.value })} /></Field>
              <Field label="End"><input className={fieldClass} value={entry.endDate} onChange={(e) => change({ ...entry, endDate: e.target.value })} /></Field>
              <Field label="Summary" wide><textarea className={`${fieldClass} min-h-24`} value={entry.summary} onChange={(e) => change({ ...entry, summary: e.target.value })} /></Field>
            </TwoColumns>
            <EvidenceEditor values={entry.evidence} onChange={(evidence) => change({ ...entry, evidence })} />
          </>}
        />
      </Section>

      <Section title="Education" description="Review qualifications and their source evidence.">
        <EntryList
          values={profile.education}
          onChange={(education) => set("education", education)}
          empty={() => ({ id: crypto.randomUUID(), institution: "", qualification: "", field: "", startDate: "", endDate: "", evidence: [] })}
          render={(entry, change) => <>
            <TwoColumns>
              <Field label="Institution"><input className={fieldClass} value={entry.institution} onChange={(e) => change({ ...entry, institution: e.target.value })} /></Field>
              <Field label="Qualification"><input className={fieldClass} value={entry.qualification} onChange={(e) => change({ ...entry, qualification: e.target.value })} /></Field>
              <Field label="Field"><input className={fieldClass} value={entry.field} onChange={(e) => change({ ...entry, field: e.target.value })} /></Field>
              <Field label="Dates"><div className="grid grid-cols-2 gap-2"><input className={fieldClass} placeholder="Start" value={entry.startDate} onChange={(e) => change({ ...entry, startDate: e.target.value })} /><input className={fieldClass} placeholder="End" value={entry.endDate} onChange={(e) => change({ ...entry, endDate: e.target.value })} /></div></Field>
            </TwoColumns>
            <EvidenceEditor values={entry.evidence} onChange={(evidence) => change({ ...entry, evidence })} />
          </>}
        />
      </Section>

      <Section title="Skills & projects" description="Keep only facts that should influence ranking.">
        <h3 className="mb-3 text-sm font-semibold">Skills</h3>
        <EntryList
          values={profile.skills}
          onChange={(skills) => set("skills", skills)}
          empty={() => ({ name: "", evidence: [] })}
          render={(skill, change) => <><input className={fieldClass} placeholder="Skill" value={skill.name} onChange={(e) => change({ ...skill, name: e.target.value })} /><EvidenceEditor values={skill.evidence} onChange={(evidence) => change({ ...skill, evidence })} /></>}
        />
        <h3 className="mb-3 mt-7 text-sm font-semibold">Projects</h3>
        <EntryList
          values={profile.projects}
          onChange={(projects) => set("projects", projects)}
          empty={() => ({ id: crypto.randomUUID(), name: "", summary: "", technologies: [], evidence: [] })}
          render={(project, change) => <>
            <TwoColumns>
              <Field label="Project"><input className={fieldClass} value={project.name} onChange={(e) => change({ ...project, name: e.target.value })} /></Field>
              <Field label="Technologies"><input className={fieldClass} value={project.technologies.join(", ")} onChange={(e) => change({ ...project, technologies: splitList(e.target.value) })} /></Field>
              <Field label="Summary" wide><textarea className={`${fieldClass} min-h-24`} value={project.summary} onChange={(e) => change({ ...project, summary: e.target.value })} /></Field>
            </TwoColumns>
            <EvidenceEditor values={project.evidence} onChange={(evidence) => change({ ...project, evidence })} />
          </>}
        />
      </Section>

      <Section title="Uncertainties" description="Ambiguous or unsupported extraction stays visible instead of becoming a hidden assumption.">
        <EntryList
          values={profile.uncertainties}
          onChange={(uncertainties) => set("uncertainties", uncertainties)}
          empty={() => ({ field: "", description: "", evidence: [] })}
          render={(uncertainty, change) => <><TwoColumns><Field label="Field"><input className={fieldClass} value={uncertainty.field} onChange={(e) => change({ ...uncertainty, field: e.target.value })} /></Field><Field label="Why uncertain"><input className={fieldClass} value={uncertainty.description} onChange={(e) => change({ ...uncertainty, description: e.target.value })} /></Field></TwoColumns><EvidenceEditor values={uncertainty.evidence} onChange={(evidence) => change({ ...uncertainty, evidence })} /></>}
        />
      </Section>

      <Section title="Goals & preferences" description="Add the ranking inputs a resume cannot tell us.">
        <div className="grid gap-6 sm:grid-cols-2">
          <StringList label="Career goals" values={profile.careerGoals} onChange={(values) => set("careerGoals", values)} placeholder="Lead an internal developer platform" />
          <StringList label="Preferred locations" values={profile.preferredLocations} onChange={(values) => set("preferredLocations", values)} placeholder="Seoul" />
        </div>
        <div className="mt-6"><WorkModePicker values={profile.workModes} onChange={(values) => set("workModes", values)} /></div>
      </Section>

      <Section title="Disqualifying Conditions" description="Clear violations remove a Job Posting from the ranked feed; ambiguity becomes Review Required.">
        <EntryList
          values={profile.disqualifyingConditions}
          onChange={(conditions) => set("disqualifyingConditions", conditions)}
          empty={() => ({ id: crypto.randomUUID(), type: "other" as const, description: "" })}
          render={(condition, change) => <TwoColumns><Field label="Condition type"><select className={fieldClass} value={condition.type} onChange={(e) => change({ ...condition, type: e.target.value as typeof condition.type })}>{["minimum-experience", "employment-type", "outsourced-onsite", "closed", "location", "work-mode", "other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Rule"><input className={fieldClass} value={condition.description} onChange={(e) => change({ ...condition, description: e.target.value })} placeholder="Exclude contract roles" /></Field></TwoColumns>}
        />
      </Section>

      <Section title="Fit Weights" description="Weights are explicit and must total exactly 100% before confirmation.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(profile.fitWeights) as Array<keyof ProfileData["fitWeights"]>).map((key) => (
            <Field key={key} label={weightLabel(key)}><div className="relative"><input className={`${fieldClass} pr-8`} type="number" min="0" max="100" value={profile.fitWeights[key]} onChange={(e) => set("fitWeights", { ...profile.fitWeights, [key]: Number(e.target.value) })} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div></Field>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
          <div><span className="text-sm text-muted-foreground">Current total</span><div className={`text-2xl font-semibold ${weightTotal === 100 ? "text-emerald-700" : "text-rose-700"}`}>{weightTotal}%</div></div>
          <Button variant="outline" onClick={() => set("fitWeights", { ...DEFAULT_FIT_WEIGHTS })}><RotateCcw className="size-4" />Restore 40/25/25/10</Button>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Confirmation creates a new immutable Candidate Profile version.</p>
        <div className="flex gap-2"><Button variant="outline" disabled={busy !== null} onClick={saveDraft}><Save className="size-4" />Save Profile Draft</Button><Button disabled={busy !== null || weightTotal !== 100} onClick={confirmProfile}><Check className="size-4" />Confirm Candidate Profile</Button></div>
      </div>
    </div>
  );
}

function SearchTargetsEditor({ activeProfile, targetDraft, confirmedSet, busy, onSuggest, onChange, onSave, onConfirm }: {
  activeProfile: CandidateProfile;
  targetDraft: SearchTargetDraftSet | null;
  confirmedSet: SearchTargetSet | null;
  busy: string | null;
  onSuggest: () => void;
  onChange: (targetDraft: SearchTargetDraftSet) => void;
  onSave: () => void;
  onConfirm: () => void;
}) {
  if (!targetDraft && !confirmedSet) return <Card><CardHeader><Badge className="mb-2 w-fit" variant="success">Candidate Profile v{activeProfile.version} active</Badge><CardTitle>Choose your Search Targets</CardTitle><CardDescription>Gemini will suggest three to five focused role titles from the active Candidate Profile. You can change every suggestion before confirmation.</CardDescription></CardHeader><CardContent><Button disabled={busy !== null} onClick={onSuggest}>{busy === "suggest-targets" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Suggest Search Targets</Button></CardContent></Card>;

  const drafts: SearchTargetDraft[] = targetDraft?.drafts ?? confirmedSet?.searchTargets ?? [];
  const editable = targetDraft !== null;
  const changeDrafts = (nextDrafts: SearchTargetDraft[]) => {
    if (targetDraft) onChange({ ...targetDraft, drafts: nextDrafts });
  };
  const valid = drafts.length >= 3 && drafts.length <= 5 && drafts.every((draft) => draft.title.trim() && draft.locations.length > 0 && draft.workModes.length > 0);
  return (
    <Section title={confirmedSet ? "Search Targets" : "Review Search Target suggestions"} description="Confirmed Search Targets retrieve candidate Job Postings. They never determine fit; the active Candidate Profile does.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Badge variant={confirmedSet ? "success" : "outline"}>{confirmedSet ? `${drafts.length} confirmed Search Targets` : `${drafts.length} of 3–5 suggestions`}</Badge>{editable && drafts.length < 5 && <Button variant="outline" onClick={() => changeDrafts([...drafts, { id: crypto.randomUUID(), title: "", locations: [], workModes: [] }])}><Plus className="size-4" />Add suggestion</Button>}</div>
      <div className="space-y-4">
        {drafts.map((draft, index) => (
          <div className="rounded-2xl border border-border bg-muted/20 p-4" key={draft.id}>
            <div className="mb-4 flex items-center justify-between"><span className="text-sm font-semibold">{editable ? "Suggestion" : "Search Target"} {index + 1}</span>{editable && <Button aria-label="Remove suggestion" size="icon" variant="ghost" onClick={() => changeDrafts(drafts.filter((item) => item.id !== draft.id))}><Trash2 className="size-4" /></Button>}</div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Role title"><input className={fieldClass} disabled={!editable} value={draft.title} onChange={(e) => changeDrafts(replaceAt(drafts, index, { ...draft, title: e.target.value }))} /></Field><Field label="Location scope"><input className={fieldClass} disabled={!editable} value={draft.locations.join(", ")} onChange={(e) => changeDrafts(replaceAt(drafts, index, { ...draft, locations: splitList(e.target.value) }))} placeholder="Seoul, Korea" /></Field></div>
            <div className="mt-4"><WorkModePicker disabled={!editable} values={draft.workModes} onChange={(modes) => changeDrafts(replaceAt(drafts, index, { ...draft, workModes: modes }))} /></div>
          </div>
        ))}
      </div>
      {confirmedSet ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-900"><div className="flex items-center gap-2 font-semibold"><Check className="size-5" />Onboarding complete</div><p className="mt-1 text-sm">Your active Candidate Profile and confirmed Search Targets are ready for a Collection Run.</p></div> : <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button variant="outline" disabled={busy !== null || !valid} onClick={onSave}><Save className="size-4" />Save draft</Button><Button disabled={busy !== null || !valid} onClick={onConfirm}><Check className="size-4" />Confirm Search Targets</Button></div>}
    </Section>
  );
}

function EntryList<T>({ values, onChange, empty, render }: { values: T[]; onChange: (values: T[]) => void; empty: () => T; render: (value: T, change: (value: T) => void) => ReactNode }) {
  return <div className="space-y-3">{values.map((value, index) => <div className="rounded-2xl border border-border bg-muted/15 p-4" key={index}><div className="mb-3 flex justify-end"><Button aria-label="Remove item" size="icon" variant="ghost" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>{render(value, (updated) => onChange(replaceAt(values, index, updated)))}</div>)}<Button variant="outline" onClick={() => onChange([...values, empty()])}><Plus className="size-4" />Add item</Button></div>;
}

function EvidenceEditor({ values, onChange }: { values: Evidence[]; onChange: (values: Evidence[]) => void }) {
  return <div className="mt-4 rounded-xl bg-muted/45 p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</div><div className="space-y-2">{values.map((evidence, index) => <div className="grid grid-cols-[1fr_5rem_auto] gap-2" key={index}><input aria-label="Evidence quote" className={fieldClass} value={evidence.quote} onChange={(e) => onChange(replaceAt(values, index, { ...evidence, quote: e.target.value }))} /><input aria-label="Evidence page" className={fieldClass} type="number" min="1" placeholder="Page" value={evidence.page ?? ""} onChange={(e) => onChange(replaceAt(values, index, { ...evidence, page: e.target.value ? Number(e.target.value) : undefined }))} /><Button aria-label="Remove evidence" size="icon" variant="ghost" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</div><Button className="mt-2" size="sm" variant="ghost" onClick={() => onChange([...values, { quote: "" }])}><Plus className="size-3.5" />Add evidence</Button></div>;
}

function StringList({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  return <Field label={label}><div className="space-y-2">{values.map((value, index) => <div className="flex gap-2" key={index}><input className={fieldClass} value={value} onChange={(e) => onChange(replaceAt(values, index, e.target.value))} /><Button aria-label={`Remove ${label}`} size="icon" variant="ghost" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>)}<Button size="sm" variant="outline" onClick={() => onChange([...values, placeholder])}><Plus className="size-3.5" />Add</Button></div></Field>;
}

function WorkModePicker({ values, onChange, disabled = false }: { values: WorkMode[]; onChange: (values: WorkMode[]) => void; disabled?: boolean }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">Work modes</legend><div className="flex flex-wrap gap-2">{WORK_MODES.map((mode) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm capitalize ${values.includes(mode) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`} key={mode}><input className="sr-only" disabled={disabled} type="checkbox" checked={values.includes(mode)} onChange={() => onChange(values.includes(mode) ? values.filter((value) => value !== mode) : [...values, mode])} />{mode}</label>)}</div></fieldset>;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>; }
function TwoColumns({ children }: { children: ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Step({ number, label, done, active }: { number: string; label: string; done: boolean; active: boolean }) { return <li className={`flex items-center gap-3 rounded-2xl border p-4 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}><span className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : number}</span><span className="text-sm font-medium">{label}</span></li>; }
function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) { return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role={tone === "error" ? "alert" : "status"}>{children}</div>; }
function CenteredStatus({ icon, label }: { icon: ReactNode; label: string }) { return <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 text-muted-foreground">{icon}{label}</div></div>; }

function replaceAt<T>(values: T[], index: number, value: T): T[] { return values.map((current, currentIndex) => currentIndex === index ? value : current); }
function splitList(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function weightLabel(key: keyof ProfileData["fitWeights"]): string { return ({ technical: "Technical fit", experience: "Experience fit", careerDirection: "Career direction", workConditions: "Work conditions" })[key]; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Something went wrong."; }

function uploadResumeRequest(form: FormData, onProgress: (progress: number) => void): Promise<{ draft: ProfileDraft }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/onboarding/resume");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.upload.addEventListener("load", () => onProgress(1));
    request.addEventListener("error", () => reject(new Error("Resume upload failed. Check your connection and try again.")));
    request.addEventListener("load", () => {
      let body: { draft?: ProfileDraft; error?: { message?: string } } = {};
      try {
        body = JSON.parse(request.responseText || "{}") as typeof body;
      } catch {
        reject(new Error(`Resume onboarding returned an invalid response (${request.status}).`));
        return;
      }
      if (request.status < 200 || request.status >= 300 || !body.draft) {
        reject(new Error(body.error?.message ?? `Request failed (${request.status}).`));
        return;
      }
      resolve({ draft: body.draft });
    });
    request.send(form);
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status}).`);
  return body as T;
}
