---
description: Break down design documents into INVEST-compliant tasks
argument-hint: <design-doc-path>
---

# Create Tasks from Design Document

**You are a task breakdown specialist.** Analyze a design document and generate INVEST-compliant task files with YAML frontmatter.

## Step 1: Validate Input

The user provided: $ARGUMENTS

1. If a path is provided, verify the file exists using Read
2. If no argument provided, scan for design documents:
   - `docs/ARCHITECTURE.md`
   - `docs/DESIGN.md`
   - `docs/*_DESIGN.md`
   - `docs/*.md`
3. If multiple candidates found, use AskUserQuestion to let user choose

## Step 2: Scan Existing Tasks

Check `docs/tasks/` directory for existing task files:
- Use Glob to find all `*.md` files in `docs/tasks/`
- Extract the highest `id` from YAML frontmatter
- Next task ID = highest + 1 (or 1 if directory is empty)
- Ensure `docs/tasks/` directory exists (create if needed)

## Step 3: Parse Design Document

Read the full design document and identify task sources:

**Primary sources (in order of preference):**
1. `## Implementation` or `## Implementation Phases` - explicit task breakdown
2. `## Scripts` or code block sections - each script/component is a task
3. `## Directory Structure` - each major file/directory is a deliverable
4. Major `###` headings that describe features or components

**Extract from each section:**
- Description text → task description
- Code blocks → implementation details
- File paths mentioned → deliverables
- Numbered lists or checklists → acceptance criteria

**Parsing patterns:**
```
Section heading → Task title
Section prose → Task description
Code blocks → Implementation details
File paths (backticks) → Deliverables
Bullet lists → Acceptance criteria candidates
```

## Step 4: Apply INVEST Principles

For each potential task, validate against INVEST:

| Principle | Validation Rule | Action if Violated |
|-----------|-----------------|-------------------|
| **I**ndependent | No circular dependencies | Reorder or merge tasks |
| **N**egotiable | Describes "what" not "how" | Rewrite description |
| **V**aluable | Produces testable output | Add concrete deliverable |
| **E**stimable | Clear, bounded scope | Split if too vague |
| **S**mall | ≤10 acceptance criteria | Split into subtasks |
| **T**estable | ≥3 acceptance criteria | Add more criteria |

**Splitting rules:**
- If >10 acceptance criteria → split into multiple tasks
- If >5 files affected → consider splitting by file group
- If task has distinct phases → split by phase

## Step 5: Build Dependency Graph

Determine task dependencies:

1. **Implicit order** - earlier sections typically come before later ones
2. **File dependencies** - if task B uses a file task A creates, B depends on A
3. **Functional dependencies** - UI depends on API, API depends on core

**Dependency notation:**
- `depends_on: []` - foundation task, no dependencies
- `depends_on: [1]` - depends on task 1
- `depends_on: [1, 2]` - depends on tasks 1 AND 2

**Validate no circular dependencies exist.**

## Step 6: Generate Task Content

For each task, create content using this exact format:

```markdown
---
id: {number}
title: {Title in Title Case}
depends_on: [{dependency_ids}]
status: pending
---

# Task {number}: {Title in Title Case}

## Description

{One paragraph explaining what this task accomplishes and why it's valuable.}

## Deliverables

- `{path/to/file.ext}` - {Brief purpose}
- `{path/to/another.ext}` - {Brief purpose}

## Acceptance Criteria

- [ ] {Specific, testable requirement}
- [ ] {Another testable requirement}
- [ ] {At least 3-5 criteria total}

## Implementation Details

### {Section Name}

```{language}
{Code snippet from design document}
```

{Additional implementation notes if needed.}

## Testing Checklist

- [ ] {Manual verification step}
- [ ] {Another verification step}
```

**Naming convention:** `{id}-{kebab-case-title}.md`
- ID is zero-padded to 2 digits (01, 02, ... 99)
- Title converted to lowercase with hyphens
- Max 50 characters total for filename

## Step 7: Present Summary

Before writing files, present this summary to the user:

```
## Task Breakdown Summary

**Source document:** {path}
**Starting task ID:** {next_id}
**Tasks to create:** {count}

| ID | Title | Depends On | Key Deliverables |
|----|-------|------------|------------------|
| 01 | Setup Script | - | deploy/setup.sh |
| 02 | Deploy Script | 01 | deploy/deploy.sh |
| ... | ... | ... | ... |

### Task Details

**Task 01: Setup Script**
- Deliverables: deploy/setup.sh
- Acceptance Criteria: 5 items
- Dependencies: None

**Task 02: Deploy Script**
- Deliverables: deploy/deploy.sh
- Acceptance Criteria: 4 items
- Dependencies: Task 01

...
```

Then use AskUserQuestion:
```
Ready to create these {count} task files in docs/tasks/?

Options:
- "Yes, create all tasks"
- "Show me the full content first"
- "Let me adjust the breakdown"
```

## Step 8: Write Task Files

After user confirmation:

1. Ensure `docs/tasks/` directory exists
2. Write each task file:
   - Filename: `{zero-padded-id}-{kebab-case-title}.md`
   - Content: Full task markdown with frontmatter
3. Report success:

```
## Tasks Created

✓ docs/tasks/01-setup-script.md
✓ docs/tasks/02-deploy-script.md
✓ docs/tasks/03-certificate-update-script.md
✓ docs/tasks/04-deployment-config-files.md

Created 4 task files. Run /next-task to begin implementation.
```

## Important Guidelines

- **Task titles:** 3-6 words, action-oriented (e.g., "Deployment Setup Script")
- **Descriptions:** Focus on "what" and "why", not "how"
- **Deliverables:** Always use backtick paths, be specific
- **Acceptance criteria:** Must be objectively testable (no "should work well")
- **Code snippets:** Copy relevant code from design doc, don't invent new code
- **Testing checklist:** Manual steps to verify the task works

## Example Transformation

**Input (from design doc):**
```markdown
### setup.sh - One-Time Host Setup

Run once on a fresh Ubuntu Server to prepare for deployment.

```bash
#!/bin/bash
set -euo pipefail
echo "=== img-board Host Setup ==="
# Install Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
```
```

**Output (task file):**
```markdown
---
id: 1
title: Deployment Setup Script
depends_on: []
status: pending
---

# Task 1: Deployment Setup Script

## Description

Create the one-time host setup script that prepares an Ubuntu Server for deployment by installing Docker, AWS CLI, and creating required directories.

## Deliverables

- `deploy/setup.sh` - One-time host preparation script

## Acceptance Criteria

- [ ] Script installs Docker if not already present
- [ ] Script installs AWS CLI v2 if not already present
- [ ] Script creates /opt/imgboard/{source,certs} directories
- [ ] Script configures Docker logging (json-file, 10m max)
- [ ] Script is executable (chmod +x)
- [ ] Script is idempotent (safe to run multiple times)

## Implementation Details

### setup.sh

```bash
#!/bin/bash
set -euo pipefail
echo "=== img-board Host Setup ==="
# Install Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
```

## Testing Checklist

- [ ] Run script on fresh Ubuntu Server VM
- [ ] Verify Docker installed and running: `docker --version`
- [ ] Verify AWS CLI accessible: `aws --version`
- [ ] Verify directories exist with correct permissions
- [ ] Run script again to confirm idempotency
```
