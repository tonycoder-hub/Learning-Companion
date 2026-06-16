// Shared builder for case study workspaces.
// Maps structured course data into a Learning Companion workspace with
// sessions, captures, review cards, and notes. Reuses model.js primitives
// so the output always passes sanitizeWorkspace().

import {
  createSession,
  sanitizeWorkspace,
  buildMirrorBundle,
  buildMirrorZip,
  nowIso,
} from "../apps/companion-web/src/model.js";

// ---------- ID helpers ----------

function sessionId(weekNum) {
  return `session_ecom_w${weekNum}`;
}

function captureId(weekNum, dayNum, conceptKey) {
  return `cap_w${weekNum}d${dayNum}_${conceptKey}`;
}

function cardId(weekNum, dayNum, conceptKey) {
  return `card_w${weekNum}d${dayNum}_${conceptKey}`;
}

// ---------- Time helpers ----------

function addMinutes(baseIso, minutes) {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function dayStartIso(baseIso, dayNum) {
  // Each day starts at 09:00 + (dayNum-1) days
  const d = new Date(baseIso);
  d.setDate(d.getDate() + (dayNum - 1));
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// ---------- Content mappers ----------

function buildConceptCapture(weekNum, dayNum, concept, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, concept.key);
  return {
    id: capId,
    quote: concept.keyQuote || concept.explanation?.slice(0, 200) || concept.termEn || concept.key,
    thought: concept.thought || `${concept.termZh || ""}${concept.termZh ? " — " : ""}${concept.explanation || ""}`.slice(0, 500),
    timestamp: concept.timestamp || "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: Array.from(new Set([
      ...(concept.tags || []),
      `w${weekNum}-d${dayNum}`,
      concept.termEn?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || concept.key,
    ])).filter(Boolean),
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset),
    originClientId: clientId,
    promotedToReview: concept.promotedToReview !== false,
  };
}

function buildSelfTestCard(weekNum, dayNum, test, conceptKey, sourceCaptureId, baseTime, offset, clientId) {
  return {
    id: cardId(weekNum, dayNum, `${conceptKey}_${test.key || "selftest"}`),
    prompt: test.question,
    answer: test.answer,
    sourceCaptureId,
    dueAt: addMinutes(baseTime, offset + 60), // due ~1 hour after capture
    strength: 0,
    createdAt: addMinutes(baseTime, offset + 1),
    updatedAt: addMinutes(baseTime, offset + 1),
    lastReviewedAt: null,
    originClientId: clientId,
  };
}

function buildPracticeCapture(weekNum, dayNum, practice, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, "practice");
  return {
    id: capId,
    quote: practice.prompt || "",
    thought: practice.exampleOutput || practice.notes || "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: ["practice", `w${weekNum}-d${dayNum}`],
    questionResolvedAt: addMinutes(baseTime, offset + 5),
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset + 5),
    originClientId: clientId,
    promotedToReview: false,
  };
}

function buildTtsCapture(weekNum, dayNum, tts, segIndex, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, `tts${segIndex + 1}`);
  return {
    id: capId,
    quote: tts.enScript || "",
    thought: [
      tts.zhRecap ? `中文复述：${tts.zhRecap}` : "",
      tts.shadowingSentence ? `Shadowing: ${tts.shadowingSentence}` : "",
    ].filter(Boolean).join("\n").slice(0, 500),
    timestamp: `D${dayNum}-S${segIndex + 1}`,
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: ["tts", "shadowing", `w${weekNum}-d${dayNum}`],
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset),
    originClientId: clientId,
    promotedToReview: false,
  };
}

function buildOpenQuestionCapture(weekNum, dayNum, q, qIndex, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, `q_open${qIndex + 1}`);
  return {
    id: capId,
    quote: q.context || q.text || "",
    thought: q.text || "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: [...(q.tags || []), "question", "open", `w${weekNum}-d${dayNum}`],
    questionResolvedAt: null,
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset),
    originClientId: clientId,
    promotedToReview: false,
  };
}

function buildParkedQuestionCapture(weekNum, dayNum, q, qIndex, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, `q_parked${qIndex + 1}`);
  return {
    id: capId,
    quote: q.context || q.text || "",
    thought: q.text || "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: [...(q.tags || []), "question", "parked", `w${weekNum}-d${dayNum}`],
    questionResolvedAt: null,
    questionParkedAt: addMinutes(baseTime, offset + 2),
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset + 2),
    originClientId: clientId,
    promotedToReview: false,
  };
}

function buildResolvedQuestionCapture(weekNum, dayNum, q, qIndex, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, `q_ans${qIndex + 1}`);
  const questionCapId = captureId(weekNum, dayNum, `q_resolved${qIndex + 1}`);
  // The question capture
  const questionCap = {
    id: questionCapId,
    quote: q.question || q.text || "",
    thought: "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: [...(q.tags || []), "question", "answered", `w${weekNum}-d${dayNum}`],
    questionResolvedAt: addMinutes(baseTime, offset + 5),
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset + 5),
    originClientId: clientId,
    promotedToReview: false,
  };
  // The answer capture
  const answerCap = {
    id: capId,
    quote: q.answer || "",
    thought: q.answerThought || "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: [...(q.tags || []), "answer", `w${weekNum}-d${dayNum}`],
    answersQuestionCaptureId: questionCapId,
    createdAt: addMinutes(baseTime, offset + 3),
    capturedAt: addMinutes(baseTime, offset + 3),
    updatedAt: addMinutes(baseTime, offset + 5),
    originClientId: clientId,
    promotedToReview: false,
  };
  return { questionCap, answerCap };
}

function buildTermCapture(weekNum, dayNum, term, baseTime, offset, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, `term_${term.key || term.termEn?.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) || "term"}`);
  return {
    id: capId,
    quote: `${term.termEn} — ${term.termZh || ""}`,
    thought: term.example || term.definition || "",
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: ["key-term", ...(term.tags || []), `w${weekNum}-d${dayNum}`],
    createdAt: addMinutes(baseTime, offset),
    capturedAt: addMinutes(baseTime, offset),
    updatedAt: addMinutes(baseTime, offset),
    originClientId: clientId,
    promotedToReview: false,
  };
}

function buildPlaceholderCapture(weekNum, dayNum, label, baseTime, clientId, sourceMeta) {
  const capId = captureId(weekNum, dayNum, "placeholder");
  return {
    id: capId,
    quote: `[Placeholder] ${label} — content coming soon`,
    thought: `[占位] ${label} — 内容待补充。See the Feishu week document for full content.`,
    timestamp: "",
    sourceTitle: sourceMeta.sourceTitle,
    sourceUrl: sourceMeta.sourceUrl,
    materialType: "course",
    sourceProvenance: "snapshot",
    tags: ["placeholder", `w${weekNum}-d${dayNum}`],
    createdAt: baseTime,
    capturedAt: baseTime,
    updatedAt: baseTime,
    originClientId: clientId,
    promotedToReview: false,
  };
}

// ---------- Week → Session ----------

function buildWeekSession(week, courseMeta, clientId, fixedNow) {
  const sourceTitle = `${courseMeta.titleEn} — ${week.titleEn}`;
  const sourceUrl = week.feishuUrl || courseMeta.feishuNavUrl;
  const sourceMeta = { sourceTitle, sourceUrl };

  const captures = [];
  const reviewCards = [];
  const notesSections = [];
  let offset = 0;

  for (const day of week.days) {
    const dayBase = dayStartIso(courseMeta.baseIso, day.day);
    const isPlaceholder = day.placeholder === true;

    // Day header in notes
    notesSections.push(`## D${day.day}: ${day.objectiveEn || ""}${day.objectiveZh ? " / " + day.objectiveZh : ""}`);
    if (day.oneLiner) {
      notesSections.push(`> ${day.oneLiner}`);
    }
    notesSections.push("");

    if (isPlaceholder) {
      captures.push(buildPlaceholderCapture(week.week, day.day, day.label || `D${day.day}`, dayBase, clientId, sourceMeta));
      notesSections.push(`*Content pending — see [Feishu W${week.week} doc](${week.feishuUrl}) for D${day.day}.*`);
      notesSections.push("");
      continue;
    }

    let dayOffset = 0;

    // Key terms
    if (day.keyTerms && day.keyTerms.length) {
      notesSections.push("**Key Terms / 核心术语:**");
      for (const term of day.keyTerms) {
        notesSections.push(`- **${term.termEn}** / ${term.termZh || ""}: ${term.definition || term.example || ""}`);
        captures.push(buildTermCapture(week.week, day.day, term, dayBase, dayOffset, clientId, sourceMeta));
        dayOffset += 3;
      }
      notesSections.push("");
    }

    // Concepts → captures + review cards
    if (day.concepts && day.concepts.length) {
      for (const concept of day.concepts) {
        const cap = buildConceptCapture(week.week, day.day, concept, dayBase, dayOffset, clientId, sourceMeta);
        captures.push(cap);
        dayOffset += 4;
        // Build a review card for promoted concepts
        if (concept.promotedToReview !== false) {
          reviewCards.push({
            id: cardId(week.week, day.day, concept.key),
            prompt: concept.reviewPrompt || `What is ${concept.termEn || concept.key}?`,
            answer: concept.reviewAnswer || concept.explanation || concept.keyQuote || "",
            sourceCaptureId: cap.id,
            dueAt: addMinutes(dayBase, dayOffset + 120),
            strength: 0,
            createdAt: addMinutes(dayBase, dayOffset - 3),
            updatedAt: addMinutes(dayBase, dayOffset - 3),
            lastReviewedAt: null,
            originClientId: clientId,
          });
        }
      }
    }

    // Self-test questions → review cards
    if (day.selfTest && day.selfTest.length) {
      for (let i = 0; i < day.selfTest.length; i++) {
        const test = day.selfTest[i];
        const relatedCapId = (day.concepts && day.concepts[i])
          ? captureId(week.week, day.day, day.concepts[i].key)
          : (captures.length ? captures[captures.length - 1].id : "");
        reviewCards.push(buildSelfTestCard(week.week, day.day, test, test.key || `st${i + 1}`, relatedCapId, dayBase, dayOffset, clientId));
        dayOffset += 2;
      }
    }

    // Practice exercise
    if (day.practice) {
      captures.push(buildPracticeCapture(week.week, day.day, day.practice, dayBase, dayOffset, clientId, sourceMeta));
      notesSections.push(`**Practice / 练习:** ${day.practice.prompt || ""}`);
      if (day.practice.exampleOutput) {
        notesSections.push(`> Example: ${day.practice.exampleOutput}`);
      }
      notesSections.push("");
      dayOffset += 6;
    }

    // TTS segments
    if (day.ttsSegments && day.ttsSegments.length) {
      for (let i = 0; i < day.ttsSegments.length; i++) {
        captures.push(buildTtsCapture(week.week, day.day, day.ttsSegments[i], i, dayBase, dayOffset, clientId, sourceMeta));
        dayOffset += 2;
      }
    }

    // Open questions
    if (day.openQuestions && day.openQuestions.length) {
      for (let i = 0; i < day.openQuestions.length; i++) {
        captures.push(buildOpenQuestionCapture(week.week, day.day, day.openQuestions[i], i, dayBase, dayOffset, clientId, sourceMeta));
        dayOffset += 2;
      }
    }

    // Parked questions
    if (day.parkedQuestions && day.parkedQuestions.length) {
      for (let i = 0; i < day.parkedQuestions.length; i++) {
        captures.push(buildParkedQuestionCapture(week.week, day.day, day.parkedQuestions[i], i, dayBase, dayOffset, clientId, sourceMeta));
        dayOffset += 3;
      }
    }

    // Resolved questions (question + answer pair)
    if (day.resolvedQuestions && day.resolvedQuestions.length) {
      for (let i = 0; i < day.resolvedQuestions.length; i++) {
        const { questionCap, answerCap } = buildResolvedQuestionCapture(week.week, day.day, day.resolvedQuestions[i], i, dayBase, dayOffset, clientId, sourceMeta);
        captures.push(questionCap, answerCap);
        dayOffset += 6;
      }
    }

    // Experiment hint
    if (day.experimentHint) {
      const capId = captureId(week.week, day.day, "experiment");
      captures.push({
        id: capId,
        quote: `Experiment hint / 实验提示: ${day.experimentHint.hypothesis || ""}`,
        thought: day.experimentHint.notes || day.experimentHint.metrics || "",
        timestamp: "",
        sourceTitle,
        sourceUrl,
        materialType: "course",
        sourceProvenance: "snapshot",
        tags: ["experiment", `w${week.week}-d${day.day}`],
        createdAt: addMinutes(dayBase, dayOffset),
        capturedAt: addMinutes(dayBase, dayOffset),
        updatedAt: addMinutes(dayBase, dayOffset),
        originClientId: clientId,
        promotedToReview: false,
      });
      dayOffset += 2;
    }

    // Rubric note
    if (day.rubric) {
      notesSections.push(`**Rubric / 评分:** ${day.rubric}`);
      notesSections.push("");
    }

    offset = dayOffset;
  }

  // Week-level notes appendix
  if (week.weekNotes) {
    notesSections.push("---");
    notesSections.push(week.weekNotes);
  }

  const sessionTitle = `W${week.week}: ${week.titleEn} / ${week.titleZh}`;
  const notesMarkdown = [
    `# ${sessionTitle}`,
    "",
    `Source: [${sourceTitle}](${sourceUrl})`,
    "",
    ...notesSections,
  ].join("\n");

  return createSession({
    id: sessionId(week.week),
    title: sessionTitle,
    sourceTitle,
    sourceUrl,
    materialType: "course",
    tags: [`week-${week.week}`, "ecom-psych", "case-study"],
    focusMode: "capture",
    notesMarkdown,
    captures,
    reviewCards,
    createdAt: dayStartIso(courseMeta.baseIso, (week.week - 1) * 7 + 1),
    updatedAt: fixedNow,
  }, clientId);
}

// ---------- Main entry point ----------

export function buildCaseStudyWorkspace(courseData, options = {}) {
  const meta = courseData.meta;
  const clientId = meta.clientId;
  const baseIso = meta.baseIso;
  const fixedNow = options.fixedNow || baseIso;

  const sessions = courseData.weeks.map((week) =>
    buildWeekSession(week, { ...meta, baseIso }, clientId, fixedNow)
  );

  const rawWorkspace = {
    schema: "learning-companion.workspace.v1",
    schemaVersion: 1,
    version: 1,
    clientId,
    activeSessionId: sessionId(1),
    sessions,
    importedPatches: [],
    importedReviewPatches: [],
    createdAt: baseIso,
    updatedAt: fixedNow,
  };

  const workspace = sanitizeWorkspace(rawWorkspace);
  const exportedAt = fixedNow;
  const mirrorBundle = buildMirrorBundle(workspace, { exportedAt });
  const mirrorZip = buildMirrorZip(workspace, { exportedAt });

  // Stats
  const totalCaptures = sessions.reduce((sum, s) => sum + s.captures.length, 0);
  const totalCards = sessions.reduce((sum, s) => sum + s.reviewCards.length, 0);
  const placeholderCount = sessions.reduce((sum, s) =>
    sum + s.captures.filter((c) => c.tags?.includes("placeholder")).length, 0);

  return {
    workspace,
    mirrorBundle,
    mirrorZip,
    stats: {
      sessionCount: sessions.length,
      captureCount: totalCaptures,
      cardCount: totalCards,
      placeholderCount,
      clientId,
      courseTitle: meta.titleEn,
      courseTitleZh: meta.titleZh,
      version: meta.version,
    },
  };
}

// ---------- Assertions ----------

export function assertCaseStudyIntegrity(result) {
  const { workspace, stats } = result;
  const errors = [];

  // All capture IDs unique
  const allCapIds = workspace.sessions.flatMap((s) => s.captures.map((c) => c.id));
  const capIdSet = new Set(allCapIds);
  if (capIdSet.size !== allCapIds.length) {
    const dups = allCapIds.filter((id, i) => allCapIds.indexOf(id) !== i);
    errors.push(`Duplicate capture IDs: ${[...new Set(dups)].join(", ")}`);
  }

  // All card IDs unique
  const allCardIds = workspace.sessions.flatMap((s) => s.reviewCards.map((c) => c.id));
  const cardIdSet = new Set(allCardIds);
  if (cardIdSet.size !== allCardIds.length) {
    const dups = allCardIds.filter((id, i) => allCardIds.indexOf(id) !== i);
    errors.push(`Duplicate card IDs: ${[...new Set(dups)].join(", ")}`);
  }

  // All sourceCaptureId references valid
  for (const session of workspace.sessions) {
    const capIds = new Set(session.captures.map((c) => c.id));
    for (const card of session.reviewCards) {
      if (card.sourceCaptureId && !capIds.has(card.sourceCaptureId)) {
        errors.push(`Card ${card.id} references missing capture ${card.sourceCaptureId}`);
      }
    }
    for (const cap of session.captures) {
      if (cap.answersQuestionCaptureId && !capIds.has(cap.answersQuestionCaptureId)) {
        errors.push(`Capture ${cap.id} answers missing capture ${cap.answersQuestionCaptureId}`);
      }
    }
  }

  // Bilingual content check (at least some Chinese characters in notes)
  const hasChinese = workspace.sessions.some((s) => /[一-鿿]/.test(s.notesMarkdown));
  if (!hasChinese) {
    errors.push("No Chinese content found in session notes (bilingual check failed)");
  }

  // Minimum content
  if (stats.captureCount < 5) {
    errors.push(`Expected at least 5 captures, got ${stats.captureCount}`);
  }
  if (stats.cardCount < 2) {
    errors.push(`Expected at least 2 review cards, got ${stats.cardCount}`);
  }

  return { ok: errors.length === 0, errors, stats };
}
