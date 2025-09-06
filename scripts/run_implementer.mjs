#!/usr/bin/env node
const taskId = process.env.TASK_ID || "DEMO-TASK";
const targetPath = process.env.TARGET_PATH || "README.md";
const diffHunk = "@@ -1 +1 @@\n-PLACEHOLDER\n+PLACEHOLDER\n";
const patchIr = {
  task_id: taskId,
  patches: [
    {
      path: targetPath,
      hunk: diffHunk,
      risk: ["api_break:false"],
      notes: ["stub implementer output"]
    }
  ]
};
process.stdout.write(JSON.stringify(patchIr, null, 2));
