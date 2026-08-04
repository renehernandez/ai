# Review-thread Retrieval

Use `gh api graphql` with an explicit owner, repository, PR number, and cursor.
Query `repository.pullRequest.reviewThreads(first: 100, after: $cursor)` and
retain `pageInfo { hasNextPage endCursor }`.

For each thread retain `id`, `isResolved`, `isOutdated`, `path`, `line`, and
`originalLine`. Paginate comments within every thread and retain comment `id`,
`url`, `body`, `createdAt`, `updatedAt`, `author { login }`, and reply linkage.
Continue both cursor levels to completion. Bind the result to the PR head OID;
when GraphQL or any page is unavailable, report thread state as unknown rather
than inferring resolution or freshness from REST comments alone.
