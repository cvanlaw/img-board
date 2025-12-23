---
description: Identify and plan the next completable task from docs/tasks/ directory
model: sonnet
---

# Next Task Planner

**You are now in plan mode.** Follow these steps to identify and plan the next task:

## Step 1: Scan Task Directory

Read all task files in `docs/tasks/` directory (sorted numerically 01-11). For each task file, extract:
- Task number and title
- Description (from ## Description section)
- Dependencies (from ## Dependencies section)
- Deliverables (from ## Deliverables section)
- Acceptance Criteria (from ## Acceptance Criteria section)

## Step 2: Check Project State

For each task's deliverables, check if the files/directories exist in the project:
- Use Glob or Bash to check for file existence
- Keep track of which tasks have all deliverables present (completed)
- Keep track of which tasks have no deliverables present (not started)

**Common deliverables to check:**
- Task 01: `package.json`, `config.json`, `public/` directory, `.gitignore`
- Task 02: `preprocessor.js`
- Task 03: `server.js`
- Task 04: `public/index.html`, `public/js/slideshow.js`, `public/css/style.css`
- Task 11: `Dockerfile`, `docker-compose.yml`, `start.js`

## Step 3: Identify Next Task

Find the first task (by number) where:
1. **All dependencies are satisfied** (either has "None" as dependency, or all dependent tasks are completed)
2. **Not yet completed** (deliverables don't exist)

**Dependency parsing logic:**
- If "## Dependencies" says "None" or "None - this is the foundation task" → task is always available
- If it lists "Task XX: Description" → extract task number XX and check if that task is completed

## Step 4: Read Full Task Details

Once you've identified the next task, read the complete markdown file for that task to get:
- Full description
- All implementation details
- All acceptance criteria (for TodoWrite)
- Testing checklist

## Step 5: Create Implementation Plan

Write to the plan file (`/Users/cvanlaw/.claude/plans/[plan-id].md`):
- Task number and title
- Brief summary of what needs to be done
- List of files to create/modify
- Key implementation details from the task file
- Any critical decisions or configurations

## Step 6: Create Todo List

Use the TodoWrite tool to create a checklist from the task's acceptance criteria:
- Extract each checkbox item from "## Acceptance Criteria"
- Create todos with status "pending"
- Use clear, actionable descriptions

Example:
```javascript
TodoWrite({
  todos: [
    { content: "npm install runs without errors", status: "pending", activeForm: "Running npm install" },
    { content: "config.json contains all configuration options", status: "pending", activeForm: "Creating config.json" }
  ]
})
```

## Step 7: Present Plan to User

Show the user:
1. **Task Identified**: "Task XX: [Title]"
2. **Summary**: Brief description of what will be implemented
3. **Files to Create**: List of deliverables
4. **Key Points**: Any important implementation notes

Then use AskUserQuestion to ask:
```
"Ready to implement Task XX: [Description]?"

Options:
- "Yes, proceed with implementation"
- "Show me more details first"
```

## Step 8: Exit Plan Mode

After presenting the plan and getting user response:
- Call ExitPlanMode
- If user approved, begin implementation by creating the first file from the deliverables list

---

## Important Notes

- Always start with Task 01 if no files exist yet
- Some tasks can be done in parallel (e.g., Task 02 and 03 both depend only on 01)
- Focus on the FIRST available task by number to maintain logical progression
- Be thorough in checking file existence to avoid recommending already-completed tasks
