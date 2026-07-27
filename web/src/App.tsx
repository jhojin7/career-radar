import {
  ArrowRight,
  Check,
  FileSearch,
  Radar,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const workflow = [
  {
    icon: FileSearch,
    number: "01",
    title: "Confirm your Candidate Profile",
    description: "Turn your career history and preferences into a Candidate Profile you control.",
  },
  {
    icon: Target,
    number: "02",
    title: "Set search targets",
    description: "Confirm the roles, locations, and work modes worth exploring.",
  },
  {
    icon: Radar,
    number: "03",
    title: "Scan the Job Pool",
    description: "Normalize Job Postings before evaluating them on shared evidence.",
  },
  {
    icon: SlidersHorizontal,
    number: "04",
    title: "Tune the ranking",
    description: "Adjust what fit means and see the ordering respond deterministically.",
  },
];

type ApiState = "checking" | "online" | "offline";

const apiPresentation = {
  checking: {
    indicatorClassName: "animate-pulse bg-amber-500",
    label: "Checking API",
    variant: "outline" as const,
  },
  online: {
    indicatorClassName: "bg-emerald-500",
    label: "API online",
    variant: "success" as const,
  },
  offline: {
    indicatorClassName: "bg-rose-500",
    label: "API offline",
    variant: "outline" as const,
  },
} satisfies Record<ApiState, { indicatorClassName: string; label: string; variant: "outline" | "success" }>;

export function App() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const api = apiPresentation[apiState];

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/healthz", { signal: controller.signal })
      .then((response) => {
        setApiState(response.ok ? "online" : "offline");
      })
      .catch(() => setApiState("offline"));

    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_15%_10%,rgba(244,114,84,0.18),transparent_38%),radial-gradient(circle_at_88%_18%,rgba(36,113,91,0.16),transparent_36%)]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="#top">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Radar className="size-5" />
          </span>
          <span>Career Radar</span>
        </a>

        <div className="flex items-center gap-2">
          <Badge className="hidden sm:inline-flex" variant="outline">
            Local workspace
          </Badge>
          <Badge variant={api.variant}>
            <span className={`mr-1.5 size-1.5 rounded-full ${api.indicatorClassName}`} />
            {api.label}
          </Badge>
        </div>
      </header>

      <main className="relative z-10" id="top">
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-12 lg:pb-28 lg:pt-24">
          <div className="max-w-3xl">
            <Badge className="mb-6" variant="outline">
              <Sparkles className="mr-1.5 size-3.5 text-accent" />
              Evidence-backed career discovery
            </Badge>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Find the signal in your next job search.
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
              Career Radar connects what you have done with what you want next, then ranks opportunities with
              transparent evidence and rules you can tune.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#workflow">
                  Explore the workflow
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/api/healthz">View health response</a>
              </Button>
            </div>
          </div>

          <Card className="relative overflow-hidden border-white/70 bg-card/90 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-primary to-accent" />
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardDescription>Job Recommendation preview</CardDescription>
                  <CardTitle className="mt-1 text-2xl">Python AI Platform Engineer</CardTitle>
                </div>
                <div className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-emerald-100 bg-emerald-50 text-xl font-bold text-emerald-700">
                  87
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6 flex flex-wrap gap-2">
                <Badge variant="success">Strong fit</Badge>
                <Badge variant="outline">Seoul · Hybrid</Badge>
              </div>
              <div className="space-y-4">
                {[
                  ["Technical fit", "92%"],
                  ["Experience fit", "84%"],
                  ["Career direction", "88%"],
                  ["Work conditions", "76%"],
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0" key={label}>
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="font-mono text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-muted/70 p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    The role aligns with your Python platform experience and preference for AI workflow tooling.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="border-y border-border/60 bg-muted/35" id="workflow">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
            <div className="max-w-2xl">
              <Badge className="mb-4" variant="outline">
                Core workflow
              </Badge>
              <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">A clear path from profile to proof.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Each stage stays reviewable, so AI structures the evidence while deterministic rules own the ranking.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map(({ icon: Icon, number, title, description }) => (
                <Card className="group border-border/60 bg-background/80 transition-transform hover:-translate-y-1" key={number}>
                  <CardHeader>
                    <div className="mb-7 flex items-center justify-between">
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary/8 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{number}</span>
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>Career Radar · Locally runnable Job Recommendations</span>
        <span>AI for evidence. Rules for ranking.</span>
      </footer>
    </div>
  );
}
