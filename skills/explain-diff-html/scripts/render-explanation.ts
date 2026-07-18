#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ExplanationOption = {
  text: string;
  correct: boolean;
  feedback: string;
};

export type ExplanationQuestion = {
  question: string;
  options: ExplanationOption[];
};

export type ExplanationSection = {
  id: "background" | "intuition" | "code";
  heading: string;
  html: string;
};

export type ExplanationSpec = {
  title: string;
  subtitle?: string;
  summary: string;
  slug?: string;
  seed?: string;
  sections: ExplanationSection[];
  quiz: ExplanationQuestion[];
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

const REQUIRED_SECTION_IDS = ["background", "intuition", "code"] as const;
const ALLOWED_TAGS = new Set([
  "p",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "div",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "blockquote",
  "details",
  "summary",
  "kbd",
  "samp",
  "br",
]);
const ALLOWED_CLASSES = new Set([
  "callout",
  "diagram",
  "flow",
  "node",
  "arrow",
  "comparison",
  "before",
  "after",
  "label",
  "muted",
]);
const VOID_TAGS = new Set(["br"]);

const CSS = `
:root {
  color-scheme: light;
  --paper: #f4f7fb;
  --surface: #ffffff;
  --ink: #18212f;
  --muted: #5b6878;
  --accent: #2457d6;
  --accent-soft: #e8efff;
  --line: #ccd6e4;
  --code-bg: #172033;
  --code-ink: #f4f7fb;
  --good: #17653f;
  --good-bg: #e9f6ef;
  --bad: #a12e3d;
  --bad-bg: #fbecef;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.page { width: min(100% - 1.25rem, 860px); margin: 0 auto; padding: 1.5rem 0 4rem; }
.eyebrow, .label {
  color: var(--accent);
  font-size: .76rem;
  font-weight: 750;
  letter-spacing: .1em;
  text-transform: uppercase;
}
h1, h2 { font-family: Georgia, "Times New Roman", serif; }
h1 { max-width: 18ch; margin: .25rem 0 .8rem; font-size: clamp(2.25rem, 12vw, 4.5rem); line-height: 1.02; letter-spacing: -.035em; overflow-wrap: anywhere; }
h2 { margin: 3.5rem 0 1rem; font-size: clamp(1.75rem, 8vw, 2.45rem); line-height: 1.15; }
h3 { margin-top: 2rem; font-size: 1.2rem; }
h4 { margin-top: 1.6rem; font-size: 1.05rem; }
.subtitle { margin: 0 0 1.25rem; color: var(--muted); }
.summary { max-width: 68ch; font-size: 1.05rem; }
.toc { margin: 2rem 0; padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.toc ul { display: flex; flex-wrap: wrap; gap: .5rem 1.1rem; margin: .55rem 0 0; padding: 0; list-style: none; }
a { color: var(--accent); text-underline-offset: .18em; }
code, pre, kbd, samp { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
code { padding: .12rem .28rem; background: #e6ebf2; border-radius: 4px; font-size: .88em; }
pre { max-width: 100%; overflow-x: auto; margin: 1.25rem 0; padding: 1rem; background: var(--code-bg); color: var(--code-ink); border-radius: 10px; white-space: pre; font-size: .78rem; line-height: 1.55; overflow-wrap: normal; -webkit-overflow-scrolling: touch; }
pre code { padding: 0; background: transparent; color: inherit; }
.callout { margin: 1.25rem 0; padding: .9rem 1rem; background: var(--accent-soft); border-left: 4px solid var(--accent); border-radius: 0 10px 10px 0; }
.diagram { max-width: 100%; margin: 1.25rem 0; padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.flow { display: flex; align-items: stretch; justify-content: flex-start; gap: .6rem; flex-wrap: nowrap; overflow-x: auto; padding: .15rem .1rem .65rem; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
.node { display: grid; flex: 0 0 min(12rem, 75vw); place-items: center; min-height: 64px; padding: .65rem .85rem; background: #f7f9fd; border: 2px solid var(--accent); border-radius: 9px; text-align: center; font-size: .86rem; }
.arrow { display: grid; flex: 0 0 auto; place-items: center; color: var(--muted); }
.comparison { display: grid; grid-template-columns: 1fr; gap: .85rem; margin: 1.25rem 0; }
.before, .after { min-width: 0; padding: .9rem 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.before { border-top: 4px solid var(--bad); }
.after { border-top: 4px solid var(--good); }
.muted, figcaption { color: var(--muted); }
figcaption { margin-top: .8rem; font-size: .88rem; }
.table-scroll { max-width: 100%; margin: 1.25rem 0; overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; -webkit-overflow-scrolling: touch; }
.table-scroll:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
table { width: 100%; min-width: 34rem; border-collapse: collapse; font-size: .88rem; }
th, td { padding: .65rem .75rem; border: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: #edf2f8; }
.quiz-card { margin: 1rem 0; padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.quiz-question { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: .7rem; margin-bottom: .9rem; }
.quiz-question h3 { margin: .12rem 0 0; font-size: 1rem; line-height: 1.4; }
.question-number { display: grid; width: 2rem; height: 2rem; place-items: center; background: var(--ink); color: #fff; border-radius: 7px; font-size: .72rem; font-weight: 800; letter-spacing: .03em; }
.quiz-options { display: grid; gap: .55rem; }
.quiz-choice { min-width: 0; }
.quiz-option { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .7rem; width: 100%; min-height: 48px; padding: .6rem .7rem; background: #fff; color: var(--ink); border: 1px solid var(--line); border-radius: 9px; text-align: left; font: 500 .94rem/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; }
.option-marker { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border: 1px solid #aebbd0; border-radius: 6px; color: var(--muted); font-size: .74rem; font-weight: 800; }
.quiz-option:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.quiz-option[aria-pressed="true"] { border-width: 2px; padding: calc(.6rem - 1px) calc(.7rem - 1px); }
.quiz-option.is-correct { border-color: var(--good); background: var(--good-bg); }
.quiz-option.is-incorrect { border-color: var(--bad); background: var(--bad-bg); }
.quiz-option.is-correct .option-marker { border-color: var(--good); color: var(--good); }
.quiz-option.is-incorrect .option-marker { border-color: var(--bad); color: var(--bad); }
.feedback { display: none; margin-top: .45rem; padding: .7rem .8rem; border-radius: 8px; font-size: .86rem; }
.feedback.visible { display: block; }
.feedback.correct { color: var(--good); background: var(--good-bg); border-left: 4px solid var(--good); }
.feedback.incorrect { color: var(--bad); background: var(--bad-bg); border-left: 4px solid var(--bad); }
@media (hover: hover) {
  .quiz-option:hover { border-color: var(--accent); background: var(--accent-soft); }
}
@media (min-width: 48rem) {
  body { font-size: 18px; }
  .page { padding: 4rem 0 7rem; }
  h2 { margin-top: 4.5rem; }
  .toc { padding: 1.2rem 1.4rem; }
  .comparison { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .diagram { padding: 1.25rem; }
  .quiz-card { margin: 1.25rem 0; padding: 1.25rem; }
  .quiz-question h3 { font-size: 1.08rem; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
`;

export const QUIZ_JS = `
(() => {
  for (const card of document.querySelectorAll('.quiz-card')) {
    const feedback = card.querySelector('.feedback');
    const correctReason = card.querySelector('.correct-reason');
    for (const option of card.querySelectorAll('.quiz-option')) {
      option.addEventListener('click', () => {
        const choice = option.closest('.quiz-choice');
        const correct = option.dataset.correct === 'true';
        for (const peer of card.querySelectorAll('.quiz-option')) {
          peer.setAttribute('aria-pressed', String(peer === option));
          peer.classList.remove('is-correct', 'is-incorrect');
        }
        option.classList.add(correct ? 'is-correct' : 'is-incorrect');
        const chosen = choice?.querySelector('.choice-reason')?.textContent ?? '';
        const reasoning = correct ? chosen : chosen + ' Correct reasoning: ' + (correctReason?.textContent ?? '');
        feedback.textContent = '';
        choice?.after(feedback);
        feedback.className = 'feedback visible ' + (correct ? 'correct' : 'incorrect');
        feedback.textContent = (correct ? 'Correct. ' : 'Not quite. ') + reasoning;
      });
    }
  }
})();
`;

export function validateSpec(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(input)) {
    return { errors: ["spec must be a JSON object"], warnings };
  }

  requireText(input, "title", errors);
  requireText(input, "summary", errors);
  optionalText(input, "subtitle", errors);
  optionalText(input, "slug", errors);
  optionalText(input, "seed", errors);

  if (!Array.isArray(input.sections)) {
    errors.push("sections must be an array");
  } else {
    if (input.sections.length !== REQUIRED_SECTION_IDS.length) {
      errors.push(
        "sections must contain background, intuition, and code exactly once",
      );
    }
    input.sections.forEach((section, index) => {
      if (!isRecord(section)) {
        errors.push(`sections[${index}] must be an object`);
        return;
      }
      requireText(section, "id", errors, `sections[${index}]`);
      requireText(section, "heading", errors, `sections[${index}]`);
      requireText(section, "html", errors, `sections[${index}]`);
      if (section.id !== REQUIRED_SECTION_IDS[index]) {
        errors.push(
          `sections[${index}].id must be ${REQUIRED_SECTION_IDS[index]}`,
        );
      }
      if (typeof section.html === "string") {
        errors.push(
          ...validatePassiveHtml(section.html).map(
            (message) => `sections[${index}].html ${message}`,
          ),
        );
      }
    });
  }

  if (!Array.isArray(input.quiz)) {
    errors.push("quiz must be an array");
  } else {
    if (input.quiz.length !== 5) {
      errors.push("quiz must contain exactly five questions");
    }
    input.quiz.forEach((question, questionIndex) => {
      if (!isRecord(question)) {
        errors.push(`quiz[${questionIndex}] must be an object`);
        return;
      }
      requireText(question, "question", errors, `quiz[${questionIndex}]`);
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        errors.push(
          `quiz[${questionIndex}].options must contain exactly four options`,
        );
        return;
      }
      let correctCount = 0;
      const lengths: number[] = [];
      let correctLength = 0;
      question.options.forEach((option, optionIndex) => {
        if (!isRecord(option)) {
          errors.push(
            `quiz[${questionIndex}].options[${optionIndex}] must be an object`,
          );
          return;
        }
        requireText(
          option,
          "text",
          errors,
          `quiz[${questionIndex}].options[${optionIndex}]`,
        );
        requireText(
          option,
          "feedback",
          errors,
          `quiz[${questionIndex}].options[${optionIndex}]`,
        );
        if (typeof option.correct !== "boolean") {
          errors.push(
            `quiz[${questionIndex}].options[${optionIndex}].correct must be boolean`,
          );
        } else if (option.correct) {
          correctCount += 1;
          correctLength =
            typeof option.text === "string" ? option.text.length : 0;
        }
        if (typeof option.text === "string") lengths.push(option.text.length);
      });
      if (correctCount !== 1) {
        errors.push(
          `quiz[${questionIndex}] must have exactly one correct option`,
        );
      }
      if (lengths.length === 4) {
        const distractorAverage =
          (lengths.reduce((sum, length) => sum + length, 0) - correctLength) /
          3;
        if (
          correctLength > distractorAverage * 1.45 &&
          correctLength - distractorAverage > 18
        ) {
          warnings.push(
            `quiz[${questionIndex}] correct option is conspicuously longer than its distractors`,
          );
        }
      }
    });
  }

  return { errors, warnings };
}

export function validatePassiveHtml(markup: string): string[] {
  const errors: string[] = [];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  const stack: string[] = [];

  for (const match of markup.matchAll(tagPattern)) {
    const [tagSource, rawName, rawAttributes] = match;
    const name = rawName.toLowerCase();
    const closing = tagSource.startsWith("</");

    if (!ALLOWED_TAGS.has(name)) {
      errors.push(`contains unsupported <${name}> element`);
      continue;
    }

    if (closing) {
      if (VOID_TAGS.has(name)) {
        errors.push(`must not close void <${name}> element`);
      } else if (stack.pop() !== name) {
        errors.push(`contains mismatched closing </${name}> element`);
      }
      continue;
    }

    const attributeErrors = validateAttributes(rawAttributes, name);
    errors.push(...attributeErrors);
    if (name === "table" && stack.includes("table")) {
      errors.push("contains nested <table> elements");
    }
    if (!VOID_TAGS.has(name) && !tagSource.endsWith("/>")) stack.push(name);
  }

  if (stack.length > 0) {
    errors.push(`contains unclosed <${stack.at(-1)}> element`);
  }

  if (/[<>]/.test(markup.replace(tagPattern, ""))) {
    errors.push("contains comments, declarations, or malformed markup");
  }

  return [...new Set(errors)];
}

export function arrangeQuiz(
  quiz: ExplanationQuestion[],
  seed: string,
): ExplanationQuestion[] {
  const random = seededRandom(seed);
  const targetPositions = shuffle([0, 1, 2, 3], random);
  targetPositions.push(Math.floor(random() * 4));
  shuffle(targetPositions, random);

  return quiz.map((question, index) => {
    const correct = question.options.find((option) => option.correct);
    if (!correct) throw new Error(`quiz[${index}] has no correct option`);
    const distractors = shuffle(
      question.options.filter((option) => !option.correct),
      random,
    );
    const options = [...distractors];
    options.splice(targetPositions[index], 0, correct);
    return { question: question.question, options };
  });
}

export function localDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function renderExplanation(spec: ExplanationSpec): string {
  const validation = validateSpec(spec);
  if (validation.errors.length > 0) {
    throw new Error(
      `Invalid explanation spec:\n${validation.errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  const seed = spec.seed ?? stableSeed(spec);
  const quiz = arrangeQuiz(spec.quiz, seed);
  const toc = [
    ...spec.sections.map((section) => [section.id, section.heading] as const),
    ["quiz", "Quiz"] as const,
  ]
    .map(
      ([id, heading]) => `<li><a href="#${id}">${escapeHtml(heading)}</a></li>`,
    )
    .join("\n");
  const sections = spec.sections
    .map(
      (section) =>
        `<section aria-labelledby="${section.id}">\n<h2 id="${section.id}">${escapeHtml(section.heading)}</h2>\n${wrapTables(section.html)}\n</section>`,
    )
    .join("\n");
  const quizHtml = quiz.map(renderQuestion).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'self' file:; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(spec.title)}</title>
<style>${CSS}</style>
</head>
<body>
<main class="page">
<header>
<p class="eyebrow">Code change explained</p>
<h1>${escapeHtml(spec.title)}</h1>
${spec.subtitle ? `<p class="subtitle">${escapeHtml(spec.subtitle)}</p>` : ""}
<p class="summary">${escapeHtml(spec.summary)}</p>
</header>
<nav class="toc" aria-label="Table of contents">
<span class="label">Contents</span>
<ul>${toc}</ul>
</nav>
${sections}
<section aria-labelledby="quiz">
<h2 id="quiz">Quiz</h2>
<p>Choose the best answer. Feedback appears immediately after each selection.</p>
${quizHtml}
</section>
</main>
<script src="./quiz.js"></script>
</body>
</html>
`;
}

function renderQuestion(question: ExplanationQuestion, index: number): string {
  const correct = question.options.find((option) => option.correct);
  const options = question.options
    .map(
      (option, optionIndex) =>
        `<div class="quiz-choice"><button type="button" class="quiz-option" aria-pressed="false" data-correct="${String(option.correct)}"><span class="option-marker" aria-hidden="true">${String.fromCharCode(65 + optionIndex)}</span><span class="option-text">${escapeHtml(option.text)}</span></button><span class="choice-reason" hidden>${escapeHtml(option.feedback)}</span></div>`,
    )
    .join("\n");
  return `<article class="quiz-card" aria-labelledby="quiz-question-${index + 1}">
<div class="quiz-question"><span class="question-number" aria-hidden="true">Q${index + 1}</span><h3 id="quiz-question-${index + 1}">${escapeHtml(question.question)}</h3></div>
<div class="quiz-options" role="group" aria-labelledby="quiz-question-${index + 1}">${options}</div>
<span class="correct-reason" hidden>${escapeHtml(correct?.feedback ?? "")}</span>
<div class="feedback" aria-live="polite"></div>
</article>`;
}

function wrapTables(html: string): string {
  return html
    .replaceAll(
      /<table(?=[\s>])/gi,
      '<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0">$&',
    )
    .replaceAll(/<\/table\s*>/gi, "$&</div>");
}

function validateAttributes(rawAttributes: string, tagName: string): string[] {
  const errors: string[] = [];
  let remaining = rawAttributes.trim().replace(/\/$/, "").trim();
  const attributePattern =
    /^\s*([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*("[^"]*"|'[^']*')/;

  while (remaining) {
    const match = remaining.match(attributePattern);
    if (!match) {
      errors.push(`contains malformed or valueless attributes on <${tagName}>`);
      break;
    }
    const name = match[1].toLowerCase();
    const value = match[2].slice(1, -1);
    if (name === "class") {
      for (const className of value.split(/\s+/).filter(Boolean)) {
        if (!ALLOWED_CLASSES.has(className))
          errors.push(`uses unsupported class "${className}"`);
      }
    } else if (name === "aria-label" || name === "role") {
      if (!value.trim()) errors.push(`uses empty ${name} on <${tagName}>`);
    } else {
      errors.push(`uses unsupported ${name} attribute on <${tagName}>`);
    }
    remaining = remaining.slice(match[0].length);
  }

  return errors;
}

function stableSeed(spec: ExplanationSpec): string {
  return createHash("sha256")
    .update(JSON.stringify(spec))
    .digest("hex")
    .slice(0, 16);
}

function seededRandom(seed: string): () => number {
  const digest = createHash("sha256").update(seed).digest();
  let state = digest.readUInt32LE(0);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(input: T[], random: () => number): T[] {
  for (let index = input.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [input[index], input[other]] = [input[other], input[index]];
  }
  return input;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "code-change"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireText(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  prefix = "spec",
): void {
  if (typeof record[key] !== "string" || !record[key].trim())
    errors.push(`${prefix}.${key} must be a non-empty string`);
}

function optionalText(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
): void {
  if (
    record[key] !== undefined &&
    (typeof record[key] !== "string" || !record[key].trim())
  )
    errors.push(`spec.${key} must be a non-empty string when provided`);
}

function exampleSpec(): ExplanationSpec {
  const options = (
    correct: string,
    ...distractors: string[]
  ): ExplanationOption[] => [
    {
      text: correct,
      correct: true,
      feedback: "This follows the changed execution path.",
    },
    ...distractors.map((text) => ({
      text,
      correct: false,
      feedback:
        "This reflects a plausible reading of the old path, not the changed behavior.",
    })),
  ];
  return {
    title: "Exponential backoff replaces a fixed retry delay",
    subtitle: "Prepared from PR #482",
    summary:
      "Retries now spread out as failures continue, reducing synchronized load on the dependency.",
    slug: "retry-backoff",
    sections: [
      {
        id: "background",
        heading: "Background",
        html: '<p>Describe the prior contract.</p><div class="callout"><strong>Invariant:</strong> one request owns one retry schedule.</div>',
      },
      {
        id: "intuition",
        heading: "Intuition",
        html: '<div class="comparison"><div class="before"><span class="label">Before</span><p>100 ms each time</p></div><div class="after"><span class="label">After</span><p>100, 200, 400 ms</p></div></div>',
      },
      {
        id: "code",
        heading: "Code",
        html: "<pre><code>delay = base * 2 ** attempt</code></pre>",
      },
    ],
    quiz: Array.from({ length: 5 }, (_, index) => ({
      question: `What does changed behavior ${index + 1} establish?`,
      options: options(
        "It follows the new retry schedule.",
        "It preserves a fixed delay.",
        "It removes retry limits.",
        "It retries successful requests.",
      ),
    })),
  };
}

export function main(args = process.argv.slice(2)): number {
  const [command, specPath, ...rest] = args;
  if (command === "example-spec") {
    process.stdout.write(`${JSON.stringify(exampleSpec(), null, 2)}\n`);
    return 0;
  }
  if ((command !== "validate" && command !== "render") || !specPath) {
    process.stderr.write(
      "Usage: render-explanation.ts <validate|render> <spec.json> [--output-dir path]\n       render-explanation.ts example-spec\n",
    );
    return 1;
  }

  let input: unknown;
  try {
    input = JSON.parse(readFileSync(resolve(specPath), "utf8"));
  } catch (error) {
    process.stderr.write(
      `Unable to read spec: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
  const validation = validateSpec(input);
  for (const warning of validation.warnings)
    process.stderr.write(`Warning: ${warning}\n`);
  if (validation.errors.length > 0) {
    process.stderr.write(
      `Invalid explanation spec:\n${validation.errors.map((error) => `- ${error}`).join("\n")}\n`,
    );
    return 1;
  }
  if (command === "validate") {
    process.stdout.write("Explanation spec valid\n");
    return 0;
  }

  const spec = input as ExplanationSpec;
  if (rest.includes("--output")) {
    process.stderr.write(
      "--output no longer writes a standalone HTML file; use --output-dir <directory>\n",
    );
    return 1;
  }
  const outputDirectoryFlag = rest.indexOf("--output-dir");
  if (outputDirectoryFlag >= 0 && !rest[outputDirectoryFlag + 1]) {
    process.stderr.write("--output-dir requires a path\n");
    return 1;
  }
  const date = localDateStamp();
  const outputDirectory = resolve(
    outputDirectoryFlag >= 0
      ? rest[outputDirectoryFlag + 1]
      : `/tmp/${date}-explanation-${slugify(spec.slug ?? spec.title)}`,
  );
  const allowedBundleFiles = new Set(["index.html", "quiz.js"]);
  try {
    if (existsSync(outputDirectory)) {
      const unexpectedFiles = readdirSync(outputDirectory).filter(
        (entry) => !allowedBundleFiles.has(entry),
      );
      if (unexpectedFiles.length > 0) {
        process.stderr.write(
          `Output directory contains unrelated files: ${unexpectedFiles.join(", ")}\n`,
        );
        return 1;
      }
    }
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(
      join(outputDirectory, "index.html"),
      renderExplanation(spec),
      "utf8",
    );
    writeFileSync(join(outputDirectory, "quiz.js"), QUIZ_JS, "utf8");
  } catch (error) {
    process.stderr.write(
      `Unable to write explanation bundle: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
  process.stdout.write(`${join(outputDirectory, "index.html")}\n`);
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  process.exitCode = main();
}
