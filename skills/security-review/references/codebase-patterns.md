---
name: codebase-patterns
description: Common codebase search patterns for security reviews
---

# Codebase Patterns

Search patterns and directory conventions for security-relevant code. Customize these for your stack.

## Search Patterns by Category

### Authentication & Authorization

```bash
# Auth middleware / guards
Grep: "authenticate", "authorize", "current_user", "signed_in" in app/controllers, middleware/

# Policies / permissions
Glob: "**/*policy*", "**/*permission*", "**/*ability*"

# Session handling
Grep: "session", "cookie", "jwt", "token" in auth-related directories

# Role checks
Grep: "role", "admin", "can?", "authorize!" in controllers, policies
```

### Data Models & Schema

```bash
# Migrations (schema changes)
Glob: "**/migrate/**", "**/migrations/**", "**/db/migrate/**"

# Models / entities
Glob: "**/*model*", "**/models/**", "**/entities/**"

# Associations / relationships
Grep: "has_many", "belongs_to", "has_one", "references" in model directories
```

### API Endpoints

```bash
# Route definitions
Glob: "**/routes*", "**/config/routes*"

# Controllers / handlers
Glob: "**/controllers/**", "**/handlers/**"

# API serializers / responses
Glob: "**/*serializer*", "**/*resource*", "**/*presenter*"

# GraphQL
Glob: "**/*resolver*", "**/*mutation*", "**/*type*.rb", "**/*type*.ts"
```

### Input Handling

```bash
# Parameter filtering
Grep: "params", "strong_parameters", "permit" in controllers

# Validation
Grep: "validates", "validate", "schema", "zod" in models, validators

# Sanitization
Grep: "sanitize", "escape", "strip_tags" across codebase
```

### Secrets & Credentials

```bash
# Environment variables
Grep: "ENV", "process.env", "os.environ" across codebase

# Config files
Glob: "**/*.env*", "**/credentials*", "**/secrets*"

# Hardcoded secrets (anti-pattern)
Grep: "password", "secret", "api_key", "token" in non-test source files
```

### Audit & Logging

```bash
# Audit trails
Grep: "audit", "track", "log_event", "paper_trail" across codebase

# Logging
Grep: "logger", "Rails.logger", "console.log" in source files

# PII in logs (anti-pattern)
Grep: "email", "ssn", "password" near "log", "logger" calls
```

### Frontend Security

```bash
# XSS vectors
Grep: "dangerouslySetInnerHTML", "innerHTML", "html_safe", "raw" in views, components

# CSRF
Grep: "csrf", "authenticity_token", "X-CSRF" in forms, middleware

# Client-side auth
Grep: "localStorage", "sessionStorage" near "token", "auth" in frontend
```

## Well-Implemented Security Patterns

Reference these as positive examples when they exist in your codebase:

| Pattern | What to Look For |
|---------|-----------------|
| Authorization policy | Centralized policy objects (Pundit, CanCanCan, CASL) |
| Input validation | Schema-based validation at boundary (strong params, Zod, Joi) |
| Parameterized queries | ORM usage, no string interpolation in SQL |
| CSRF protection | Framework-level CSRF tokens on state-changing requests |
| Rate limiting | Middleware/decorator on auth and API endpoints |
| Audit logging | Callbacks/middleware capturing who did what when |
| Encryption at rest | Column-level encryption for PII/PHI (attr_encrypted, lockbox) |
| Secure defaults | Auth required by default, explicit opt-out |
