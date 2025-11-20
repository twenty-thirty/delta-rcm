
import { Claim, ReimbursementRate, PayerDenialStats, PatientStat } from '../types';

// --- Reimbursement Logic (Mode vs Max) ---

export const calculateReimbursementRates = (claims: Claim[]): Map<string, Map<string, ReimbursementRate>> => {
  // Map<Payer, Map<CPT, Rates[]>>
  const pricingHistory = new Map<string, Map<string, number[]>>();

  claims.filter(c => c.isPaid && c.paid > 0 && c.units > 0).forEach(c => {
    if (!pricingHistory.has(c.payer)) pricingHistory.set(c.payer, new Map());
    const payerMap = pricingHistory.get(c.payer)!;
    
    if (!payerMap.has(c.cpt)) payerMap.set(c.cpt, []);
    const ratePerUnit = c.paid / c.units;
    // Round to 2 decimals to group effectively
    const roundedRate = Math.round(ratePerUnit * 100) / 100;
    payerMap.get(c.cpt)!.push(roundedRate);
  });

  // Calculate Expected Rate per Payer/CPT
  const results = new Map<string, Map<string, ReimbursementRate>>();

  pricingHistory.forEach((cptMap, payer) => {
    if (!results.has(payer)) results.set(payer, new Map());
    
    cptMap.forEach((rates, cpt) => {
      const frequency: Record<number, number> = {};
      let maxRate = 0;

      rates.forEach(r => {
        frequency[r] = (frequency[r] || 0) + 1;
        if (r > maxRate) maxRate = r;
      });

      let modeRate = 0;
      let maxFreq = 0;
      let distinctRates = Object.keys(frequency).length;

      for (const [rateStr, freq] of Object.entries(frequency)) {
        const r = parseFloat(rateStr);
        if (freq > maxFreq) {
          maxFreq = freq;
          modeRate = r;
        } else if (freq === maxFreq && r > modeRate) {
          // Tie-breaker: take higher rate if frequencies are equal
          modeRate = r;
        }
      }

      // Logic: If distinct rates > 2, use Mode. If all rates unique or distinct <=2, check if Mode is significantly dominant? 
      // User Rule: "if it's more than 2 different amounts, take mode, otherwise take highest amount"
      
      let finalRate = 0;
      let method: 'Mode' | 'Max' | 'None' = 'None';

      if (distinctRates > 2) {
        finalRate = modeRate;
        method = 'Mode';
      } else {
        finalRate = maxRate;
        method = 'Max';
      }

      results.get(payer)!.set(cpt, {
        payer,
        cpt,
        expectedRate: finalRate,
        method,
        frequency: maxFreq
      });
    });
  });

  return results;
};

// --- Denial Opportunity Calculation ---

export const calculateDenialOpportunity = (
  claims: Claim[], 
  rates: Map<string, Map<string, ReimbursementRate>>
): PayerDenialStats[] => {
  
  const stats = new Map<string, PayerDenialStats>();

  claims.filter(c => !c.isPaid).forEach(c => {
    if (!stats.has(c.payer)) {
      stats.set(c.payer, { payer: c.payer, deniedUnits: 0, deniedValue: 0, projectedValue: 0 });
    }
    const stat = stats.get(c.payer)!;
    stat.deniedUnits += c.units;
    stat.deniedValue += c.charge;

    // Calculate projected value
    const payerRates = rates.get(c.payer);
    const rateObj = payerRates?.get(c.cpt);
    
    // If we have an expected rate, use it. Otherwise, maybe fallback to charge? No, strictly use proven rate.
    if (rateObj) {
      stat.projectedValue += (c.units * rateObj.expectedRate);
    }
  });

  return Array.from(stats.values());
};

// --- Patient Analytics ---

export const analyzePatients = (claims: Claim[]): PatientStat[] => {
  const patients = new Map<string, PatientStat>();

  claims.forEach(c => {
    if (!patients.has(c.patientId)) {
      patients.set(c.patientId, {
        patientId: c.patientId,
        patientName: c.patientName,
        totalVisits: 0,
        totalRevenue: 0,
        lastVisit: null,
        payer: c.payer // Assume primary payer
      });
    }
    const p = patients.get(c.patientId)!;
    
    // Simple logic to count visits (unique DOS)
    // We'll just increment encounters per claim line for now, usually distinct count is better done outside
    // But for performance here, we aggregate total revenue
    p.totalRevenue += c.paid;
    
    // Date logic
    if (c.dos) {
      if (!p.lastVisit || c.dos > p.lastVisit) {
        p.lastVisit = c.dos;
      }
    }
  });

  // Post-process for unique visits? 
  // For simplicity in this pass, let's just count distinct DOS per patient
  const distinctVisits = new Set<string>();
  claims.forEach(c => distinctVisits.add(`${c.patientId}|${c.dos?.getTime()}`));
  
  const visitCounts: Record<string, number> = {};
  distinctVisits.forEach(key => {
    const pid = key.split('|')[0];
    visitCounts[pid] = (visitCounts[pid] || 0) + 1;
  });

  patients.forEach(p => {
    p.totalVisits = visitCounts[p.patientId] || 0;
  });

  return Array.from(patients.values());
};
