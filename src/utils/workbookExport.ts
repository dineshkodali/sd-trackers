import * as XLSX from 'xlsx';
import { 
  SGReferral, 
  VulnerableSU, 
  ChallengingSU, 
  MaintenanceRecord, 
  SPCDRecord, 
  FoodRecord, 
  LaundryRecord, 
  EscalationRecord 
} from '../types';

export interface MultiSheetWorkbookData {
  referrals: SGReferral[];
  vulnerableSUs: VulnerableSU[];
  challengingSUs: ChallengingSU[];
  maintenanceRecords: MaintenanceRecord[];
  spcdRecords: SPCDRecord[];
  foodRecords: FoodRecord[];
  laundryRecords: LaundryRecord[];
  escalations: EscalationRecord[];
}

/**
 * Builds and downloads a genuine multi-sheet Excel Workbook (.xlsx)
 * matching the SharePoint Master Workbook structure.
 */
export function exportToSharePointExcelWorkbook(
  data: MultiSheetWorkbookData, 
  filename: string = 'SD_Commercial_Trackers_Master.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Referrals Sheet
  const referralsRows = data.referrals.map(r => ({
    'ID': r.id,
    'Service User Name': r.suName,
    'Port/NASS Ref': r.portRef,
    'Mosaic ID': r.mosaicId,
    'Date Referred': r.dateReferred,
    'Accommodation Site': r.site,
    'Status': r.status,
    'Referral Type': r.referralType,
    'Responsible Council': r.referralCouncil,
    'Lead Officer / Worker': r.laOfficerLeading || r.officerLeadingHotel || 'Unallocated',
    'Notes / Actions Taken': r.notesActionTaken
  }));
  const wsReferrals = XLSX.utils.json_to_sheet(referralsRows);
  XLSX.utils.book_append_sheet(wb, wsReferrals, 'Referrals');

  // 2. Vulnerable Residents Sheet
  const vulnerableRows = data.vulnerableSUs.map(v => ({
    'ID': v.id,
    'Resident Name': v.suName,
    'Accommodation Site': v.site,
    'Room / Flat': v.roomOrFlatNo,
    'Risk Level': v.riskLevel,
    'Vulnerability Classification': v.vulnerability,
    'Review Date': v.reviewDate,
    'Allocated Worker': v.allocatedWorker,
    'Status': v.status,
    'Notes / Actions Taken': v.notesActionTaken,
    'SG Team Update': v.sgTeamUpdate
  }));
  const wsVulnerable = XLSX.utils.json_to_sheet(vulnerableRows);
  XLSX.utils.book_append_sheet(wb, wsVulnerable, 'Vulnerable_Residents');

  // 3. Challenging Behavior Sheet
  const challengingRows = data.challengingSUs.map(c => ({
    'ID': c.id,
    'Resident Name': c.name,
    'Port Reference': c.portRef,
    'Accommodation Site': c.site,
    'Date of Incident': c.dateOfIncident || c.date,
    'Type of Issue': c.typeOfIssue,
    'Risk Factor': c.riskFactor,
    'Incident Description': c.incidentDescription,
    'Action Taken': c.actionTaken,
    'Follow Up Required': c.followUpRequired,
    'Status': c.status
  }));
  const wsChallenging = XLSX.utils.json_to_sheet(challengingRows);
  XLSX.utils.book_append_sheet(wb, wsChallenging, 'Challenging_Behavior');

  // 4. Maintenance Sheet
  const maintenanceRows = data.maintenanceRecords.map(m => ({
    'ID': m.id,
    'Accommodation Site': m.site,
    'Location / Room': m.room || m.location,
    'Priority Level': m.priority,
    'Priority Time Scale': m.priorityTimeScale,
    'Status': m.defectStatus,
    'Action State': m.action,
    'Reported By': m.raisedBy,
    'Reported Date': m.date,
    'Close Due Date': m.closeDueDate,
    'Progress': m.progress,
    'Description / Notes': `${m.description}${m.notes ? ` - ${m.notes}` : ''}`
  }));
  const wsMaintenance = XLSX.utils.json_to_sheet(maintenanceRows);
  XLSX.utils.book_append_sheet(wb, wsMaintenance, 'Maintenance_Defects');

  // 5. SPCD Compliance Sheet
  const spcdRows = data.spcdRecords.map(s => ({
    'ID': s.id,
    'Resident Name': s.suName,
    'Port Reference': s.suPortReference,
    'Site Location': s.siteName,
    'Room': s.roomNumber,
    'Date Logged': s.date,
    'Staff Reporting': s.staffReporting,
    'Action Taken': s.briefDescriptionActionTaken,
    'Follow Up Notes': s.followUpNotes,
    'SG Review': s.sgReview
  }));
  const wsSpcd = XLSX.utils.json_to_sheet(spcdRows);
  XLSX.utils.book_append_sheet(wb, wsSpcd, 'SPCD_Compliance');

  // 6. Food Temp Checks Sheet
  const foodRows = data.foodRecords.map(f => ({
    'ID': f.id,
    'Resident Name': f.residentName,
    'Room': f.roomNo,
    'Site': f.site,
    'Meal Type': f.mealType,
    'Dietary Requirement': f.dietaryRequirement,
    'Temp Checked (°C)': f.tempCheckedCelsius,
    'Time Delivered': f.timeDelivered,
    'Delivered By': f.deliveredBy,
    'Signed': f.residentSigned ? 'Yes' : 'No',
    'Status': f.status
  }));
  const wsFood = XLSX.utils.json_to_sheet(foodRows);
  XLSX.utils.book_append_sheet(wb, wsFood, 'Food_Temp_Checks');

  // 7. Laundry Operations Sheet
  const laundryRows = data.laundryRecords.map(l => ({
    'ID': l.id,
    'Resident Name': l.residentName,
    'Room': l.roomNo,
    'Site': l.site,
    'Date': l.date,
    'Bag Count': l.bagCount,
    'Tokens Issued': l.tokensIssued,
    'Status': l.status,
    'Staff Initials': l.staffInitials,
    'Collection Time': l.collectionTime || 'Pending'
  }));
  const wsLaundry = XLSX.utils.json_to_sheet(laundryRows);
  XLSX.utils.book_append_sheet(wb, wsLaundry, 'Laundry_Operations');

  // 8. Escalations Sheet
  const escalationsRows = data.escalations.map(e => ({
    'ID': e.id,
    'Title / Subject': e.incidentTitle || e.suName,
    'Accommodation Site': e.site,
    'Incident Date': e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : ''),
    'Incident Type': e.incidentType,
    'Escalated To': e.escalatedTo || e.reportedAuthorities,
    'Status': e.status,
    'Urgency': e.urgency || 'High',
    'Action Taken': e.actionTaken || e.immediateAction || '',
    'Notes': e.incidentNotes || e.incidentSummary || ''
  }));
  const wsEscalations = XLSX.utils.json_to_sheet(escalationsRows);
  XLSX.utils.book_append_sheet(wb, wsEscalations, 'Multi_Agency_Escalations');

  // Write file
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Generates TSV (Tab-Separated Values) string for instant clipboard copying.
 * When pasted into Excel or SharePoint Online, tab-separated text perfectly
 * distributes into spreadsheet rows and columns without formatting issues.
 */
export function formatDataAsExcelClipboardTsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  };

  const headerLine = headers.map(sanitize).join('\t');
  const rowLines = rows.map(r => r.map(sanitize).join('\t'));
  return [headerLine, ...rowLines].join('\r\n');
}
