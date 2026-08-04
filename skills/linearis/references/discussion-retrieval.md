# Discussion Retrieval

Top-level `comments` commands are deprecated and can omit replies. Discover and
use the current domain-owned discussion commands reported by `linearis usage`
and the relevant domain `usage` output.

Retrieve every root discussion page, then retrieve every reply page for each
relevant root. Continue each cursor independently until `hasNextPage` is false.
Preserve `nodes`, `pageInfo`, immutable discussion IDs, parent IDs, authors, and
timestamps so the caller can prove the read was reply-complete.
