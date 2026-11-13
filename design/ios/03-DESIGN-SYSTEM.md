# 03 Design system

Boards: [Colour and type](design-system/01-colour-and-type.png) · [Components](design-system/02-components.png) · [States](design-system/03-states-and-feedback.png) · [Icons and SF Symbols](design-system/04-icons-and-symbols.png). Machine-readable tokens: [data/tokens.json](data/tokens.json).

## Principles

1. Native first: large titles, inset grouped lists, bottom sheets, swipe actions, system pickers, Dynamic Type, dark mode.
2. Keep the web brand: the teal tint (#0F766E) carries over; surfaces and type are iOS system.
3. Status is text plus colour, never colour alone.
4. One tap to the thing you need; destructive actions are always confirmed (archive takes two confirmations).
5. Same data, same rules: the app talks to the existing Supabase backend and respects the same role and site scoping.

## Colour

| Token | Value | Use |
|---|---|---|
| tint | `#0F766E` | tint |
| tintSoft | `#E6F4F2` | tintSoft |
| teal | `#0D9488` | teal |
| grouped | `#F2F2F7` | grouped |
| card | `#FFFFFF` | card |
| separator | `#E5E5EA` | separator |
| primary | `#1C1C1E` | primary |
| secondary | `#636366` | secondary |
| tertiary | `#8E8E93` | tertiary |
| onTint | `#FFFFFF` | onTint |
| success | `#34C759` | success |
| warning | `#FF9500` | warning |
| danger | `#FF3B30` | danger |
| info | `#007AFF` | info |
| special | `#AF52DE` | special |
| neutral | `#8E8E93` | neutral |

Dark mode: define every colour as an Asset Catalog colour set with a dark value (surfaces #000 / #1C1C1E, tint lightened to #2DD4BF for contrast). The mock-ups show light mode only.

## Typography

SF Pro through Dynamic Type text styles: largeTitle 34/bold, title 28/bold, headline 17/semibold, body 17/regular, cardTitle 16/semibold, callout 15/regular, subheadline 13/regular, caption 12/regular, badge 12/semibold. All text scales; layouts must wrap rather than truncate at the largest accessibility sizes.

## Spacing, shape, elevation

4pt grid (4, 8, 12, 16, 20, 24, 32); screen margin 16; card padding 14; row minimum 44. Radii: card 14, group 12, button 14, field 11, chip 17, badge 11, sheet 22. Cards use a hairline shadow only.

## Components

- **Navigation bars:** large title at the top of a tab, inline title on pushed screens; trailing actions are circular tinted buttons.
- **Tab bar:** five items, translucent, badge for counts.
- **Record card:** title, one supporting line, status badge (top right), up to three facts with icons.
- **Inset grouped list / form row:** label left, value or placeholder right, chevron for pickers, red asterisk for required, inline error below the row.
- **Buttons:** primary (filled tint), secondary (tint on soft), destructive (red on soft), outline; 50pt high, small 38pt.
- **Search field, filter chips, segmented control:** system styles; chips scroll horizontally.
- **Badges:** pill with dot and text; tones success / warning / danger / info / special / neutral.
- **Bottom sheet:** grabber, centred title, grouped content, primary action at the bottom.
- **Banners:** info, warning, error, success; icon plus short text, optional action.
- **KPI card:** label, large number, delta line.
- **Charts:** donut and horizontal bars with a value list underneath so VoiceOver and keyboard users reach every figure.

## Tables → mobile lists

Desktop tables of 8–54 columns are never shrunk. Each becomes a card list: the first identifying column is the title, one descriptive column the subtitle, the status column the badge, up to three dates/places/people as facts. Everything else is on the Detail screen in grouped sections. Sorting becomes a sort menu on the filter button; pagination becomes continuous scrolling.

## States and feedback

Loading uses skeleton cards, empty states explain and offer the next step, errors say what happened and offer Retry, success is a toast. Validation is inline under the row; Save stays enabled and scrolls to the first error. Offline shows a banner and queues edits.

## Accessibility

Contrast at least 4.5:1 for text (tint #0F766E on white is 5.5:1); 44×44pt targets; Dynamic Type; VoiceOver labels on icon buttons and charts; Reduce Motion; Bold Text; Increase Contrast; haptics for success and destructive confirmation; never rely on colour alone.

## Icons

SF Symbols in the app. The mock-ups use outline stand-ins; the symbol for each module is listed on the [icons board](design-system/04-icons-and-symbols.png) and in the inventory data (`tools/lib/pages.cjs`).

## Fonts and assets note

The mock-ups were drawn with the system font available on the machine that rendered them, not SF Pro (Apple's font cannot be embedded here). Spacing and sizes follow iOS metrics, so the real app will look slightly crisper, not different.
