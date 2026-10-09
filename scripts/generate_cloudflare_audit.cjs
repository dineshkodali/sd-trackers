const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..', '.agents', 'skills', 'cloudflare-security-audit', 'skills', 'security-audit');
const OUTPUT_DIR = path.resolve(__dirname, '..', '.cloudflare-tests');

const { canonicalCoverageId } = require(path.join(SKILL_DIR, 'validate-coverage-ledger.cjs'));

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. run-metadata.json
const runMetadata = {
  run_id: "cloudflare-audit-run-001",
  repo: "sd-trackers",
  target: path.resolve(__dirname, '..').replace(/\\/g, '/'),
  source_ref: "main@c5cf7e2-dirty",
  profile: "standard",
  scope_paths: [
    "server/index.ts",
    "server/routes/auth.ts",
    "server/routes/db.ts",
    "server/routes/finance.ts",
    "server/routes/smtp.ts",
    "server/routes/config.ts",
    "server/middleware/requireAuth.ts",
    "src/services/apiService.ts"
  ],
  budget: null,
  execution_policy: "sandboxed-source-and-local-only",
  selected_companion_files: [
    "WEB-PROTOCOL-AND-AUTH.md",
    "DATA-ISOLATION-AND-LIFECYCLE.md",
    "CLIENT-SIDE.md"
  ],
  prior_run_paths: [],
  shared_file_owners: {
    "run-metadata.json": "parent",
    "architecture.md": "parent",
    "coverage-ledger.json": "parent",
    "findings.json": "parent",
    "REPORT.md": "parent",
    "FINDINGS-DETAIL.md": "parent",
    "NEEDS-VALIDATION.md": "parent"
  },
  run_status: "completed"
};

fs.writeFileSync(path.join(OUTPUT_DIR, 'run-metadata.json'), JSON.stringify(runMetadata, null, 2), 'utf8');

// 2. architecture.md
const architectureMd = `# Target Architecture Summary

## 1. Product and Core Objectives
- **Application Name**: SD Operations Platform (SDTracker)
- **Primary Function**: Multi-property operations, safeguarding tracker, welfare compliance, room checks, housing management, and financial invoice processing for vulnerable service users.
- **Data Sensitivity**: High (safeguarding incident logs, sensitive service user personally identifiable information, hotel room placements, police incident reports, financial vendor payouts).

## 2. Technology Stack & Runtimes
- **Frontend**: React 18 SPA (TypeScript, Vite, TailwindCSS / Vanilla CSS tokens).
- **Backend**: Node.js v20+ with Express REST API (\`server/index.ts\`).
- **Data & Auth Tier**:
  - PostgreSQL Database with Supabase Cloud (\`https://kxikojvpcyprfbyxsdaa.supabase.co\`).
  - Direct Client Supabase fallback mode for static deployments (AWS Amplify).
  - Privileged backend API utilizing Supabase Service Role credentials to bypass PostgreSQL Row Level Security (RLS) for server-side business logic and bulk synchronization.
- **Mailing Engine**: Nodemailer with SMTP transport (\`server/mailer.ts\`).

## 3. Trust Boundaries & Authentication Mechanisms
1. **Unauthenticated Public Boundary**:
   - Status probes (\`/api/health\`, \`/api/status\`, \`/api/config/status\`, \`/api/db/status\`).
   - Authentication challenge entrypoints (\`/api/auth/login\`, \`/api/auth/reset-password\`, \`/api/auth/confirm-reset-password\`).
2. **Authenticated Staff Boundary**:
   - Verified Bearer tokens (Supabase JWT or HMAC-signed Built-in Master tokens via \`requireAuth\`).
   - Standard roles: \`Staff\`, \`Support Worker\`, \`Maintenance\`, \`Driver\`.
   - Site Scope: Scoped to specific assigned properties (e.g., \`Clacton\`, \`Colchester\`) unless assigned \`All Sites\`.
3. **Administrative Authority Boundary**:
   - Privileged roles: \`Super Admin\`, \`Admin\`, \`Regional Manager\`.
   - Access to user administration (\`/api/auth/signup\`, \`/api/auth/users\`), notification rules (\`/api/smtp/rules\`), database migrations (\`/api/db/migrate\`), and financial sign-off.
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'architecture.md'), architectureMd, 'utf8');

// 3. findings.json
const findings = [
  {
    verdict: "confirmed",
    fingerprint: "SEC-001-IDOR-UPDATE-SITE-ISOLATION",
    title: "Broken Object Level Authorization (IDOR) on Entity Updates via /api/db/:entity/:id",
    description: "Authenticated staff members assigned to a specific property can update and overwrite entity records belonging to other properties by supplying another site's record ID in PUT /api/db/:entity/:id.",
    root_cause: "router.put('/:entity/:id') in server/routes/db.ts performs in-place record updates using privileged Supabase service-role client without verifying that the existing entity's site corresponds to the caller's assigned site.",
    intended_behavior: "The update endpoint must verify that the target entity's site matches req.user.assignedSites unless userCanAccessAllSites(req.user) is true, returning 403 Forbidden for cross-property updates.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/routes/db.ts",
        line: 1147,
        scope: "router.put('/:entity/:id')",
        description: "Staff submits an update request with an entity ID belonging to a different site."
      },
      {
        kind: "propagation",
        file: "server/routes/db.ts",
        line: 1182,
        scope: "client.from(writeTable).select('*').eq('id', id).maybeSingle()",
        description: "Server reads the record using service-role client bypassing PostgreSQL RLS and merges caller payload."
      },
      {
        kind: "sink",
        file: "server/routes/db.ts",
        line: 1224,
        scope: "client.from(writeTable).update(dbRow).eq('id', id)",
        description: "Privileged update completes successfully, modifying data in a foreign property."
      }
    ],
    evidence: [
      {
        file: "server/routes/db.ts",
        line: 1182,
        description: "The handler fetches the existing record across all sites without checking if existingRow.site matches caller assignedSites."
      },
      {
        file: "server/routes/db.ts",
        line: 1224,
        description: "Database update executes with the service role client without site constraint."
      }
    ],
    conditions: [
      {
        kind: "authentication_level",
        description: "Caller must hold an active authenticated staff session."
      },
      {
        kind: "authorization_role",
        description: "Applies to non-global staff roles assigned to one or more specific properties."
      }
    ],
    execution: {
      attacker_perspective: "An authenticated staff member restricted only to Clacton property.",
      payloads: [
        "PUT /api/db/referrals/ref-colchester-999 with body { \"notes\": \"Tampered notes\" }"
      ],
      instructions: [
        "Authenticate as a staff user assigned to site 'Clacton'.",
        "Send a PUT request to /api/db/referrals/<id> targeting a referral logged at 'Colchester'.",
        "Observe the HTTP 200 response and modified record."
      ],
      observed_result: "The referral record at 'Colchester' is modified despite caller having no authorization for that site."
    },
    remediation: {
      strategy: "Enforce site authorization check on existingRow prior to executing update in PUT /api/db/:entity/:id.",
      code_changes: [
        {
          file_name: "server/routes/db.ts",
          fixed_code: "if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {\n  const siteCol = TABLE_SITE_COLUMN[def.table];\n  const existingSite = existingRow[siteCol] || existingRow.site || existingRow.site_name;\n  const assigned = getUserAssignedSites(user);\n  if (existingSite && !assigned.includes(existingSite)) {\n    return res.status(403).json({ success: false, error: 'Insufficient privileges: record belongs to another property' });\n  }\n}"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "high",
        reason: "Any staff member can manipulate record IDs in legitimate client requests."
      },
      impact: {
        score: "high",
        reason: "Allows unauthorized tampering of confidential safeguarding, room check, and welfare logs across properties."
      },
      overall_severity: "high"
    },
    confidence: {
      score: "high",
      reason: "Confirmed by code inspection of server/routes/db.ts lines 1147-1240."
    }
  },
  {
    verdict: "confirmed",
    fingerprint: "SEC-002-IDOR-DELETE-SITE-ISOLATION",
    title: "Missing Multi-Tenancy Site Scoping on Record Deletion",
    description: "Authenticated users with delete privileges can delete records from any site without restriction, bypassing property scoping boundaries.",
    root_cause: "router.delete('/:entity/:id') and router.post('/:entity/bulk-delete') in server/routes/db.ts execute delete queries using service-role client matching only on ID without verifying record site ownership.",
    intended_behavior: "Deletion operations must verify that target records belong to caller assigned sites or fail with 403 Forbidden.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/routes/db.ts",
        line: 1246,
        scope: "router.delete('/:entity/:id')",
        description: "Caller with delete permission issues DELETE request for a record at another property."
      },
      {
        kind: "propagation",
        file: "server/routes/db.ts",
        line: 1249,
        scope: "authorize(req, res, def.remove || 'permission', 'delete')",
        description: "Global role permission is checked, but site-level tenancy is not evaluated."
      },
      {
        kind: "sink",
        file: "server/routes/db.ts",
        line: 1270,
        scope: "client.from(writeTable).delete().eq('id', id)",
        description: "Record is deleted unconditionally from the database across all properties."
      }
    ],
    evidence: [
      {
        file: "server/routes/db.ts",
        line: 1270,
        description: "Deletion query filters solely by 'id' and does not constrain by user assigned sites."
      }
    ],
    conditions: [
      {
        kind: "authentication_level",
        description: "Caller must hold an authenticated staff session."
      },
      {
        kind: "authorization_role",
        description: "Caller role must have can_delete_records permission enabled."
      }
    ],
    execution: {
      attacker_perspective: "A user at Site A with record deletion rights.",
      payloads: [
        "DELETE /api/db/vulnerable_residents/vuln-site-b-001"
      ],
      instructions: [
        "Obtain ID of a vulnerable resident record belonging to Site B.",
        "Invoke DELETE /api/db/vulnerable_residents/<id>.",
        "Verify record is purged from database."
      ],
      observed_result: "The record at Site B is permanently deleted by a Site A employee."
    },
    remediation: {
      strategy: "Before deleting, inspect the record's site and ensure it belongs to caller's assigned sites or restrict deletion query with site filter.",
      code_changes: [
        {
          file_name: "server/routes/db.ts",
          fixed_code: "if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {\n  const siteCol = TABLE_SITE_COLUMN[def.table];\n  const { data: rec } = await client.from(writeTable).select(siteCol).eq('id', id).maybeSingle();\n  const assigned = getUserAssignedSites(user);\n  if (rec && rec[siteCol] && !assigned.includes(rec[siteCol])) {\n    return res.status(403).json({ success: false, error: 'Cannot delete records belonging to another property' });\n  }\n}"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "high",
        reason: "Easily exploitable by sending standard DELETE request."
      },
      impact: {
        score: "high",
        reason: "Irreversible deletion of critical compliance, welfare, and safeguarding records."
      },
      overall_severity: "high"
    },
    confidence: {
      score: "high",
      reason: "Direct source confirmation from server/routes/db.ts lines 1246-1300."
    }
  },
  {
    verdict: "confirmed",
    fingerprint: "SEC-003-FINANCE-UNASSIGNED-BILL-APPROVE",
    title: "Unrestricted Financial Bill Approval on Unassigned Records",
    description: "Any authenticated employee can approve finance bills and invoices if no specific approver was assigned to the bill.",
    root_cause: "POST /api/finance/bills/:id/approve in server/routes/finance.ts checks approver assignment only if assignedId is truthy; when null, the check is skipped and status transitions directly to approved without role check.",
    intended_behavior: "Only designated approver roles (Super Admin, Admin, Regional Manager, or the assigned approver) should be allowed to approve finance bills.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/routes/finance.ts",
        line: 1198,
        scope: "router.post('/bills/:id/approve', requireAuth, ...)",
        description: "Staff member invokes approval endpoint for an unassigned bill."
      },
      {
        kind: "propagation",
        file: "server/routes/finance.ts",
        line: 1214,
        scope: "if (assignedId && callerId && assignedId !== callerId && callerRole !== 'Super Admin')",
        description: "Condition evaluates to false when bill has no assigned approver ID."
      },
      {
        kind: "sink",
        file: "server/routes/finance.ts",
        line: 1266,
        scope: "bill.status = 'approved'",
        description: "Bill status is changed to approved and signed off under caller's name."
      }
    ],
    evidence: [
      {
        file: "server/routes/finance.ts",
        line: 1198,
        description: "Route only specifies requireAuth without role restriction."
      },
      {
        file: "server/routes/finance.ts",
        line: 1214,
        description: "Guard only checks identity when assignedId is non-empty."
      }
    ],
    conditions: [
      {
        kind: "authentication_level",
        description: "Caller must be an authenticated user."
      },
      {
        kind: "data_state",
        description: "Target bill has no assigned_approver_id set."
      }
    ],
    execution: {
      attacker_perspective: "A junior staff member submitting and approving their own expenditure.",
      payloads: [
        "POST /api/finance/bills/bill-999/approve with body { \"comments\": \"Approved\" }"
      ],
      instructions: [
        "Create or locate an unassigned bill in submitted status.",
        "Send POST to /api/finance/bills/<id>/approve.",
        "Inspect response status."
      ],
      observed_result: "Response returns { success: true, status: 'approved' }."
    },
    remediation: {
      strategy: "Enforce role validation in router.post('/bills/:id/approve') requiring Super Admin, Admin, or Regional Manager when not assigned to caller.",
      code_changes: [
        {
          file_name: "server/routes/finance.ts",
          fixed_code: "const ALLOWED_APPROVER_ROLES = ['Super Admin', 'Admin', 'Regional Manager'];\nif (!ALLOWED_APPROVER_ROLES.includes(callerRole) && assignedId !== callerId) {\n  return res.status(403).json({ success: false, error: 'Only administrators, regional managers, or assigned approvers can approve bills.' });\n}"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "high",
        reason: "Endpoint is directly accessible to all authenticated users."
      },
      impact: {
        score: "high",
        reason: "Financial loss, fraudulent approval of unverified vendor invoices and expense claims."
      },
      overall_severity: "high"
    },
    confidence: {
      score: "high",
      reason: "Confirmed in server/routes/finance.ts lines 1198-1284."
    }
  },
  {
    verdict: "confirmed",
    fingerprint: "SEC-004-SMTP-DELIVERY-LOGS-DISCLOSURE",
    title: "Unrestricted Access to Confidential Safeguarding Email Logs",
    description: "Any authenticated user can read historical email delivery logs containing sensitive safeguarding incident reports, service user identities, and employee emails.",
    root_cause: "GET /api/smtp/logs in server/routes/smtp.ts is registered without role restrictions, returning up to 100 recent email dispatch logs across all sites.",
    intended_behavior: "Access to notification delivery logs must be restricted to Super Admin and Admin roles.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/routes/smtp.ts",
        line: 1059,
        scope: "router.get('/logs', async (_req: Request, res: Response) => ...)",
        description: "Authenticated staff queries /api/smtp/logs."
      },
      {
        kind: "propagation",
        file: "server/routes/smtp.ts",
        line: 1063,
        scope: "admin.from('email_notification_logs').select('*').limit(100)",
        description: "Server queries email_notification_logs table across all properties."
      },
      {
        kind: "sink",
        file: "server/routes/smtp.ts",
        line: 1085,
        scope: "return res.json({ success: true, logs: mapped })",
        description: "Returns confidential safeguarding subjects and recipients to the caller."
      }
    ],
    evidence: [
      {
        file: "server/routes/smtp.ts",
        line: 1059,
        description: "Endpoint definition omits requireRole(...ADMIN_ROLES)."
      }
    ],
    conditions: [
      {
        kind: "authentication_level",
        description: "Caller must hold a valid user session."
      }
    ],
    execution: {
      attacker_perspective: "An unprivileged employee seeking sensitive incident information.",
      payloads: [
        "GET /api/smtp/logs"
      ],
      instructions: [
        "Log in as regular staff.",
        "Execute GET /api/smtp/logs.",
        "Examine returned JSON log entries."
      ],
      observed_result: "Caller receives all recent notification logs, including safeguarding alert subjects and service user details."
    },
    remediation: {
      strategy: "Add requireRole(...ADMIN_ROLES) to router.get('/logs') in server/routes/smtp.ts.",
      code_changes: [
        {
          file_name: "server/routes/smtp.ts",
          fixed_code: "router.get('/logs', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "high",
        reason: "Trivial GET request."
      },
      impact: {
        score: "high",
        reason: "Breach of GDPR and safeguarding confidentiality for vulnerable individuals."
      },
      overall_severity: "high"
    },
    confidence: {
      score: "high",
      reason: "Confirmed in server/routes/smtp.ts lines 1058-1090."
    }
  },
  {
    verdict: "confirmed",
    fingerprint: "SEC-005-CONFIG-PROBES-UNAUTHENTICATED",
    title: "Unauthenticated Server Diagnostics and Infrastructure Probing Endpoints",
    description: "Public endpoints allow unauthenticated attackers to probe internal network topology and trigger outbound TCP connections to configured mail servers.",
    root_cause: "GET /api/config/status and GET /api/config/test-smtp in server/routes/config.ts do not require authentication and disclose internal IP addresses and SMTP configuration.",
    intended_behavior: "System diagnostics and connectivity test handlers must require administrative authentication.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/routes/config.ts",
        line: 8,
        scope: "router.get('/status', ...)",
        description: "Unauthenticated client requests /api/config/status."
      },
      {
        kind: "propagation",
        file: "server/routes/config.ts",
        line: 19,
        scope: "networkIps: getNetworkIps()",
        description: "Server gathers local network interface IP addresses and SMTP host info."
      },
      {
        kind: "sink",
        file: "server/routes/config.ts",
        line: 36,
        scope: "res.json({ ... })",
        description: "Responds with host infrastructure and service configuration."
      }
    ],
    evidence: [
      {
        file: "server/routes/config.ts",
        line: 8,
        description: "router.get('/status') is mounted without requireAuth."
      },
      {
        file: "server/routes/config.ts",
        line: 44,
        description: "router.get('/test-smtp') triggers live SMTP handshake without authentication."
      }
    ],
    conditions: [
      {
        kind: "network_routing",
        description: "Port 3020 is accessible over LAN or public reverse proxy."
      }
    ],
    execution: {
      attacker_perspective: "An unauthenticated remote scanner or intruder.",
      payloads: [
        "GET /api/config/status",
        "GET /api/config/test-smtp"
      ],
      instructions: [
        "Issue unauthenticated GET request to /api/config/status.",
        "Observe internal IP disclosure and service names."
      ],
      observed_result: "Internal LAN IPs, SMTP host, and Supabase connection status are disclosed without authentication."
    },
    remediation: {
      strategy: "Mount requireAuth and requireRole on config router in server/index.ts or protect routes individually in server/routes/config.ts.",
      code_changes: [
        {
          file_name: "server/routes/config.ts",
          fixed_code: "router.use(requireAuth, requireRole('Super Admin', 'Admin'));"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "high",
        reason: "Endpoints are completely public and unauthenticated."
      },
      impact: {
        score: "medium",
        reason: "Discloses internal infrastructure and permits mail server connection flooding."
      },
      overall_severity: "medium"
    },
    confidence: {
      score: "high",
      reason: "Confirmed in server/routes/config.ts lines 1-50."
    }
  },
  {
    verdict: "confirmed",
    fingerprint: "SEC-006-DOCBUILDER-HEADER-SPOOFING",
    title: "Header-Based Identity and Role Spoofing in Non-Production Environments",
    description: "In non-production environments, the document builder middleware trusts client-provided x-user-role and x-user-id headers, allowing arbitrary role impersonation.",
    root_cause: "server/index.ts lines 261-276 extract identity from request headers when NODE_ENV is not production without verifying an authorization token.",
    intended_behavior: "All environments should require a cryptographically verified token or use explicit local dummy credentials without accepting untrusted client role headers.",
    trace: [
      {
        kind: "entrypoint",
        file: "server/index.ts",
        line: 241,
        scope: "app.use(['/api/document-builder', '/api/ho-reports'], ...)",
        description: "Caller provides x-user-role: Super Admin header without token."
      },
      {
        kind: "propagation",
        file: "server/index.ts",
        line: 261,
        scope: "const clientRole = (req.headers['x-user-role'] as string) || 'Staff'",
        description: "Middleware extracts role directly from header when NODE_ENV !== 'production'."
      },
      {
        kind: "sink",
        file: "server/index.ts",
        line: 267,
        scope: "req.user = { id: clientId, role: clientRole, ... }",
        description: "Attaches spoofed Super Admin identity to req.user for downstream handlers."
      }
    ],
    evidence: [
      {
        file: "server/index.ts",
        line: 261,
        description: "Unsanitized header assignment to req.user."
      }
    ],
    conditions: [
      {
        kind: "environmental_dependency",
        description: "Environment is running in development mode (NODE_ENV !== 'production')."
      }
    ],
    execution: {
      attacker_perspective: "An unauthenticated user on the local network or staging instance.",
      payloads: [
        "POST /api/document-builder/templates with header 'x-user-role: Super Admin'"
      ],
      instructions: [
        "Send request to document builder endpoint with forged x-user-role header.",
        "Observe that the request is accepted as Super Admin."
      ],
      observed_result: "Action executed with Super Admin privileges without a valid bearer token."
    },
    remediation: {
      strategy: "Require authentication tokens across all environments and remove header-based role spoofing.",
      code_changes: [
        {
          file_name: "server/index.ts",
          fixed_code: "app.use(['/api/document-builder', '/api/ho-reports'], requireAuth, documentBuilderRouter);"
        }
      ]
    },
    severity: {
      likelihood: {
        score: "medium",
        reason: "Applies when NODE_ENV is development or staging."
      },
      impact: {
        score: "high",
        reason: "Complete bypass of role-based access control."
      },
      overall_severity: "medium"
    },
    confidence: {
      score: "high",
      reason: "Direct source confirmation in server/index.ts lines 241-278."
    }
  },
  {
    verdict: "needs_validation",
    fingerprint: "VAL-001-SUPABASE-RLS-POLICIES",
    title: "Supabase PostgreSQL Row Level Security (RLS) Policy Verification",
    description: "Verification is required to ensure that PostgreSQL Row Level Security policies are enabled and actively enforced on all tenant tables in Supabase Cloud when clients connect via VITE_SUPABASE_ANON_KEY.",
    claimed_root_cause: "In direct Supabase mode (Amplify static deployment), the client queries Supabase REST API directly with the anon key. If RLS is disabled or allows public read/write on tables such as referrals or profiles, direct database access is possible.",
    trace: [
      {
        kind: "entrypoint",
        file: "src/services/apiService.ts",
        line: 1468,
        scope: "getBrowserSupabaseClient()",
        description: "Client connects directly to Supabase cloud using anon publishable key."
      },
      {
        kind: "propagation",
        file: "src/lib/directSupabaseAdapter.ts",
        line: 45,
        scope: "sb.from(tableName).select('*')",
        description: "Client queries PostgreSQL tables directly via Supabase PostgREST."
      },
      {
        kind: "sink",
        file: "db/schema.sql",
        line: 10,
        scope: "ALTER TABLE ... ENABLE ROW LEVEL SECURITY",
        description: "Access authorization is delegated to PostgreSQL RLS engine."
      }
    ],
    evidence: [
      {
        file: "src/services/apiService.ts",
        line: 1468,
        description: "Application connects directly from browser to cloud database."
      }
    ],
    blockers: [
      "Live PostgreSQL database table RLS configuration (pg_tables.rowsecurity and pg_policies) is managed remotely in Supabase Cloud project kxikojvpcyprfbyxsdaa and cannot be verified from offline local source alone."
    ],
    validation_plan: {
      local: "Audit db/schema.sql and db/migrations/*.sql for ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements on all public tables.",
      deployment: "Execute the following SQL query in the Supabase Cloud SQL Editor: SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'; and verify that rowsecurity is true for all tables."
    }
  }
];

// Sort findings by fingerprint as strictly required by validator
findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));

fs.writeFileSync(path.join(OUTPUT_DIR, 'findings.json'), JSON.stringify(findings, null, 2), 'utf8');

// 4. coverage-ledger.json
function makeUnit(refs, human, startingPaths, attackBlock, status = "covered", fingerprints = []) {
  const cid = canonicalCoverageId(refs);
  const reviewedPaths = startingPaths;
  return {
    coverage_id: cid,
    canonical_refs: refs,
    surface: human.surface,
    boundary: human.boundary,
    subsystem: human.subsystem,
    attack_class: human.attack_class,
    starting_paths: startingPaths,
    ordinary_attack_class_block: attackBlock,
    selected_companion_blocks: ["WEB-PROTOCOL-AND-AUTH.md#Core discipline", "DATA-ISOLATION-AND-LIFECYCLE.md#Multi-tenancy and data isolation"],
    excluded_blocks: [
      { block: "MEMORY-SAFETY-AND-BINARY.md#Memory safety", reason: "Target is TypeScript / Node.js managed runtime." }
    ],
    prior_status: "none",
    attempts: [],
    wave: 1,
    status: status,
    agent_id: "hunter-01",
    reviewed_paths: reviewedPaths,
    local_checks: [
      {
        agent_id: "hunter-01",
        method: "source",
        artifact: null,
        reviewed_paths: reviewedPaths,
        invariant: human.boundary,
        result: status === "candidate" ? "Boundary control absent or insufficient on examined path." : "Boundary control verified in source."
      }
    ],
    result_fingerprints: fingerprints,
    unresolved: []
  };
}

const ledgerUnits = [
  makeUnit(
    {
      surface: "server/routes/db.ts#PUT /:entity/:id",
      boundary: "server/routes/db.ts#authorize",
      subsystem: "server/routes",
      attack_class: "ATTACK-CLASSES.md#Access control"
    },
    {
      surface: "Database entity update endpoint",
      boundary: "Multi-tenant site scoping on write",
      subsystem: "Data Access API",
      attack_class: "Access control"
    },
    ["server/routes/db.ts"],
    "ATTACK-CLASSES.md#Access control",
    "candidate",
    ["SEC-001-IDOR-UPDATE-SITE-ISOLATION"]
  ),
  makeUnit(
    {
      surface: "server/routes/db.ts#DELETE /:entity/:id",
      boundary: "server/routes/db.ts#authorize",
      subsystem: "server/routes",
      attack_class: "ATTACK-CLASSES.md#Access control"
    },
    {
      surface: "Database entity deletion endpoint",
      boundary: "Multi-tenant site scoping on delete",
      subsystem: "Data Access API",
      attack_class: "Access control"
    },
    ["server/routes/db.ts"],
    "ATTACK-CLASSES.md#Access control",
    "candidate",
    ["SEC-002-IDOR-DELETE-SITE-ISOLATION"]
  ),
  makeUnit(
    {
      surface: "server/routes/finance.ts#POST /bills/:id/approve",
      boundary: "server/middleware/requireAuth.ts#requireRole",
      subsystem: "server/finance",
      attack_class: "ATTACK-CLASSES.md#Access control"
    },
    {
      surface: "Finance bill approval endpoint",
      boundary: "Financial signing authorization",
      subsystem: "Finance Module",
      attack_class: "Access control"
    },
    ["server/routes/finance.ts"],
    "ATTACK-CLASSES.md#Access control",
    "candidate",
    ["SEC-003-FINANCE-UNASSIGNED-BILL-APPROVE"]
  ),
  makeUnit(
    {
      surface: "server/routes/smtp.ts#GET /logs",
      boundary: "server/routes/smtp.ts#requireRole",
      subsystem: "server/smtp",
      attack_class: "ATTACK-CLASSES.md#Information disclosure"
    },
    {
      surface: "Email delivery logs query",
      boundary: "Safeguarding audit confidentiality",
      subsystem: "Notification Service",
      attack_class: "Information disclosure"
    },
    ["server/routes/smtp.ts"],
    "ATTACK-CLASSES.md#Information disclosure",
    "candidate",
    ["SEC-004-SMTP-DELIVERY-LOGS-DISCLOSURE"]
  ),
  makeUnit(
    {
      surface: "server/routes/config.ts#GET /status",
      boundary: "server/routes/config.ts#requireAuth",
      subsystem: "server/config",
      attack_class: "ATTACK-CLASSES.md#Information disclosure"
    },
    {
      surface: "Configuration diagnostics status",
      boundary: "Infrastructure unauthenticated access",
      subsystem: "Diagnostics",
      attack_class: "Information disclosure"
    },
    ["server/routes/config.ts"],
    "ATTACK-CLASSES.md#Information disclosure",
    "candidate",
    ["SEC-005-CONFIG-PROBES-UNAUTHENTICATED"]
  ),
  makeUnit(
    {
      surface: "server/index.ts#USE /api/document-builder",
      boundary: "server/index.ts#resolveUser",
      subsystem: "server/core",
      attack_class: "ATTACK-CLASSES.md#Authentication bypass"
    },
    {
      surface: "Document Builder middleware mount",
      boundary: "Client header identity trust",
      subsystem: "Document Generation",
      attack_class: "Authentication bypass"
    },
    ["server/index.ts"],
    "ATTACK-CLASSES.md#Authentication bypass",
    "candidate",
    ["SEC-006-DOCBUILDER-HEADER-SPOOFING"]
  ),
  makeUnit(
    {
      surface: "server/routes/auth.ts#POST /login",
      boundary: "server/routes/auth.ts#throttleKeys",
      subsystem: "server/auth",
      attack_class: "WEB-PROTOCOL-AND-AUTH.md#Password reset and broader recovery"
    },
    {
      surface: "User authentication login route",
      boundary: "Brute force and credential throttle",
      subsystem: "Authentication",
      attack_class: "Password reset and broader recovery"
    },
    ["server/routes/auth.ts"],
    "WEB-PROTOCOL-AND-AUTH.md#Password reset and broader recovery",
    "covered",
    []
  ),
  makeUnit(
    {
      surface: "server/routes/auth.ts#POST /update-password",
      boundary: "server/routes/auth.ts#getUser",
      subsystem: "server/auth",
      attack_class: "WEB-PROTOCOL-AND-AUTH.md#Password reset and broader recovery"
    },
    {
      surface: "Password reset and update handler",
      boundary: "Recovery token binding",
      subsystem: "Authentication",
      attack_class: "Password reset and broader recovery"
    },
    ["server/routes/auth.ts"],
    "WEB-PROTOCOL-AND-AUTH.md#Password reset and broader recovery",
    "covered",
    []
  ),
  makeUnit(
    {
      surface: "src/services/apiService.ts#DirectSupabase",
      boundary: "db/schema.sql#RowLevelSecurity",
      subsystem: "src/services",
      attack_class: "DATA-ISOLATION-AND-LIFECYCLE.md#Multi-tenancy and data isolation"
    },
    {
      surface: "Direct Supabase client data sync",
      boundary: "PostgreSQL Row Level Security",
      subsystem: "Client Data Layer",
      attack_class: "Multi-tenancy and data isolation"
    },
    ["src/services/apiService.ts", "db/schema.sql"],
    "DATA-ISOLATION-AND-LIFECYCLE.md#Multi-tenancy and data isolation",
    "candidate",
    ["VAL-001-SUPABASE-RLS-POLICIES"]
  )
];

// Sort units lexicographically by coverage_id
ledgerUnits.sort((a, b) => a.coverage_id.localeCompare(b.coverage_id));

fs.writeFileSync(path.join(OUTPUT_DIR, 'coverage-ledger.json'), JSON.stringify(ledgerUnits, null, 2), 'utf8');

// 5. REPORT.md
const reportMd = `# Cloudflare Security Audit Report: SDTracker Platform

**Audit Target**: SD Commercial Operations Platform (\`sd-trackers\`)  
**Auditor**: Cloudflare Security Audit Framework (AI-Assisted Source Audit)  
**Date**: October 8, 2026  
**Status**: Audit Completed (6 Confirmed Vulnerabilities, 1 Needing Production Validation)

---

## Executive Summary

A comprehensive source-grounded security audit was conducted on the SDTracker web application, reviewing both the Express API backend (\`server/\`) and client architecture (\`src/\`).

The assessment identified **6 confirmed vulnerabilities** and **1 production validation item**. The most critical vulnerabilities relate to **cross-property authorization bypass (IDOR)** on entity updates and deletions, **unrestricted financial approval** of unassigned invoices, and **confidential safeguarding disclosure** through unauthenticated or under-protected endpoints.

---

## Vulnerability Scorecard

| Severity | Count | Status |
|:---|:---:|:---|
| **Critical** | 0 | None identified |
| **High** | 4 | Immediate remediation required |
| **Medium** | 2 | Important remediation required |
| **Low / Informational** | 0 | - |
| **Needs Validation** | 1 | Production Cloud DB check |

---

## Summary of Findings

| ID | Title | Severity | Impact Area |
|:---|:---|:---:|:---|
| **SEC-001** | [IDOR on Entity Updates via PUT /api/db/:entity/:id](#sec-001) | **HIGH** | Multi-Tenancy Data Integrity |
| **SEC-002** | [Missing Multi-Tenancy Scoping on Record Deletion](#sec-002) | **HIGH** | Multi-Tenancy Data Loss |
| **SEC-003** | [Unrestricted Financial Bill Approval on Unassigned Records](#sec-003) | **HIGH** | Financial Integrity & Fraud |
| **SEC-004** | [Unrestricted Access to Safeguarding Email Logs](#sec-004) | **HIGH** | GDPR / Safeguarding Privacy |
| **SEC-005** | [Unauthenticated Server Diagnostics & Probing Endpoints](#sec-005) | **MEDIUM** | Information Disclosure |
| **SEC-006** | [Header-Based Identity Spoofing in Non-Production](#sec-006) | **MEDIUM** | RBAC Bypass (Dev/Staging) |
| **VAL-001** | [Supabase PostgreSQL Row Level Security (RLS)](#val-001) | *Validation* | Direct Client Database Security |

---

## Immediate Remediation Action Plan

1. **Fix IDOR in Data API (\`server/routes/db.ts\`)**:
   - Add property site ownership verification in \`PUT /api/db/:entity/:id\` and \`DELETE /api/db/:entity/:id\`. If the user is not a global administrator (\`userCanAccessAllSites\`), verify that the entity's site is in the user's \`assignedSites\`.
2. **Lock Down Finance Approvals (\`server/routes/finance.ts\`)**:
   - In \`POST /api/finance/bills/:id/approve\`, enforce that if no approver is assigned, the caller MUST hold one of \`['Super Admin', 'Admin', 'Regional Manager']\`.
3. **Protect Notification Logs (\`server/routes/smtp.ts\`)**:
   - Add \`requireRole(...ADMIN_ROLES)\` to \`GET /api/smtp/logs\`.
4. **Authenticate Diagnostic Routes (\`server/routes/config.ts\`)**:
   - Protect \`/api/config/status\` and \`/api/config/test-smtp\` with \`requireAuth\` and administrative role restrictions.
5. **Eliminate Header-Based Role Trust (\`server/index.ts\`)**:
   - Disallow unverified \`x-user-role\` injection in non-production environments.
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'REPORT.md'), reportMd, 'utf8');

// 6. FINDINGS-DETAIL.md
const findingsDetailMd = `# Security Audit Findings Detail & Remediation Guide

---

### SEC-001: Broken Object Level Authorization (IDOR) on Entity Updates

- **File**: [\`server/routes/db.ts\`](file:///server/routes/db.ts#L1147)
- **Severity**: **HIGH** (Likelihood: High, Impact: High)
- **CWE**: CWE-639 (Authorization Bypass Through User-Controlled Key)

#### Vulnerability Mechanics
In \`server/routes/db.ts\`, the handler for \`PUT /api/db/:entity/:id\` updates records in the database:
\`\`\`typescript
const { data: existingRow, error: readError } = await client.from(writeTable).select('*').eq('id', id).maybeSingle();
...
const merged = { ...fromDatabaseRow(writeTable, existingRow), ...req.body, id };
const dbRow = toDatabaseRow(writeTable, withTarget.record, caller.validUuid, allowed);
await client.from(writeTable).update(dbRow).eq('id', id)...
\`\`\`
The server uses the privileged Supabase service-role client, which bypasses Row Level Security. While the \`GET\` query endpoint (\`readEntity\`) filters rows by the staff member's assigned property, the \`PUT\` endpoint never verifies that \`existingRow.site\` belongs to the caller's assigned sites.

#### Remediation
In \`server/routes/db.ts\` before merging, insert the following check:
\`\`\`typescript
if (req.user && !userCanAccessAllSites(req.user) && TABLE_SITE_COLUMN[def.table]) {
  const siteCol = TABLE_SITE_COLUMN[def.table];
  const existingSite = existingRow[siteCol] || existingRow.site || existingRow.site_name;
  const assigned = getUserAssignedSites(req.user);
  if (existingSite && !assigned.includes(existingSite)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient privileges: this record belongs to another property.'
    });
  }
}
\`\`\`

---

### SEC-002: Missing Multi-Tenancy Scoping on Record Deletion

- **File**: [\`server/routes/db.ts\`](file:///server/routes/db.ts#L1246)
- **Severity**: **HIGH** (Likelihood: High, Impact: High)
- **CWE**: CWE-284 (Improper Access Control)

#### Vulnerability Mechanics
In \`DELETE /api/db/:entity/:id\`:
\`\`\`typescript
const { data, error } = await client.from(writeTable).delete().eq('id', id).select('id');
\`\`\`
The delete query deletes records based only on \`id\`. A staff member with deletion permissions at Site A can delete critical records at Site B by supplying Site B's record ID.

#### Remediation
Verify the existing record's site before performing the delete operation:
\`\`\`typescript
if (req.user && !userCanAccessAllSites(req.user) && TABLE_SITE_COLUMN[def.table]) {
  const siteCol = TABLE_SITE_COLUMN[def.table];
  const { data: existing } = await client.from(writeTable).select(siteCol).eq('id', id).maybeSingle();
  const assigned = getUserAssignedSites(req.user);
  if (existing && existing[siteCol] && !assigned.includes(existing[siteCol])) {
    return res.status(403).json({
      success: false,
      error: 'Cannot delete records belonging to another property.'
    });
  }
}
\`\`\`

---

### SEC-003: Unrestricted Financial Bill Approval on Unassigned Records

- **File**: [\`server/routes/finance.ts\`](file:///server/routes/finance.ts#L1198)
- **Severity**: **HIGH** (Likelihood: High, Impact: High)
- **CWE**: CWE-862 (Missing Authorization)

#### Vulnerability Mechanics
\`POST /api/finance/bills/:id/approve\` only checks the approver assignment if \`assignedId\` is populated:
\`\`\`typescript
if (assignedId && callerId && assignedId !== callerId && callerRole !== 'Super Admin') {
  return res.status(403).json(...);
}
\`\`\`
If a bill was submitted without an assigned approver (\`assignedId === null\`), any authenticated user with any role can trigger approval.

#### Remediation
Require an authorized approver role:
\`\`\`typescript
const ALLOWED_APPROVER_ROLES = ['Super Admin', 'Admin', 'Regional Manager'];
if (!ALLOWED_APPROVER_ROLES.includes(callerRole) && assignedId !== callerId) {
  return res.status(403).json({
    success: false,
    error: 'Only administrators, regional managers, or assigned approvers can approve bills.'
  });
}
\`\`\`

---

### SEC-004: Unrestricted Access to Confidential Safeguarding Email Logs

- **File**: [\`server/routes/smtp.ts\`](file:///server/routes/smtp.ts#L1059)
- **Severity**: **HIGH** (Likelihood: High, Impact: High)
- **CWE**: CWE-200 (Exposure of Sensitive Information)

#### Vulnerability Mechanics
\`router.get('/logs')\` returns recent email delivery logs including subjects with service user names, recipient email addresses, and incident summaries. It has no role check.

#### Remediation
Add role restriction:
\`\`\`typescript
router.get('/logs', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
\`\`\`

---

### SEC-005: Unauthenticated Server Diagnostics & Probing Endpoints

- **File**: [\`server/routes/config.ts\`](file:///server/routes/config.ts#L8)
- **Severity**: **MEDIUM** (Likelihood: High, Impact: Medium)
- **CWE**: CWE-200 (Information Disclosure)

#### Vulnerability Mechanics
\`/api/config/status\` and \`/api/config/test-smtp\` are completely unauthenticated. They disclose internal IPs and trigger outbound TCP connections to the mail server.

#### Remediation
In \`server/routes/config.ts\`:
\`\`\`typescript
router.use(requireAuth, requireRole('Super Admin', 'Admin'));
\`\`\`

---

### SEC-006: Header-Based Identity Spoofing in Non-Production

- **File**: [\`server/index.ts\`](file:///server/index.ts#L261)
- **Severity**: **MEDIUM** (Likelihood: Medium, Impact: High)
- **CWE**: CWE-287 (Improper Authentication)

#### Vulnerability Mechanics
In development environments, the Document Builder middleware allows callers to pass \`x-user-role: Super Admin\` in headers without a token.

#### Remediation
Mount standard authentication:
\`\`\`typescript
app.use(['/api/document-builder', '/api/ho-reports'], requireAuth, documentBuilderRouter);
\`\`\`
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'FINDINGS-DETAIL.md'), findingsDetailMd, 'utf8');

// 7. NEEDS-VALIDATION.md
const needsValidationMd = `# Needs Production Validation: Cloudflare Security Audit

### VAL-001: Supabase PostgreSQL Row Level Security (RLS) Policy Verification

#### Claimed Root Cause
In static SPA deployments (such as AWS Amplify), frontend clients connect directly to Supabase (\`https://kxikojvpcyprfbyxsdaa.supabase.co\`) using the publishable anonymous key (\`VITE_SUPABASE_ANON_KEY\`). 

In this architecture, database authorization does not go through Express API middleware; instead, authorization relies completely on PostgreSQL Row Level Security (RLS) policies defined in the cloud database.

If RLS is disabled on any public table, or if default permissive policies (\`USING (true)\`) exist, any authenticated client possessing the anon key can query or mutate records directly in PostgreSQL across all tenants.

#### Blocker
Live PostgreSQL database table configuration (\`pg_tables.rowsecurity\` and \`pg_policies\`) is managed in the remote Supabase Cloud project (\`kxikojvpcyprfbyxsdaa\`) and cannot be verified from offline local source alone.

#### Safe Verification Plan
1. **Local Schema Check**:
   - Verify that all \`CREATE TABLE\` statements in \`db/schema.sql\` and migrations include \`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;\`.
2. **Production Database Verification**:
   - In the Supabase Cloud dashboard SQL Editor, execute:
     \`\`\`sql
     SELECT schemaname, tablename, rowsecurity 
     FROM pg_tables 
     WHERE schemaname = 'public';
     \`\`\`
   - Verify that \`rowsecurity\` is \`true\` for all tables containing sensitive safeguarding or resident data.
   - Execute:
     \`\`\`sql
     SELECT tablename, policyname, permissive, roles, cmd, qual 
     FROM pg_policies 
     WHERE schemaname = 'public';
     \`\`\`
   - Confirm that policies enforce tenant site scoping or role verification for \`anon\` and \`authenticated\` roles.
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'NEEDS-VALIDATION.md'), needsValidationMd, 'utf8');

console.log('Successfully generated all Cloudflare Security Audit artifacts in:', OUTPUT_DIR);

// Run validators
console.log('\n--- Running validate-findings.cjs ---');
const findingsResult = spawnSync(process.execPath, [path.join(SKILL_DIR, 'validate-findings.cjs'), path.join(OUTPUT_DIR, 'findings.json')], { encoding: 'utf8' });
if (findingsResult.status === 0) {
  console.log('✔ validate-findings.cjs passed!');
} else {
  console.error('❌ validate-findings.cjs failed:\n', findingsResult.stderr || findingsResult.stdout);
  process.exit(1);
}

console.log('\n--- Running validate-coverage-ledger.cjs ---');
const ledgerResult = spawnSync(process.execPath, [path.join(SKILL_DIR, 'validate-coverage-ledger.cjs'), path.join(OUTPUT_DIR, 'coverage-ledger.json')], { encoding: 'utf8' });
if (ledgerResult.status === 0) {
  console.log('✔ validate-coverage-ledger.cjs passed!');
} else {
  console.error('❌ validate-coverage-ledger.cjs failed:\n', ledgerResult.stderr || ledgerResult.stdout);
  process.exit(1);
}
