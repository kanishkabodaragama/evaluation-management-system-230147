"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";
import { FormActions, InlineAlert } from "@/components/ui/crud";
import type { Criterion, Score, Submission, SubmissionStatus } from "@/lib/api";
import {
  createScore,
  createSubmission,
  getAssignment,
  listScores,
  listSubmissions,
  updateScore,
  updateSubmission,
} from "@/lib/api";

/**
 * Reviewers cannot call /api/criteria (admin-only).
 * For now we show a small fixed rubric (0-10) that is stored as scores against criterion IDs.
 *
 * Instructions for future agent:
 * Add a reviewer-allowed endpoint (e.g. GET /api/public/criteria or GET /api/criteria with requireReviewer)
 * and then replace `CRITERIA_FALLBACK` with a real criteria fetch.
 */
const CRITERIA_FALLBACK: Array<
  Pick<Criterion, "id" | "name" | "description" | "sort_order" | "weight">
> = [];

type ScoreDraft = {
  criterion_id: string;
  score_value: string; // keep as string for input
  comment: string;
};

function validateDraft(draft: ScoreDraft) {
  const errors: { score?: string } = {};
  const raw = draft.score_value.trim();
  if (!raw) {
    errors.score = "Score is required.";
    return errors;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    errors.score = "Score must be a number between 0 and 10.";
  }
  return errors;
}

export default function AssignmentDetailPage() {
  return (
    <RequireAuth allowedRoles={["reviewer"]}>
      <Page title="Submit review" description="Score criteria and submit your evaluation.">
        <AssignmentDetailInner />
      </Page>
    </RequireAuth>
  );
}

function AssignmentDetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("id") ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<Awaited<ReturnType<typeof getAssignment>> | null>(
    null,
  );

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [existingScores, setExistingScores] = useState<Score[]>([]);

  const [overallComment, setOverallComment] = useState("");

  const [criteria, setCriteria] = useState<
    Array<Pick<Criterion, "id" | "name" | "description" | "sort_order" | "weight">>
  >([]);

  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "submitting">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isSubmitted = submission?.status === "submitted";

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!assignmentId) {
        setLoadError("Missing assignment id. Please return to Assignments and select an item.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const a = await getAssignment(assignmentId);

        // Find existing submission for this assignment scope (session+employee). Backend scopes to reviewer.
        const subs = await listSubmissions({
          limit: 10,
          offset: 0,
          sortBy: "created_at",
          sortDir: "desc",
          session_id: a.session_id,
          employee_id: a.employee_id,
        });

        const maybeSub = subs.items[0] ?? null;

        let scores: Score[] = [];
        if (maybeSub) {
          const scoreRes = await listScores({
            limit: 200,
            offset: 0,
            sortBy: "created_at",
            sortDir: "asc",
            submission_id: maybeSub.id,
          });
          scores = scoreRes.items;
        }

        if (cancelled) return;

        setAssignment(a);
        setSubmission(maybeSub);
        setExistingScores(scores);
        setOverallComment(maybeSub?.overall_comment ?? "");

        // Criteria: currently unavailable for reviewer. Use fallback (can be empty).
        const crit = [...CRITERIA_FALLBACK].sort((x, y) => x.sort_order - y.sort_order);
        setCriteria(crit);

        // Initialize drafts from criteria + existing scores
        const scoreByCriterion = new Map<string, Score>();
        scores.forEach((s) => scoreByCriterion.set(s.criterion_id, s));

        const nextDrafts: Record<string, ScoreDraft> = {};
        crit.forEach((c) => {
          const existing = scoreByCriterion.get(c.id) ?? null;
          nextDrafts[c.id] = {
            criterion_id: c.id,
            score_value: existing ? String(existing.score_value) : "",
            comment: existing?.comment ?? "",
          };
        });
        setDrafts(nextDrafts);
        setTouched({});
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load assignment");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const validation = useMemo(() => {
    const errors: Record<string, { score?: string }> = {};
    let isValid = true;

    if (criteria.length === 0) {
      // Without criteria, we cannot collect scores. Keep disabled until backend supports reviewer criteria access.
      isValid = false;
    }

    for (const c of criteria) {
      const d = drafts[c.id];
      if (!d) {
        isValid = false;
        errors[c.id] = { score: "Missing draft state." };
        continue;
      }
      const e = validateDraft(d);
      if (e.score) isValid = false;
      errors[c.id] = e;
    }

    return { isValid, errors };
  }, [criteria, drafts]);

  async function ensureSubmission(): Promise<Submission> {
    if (!assignment) throw new Error("Assignment not loaded");
    if (submission) return submission;

    const created = await createSubmission({
      session_id: assignment.session_id,
      employee_id: assignment.employee_id,
      assignment_id: assignment.id,
      status: "draft",
      overall_comment: overallComment.trim() || null,
    });
    setSubmission(created);
    return created;
  }

  async function saveDraft(statusAfterSave?: SubmissionStatus) {
    setSaveError(null);
    setSaveSuccess(null);

    if (!assignment) return;

    if (criteria.length === 0) {
      setSaveError(
        "Criteria are not available to reviewers yet. Ask an admin to enable a reviewer criteria endpoint.",
      );
      return;
    }

    const nextStatus = statusAfterSave ?? "draft";
    if (submission?.status === "submitted") {
      setSaveError("This submission is already submitted and cannot be edited.");
      return;
    }

    setSaveStatus(statusAfterSave === "submitted" ? "submitting" : "saving");

    try {
      const sub = await ensureSubmission();

      // Update overall comment and optional status
      const updatedSub = await updateSubmission(sub.id, {
        overall_comment: overallComment.trim() || null,
        status: nextStatus,
      });
      setSubmission(updatedSub);

      // Upsert scores per criterion
      const existingByCriterion = new Map<string, Score>();
      existingScores.forEach((s) => existingByCriterion.set(s.criterion_id, s));

      const nextExistingScores: Score[] = [...existingScores];

      for (const c of criteria) {
        const d = drafts[c.id];
        const raw = d?.score_value ?? "";
        const scoreValue = Number(raw);

        const existing = existingByCriterion.get(c.id) ?? null;
        if (!existing) {
          const created = await createScore({
            submission_id: updatedSub.id,
            criterion_id: c.id,
            score_value: scoreValue,
            comment: d.comment.trim() || null,
          });
          existingByCriterion.set(c.id, created);
          nextExistingScores.push(created);
        } else {
          const updated = await updateScore(existing.id, {
            score_value: scoreValue,
            comment: d.comment.trim() || null,
          });
          existingByCriterion.set(c.id, updated);
          const idx = nextExistingScores.findIndex((x) => x.id === existing.id);
          if (idx >= 0) nextExistingScores[idx] = updated;
        }
      }

      setExistingScores(nextExistingScores);

      setSaveSuccess(
        statusAfterSave === "submitted" ? "Submission submitted successfully." : "Draft saved.",
      );

      if (statusAfterSave === "submitted") {
        router.push("/assignments");
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaveStatus("idle");
    }
  }

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  if (loadError) {
    return <InlineAlert kind="error">{loadError}</InlineAlert>;
  }

  if (!assignment) {
    return <InlineAlert kind="error">Assignment not found.</InlineAlert>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="muted small">
        <Link href="/assignments" className="crud-link">
          ← Back to assignments
        </Link>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div className="muted small">Assignment</div>
          <div className="small">
            <b>Session:</b> <span className="muted">{assignment.session_id}</span>
          </div>
          <div className="small">
            <b>Employee:</b> <span className="muted">{assignment.employee_id}</span>
          </div>
          <div className="small">
            <b>Submission status:</b>{" "}
            <span className="muted">{submission?.status ?? "not created"}</span>
          </div>
        </div>

        {criteria.length === 0 ? (
          <InlineAlert kind="info">
            Criteria are not available to reviewers yet (backend currently restricts /api/criteria to admins).
            To enable scoring, expose a reviewer-readable criteria endpoint and update this page to fetch it.
          </InlineAlert>
        ) : null}
      </div>

      {saveError ? <InlineAlert kind="error">{saveError}</InlineAlert> : null}
      {saveSuccess ? <InlineAlert kind="success">{saveSuccess}</InlineAlert> : null}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="page-title" style={{ fontSize: "1.05rem" }}>
          Scores (0–10)
        </h2>

        {criteria.map((c) => {
          const d = drafts[c.id];
          const err = validation.errors[c.id];
          const showErr = touched[c.id] && !!err?.score;

          return (
            <div
              key={c.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  {c.description ? <div className="muted small">{c.description}</div> : null}
                </div>
                <div className="muted small">Weight: {c.weight}</div>
              </div>

              <div className="crud-form" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span className="field-label">Score *</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="0 - 10"
                    value={d?.score_value ?? ""}
                    disabled={isSubmitted}
                    onBlur={() => setTouched((t) => ({ ...t, [c.id]: true }))}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) => ({
                        ...prev,
                        [c.id]: {
                          criterion_id: c.id,
                          score_value: v,
                          comment: prev[c.id]?.comment ?? "",
                        },
                      }));
                    }}
                  />
                  {showErr ? (
                    <div className="muted small" style={{ color: "var(--error)" }}>
                      {err?.score}
                    </div>
                  ) : null}
                </label>

                <label className="field">
                  <span className="field-label">Comment (optional)</span>
                  <input
                    className="input"
                    placeholder="Optional notes…"
                    value={d?.comment ?? ""}
                    disabled={isSubmitted}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) => ({
                        ...prev,
                        [c.id]: {
                          criterion_id: c.id,
                          score_value: prev[c.id]?.score_value ?? "",
                          comment: v,
                        },
                      }));
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}

        <label className="field" style={{ marginTop: 6 }}>
          <span className="field-label">Overall comment (optional)</span>
          <textarea
            className="input"
            rows={3}
            placeholder="Optional overall feedback…"
            value={overallComment}
            disabled={isSubmitted}
            onChange={(e) => setOverallComment(e.target.value)}
          />
        </label>

        <FormActions>
          <button
            type="button"
            className="button"
            onClick={() => saveDraft("draft")}
            disabled={saveStatus !== "idle" || isSubmitted}
          >
            {saveStatus === "saving" ? "Saving…" : "Save draft"}
          </button>

          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              const nextTouched: Record<string, boolean> = {};
              criteria.forEach((c) => (nextTouched[c.id] = true));
              setTouched(nextTouched);

              if (!validation.isValid) return;
              void saveDraft("submitted");
            }}
            disabled={saveStatus !== "idle" || isSubmitted || !validation.isValid}
            title={
              criteria.length === 0
                ? "Criteria not available"
                : !validation.isValid
                  ? "Fix validation errors before submitting"
                  : undefined
            }
          >
            {saveStatus === "submitting" ? "Submitting…" : isSubmitted ? "Submitted" : "Submit"}
          </button>
        </FormActions>

        {isSubmitted ? (
          <InlineAlert kind="info">
            This submission has already been submitted. Duplicate submissions are prevented by the backend.
          </InlineAlert>
        ) : null}
      </div>
    </div>
  );
}
