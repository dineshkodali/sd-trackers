/**
 * Client-Side Default Document Templates
 *
 * Guaranteed fallback templates so the user interface NEVER displays an empty dead-end.
 */

import type { TemplateWithVersion } from '../types/documentBuilder';

export const CLIENT_SEED_TEMPLATES: TemplateWithVersion[] = [
  {
    id: 'tmpl-incident-report',
    name: 'Incident Report',
    description: 'Official UKVI & Clearsprings compliant incident report form with full factual disclosure, authority notifications, and evidence tracking.',
    category: 'Operations',
    isActive: true,
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    currentVersion: {
      id: 'tver-incident-v1',
      templateId: 'tmpl-incident-report',
      version: 1,
      isCurrent: true,
      fieldDefinitions: [
        { id: 'f-ir-1', name: 'propertyId', label: 'Property ID', type: 'text', section: 'incident', required: true, placeholder: 'e.g. 741- Clacton Pier Avenue', order: 1, width: 'half' },
        { id: 'f-ir-2', name: 'personReporting', label: 'Person Reporting', type: 'text', section: 'incident', required: true, placeholder: 'Full name of reporter', order: 2, width: 'half' },
        { id: 'f-ir-3', name: 'dateOfIncident', label: 'Date of Incident', type: 'date', section: 'incident', required: true, order: 3, width: 'half' },
        { id: 'f-ir-4', name: 'offenders', label: 'Offenders (Name/Port)', type: 'repeating_group', section: 'persons', required: false, repeatable: true, itemLabel: '+ Add Offender', placeholder: 'Name/Port or N/A', order: 1, width: 'full' },
        { id: 'f-ir-5', name: 'victims', label: 'Victims (Name/Port)', type: 'repeating_group', section: 'persons', required: true, repeatable: true, itemLabel: '+ Add Victim', placeholder: 'e.g. Mohammed Kaw Rasul (MST/9157022)', order: 2, width: 'full' },
        { id: 'f-ir-6', name: 'witnesses', label: 'Witnesses (SUs) (Name/Port)', type: 'repeating_group', section: 'persons', required: false, repeatable: true, itemLabel: '+ Add Witness', placeholder: 'e.g. Welfare officer (Emeka Opara) or N/A', order: 3, width: 'full' },
        { id: 'f-ir-7', name: 'incidentDescription', label: 'Incident Description', type: 'textarea', section: 'description', required: true, placeholder: 'Please complete with as much detail as possible, stating only facts...', order: 1, width: 'full' },
        { id: 'f-ir-8', name: 'actionTaken', label: 'Action Taken', type: 'textarea', section: 'actions', required: true, placeholder: 'Describe exact action and steps taken...', order: 1, width: 'full' },
        { id: 'f-ir-9', name: 'warningLetterIssued', label: 'Warning Letter Issued?', type: 'select', section: 'warnings', required: false, options: ['N/A', 'No', 'Yes'], order: 1, width: 'half' },
        { id: 'f-ir-10', name: 'warningLetterToWhom', label: 'To Whom?', type: 'text', section: 'warnings', required: false, placeholder: 'Name/Port or N/A', order: 2, width: 'half' },
        { id: 'f-ir-11', name: 'safeguardingInformed', label: 'Safeguarding Informed?', type: 'select', section: 'authorities', required: false, options: ['N/A', 'No', 'Yes'], order: 1, width: 'half' },
        { id: 'f-ir-12', name: 'safeguardingWho', label: 'Who?', type: 'text', section: 'authorities', required: false, placeholder: 'Name or N/A', order: 2, width: 'half' },
        { id: 'f-ir-13', name: 'policeInvolved', label: 'Police Involved?', type: 'select', section: 'authorities', required: false, options: ['N/A', 'No', 'Yes'], order: 3, width: 'half' },
        { id: 'f-ir-14', name: 'policeCadRef', label: 'CAD Ref (Police)', type: 'text', section: 'authorities', required: false, placeholder: 'CAD Reference or N/A', order: 4, width: 'half' },
        { id: 'f-ir-15', name: 'ambulanceInvolved', label: 'Ambulance Involved?', type: 'select', section: 'authorities', required: false, options: ['N/A', 'No', 'Yes'], order: 5, width: 'half' },
        { id: 'f-ir-16', name: 'ambulanceCadRef', label: 'CAD Ref (Ambulance)', type: 'text', section: 'authorities', required: false, placeholder: 'CAD Reference or N/A', order: 6, width: 'half' },
        { id: 'f-ir-17', name: 'fireServiceInvolved', label: 'Fire Service Involved?', type: 'select', section: 'authorities', required: false, options: ['N/A', 'No', 'Yes'], order: 7, width: 'half' },
        { id: 'f-ir-18', name: 'fireCadRef', label: 'CAD Ref (Fire)', type: 'text', section: 'authorities', required: false, placeholder: 'CAD Reference or N/A', order: 8, width: 'half' },
        { id: 'f-ir-19', name: 'evidencePhotos', label: 'Evidence Photos & Attachments', type: 'attachment', section: 'evidence', required: false, repeatable: true, itemLabel: '+ Add Evidence Photo', placeholder: 'Upload or link evidence photos', order: 1, width: 'full' },
      ],
      layoutConfig: {
        sections: [
          { id: 'incident', title: 'Property & Reporting Details', order: 1, columns: 2 },
          { id: 'persons', title: 'Persons Involved (Offenders / Victims / Witnesses)', order: 2, columns: 1 },
          { id: 'description', title: 'Incident Description', order: 3, columns: 1 },
          { id: 'actions', title: 'Action Taken', order: 4, columns: 1 },
          { id: 'warnings', title: 'Warning Letter', order: 5, columns: 2 },
          { id: 'authorities', title: 'Reported Authorities', order: 6, columns: 2 },
          { id: 'evidence', title: 'Evidence & Photos', order: 7, columns: 1 },
        ],
        pageSize: 'A4',
        margins: { top: 25, right: 20, bottom: 25, left: 20 },
      },
      headerConfig: {
        showLogo: true,
        showCompanyName: true,
        showDocumentNumber: true,
        showDate: true,
        subtitle: 'Please complete with as much detail as possible, stating only facts. Please email CST@Clearsprings.co.uk who will review and send it to UKVI where appropriate.',
        confidentialityLevel: 'Confidential',
      },
      footerConfig: {
        showPageNumbers: true,
        showGeneratedTimestamp: true,
        customText: 'Please attach photos of any evidence where possible when submitting to CST.',
      },
      createdBy: 'system',
      createdAt: '2026-01-01T00:00:00Z',
    },
  },
];
