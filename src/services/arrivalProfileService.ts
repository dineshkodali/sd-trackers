/**
 * Saves the extra New Arrivals details against the EXISTING Service User, in the places the profile already reads them from:
 *
 *   SU Comments (safeguarding)  -> support row "Safeguarding" (marked su-form:vulnerability)   -> Support tab
 *   Dietary requirements        -> support row "Dietary Requirements & Allergies" (su-form:dietary) -> Support tab
 *   GP                          -> service_users.gp_registration and gp_registrations.gp_practice  -> Overview / GP tab
 *   Registered pharmacy         -> gp_registrations.pharmacy                                        -> GP tab
 *   NHS number                  -> gp_registrations.nhs_number (validated, shown masked)            -> GP tab
 *
 * No new table or column is needed. What is written is decided by planProfileSync (blank never changes anything; single
 * values fill blanks only; lists merge). The Service User id is the one the arrival was synced to, so no duplicate profile
 * can be created here.
 */

import { suPropertyService } from './suPropertyService';
import { suPropertyDetailsService } from './suPropertyDetailsService';
import { suTrackerService } from './suTrackerService';
import { parseSUNeeds, saveSUAdditionalDetails } from '../components/serviceUsers/ServiceUserSupportDocsSections';
import { planProfileSync, hasAnyDetail, type ArrivalProfileDetails } from '../utils/arrivalProfileSync';
import { nhsNumberError } from '../utils/nhsNumber';

export interface ArrivalProfileResult {
  ok: boolean;
  /** what was written, in plain words */
  saved: string[];
  /** typed values that were not applied because the profile already has a different value */
  kept: string[];
  error?: string;
}

export async function applyArrivalProfileDetails(suId: string, details: ArrivalProfileDetails, user: string): Promise<ArrivalProfileResult> {
  if (!suId) return { ok: false, saved: [], kept: [], error: 'No Service User to save the details against.' };
  if (!hasAnyDetail(details)) return { ok: true, saved: [], kept: [] };
  const nhsErr = nhsNumberError(details.nhsNumber);
  if (nhsErr) return { ok: false, saved: [], kept: [], error: nhsErr };

  try {
    const [support, suRes, gpRes] = await Promise.all([
      suPropertyDetailsService.getSUSupport(suId),
      suPropertyService.getServiceUser(suId),
      suTrackerService.getGpRegistrationForSu(suId)
    ]);
    if (!suRes.success || !suRes.data) return { ok: false, saved: [], kept: [], error: suRes.error || 'The Service User profile could not be read.' };
    if (!gpRes.success) return { ok: false, saved: [], kept: [], error: gpRes.error || 'The GP registration could not be read.' };

    const needs = parseSUNeeds(support);
    const gp = gpRes.data;
    const plan = planProfileSync({
      safeguarding: needs.vulnerabilityFlags,
      dietary: needs.dietaryNeeds,
      suGpPractice: suRes.data.gpRegistration || '',
      gp: gp ? { id: gp.id, gpPractice: gp.gpPractice, pharmacy: gp.pharmacy, nhsNumber: gp.nhsNumber, notes: gp.notes } : null
    }, details);

    if (plan.safeguarding.write || plan.dietary.write) {
      // Reuses the Service User form's own save so the rows are the ones the Support tab already reads. Everything that is
      // not changing is passed back exactly as it is, so nothing else on the profile is touched.
      await saveSUAdditionalDetails({
        suId, contactData: null, householdMembers: [],
        supportPriority: needs.supportPriority || '', assignedStaff: needs.assignedStaff || '',
        vulnerabilityFlags: plan.safeguarding.write ? plan.safeguarding.value : needs.vulnerabilityFlags,
        medicalConditions: needs.medicalConditions,
        dietaryNeeds: plan.dietary.write ? plan.dietary.value : needs.dietaryNeeds,
        mobilityNeeds: needs.mobilityNeeds,
        newDocs: [], suPropertyDetailsService
      });
    }

    if (plan.suGpPractice.write) {
      const res = await suPropertyService.updateServiceUser(suId, { gpRegistration: plan.suGpPractice.value });
      if (!res.success) throw new Error(res.error || 'The GP could not be saved on the profile.');
    }

    if (plan.gp.write) {
      const res = await suTrackerService.saveGpRegistration({
        id: gp?.id, suId,
        gpPractice: plan.gp.fields.gpPractice ?? gp?.gpPractice,
        pharmacy: plan.gp.fields.pharmacy ?? gp?.pharmacy,
        nhsNumber: plan.gp.fields.nhsNumber ?? gp?.nhsNumber,
        notes: gp?.notes
      }, user);
      if (!res.success) throw new Error(res.error || 'The GP registration could not be saved.');
    }

    return { ok: true, saved: plan.saved, kept: plan.keptExisting };
  } catch (err: any) {
    return { ok: false, saved: [], kept: [], error: err?.message || 'The details could not be saved to the profile.' };
  }
}
