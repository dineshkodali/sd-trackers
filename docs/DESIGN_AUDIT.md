# UI design audit

Skills checked before starting: [emilkowalski/skills](https://github.com/emilkowalski/skills) (`skills/apple-design`) and [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) (`web-design-engineer`). The prompt's "gardden-skills by conarldi" resolves to the second one. Rules applied: no decorative gradients or glows, no emoji or sparkle decoration, no looping or decorative motion, honour `prefers-reduced-motion`, build hierarchy with weight and size, one family of type.

Where the skills and the project disagree, the project wins. Poppins is the product typeface (self-hosted, see `src/fonts`), so the skills' preference against some default faces does not apply. The app stays a dense, operational tool, so the large-display and translucent-material guidance was not adopted.

## Findings and action

| Pattern | Found | Action |
| --- | --- | --- |
| Radial orbs and blurred glows | Sign-in and reset-password screens (5 blurred circles) | Removed |
| Gradients | Sign-in panel and buttons, reset-password header and buttons, maintenance bar and banner, quick incident header, food consumption header | Replaced with solid brand colours |
| Dot grids | None found | None needed |
| Sparkle icons | 7 uses; 6 were decoration (empty notifications, "NEW" pill, hints, success banners, template header) | Removed. Kept on Housekeeping, where it means cleaning |
| Animated arrows | Hover-slide arrows on sign-in, quick jump and 4 dashboard links | Removed the movement, arrows stay |
| Hover scale and lift | Roles toggle (scale), property room cards (lift, shadow, decorative corner) | Removed |
| Looping pulses | Network offline dot, live-status dot, download spinner | Kept, they signal live state |
| Emojis in headings | None. The only symbol is an accessible-room marker on a table row | Kept, it carries information |
| Em dashes in copy | 7 real cases (labels, option text, headings) | Rewritten with colons, commas or "to" |
| Em dashes as empty values | About 30 table cells | Kept, the standard empty-cell marker |
| "Not X, it's Y" copy | None found in UI strings | None needed |
| Inter, Geist, Space Grotesk | None found | None needed |
| Reduced motion | No global rule | Added to `src/index.css` |

## Not changed, and why

- **Lucide icons** are imported in 158 files. Most label navigation, actions and statuses, which is a real use. Bulk removal would hurt recognition, so icons were only removed where they were pure decoration.
- **Card and container density** and **dashboard metric cards** need a page-by-page design decision with the product owner, not a code sweep.
- **Spacing and component tokens** are already largely shared through Tailwind and the tracker layout components (`TrackerLayout`, `TrackerToolbar`, `TrackerDossier`). A separate token file was not added to avoid a second competing system.

## Not verified

Pages were not compared visually before and after in a browser. Build, type check and unit tests were run.
