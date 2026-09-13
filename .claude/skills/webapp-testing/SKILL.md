---
name: webapp-testing
description: End-to-end testing of flows in a real browser — click, fill, assert, screenshot — before declaring a feature done.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Web App Testing

## Trigger
- A screen or flow changed.
- Before UAT or release.
- A user reports the UI not working.

## Inputs needed
- A running instance.
- A test account.
- The flows the change touches.

## Procedure
1. Identify the flows affected by the change.
2. Walk each with valid input, then invalid input, then a simulated network failure.
3. Check every async state, and check the empty state deliberately — new CRM accounts have no data.
4. Refresh mid-flow and use browser back to check state handling.
5. Complete the flow using only the keyboard.
6. Resize to 375px, 768px and 1440px.
7. Capture a screenshot for every defect.

## Checklist
- [ ] Validation errors shown at field level for both client and server rejection
- [ ] Loading, empty and error states all render
- [ ] No raw error text, `undefined` or `NaN` reaching the user
- [ ] Focus visible and managed in modals and menus
- [ ] No console errors
- [ ] Layout holds at all three widths
- [ ] State survives refresh and browser back

## Output template
```
**Flows tested**
- Create contact → PASS
- Bulk import → FAIL

**Defects**
- Bulk import: uploading an empty CSV shows `undefined rows`.
  Steps: ... Expected: ... Actual: ... Screenshot: <path>
```

## Do not
- Report what you observed, not what the code implies.
- Do not fix the code inside this skill — report it.
