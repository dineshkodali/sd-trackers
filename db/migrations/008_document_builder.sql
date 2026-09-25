-- =====================================================================
-- 008: Document Builder Module (Single Unified Table: doc_builder)
--
-- Saves EVERYTHING in ONE single table: `doc_builder`
-- - record_type = 'template' -> Document Templates & versioned schemas
-- - record_type = 'document' -> Saved Document Drafts & Finalized Records
-- - record_type = 'audit'    -> Compliance & RBAC Audit Event Logs
--
-- Run this in Supabase Dashboard -> SQL Editor
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doc_builder (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL DEFAULT 'document', -- 'template' | 'document' | 'audit'
  template_id TEXT,
  site TEXT NOT NULL DEFAULT 'All Sites',
  title TEXT NOT NULL,
  document_number TEXT,
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'draft',                  -- 'draft' | 'final' | 'active' | 'inactive'
  field_values JSONB DEFAULT '{}',
  created_by TEXT,
  created_by_name TEXT,
  created_by_role TEXT,
  created_by_email TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  updated_by_role TEXT,
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  data JSONB NOT NULL DEFAULT '{}',             -- holds complete template definition or document data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for auto-updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_doc_builder_updated_at'
  ) THEN
    CREATE TRIGGER update_doc_builder_updated_at
      BEFORE UPDATE ON public.doc_builder
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes for ultra-fast queries
CREATE INDEX IF NOT EXISTS idx_doc_builder_type ON public.doc_builder(record_type);
CREATE INDEX IF NOT EXISTS idx_doc_builder_site ON public.doc_builder(site);
CREATE INDEX IF NOT EXISTS idx_doc_builder_template ON public.doc_builder(template_id);
CREATE INDEX IF NOT EXISTS idx_doc_builder_updated_at ON public.doc_builder(updated_at DESC);

-- =====================================================================
-- SEED INITIAL APPROVED TEMPLATES INTO doc_builder
-- =====================================================================

-- 1. Risk Assessment Template
INSERT INTO public.doc_builder (id, record_type, template_id, site, title, category, status, data, created_by)
VALUES (
  'tmpl-risk-assessment',
  'template',
  'tmpl-risk-assessment',
  'All Sites',
  'Risk Assessment',
  'Safeguarding',
  'active',
  '{
    "id": "tmpl-risk-assessment",
    "name": "Risk Assessment",
    "description": "Standard risk assessment document with hazard identification, risk rating, control measures, and review scheduling.",
    "category": "Safeguarding",
    "isActive": true,
    "createdBy": "system",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
    "currentVersion": {
      "id": "tver-risk-v1",
      "templateId": "tmpl-risk-assessment",
      "version": 1,
      "isCurrent": true,
      "fieldDefinitions": [
        {"id":"f-ra-1","name":"assessmentDate","label":"Assessment Date","type":"date","section":"details","required":true,"order":1,"width":"half"},
        {"id":"f-ra-2","name":"assessorName","label":"Assessor Name","type":"text","section":"details","required":true,"placeholder":"Full name of assessor","order":2,"width":"half"},
        {"id":"f-ra-3","name":"residentName","label":"Resident / Subject Name","type":"text","section":"details","required":true,"placeholder":"Full name","order":3,"width":"half"},
        {"id":"f-ra-4","name":"portRef","label":"Port / NASS Reference","type":"text","section":"details","required":false,"placeholder":"e.g. PORT-123456","order":4,"width":"half"},
        {"id":"f-ra-5","name":"location","label":"Location / Area","type":"text","section":"details","required":true,"placeholder":"Building, floor, room","order":5,"width":"full"},
        {"id":"f-ra-6","name":"riskCategory","label":"Risk Category","type":"select","section":"details","required":true,"options":["Personal Safety","Fire","Environmental","Health & Hygiene","Security","Mental Health","Safeguarding"],"order":6,"width":"half"},
        {"id":"f-ra-7","name":"overallRiskLevel","label":"Overall Risk Level","type":"select","section":"details","required":true,"options":["Low","Medium","High","Critical"],"order":7,"width":"half"},
        {"id":"f-ra-8","name":"hazardDescription","label":"Hazard Description","type":"textarea","section":"hazards","required":true,"placeholder":"Describe the identified hazards and potential harm...","order":1,"width":"full"},
        {"id":"f-ra-9","name":"personsAtRisk","label":"Persons at Risk","type":"textarea","section":"hazards","required":true,"placeholder":"Who may be harmed and how...","order":2,"width":"full"},
        {"id":"f-ra-10","name":"existingControls","label":"Existing Control Measures","type":"textarea","section":"controls","required":true,"placeholder":"Current measures in place...","order":1,"width":"full"},
        {"id":"f-ra-11","name":"additionalControls","label":"Additional Controls Required","type":"textarea","section":"controls","required":false,"placeholder":"Further actions needed...","order":2,"width":"full"},
        {"id":"f-ra-12","name":"reviewDate","label":"Review Date","type":"date","section":"review","required":true,"order":1,"width":"half"},
        {"id":"f-ra-13","name":"reviewedBy","label":"To Be Reviewed By","type":"text","section":"review","required":false,"placeholder":"Name of reviewer","order":2,"width":"half"},
        {"id":"f-ra-14","name":"additionalNotes","label":"Additional Notes","type":"textarea","section":"review","required":false,"placeholder":"Any further notes or observations...","order":3,"width":"full"}
      ],
      "layoutConfig": {
        "sections": [
          {"id":"details","title":"Assessment Details","order":1,"columns":2},
          {"id":"hazards","title":"Hazard Identification","order":2,"columns":1},
          {"id":"controls","title":"Control Measures","order":3,"columns":1},
          {"id":"review","title":"Review & Sign-Off","order":4,"columns":2}
        ],
        "pageSize": "A4",
        "margins": {"top": 25, "right": 20, "bottom": 25, "left": 20}
      },
      "headerConfig": {
        "showLogo": true,
        "showCompanyName": true,
        "showDocumentNumber": true,
        "showDate": true,
        "subtitle": "Accommodation Services Risk Assessment",
        "confidentialityLevel": "Restricted"
      },
      "footerConfig": {
        "showPageNumbers": true,
        "showGeneratedTimestamp": true,
        "customText": "SD Commercial — Confidential Document"
      }
    }
  }'::jsonb,
  'system'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  data = EXCLUDED.data;

-- 2. Incident Report Template
INSERT INTO public.doc_builder (id, record_type, template_id, site, title, category, status, data, created_by)
VALUES (
  'tmpl-incident-report',
  'template',
  'tmpl-incident-report',
  'All Sites',
  'Incident Report',
  'Operations',
  'active',
  '{
    "id": "tmpl-incident-report",
    "name": "Incident Report",
    "description": "Structured incident documentation with timeline, witnesses, actions taken, and follow-up requirements.",
    "category": "Operations",
    "isActive": true,
    "createdBy": "system",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
    "currentVersion": {
      "id": "tver-incident-v1",
      "templateId": "tmpl-incident-report",
      "version": 1,
      "isCurrent": true,
      "fieldDefinitions": [
        {"id":"f-ir-1","name":"incidentDate","label":"Date of Incident","type":"date","section":"incident","required":true,"order":1,"width":"half"},
        {"id":"f-ir-2","name":"incidentTime","label":"Time of Incident","type":"text","section":"incident","required":true,"placeholder":"e.g. 14:30","order":2,"width":"half"},
        {"id":"f-ir-3","name":"reportedBy","label":"Reported By","type":"text","section":"incident","required":true,"placeholder":"Name of reporter","order":3,"width":"half"},
        {"id":"f-ir-4","name":"incidentType","label":"Incident Type","type":"select","section":"incident","required":true,"options":["Physical Altercation","Verbal Abuse","Property Damage","Medical Emergency","Fire / Alarm","Anti-Social Behaviour","Missing Person","Safeguarding Concern","Other"],"order":4,"width":"half"},
        {"id":"f-ir-5","name":"severity","label":"Severity Level","type":"select","section":"incident","required":true,"options":["Low","Medium","High","Critical"],"order":5,"width":"half"},
        {"id":"f-ir-6","name":"locationDetail","label":"Exact Location","type":"text","section":"incident","required":true,"placeholder":"Building, floor, room number","order":6,"width":"half"},
        {"id":"f-ir-7","name":"personsInvolved","label":"Person(s) Involved","type":"textarea","section":"persons","required":true,"placeholder":"Names, roles, and resident references of all persons involved...","order":1,"width":"full"},
        {"id":"f-ir-8","name":"witnesses","label":"Witnesses","type":"textarea","section":"persons","required":false,"placeholder":"Names and contact details of witnesses...","order":2,"width":"full"},
        {"id":"f-ir-9","name":"description","label":"Incident Description","type":"textarea","section":"description","required":true,"placeholder":"Provide a detailed factual account of the incident...","order":1,"width":"full"},
        {"id":"f-ir-10","name":"immediateAction","label":"Immediate Action Taken","type":"textarea","section":"actions","required":true,"placeholder":"Describe immediate response and actions taken...","order":1,"width":"full"},
        {"id":"f-ir-11","name":"authoritiesNotified","label":"Authorities Notified","type":"select","section":"actions","required":true,"options":["None","Police","Ambulance","Fire Service","Social Services","Home Office","Multiple Agencies"],"order":2,"width":"half"},
        {"id":"f-ir-12","name":"crimeReference","label":"Crime / Reference Number","type":"text","section":"actions","required":false,"placeholder":"If applicable","order":3,"width":"half"},
        {"id":"f-ir-13","name":"followUpActions","label":"Follow-Up Actions Required","type":"textarea","section":"followup","required":false,"placeholder":"Outline any follow-up actions or investigations needed...","order":1,"width":"full"},
        {"id":"f-ir-14","name":"followUpDeadline","label":"Follow-Up Deadline","type":"date","section":"followup","required":false,"order":2,"width":"half"},
        {"id":"f-ir-15","name":"managerReview","label":"Manager Review Notes","type":"textarea","section":"followup","required":false,"placeholder":"Manager comments and sign-off notes...","order":3,"width":"full"}
      ],
      "layoutConfig": {
        "sections": [
          {"id":"incident","title":"Incident Details","order":1,"columns":2},
          {"id":"persons","title":"Persons Involved & Witnesses","order":2,"columns":1},
          {"id":"description","title":"Incident Description","order":3,"columns":1},
          {"id":"actions","title":"Actions & Notifications","order":4,"columns":2},
          {"id":"followup","title":"Follow-Up & Review","order":5,"columns":1}
        ],
        "pageSize": "A4",
        "margins": {"top": 25, "right": 20, "bottom": 25, "left": 20}
      },
      "headerConfig": {
        "showLogo": true,
        "showCompanyName": true,
        "showDocumentNumber": true,
        "showDate": true,
        "subtitle": "Incident Report Form",
        "confidentialityLevel": "Confidential"
      },
      "footerConfig": {
        "showPageNumbers": true,
        "showGeneratedTimestamp": true,
        "customText": "SD Commercial — Incident Report — Confidential"
      }
    }
  }'::jsonb,
  'system'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  data = EXCLUDED.data;

-- 3. Safeguarding Referral Template
INSERT INTO public.doc_builder (id, record_type, template_id, site, title, category, status, data, created_by)
VALUES (
  'tmpl-safeguarding-referral',
  'template',
  'tmpl-safeguarding-referral',
  'All Sites',
  'Safeguarding Referral',
  'Safeguarding',
  'active',
  '{
    "id": "tmpl-safeguarding-referral",
    "name": "Safeguarding Referral",
    "description": "Formal safeguarding referral document with resident details, concerns, evidence, and multi-agency notifications.",
    "category": "Safeguarding",
    "isActive": true,
    "createdBy": "system",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
    "currentVersion": {
      "id": "tver-safeguarding-v1",
      "templateId": "tmpl-safeguarding-referral",
      "version": 1,
      "isCurrent": true,
      "fieldDefinitions": [
        {"id":"f-sg-1","name":"referralDate","label":"Referral Date","type":"date","section":"referral","required":true,"order":1,"width":"half"},
        {"id":"f-sg-2","name":"referringOfficer","label":"Referring Officer","type":"text","section":"referral","required":true,"placeholder":"Name and role","order":2,"width":"half"},
        {"id":"f-sg-3","name":"referralType","label":"Referral Type","type":"select","section":"referral","required":true,"options":["Safeguarding Adult","Safeguarding Child","Mental Health","Domestic Abuse","Self-Harm / Suicide Risk","Modern Slavery"],"order":3,"width":"half"},
        {"id":"f-sg-4","name":"urgency","label":"Urgency","type":"select","section":"referral","required":true,"options":["Low","Medium","High","Critical"],"order":4,"width":"half"},
        {"id":"f-sg-5","name":"residentName","label":"Resident Full Name","type":"text","section":"resident","required":true,"placeholder":"Full legal name","order":1,"width":"half"},
        {"id":"f-sg-6","name":"dateOfBirth","label":"Date of Birth","type":"date","section":"resident","required":true,"order":2,"width":"half"},
        {"id":"f-sg-7","name":"portRef","label":"Port / NASS Reference","type":"text","section":"resident","required":false,"placeholder":"e.g. PORT-123456","order":3,"width":"half"},
        {"id":"f-sg-8","name":"roomNumber","label":"Room / Flat Number","type":"text","section":"resident","required":false,"placeholder":"e.g. Room 12B","order":4,"width":"half"},
        {"id":"f-sg-9","name":"gender","label":"Gender","type":"select","section":"resident","required":true,"options":["Male","Female","Other","Prefer not to say"],"order":5,"width":"half"},
        {"id":"f-sg-10","name":"nationality","label":"Nationality","type":"text","section":"resident","required":false,"placeholder":"Country of origin","order":6,"width":"half"},
        {"id":"f-sg-11","name":"concerns","label":"Nature of Concerns","type":"textarea","section":"concerns","required":true,"placeholder":"Describe the safeguarding concerns in detail...","order":1,"width":"full"},
        {"id":"f-sg-12","name":"evidence","label":"Evidence / Observations","type":"textarea","section":"concerns","required":true,"placeholder":"Documented evidence, witness statements, visible indicators...","order":2,"width":"full"},
        {"id":"f-sg-13","name":"previousConcerns","label":"Previous Concerns / History","type":"textarea","section":"concerns","required":false,"placeholder":"Any prior incidents or existing care plans...","order":3,"width":"full"},
        {"id":"f-sg-14","name":"localAuthority","label":"Local Authority","type":"text","section":"agencies","required":true,"placeholder":"Council name","order":1,"width":"half"},
        {"id":"f-sg-15","name":"methodOfReferral","label":"Method of Referral","type":"select","section":"agencies","required":true,"options":["Mosaic Portal","Encrypted Email","Phone Call","In Person","Online Form"],"order":2,"width":"half"},
        {"id":"f-sg-16","name":"agenciesNotified","label":"Agencies Notified","type":"textarea","section":"agencies","required":false,"placeholder":"List all agencies contacted with dates and reference numbers...","order":3,"width":"full"},
        {"id":"f-sg-17","name":"immediateActions","label":"Immediate Actions Taken","type":"textarea","section":"agencies","required":true,"placeholder":"Steps taken to ensure immediate safety...","order":4,"width":"full"}
      ],
      "layoutConfig": {
        "sections": [
          {"id":"referral","title":"Referral Information","order":1,"columns":2},
          {"id":"resident","title":"Resident Details","order":2,"columns":2},
          {"id":"concerns","title":"Safeguarding Concerns","order":3,"columns":1},
          {"id":"agencies","title":"Agency Notifications & Actions","order":4,"columns":2}
        ],
        "pageSize": "A4",
        "margins": {"top": 25, "right": 20, "bottom": 25, "left": 20}
      },
      "headerConfig": {
        "showLogo": true,
        "showCompanyName": true,
        "showDocumentNumber": true,
        "showDate": true,
        "subtitle": "Safeguarding Referral Form",
        "confidentialityLevel": "Restricted"
      },
      "footerConfig": {
        "showPageNumbers": true,
        "showGeneratedTimestamp": true,
        "customText": "SD Commercial — Safeguarding Referral — Restricted"
      }
    }
  }'::jsonb,
  'system'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  data = EXCLUDED.data;

NOTIFY pgrst, 'reload schema';
