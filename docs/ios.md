# SD Operations Platform — iOS Mobile Application Architecture & Implementation Plan

This document outlines the complete architectural blueprint, feature set, design system, and technical implementation for the **SD Operations Platform iOS Mobile Application**.

---

## 1. Vision & Architectural Philosophy

### "Field-Ready, High-Frequency, Compatible & Lightweight"
The desktop web application serves extensive administrative duties, schema customization, and heavy 15-column tabular reports. In contrast, the iOS mobile app is designed for **field operators, duty leads, site managers, and care workers** navigating hotel properties on foot.

### Core Tenets:
1. **Zero Bloat ("Not Too Heavy")**: Strip away cumbersome desktop workflows (custom table schema builders, bulk CSV seeds, complex pivot charts). Keep only the essential daily workflows that site teams execute on their phones.
2. **100% Brand Kit Parity**: Uses the exact same design language from [`docs/BRAND_KIT.md`](./BRAND_KIT.md) (Teal `#0d9488`, Fluent neutral surfaces `#f3f2f1` / `#faf9f8`, sharp 2px radii, high-density enterprise typography, and consistent badge colors).
3. **Field Durability & Offline Capability**: Hotels frequently have poor cell reception in basements, plant rooms, and stairwells. The app incorporates offline request queueing with auto-sync upon reconnection.
4. **Hardware Acceleration**: Deep integration with native iOS capabilities: **Camera** (incident/maintenance photo evidence), **Face ID / Touch ID** (biometric enterprise lock), **Apple Push Notifications (APNs)** (critical safeguarding alerts), and **Haptics** (`UIImpactFeedbackGenerator`).

---

## 2. Technology Stack & Implementation Strategy

### Recommended Approach: Capacitor 6 + React 19 + Tailwind CSS + Direct Supabase
This architecture delivers the fastest time-to-market with 100% parity across data models, authentication, and design tokens, compiled into a pure native Xcode project.

```
┌─────────────────────────────────────────────────────────┐
│                    iOS Native Shell                     │
│   (Xcode / Swift / CocoaPods / APNs / Info.plist)       │
├─────────────────────────────────────────────────────────┤
│                  Capacitor 6 Bridge                     │
│  ├── @capacitor/camera          (Photo attachments)     │
│  ├── @capacitor/push-notifications (APNs alerts)        │
│  ├── @capacitor/haptics         (Tactile feedback)      │
│  ├── @capacitor/network         (Offline detection)     │
│  └── @capacitor/secure-storage  (iOS Keychain for JWT)  │
├─────────────────────────────────────────────────────────┤
│            SD Operations Mobile Application             │
│  ├── React 19 + TypeScript (Strict Mode)                │
│  ├── Tailwind CSS v4 (SD Brand Kit Tokens)              │
│  ├── Lucide React Icons (Consistent with WebApp)        │
│  ├── Direct Client-Side Supabase SDK Adapter            │
│  └── Offline Mutation Queue (SQLite / LocalStorage)     │
└─────────────────────────────────────────────────────────┘
```

> **Alternative (SwiftUI Native)**: If 100% SwiftUI is required, the data schema in `server/schemaAdapter.ts` and Supabase tables directly map to Swift structs using `supabase-swift` and `SwiftData`.

---

## 3. Mobile-First Feature Matrix: What to Include vs. Exclude

| Feature / Module | Included on iOS? | Mobile UX Adaptation |
| :--- | :---: | :--- |
| **Authentication & RBAC** | ✅ **YES** | Face ID / Touch ID biometric lock; Azure Entra ID / Supabase SSO; Site-locking for Staff |
| **Operations Dashboard** | ✅ **YES** | Daily Action Summary cards; Urgent Safeguarding Counter; 1-Tap Emergency Hotline |
| **Safeguarding Escalations** | ✅ **YES** | Quick Incident bottom-sheet; Live camera capture for evidence; Push notification on high urgency |
| **RFA Welfare Checks** | ✅ **YES** | Room-by-room checkoff list; Swipe-to-complete; Voice dictation for welfare notes |
| **Referrals & Resident Lookup** | ✅ **YES** | Instant search by Name or Port Ref; Room number badge; Medical/dietary alert badges |
| **Property Maintenance** | ✅ **YES** | Snap defect photos (leaks, locks, heating); Priority chips (Urgent/Emergency); Status tracker |
| **Hot Food & Buffet Logs** | ✅ **YES** | Quick temperature steppers; Instant pass/fail validation (&ge;63&deg;C holding); Chef signature sign-off |
| **Property Laundry Logs** | ✅ **YES** | Numeric bags sent/returned stepper; Instant discrepancy warning calculation; Driver receipt attachment |
| **GP Clinical Appointments** | ✅ **YES** | Today's appointment agenda; Service user escort details; Apple Maps 1-tap navigation |
| **Public Transport Passes** | ✅ **YES** | Digital URN display; Ticket authorization code; Offline QR card view |
| **Change Requests & Approvals**| ✅ **YES** | Mobile approvals inbox; 1-tap Approve / Reject for managers with push alerts |
| **Table Schema Customizer** | ❌ **NO** | *Excluded from mobile*: Heavy desktop-only administration module |
| **Bulk CSV / Database Seeding** | ❌ **NO** | *Excluded from mobile*: Managed via WebApp or Supabase SQL Editor |
| **Full PDF / CSV Export Engine**| ⚡ **Lite** | Quick-share summary cards via iOS Share Sheet (`UIActivityViewController`) |

---

## 4. UI Design System & Brand Kit Tokens for iOS

The iOS app strictly implements the design tokens from [`docs/BRAND_KIT.md`](./BRAND_KIT.md):

### Color Tokens:
* **Primary Brand Teal**: `#0d9488` (RGB: `13, 148, 136`) — Main CTAs, active tab icons, header accents.
* **Primary Hover / Pressed**: `#0f766e` (RGB: `15, 118, 110`) — Touch feedback state.
* **Canvas Background**: `#f3f2f1` (RGB: `243, 242, 241`) — Screen background.
* **Card & Sheet Surface**: `#ffffff` — Elevated modules, bottom sheets, form cards.
* **Subtle Alternating Surface**: `#faf9f8` — Secondary panel backgrounds, disabled inputs.
* **Border Lines**: `#e1dfdd` (Containers), `#8a8886` (Inputs, buttons).
* **Text Colors**: `#242424` (Headings), `#323130` (Body), `#605e5c` (Captions/Muted).
* **Semantic Accents**:
  * **Critical / Danger**: `#a4262c` (Soft background: `#fdf3f2`, Soft border: `#f5b8b5`)
  * **Warning / Alert**: `#d97706` (Soft background: `#fffbeb`, Soft border: `#fde68a`)
  * **Success**: `#107c41` (Soft background: `#f0fdf4`, Soft border: `#bbf7d0`)

### iOS-Specific Design Rules:
1. **Safe Area Insets**: Full support for Dynamic Island, iPhone home indicators, and status bar padding (`pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`).
2. **Bottom Navigation Bar**: 5 primary items for single-thumb navigation:
   - **Dashboard** (`LayoutDashboard`)
   - **Welfare** (`HeartHandshake`)
   - **Incidents** (`AlertTriangle` with pulsating badge if active)
   - **Maintenance** (`Wrench`)
   - **Approvals / More** (`CheckCircle2` / `Menu`)
3. **Bottom Sheet Modals**: All forms open as swipeable bottom sheets with native dismiss gestures instead of desktop center popups.
4. **Tactile Feedback**:
   - `Haptics.impact({ style: ImpactStyle.Light })` on list selection and tab switching.
   - `Haptics.notification({ type: NotificationType.Success })` on form submission.
   - `Haptics.notification({ type: NotificationType.Warning })` on critical escalation creation.

---

## 5. Security & Role-Based Access Control (RBAC) on iOS

The mobile app enforces the exact same strict security constraints established in the web application:
1. **Strict Site Locking for Staff**:
   - When a Staff member logs in, their assigned hotel (e.g. `"Stansted Hotel (Ibis Budget Bisop Stortford)"`) is stored in the session.
   - All forms automatically lock the **Hotel / Site** field with the locked badge (`<Lock /> Assigned Property (Locked)`).
   - Staff cannot switch hotels or submit entries under other properties.
2. **Biometric Session Protection**:
   - If the app is sent to the background for more than 5 minutes, it prompts for Face ID / Touch ID before re-displaying sensitive safeguarding data.
3. **Encrypted Storage**:
   - JWT session tokens and refresh tokens are stored in the **iOS Keychain** via `@capacitor/preferences` / Keychain Services, never in insecure plaintext.

---

## 6. Offline-First Architecture & Data Synchronization

```
┌────────────────────────────────────────┐
│             User Action                │
│    (e.g., Log Welfare Check)           │
└───────────────────┬────────────────────┘
                    │
            Is Online?
           /          \
      [Yes]            [No]
        │                │
┌───────▼────────┐  ┌───▼────────────────────────┐
│ Post to Live   │  │ Store in Offline Mutation  │
│ Supabase DB    │  │ Queue (SQLite / IndexedDB) │
└───────┬────────┘  └───┬────────────────────────┘
        │                │
        │           Network Reconnects?
        │                │
        └────────────────▼
┌────────────────────────────────────────┐
│ Process Pending Queue in Chronological │
│ Order & Sync Audit Trail               │
└────────────────────────────────────────┘
```

1. When offline, submissions are assigned a temporary UUID and saved to the offline queue with a pending badge.
2. When the device reconnects (detected via `@capacitor/network`), a background sync service dispatches all queued records to Supabase using the existing `toDatabaseRow()` relational adapter.

---

## 7. iOS Project Setup & Directory Layout

```
sdtracker-ios/
├── ios/                          # Native Xcode Project
│   ├── App/
│   │   ├── App/
│   │   │   ├── Info.plist        # Permissions: Camera, Biometrics, APNs
│   │   │   ├── AppDelegate.swift # Push notification routing
│   │   │   └── Assets.xcassets   # App Icons & Splash Screens (Teal brand)
│   │   └── Podfile
│   └── capacitor.config.ts       # Capacitor Bridge Configuration
│
├── src/                          # Shared React/TypeScript Application
│   ├── components/
│   │   ├── mobile/               # Mobile-optimized Views
│   │   │   ├── MobileHeader.tsx  # Compact top bar with Property badge
│   │   │   ├── MobileTabBar.tsx  # Bottom 5-icon thumb navigation
│   │   │   ├── BottomSheet.tsx   # Native swipeable modal container
│   │   │   └── OfflineBanner.tsx # Connectivity status alert
│   │   ├── dashboard/            # Mobile Dashboard cards
│   │   ├── welfare/              # Swipeable room welfare checklist
│   │   ├── escalations/          # Photo incident reporting
│   │   ├── maintenance/          # Defect reporter with camera
│   │   └── food/                 # Fast temp steppers
│   ├── context/                  # AppContext with RBAC & site-locking
│   ├── lib/
│   │   ├── directSupabaseAdapter.ts # Direct Supabase cloud connection
│   │   ├── nativeCamera.ts       # Capacitor camera wrapper
│   │   ├── nativeBiometrics.ts   # Face ID authentication wrapper
│   │   └── offlineQueue.ts       # Local mutation queue & auto-sync
│   └── styles/
│       └── mobile.css            # Safe area insets & mobile touch styles
```

---

## 8. Step-by-Step Setup Guide

### Step 1: Install Dependencies
From the repository root, install Capacitor and the native plugins:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/camera @capacitor/haptics @capacitor/network @capacitor/preferences @capacitor/push-notifications
```

### Step 2: Initialize Capacitor
```bash
npx cap init "SD Operations" "uk.co.sdcdms.trackers" --web-dir dist
npx cap add ios
```

### Step 3: Configure Native iOS Permissions (`Info.plist`)
Add the required usage descriptions to `ios/App/App/Info.plist`:
```xml
<!-- Camera for Defect & Incident Photos -->
<key>NSCameraUsageDescription</key>
<string>SD Operations requires camera access to attach photo evidence to safeguarding incidents and property maintenance defects.</string>

<!-- Photo Library for Attaching Existing Receipts & Documents -->
<key>NSPhotoLibraryUsageDescription</key>
<string>SD Operations requires photo library access to upload certificates and delivery documentation.</string>

<!-- Face ID / Touch ID Authentication -->
<key>NSFaceIDUsageDescription</key>
<string>SD Operations requires Face ID to secure confidential resident records.</string>
```

### Step 4: Build & Sync
Whenever changes are made:
```bash
npm run build
npx cap sync ios
npx cap open ios
```
This opens Xcode where you can run the app on the iOS Simulator or deploy directly to a test iPhone via TestFlight.

---

## 9. Next Milestones for iOS Rollout

1. **Phase 1: Shell & Authentication**: Initialize Capacitor project, implement Biometric Face ID login, and connect directly to live Supabase with RBAC site locking.
2. **Phase 2: Core Field Trackers**: Implement mobile-optimized Welfare Room Checks, Safeguarding Incident Camera capture, and Maintenance defect reporting.
3. **Phase 3: Catering & Logistics**: Implement Hot Food temperature steppers and Laundry batch reconciliation.
4. **Phase 4: Offline Queue & APNs**: Finalize SQLite offline storage and configure Apple Push Notifications for high-priority incidents and change approvals.
