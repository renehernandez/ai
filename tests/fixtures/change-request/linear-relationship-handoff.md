# Linear Relationship Handoff Fixtures

## Closing

Expectation: PAD-1909 is closing.

```markdown
## Tracking

Closes PAD-1909
```

Expected adapter result: accept before mutation and confirm after hosted-body
readback.

## Contributing

Expectation: PAD-1909 is contributing.

```markdown
## Tracking

Related to PAD-1909
```

Expected adapter result: accept before mutation and confirm after hosted-body
readback.

## Mismatch

Expectation: PAD-1909 is closing.

```markdown
## Tracking

Related to PAD-1909
```

Expected adapter result: reject before provider mutation. Reject the same
mismatch if it appears during hosted-body readback.

## Markdown Link Instead Of Plain Statement

Expectation: PAD-1909 is closing.

```markdown
## Tracking

Closes [PAD-1909](https://linear.app/fullscript/issue/PAD-1909/example)
```

Expected adapter result: reject before provider mutation because the approved
contract requires an exact plain relationship statement.

## No Relevant Issue

Expectation: explicit no-issue result.

Expected adapter result: accept a body without a Tracking section and do not
invent a relationship.

An existing template-owned or manual Tracking section is also valid:

```markdown
## Tracking

Release coordination: owned by the MR author.
```

Expected adapter result: preserve the section unchanged and add no Linear
relationship statement.
