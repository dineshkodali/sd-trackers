# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: errors\error-handling.spec.ts >> TS-22 Error handling >> 22.7 DEF-10 server-side deletion clears the row from the UI
- Location: tests\errors\error-handling.spec.ts:77:8

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('main table tbody tr').filter({ hasText: 'QA-TEST-227DEF10SE-930821' })
Expected: 0
Received: 1
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" locator('main table tbody tr').filter({ hasText: 'QA-TEST-227DEF10SE-930821' }) with timeout 15000ms
  - waiting for locator('main table tbody tr').filter({ hasText: 'QA-TEST-227DEF10SE-930821' })
    33 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - generic [ref=f1e6]:
        - generic [ref=f1e7]:
          - generic [ref=f1e8]: S
          - generic [ref=f1e9]: D
          - generic [ref=f1e10]: SD
        - generic [ref=f1e11]:
          - generic [ref=f1e12]:
            - generic [ref=f1e13]: SD
            - generic [ref=f1e14]: COMMERCIAL
          - generic [ref=f1e15]: Operations & Compliance Portal
      - generic [ref=f1e16]:
        - button "All Properties (16 Hotels)" [ref=f1e17] [cursor=pointer]
        - 'button "Network status: Online" [ref=f1e24] [cursor=pointer]':
          - generic [ref=f1e31]: Online
        - button "Diagnostics" [ref=f1e32] [cursor=pointer]
        - button "Super Admin" [ref=f1e37]
        - button "View notifications" [ref=f1e44]:
          - generic [ref=f1e48]: "1"
        - button "S Stack Master" [ref=f1e50]:
          - generic [ref=f1e51]: S
          - generic [ref=f1e52]: Stack Master
    - generic [ref=f1e55]:
      - complementary [ref=f1e56]:
        - navigation [ref=f1e57]:
          - button "Dashboard" [ref=f1e59]
          - generic [ref=f1e65]:
            - generic [ref=f1e66]: Safeguarding
            - generic [ref=f1e68]:
              - button "SG Referrals 1" [active] [ref=f1e69]:
                - generic [ref=f1e70]: SG Referrals
                - generic [ref=f1e75]: "1"
              - button "Toggle Archive View" [ref=f1e76]
            - generic [ref=f1e80]:
              - button "Vulnerable SUs 0" [ref=f1e81]:
                - generic [ref=f1e82]: Vulnerable SUs
                - generic [ref=f1e86]: "0"
              - button "Toggle Archive View" [ref=f1e87]
            - generic [ref=f1e91]:
              - button "Challenging SUs 1" [ref=f1e92]:
                - generic [ref=f1e93]: Challenging SUs
                - generic [ref=f1e97]: "1"
              - button "Toggle Archive View" [ref=f1e98]
          - generic [ref=f1e101]:
            - generic [ref=f1e102]: Facilities & Welfare
            - button "Maintenance Tracker" [ref=f1e103]
            - button "SPCD Tracker 1" [ref=f1e111]:
              - generic [ref=f1e112]: SPCD Tracker
              - generic [ref=f1e117]: "1"
            - button "Laundry Support" [ref=f1e118]
            - button "Hot Meals Tracker" [ref=f1e125]
            - button "Escalations Log 1" [ref=f1e134]:
              - generic [ref=f1e135]: Escalations Log
              - generic [ref=f1e142]: "1"
            - button "Proof Documents" [ref=f1e143]
          - generic [ref=f1e150]:
            - generic [ref=f1e151]: Compliance
            - button "Reports & SharePoint" [ref=f1e152]
            - button "Audit Security Trail" [ref=f1e158]
            - button "Requests & Approvals" [ref=f1e170]
          - generic [ref=f1e177]:
            - generic [ref=f1e178]: Admin & Governance
            - button "Properties Directory 16" [ref=f1e180]:
              - generic [ref=f1e181]: Properties Directory
              - generic [ref=f1e185]: "16"
            - button "Staff & User Accounts 6" [ref=f1e186]:
              - generic [ref=f1e187]: Staff & User Accounts
              - generic [ref=f1e193]: "6"
            - button "Roles & RBAC Matrix" [ref=f1e194]
            - button "Field Options & Setup" [ref=f1e200]
            - button "System Preferences" [ref=f1e204]
      - main [ref=f1e208]:
        - generic [ref=f1e209]:
          - generic [ref=f1e210]:
            - generic [ref=f1e211]:
              - heading "SG Referrals" [level=2] [ref=f1e212]
              - paragraph [ref=f1e213]: Track multi-agency safeguarding referrals and local authority council outcomes.
            - generic [ref=f1e214]:
              - generic [ref=f1e215]:
                - button "Active Referrals" [ref=f1e216]
                - button "Archive" [ref=f1e217]
              - button "+ New Record" [ref=f1e218]
              - generic [ref=f1e222]:
                - button "Export" [ref=f1e223]
                - button "Export format & options" [ref=f1e228]
          - generic [ref=f1e231]:
            - generic [ref=f1e232]:
              - generic [ref=f1e233]:
                - generic [ref=f1e234]: Hotel / Site
                - combobox [ref=f1e236]:
                  - option "All Permitted Sites (16)" [selected]
                  - option "Holiday Inn Lambeth"
                  - option "Holiday Inn Old Street"
                  - option "Maida Vale Aparthotel"
                  - option "Brit Hotel"
                  - option "Parmiter PDA"
                  - option "Holiday Inn Swiss Cottage"
                  - option "Ibis Styles - Seven Kings"
                  - option "Stansted Hotel (Ibis Budget Bisop Stortford)"
                  - option "Clapham South Dudley Hotel"
                  - option "Hilton Hampton - Ealing"
                  - option "Leigham Court Hotel"
                  - option "Ibis Cardiff City Centre"
                  - option "Clacton Pier Avenue"
                  - option "Lea Halls"
                  - option "Mercure Heathrow Hotel"
                  - option "Burrows Court"
              - generic [ref=f1e237]:
                - generic [ref=f1e238]: Month / Period
                - combobox [ref=f1e239]:
                  - option "All Months" [selected]
                  - option "June 2026"
                  - option "May 2026"
                  - option "April 2026"
                  - option "March 2026"
                  - option "February 2026"
                  - option "January 2026"
              - generic [ref=f1e240]:
                - generic [ref=f1e241]: Status
                - combobox [ref=f1e242]:
                  - option "All Statuses" [selected]
                  - option "Open"
                  - option "In progress"
                  - option "Completed"
                  - option "Pending"
                  - option "Archived"
              - generic [ref=f1e243]:
                - generic [ref=f1e244]: Quick Search
                - textbox "Filter by name, Port/NASS ref, room, or notes..." [ref=f1e247]
              - generic [ref=f1e248]:
                - button "Reset" [ref=f1e249]
                - generic [ref=f1e255]:
                  - button "Export" [ref=f1e256]
                  - button "Choose export format (PDF or CSV)" [ref=f1e261]
            - generic [ref=f1e264]:
              - generic [ref=f1e265]:
                - text: "Matching records:"
                - strong [ref=f1e266]: "1"
              - generic [ref=f1e267]: Instant search & filter with recent search history
          - generic [ref=f1e268]:
            - table [ref=f1e270]:
              - rowgroup [ref=f1e271]:
                - row [ref=f1e272]:
                  - columnheader "Sr. No." [ref=f1e273]
                  - columnheader "Hotel" [ref=f1e274] [cursor=pointer]
                  - columnheader "Referral Council" [ref=f1e280] [cursor=pointer]
                  - columnheader "SU Name" [ref=f1e286] [cursor=pointer]
                  - columnheader "Mosaic ID" [ref=f1e292] [cursor=pointer]
                  - columnheader "Port / Nass Ref" [ref=f1e298] [cursor=pointer]
                  - columnheader "Date of Birth" [ref=f1e304] [cursor=pointer]
                  - columnheader "Raised By (Officer Leading)" [ref=f1e310]
                  - columnheader "Referral Type" [ref=f1e311] [cursor=pointer]
                  - columnheader "Status" [ref=f1e317] [cursor=pointer]
                  - columnheader "Date Referred" [ref=f1e323] [cursor=pointer]
                  - columnheader "Method of Referral" [ref=f1e328]
                  - columnheader "Acknowledgement Received" [ref=f1e329]
                  - columnheader "Response Received from LA" [ref=f1e330]
                  - columnheader "LA officer Leading" [ref=f1e331]
                  - columnheader "Notes - Action(s) Taken" [ref=f1e332]
                  - columnheader "SG Review" [ref=f1e333]
                  - columnheader "Actions" [ref=f1e334]
              - rowgroup [ref=f1e335]:
                - row [ref=f1e336]:
                  - cell "1" [ref=f1e337]
                  - cell "Brit Hotel" [ref=f1e338]
                  - cell "Westminster City Council" [ref=f1e339]
                  - cell [ref=f1e340]:
                    - button "QA-TEST-227DEF10SE-930821" [ref=f1e341]
                  - cell "MOS-mr6mj" [ref=f1e342]
                  - cell "PORT-mr6mj" [ref=f1e343]
                  - cell "—" [ref=f1e344]
                  - cell "Stack Master" [ref=f1e345]
                  - cell "Safeguarding Adult" [ref=f1e346]
                  - cell "Open" [ref=f1e347]:
                    - combobox "Click to update referral status" [ref=f1e348] [cursor=pointer]:
                      - option "Open" [selected]
                      - option "In progress"
                      - option "Completed"
                      - option "Archived"
                  - cell "2026-09-07" [ref=f1e349]
                  - cell "Mosaic Portal" [ref=f1e350]
                  - cell [ref=f1e351]
                  - cell "Awaiting Allocation" [ref=f1e353]
                  - cell "Awaiting LA" [ref=f1e354]
                  - cell "Seeded by automated test. Safe to delete." [ref=f1e355]
                  - cell "—" [ref=f1e356]
                  - cell [ref=f1e357]:
                    - generic [ref=f1e358]:
                      - button "View Record Details" [ref=f1e359]
                      - button "Edit Record" [ref=f1e363]
                      - button "Archive Referral" [ref=f1e366]
                      - button "Delete Record" [ref=f1e370]
            - generic [ref=f1e374]:
              - generic [ref=f1e375]:
                - generic [ref=f1e376]: "Rows per page:"
                - combobox "Adjust page size to optimize rendering speed" [ref=f1e377]:
                  - option "10 (Fastest)" [selected]
                  - option "25"
                  - option "50"
                  - option "100"
                - generic [ref=f1e378]: "|"
                - generic [ref=f1e379]:
                  - text: Showing
                  - strong [ref=f1e380]: "1"
                  - text: "-"
                  - strong [ref=f1e381]: "1"
                  - text: of
                  - strong [ref=f1e382]: "1"
              - generic [ref=f1e383]:
                - button "First Page" [disabled] [ref=f1e384]
                - button "Previous Page" [disabled] [ref=f1e388]
                - generic [ref=f1e391]: Page 1 of 1
                - button "Next Page" [disabled] [ref=f1e392]
                - button "Last Page" [disabled] [ref=f1e395]
  - generic [aria-hidden] [ref=f1e399]: "0"
```

# Test source

```ts
  1   | /**
  2   |  * TS-22 — Error handling and resilience.
  3   |  */
  4   | import { test, expect } from '../helpers/fixtures';
  5   | import { anonTest } from '../helpers/fixtures';
  6   | import { gotoModule, watchFailures, isEmptyState, injectSession, waitForAppShell } from '../helpers/ui';
  7   | import { createRecord, referralPayload, listRecords, deleteRecord } from '../helpers/api';
  8   | 
  9   | test.describe('TS-22 Error handling', () => {
  10  |   test('22.1 no module raises an uncaught exception during a full tour', async ({ page }) => {
  11  |     const { pageErrors } = watchFailures(page);
  12  |     for (const key of ['referrals', 'vulnerable', 'challenging', 'maintenance', 'spcd', 'escalations'] as const) {
  13  |       await gotoModule(page, key);
  14  |     }
  15  |     expect(pageErrors).toEqual([]);
  16  |   });
  17  | 
  18  |   test('22.2 a module with no records shows an explicit empty state', async ({ page, api }) => {
  19  |     // Requests & Approvals has no create path, so it is reliably empty.
  20  |     await gotoModule(page, 'requests');
  21  |     const rows = await listRecords(api, 'requests');
  22  |     if (rows.length === 0) {
  23  |       expect(await isEmptyState(page)).toBe(true);
  24  |     }
  25  |   });
  26  | 
  27  |   test('22.3 the app still renders when the data API fails', async ({ page }) => {
  28  |     await page.route('**/api/db/**', (route) => route.fulfill({ status: 500, body: '{"error":"simulated"}' }));
  29  |     const { pageErrors } = watchFailures(page);
  30  |     await gotoModule(page, 'referrals');
  31  |     await page.waitForTimeout(2500);
  32  | 
  33  |     await expect(page.locator('main')).toBeVisible();
  34  |     expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(0);
  35  |     expect(pageErrors, 'API failure must not crash the view').toEqual([]);
  36  |     await page.unroute('**/api/db/**');
  37  |   });
  38  | 
  39  |   test('22.4 the app survives the data API being unreachable', async ({ page }) => {
  40  |     await page.route('**/api/db/**', (route) => route.abort());
  41  |     const { pageErrors } = watchFailures(page);
  42  |     await gotoModule(page, 'vulnerable');
  43  |     await page.waitForTimeout(2500);
  44  | 
  45  |     await expect(page.locator('main')).toBeVisible();
  46  |     expect(pageErrors).toEqual([]);
  47  |     await page.unroute('**/api/db/**');
  48  |   });
  49  | 
  50  |   test('22.5 a malformed API payload does not crash the view', async ({ page }) => {
  51  |     await page.route('**/api/db/referrals', (route) =>
  52  |       route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":"not-an-array"}' }));
  53  |     const { pageErrors } = watchFailures(page);
  54  |     await gotoModule(page, 'referrals');
  55  |     await page.waitForTimeout(2500);
  56  | 
  57  |     await expect(page.locator('main')).toBeVisible();
  58  |     expect(pageErrors).toEqual([]);
  59  |     await page.unroute('**/api/db/referrals');
  60  |   });
  61  | 
  62  |   test('22.6 a slow API shows the shell rather than a blank page', async ({ page }) => {
  63  |     await page.route('**/api/db/**', async (route) => {
  64  |       await new Promise((r) => setTimeout(r, 2500));
  65  |       await route.continue();
  66  |     });
  67  |     await gotoModule(page, 'challenging');
  68  |     await expect(page.locator('main')).toBeVisible();
  69  |     await expect(page.locator('nav button').first()).toBeVisible();
  70  |     await page.unroute('**/api/db/**');
  71  |   });
  72  | 
  73  |   /**
  74  |    * DEF-10. The sync only assigns when the payload is non-empty, so records
  75  |    * deleted server-side linger in the UI indefinitely.
  76  |    */
  77  |   test.fail('22.7 DEF-10 server-side deletion clears the row from the UI', async ({ page, api, tag }) => {
  78  |     const payload = referralPayload({ suName: tag });
  79  |     await createRecord(api, 'referrals', payload);
  80  |     await page.reload({ waitUntil: 'domcontentloaded' });
  81  |     await gotoModule(page, 'referrals');
  82  |     await expect(page.locator('main table tbody tr').filter({ hasText: tag })).toBeVisible({ timeout: 30_000 });
  83  | 
  84  |     await deleteRecord(api, 'referrals', payload.id);
  85  |     // Allow several background sync cycles to land.
  86  |     await page.waitForTimeout(12_000);
  87  | 
> 88  |     await expect(page.locator('main table tbody tr').filter({ hasText: tag })).toHaveCount(0);
      |                                                                                ^ Error: expect(locator).toHaveCount(expected) failed
  89  |   });
  90  | });
  91  | 
  92  | anonTest.describe('TS-22 Error handling (unauthenticated)', () => {
  93  |   anonTest('22.8 a failing auth check leaves the user on the login screen', async ({ page, context }) => {
  94  |     await context.route('**/api/auth/me', (route) => route.fulfill({ status: 500, body: '{"error":"simulated"}' }));
  95  |     await injectSession(context);
  96  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  97  |     await page.waitForTimeout(6000);
  98  |     const shell = await page.locator('nav button').count();
  99  |     expect(shell, 'a failed verification must not open the app').toBe(0);
  100 |   });
  101 | 
  102 |   anonTest('22.9 login surfaces a message when the auth API errors', async ({ page, context }) => {
  103 |     await context.route('**/api/auth/login', (route) => route.fulfill({ status: 500, body: '{"error":"Authentication service unavailable"}' }));
  104 |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  105 |     await page.locator('input[type="email"]').first().fill('someone@example.com');
  106 |     await page.locator('input[type="password"]').first().fill('whatever');
  107 |     await page.getByRole('button', { name: /sign in/i }).first().click();
  108 |     await page.waitForTimeout(2500);
  109 |     expect(await page.locator('input[type="password"]').count(), 'must stay on login').toBeGreaterThan(0);
  110 |   });
  111 | });
  112 | 
```