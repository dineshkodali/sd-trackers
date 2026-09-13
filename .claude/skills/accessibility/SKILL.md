---
name: accessibility
description: Audit and fix an interface against WCAG 2.2 AA — keyboard, screen reader, contrast and semantics.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Accessibility Audit

## Trigger
- New or changed UI.
- Building shared components or data tables.
- Before release.

## Inputs needed
- A running instance or the component source.
- An automated scanner such as axe.

## Procedure
1. Run the automated scan to clear mechanical failures first.
2. Tab through the whole flow using only the keyboard.
3. Check every input has a programmatically associated label and a linked error message.
4. Verify contrast: 4.5:1 body text, 3:1 large text, UI components and focus indicators.
5. Test custom controls with a screen reader and record what is announced.
6. Confirm async updates and validation are announced via live regions.
7. Record each issue against its WCAG success criterion.

## Checklist
- [ ] Every interactive element reachable and operable by keyboard
- [ ] Visible focus indicator everywhere, never removed
- [ ] All inputs labelled; errors linked to their field
- [ ] Heading order logical, one h1, landmarks present
- [ ] Contrast ratios met
- [ ] Custom controls expose correct role, name and state
- [ ] Modals trap focus and restore it on close
- [ ] Tables use proper header association
- [ ] No information conveyed by colour alone
- [ ] Reduced-motion preference respected

## Output template
```
| Severity | Element | WCAG | Issue | Fix |
|---|---|---|---|---|
| High | Filter dropdown | 2.1.1 | not keyboard operable | <fix> |

**Verified:** 1.4.3, 2.4.7, 4.1.2
**Method:** axe scan + manual keyboard + VoiceOver
```

## Do not
- Never suggest removing a focus outline — restyle it.
- Prefer native HTML over an ARIA patch.
- Never report an automated scan alone as an audit — it catches roughly a third of real issues.
