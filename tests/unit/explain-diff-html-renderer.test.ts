import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  arrangeQuiz,
  type ExplanationOption,
  type ExplanationSpec,
  localDateStamp,
  main,
  renderExplanation,
  validatePassiveHtml,
  validateSpec,
} from "../../skills/explain-diff-html/scripts/render-explanation.ts";

function options(question: number): ExplanationOption[] {
  return [0, 1, 2, 3].map((option) => ({
    text: `Question ${question} option ${option}`,
    correct: option === 0,
    feedback: `Reasoning for question ${question} option ${option}.`,
  }));
}

function spec(): ExplanationSpec {
  return {
    title: "Cache invalidation on writes",
    summary: "Writes now evict the corresponding cached read.",
    slug: "cache-invalidation",
    seed: "stable-test-seed",
    sections: [
      {
        id: "background",
        heading: "Background",
        html: "<p>Reads may be cached.</p>",
      },
      {
        id: "intuition",
        heading: "Intuition",
        html: '<div class="callout"><strong>Rule:</strong> writes invalidate reads.</div>',
      },
      {
        id: "code",
        heading: "Code",
        html: "<pre><code>cache.delete(key)</code></pre>",
      },
    ],
    quiz: Array.from({ length: 5 }, (_, index) => ({
      question: `Question ${index}?`,
      options: options(index),
    })),
  };
}

test("renders a deterministic offline explanation", () => {
  const first = renderExplanation(spec());
  const second = renderExplanation(spec());

  assert.equal(first, second);
  assert.match(first, /^<!doctype html>/);
  assert.match(first, /Content-Security-Policy/);
  assert.match(first, /white-space: pre;/);
  assert.match(first, /href="#background"/);
  assert.match(first, /id="background"/);
  assert.doesNotMatch(first, /<link\b|<img\b|src=/);
});

test("renders quiz cards as compact labelled interactions", () => {
  const html = renderExplanation(spec());

  assert.doesNotMatch(html, /<fieldset|<legend/);
  assert.match(
    html,
    /<article class="quiz-card" aria-labelledby="quiz-question-1">/,
  );
  assert.match(
    html,
    /<span class="question-number" aria-hidden="true">Q1<\/span>/,
  );
  assert.match(html, /<h3 id="quiz-question-1">Question 0\?<\/h3>/);
  assert.match(
    html,
    /<span class="option-marker" aria-hidden="true">A<\/span>/,
  );
  assert.match(html, /<span class="option-text">Question 0 option \d<\/span>/);
  assert.match(html, /class="quiz-option" aria-pressed="false"/);
  assert.match(
    html,
    /class="quiz-options" role="group" aria-labelledby="quiz-question-1"/,
  );
  assert.match(html, /const choice = option\.closest\('\.quiz-choice'\)/);
  assert.match(html, /choice\?\.after\(feedback\)/);
  assert.ok(
    html.indexOf("choice?.after(feedback);") <
      html.indexOf(
        "feedback.textContent = (correct ? 'Correct. ' : 'Not quite. ')",
      ),
  );
});

test("uses mobile-first layout and contained wide content", () => {
  const input = spec();
  input.sections[0].html =
    "<TABLE><THEAD><TR><TH>Contract</TH><TH>Behavior</TH></TR></THEAD><TBODY><TR><TD>write</TD><TD>invalidate</TD></TR></TBODY></TABLE>";
  const html = renderExplanation(input);

  assert.match(html, /\.page \{ width: min\(100% - 1\.25rem, 860px\)/);
  assert.match(html, /h1 \{[^}]*overflow-wrap: anywhere;/s);
  assert.match(html, /\.comparison \{[^}]*grid-template-columns: 1fr;/s);
  assert.match(html, /\.flow \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/s);
  assert.match(html, /\.quiz-option \{[^}]*min-height: 48px;/s);
  assert.match(html, /\.table-scroll \{[^}]*overflow-x: auto;/s);
  assert.match(
    html,
    /<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0"><TABLE>/,
  );
  assert.match(html, /<\/TABLE><\/div>/);
  assert.match(html, /@media \(min-width: 48rem\)/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
});

test("balances correct-answer positions across five questions", () => {
  const arranged = arrangeQuiz(spec().quiz, "stable-test-seed");
  const positions = arranged.map((question) =>
    question.options.findIndex((option) => option.correct),
  );
  const counts = [0, 1, 2, 3].map(
    (position) => positions.filter((value) => value === position).length,
  );

  assert.equal(new Set(positions).size, 4);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.deepEqual(arranged, arrangeQuiz(spec().quiz, "stable-test-seed"));
});

test("uses the local calendar date for artifact prefixes", () => {
  assert.equal(localDateStamp(new Date(2026, 0, 2, 23, 30)), "2026-01-02");
});

test("rejects active and external markup", () => {
  assert.match(
    validatePassiveHtml("<script>alert(1)</script>").join("\n"),
    /unsupported <script>/,
  );
  assert.match(
    validatePassiveHtml('<p onclick="alert(1)">Click</p>').join("\n"),
    /unsupported onclick/,
  );
  assert.match(
    validatePassiveHtml(
      '<div class="diagram"><img src="https://example.test/pixel.png"></div>',
    ).join("\n"),
    /unsupported <img>/,
  );
});

test("accepts the supported visual vocabulary", () => {
  assert.deepEqual(
    validatePassiveHtml(
      '<figure class="diagram"><div class="flow"><div class="node">API</div><span class="arrow">→</span><div class="node">DB</div></div><figcaption>Example request flow.</figcaption></figure>',
    ),
    [],
  );
});

test("rejects nested tables before responsive wrappers are added", () => {
  assert.match(
    validatePassiveHtml(
      "<table><tbody><tr><td><table><tbody><tr><td>nested</td></tr></tbody></table></td></tr></tbody></table>",
    ).join("\n"),
    /nested <table>/,
  );
});

test("rejects invalid quiz contracts before rendering", () => {
  const invalid = spec();
  invalid.quiz[0].options[1].correct = true;

  assert.match(
    validateSpec(invalid).errors.join("\n"),
    /exactly one correct option/,
  );
  assert.throws(() => renderExplanation(invalid), /Invalid explanation spec/);
});

test("CLI renders a validated HTML file", () => {
  const directory = mkdtempSync(join(tmpdir(), "explain-diff-html-"));
  const specPath = join(directory, "spec.json");
  const outputPath = join(directory, "rendered.html");

  try {
    writeFileSync(specPath, JSON.stringify(spec()));
    assert.equal(main(["render", specPath, "--output", outputPath]), 0);
    assert.match(
      readFileSync(outputPath, "utf8"),
      /Cache invalidation on writes/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
