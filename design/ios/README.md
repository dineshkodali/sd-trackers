# SDTracker iOS design reference

A complete mobile design reference for the existing SDTracker web app: 258 iPhone screens covering all 49 pages, six roles, six workflows and a design system. Open [index.html](index.html) in a browser for the visual gallery.

| Deliverable | File |
|---|---|
| A. Screen inventory | [01-SCREEN-INVENTORY.md](01-SCREEN-INVENTORY.md) |
| B. Navigation architecture and role access | [02-NAVIGATION-ARCHITECTURE.md](02-NAVIGATION-ARCHITECTURE.md) |
| C. Design system | [03-DESIGN-SYSTEM.md](03-DESIGN-SYSTEM.md), [design-system/](design-system/), [data/tokens.json](data/tokens.json) |
| D. iPhone mock-ups | [mockups/](mockups/) (one PNG per screen), [overview/](overview/) (contact sheets) |
| E. Screen specifications | [04-SCREEN-SPECS.md](04-SCREEN-SPECS.md) |
| F. Workflow references | [05-WORKFLOWS.md](05-WORKFLOWS.md), [workflows/](workflows/) |
| G. Coverage report | [06-COVERAGE-REPORT.md](06-COVERAGE-REPORT.md) |

Start with the overview sheets: [00-foundation.png](overview/00-foundation.png), [01-navigation.png](overview/01-navigation.png), [02-home.png](overview/02-home.png)… and the [workflows](workflows/).

## Regenerating

Everything is generated from the web source so it stays honest:

```
node design/ios/tools/audit.cjs        # read-only audit of src/ -> data/audit.json
node design/ios/tools/designsystem.cjs # tokens + design-system boards
node design/ios/tools/build.cjs        # all mock-up PNGs + data/screens.json
node design/ios/tools/overview.cjs     # contact sheets + workflow strips
node design/ios/tools/docs.cjs         # these documents + index.html
```

Needs Node, the repo's installed packages (`react`, `@tabler/icons-react`, `playwright-core`) and Chrome or Edge. Nothing here is imported by the web app or its build.

## Read this first

- Fictional data only. No real residents, properties or references appear.
- The brief lists roles Engineer and Customer; the repository has six different roles. See the navigation document and the coverage report.
- Icons and fonts are stand-ins for SF Symbols and SF Pro.
