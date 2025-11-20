import React, { useState, useMemo } from 'react';
import { Claim, CodeType, ReimbursementRate } from '../types';
import { formatMoney } from '../utils/parser';
import { calculateReimbursementRates } from '../utils/analytics';
import { CreditCard, Calculator, AlertTriangle, Info, Activity } from 'lucide-react';

// --- Component: AQL Summary Table ---

interface AQLStats {
  units: number;
  paid: number;
  unpaid: number;
  amount: number;
}

interface AQLSummaryProps {
  claims: Claim[];
}

export const AQLSummaryTable: React.FC<AQLSummaryProps> = ({ claims }) => {
  const data = useMemo(() => {
    const summary: Record<string, AQLStats> = {
      A: { units: 0, paid: 0, unpaid: 0, amount: 0 },
      Q: { units: 0, paid: 0, unpaid: 0, amount: 0 },
      L: { units: 0, paid: 0, unpaid: 0, amount: 0 },
    };
    
    claims.filter(c => c.codeType === CodeType.AQL).forEach(c => {
      const letter = c.cpt.charAt(0).toUpperCase();
      if (letter in summary) {
        const key = letter as keyof typeof summary;
        summary[key].units += c.units;
        summary[key].amount += c.paid;
        if (c.isPaid) summary[key].paid += c.units;
        else summary[key].unpaid += c.units;
      }
    });
    return summary;
  }, [claims]);

  const totalAQLUnits = data.A.units + data.Q.units + data.L.units;
  if (totalAQLUnits === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="p-5 border-b border-gray-200 bg-indigo-50 flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-600" />
        <div>
          <h3 className="font-bold text-lg text-indigo-900">AQL Codes Summary</h3>
          <p className="text-xs text-indigo-700">High-level breakdown of A, Q, and L codes</p>
        </div>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="px-6 py-3">Code Type</th>
            <th className="px-6 py-3 text-right">Total Units</th>
            <th className="px-6 py-3 text-right text-green-600">Paid Units</th>
            <th className="px-6 py-3 text-right text-red-600">Unpaid Units</th>
            <th className="px-6 py-3 text-right">Paid %</th>
            <th className="px-6 py-3 text-right">Total Paid ($)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.entries(data).map(([type, stats]) => {
             const paidPct = stats.units ? ((stats.paid / stats.units) * 100).toFixed(1) : '0.0';
             return (
              <tr key={type} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-bold text-gray-900">{type}-Codes</td>
                <td className="px-6 py-4 text-right font-medium text-gray-900">{stats.units}</td>
                <td className="px-6 py-4 text-right text-green-600 font-medium">{stats.paid}</td>
                <td className="px-6 py-4 text-right text-red-600 font-medium">{stats.unpaid}</td>
                <td className="px-6 py-4 text-right text-gray-500">{paidPct}%</td>
                <td className="px-6 py-4 text-right font-medium text-gray-900">{formatMoney(stats.amount)}</td>
              </tr>
             );
          })}
        </tbody>
      </table>
    </div>
  );
};

// --- Component: CPT Performance Report (Replaces AQLReport) ---

interface CPTPerformanceProps {
  claims: Claim[];
}

export const CPTPerformanceReport: React.FC<CPTPerformanceProps> = ({ claims }) => {
  
  const stats = useMemo(() => {
    const byCode: Record<string, { total: number, paid: number, unpaid: number, amount: number, encounters: number }> = {};
    let totals = { total: 0, paid: 0, unpaid: 0, amount: 0, encounters: 0 };

    claims.forEach(c => {
      if (!byCode[c.cpt]) byCode[c.cpt] = { total: 0, paid: 0, unpaid: 0, amount: 0, encounters: 0 };
      
      // Row stats
      byCode[c.cpt].total += c.units;
      if (c.isPaid) byCode[c.cpt].paid += c.units;
      else byCode[c.cpt].unpaid += c.units;
      byCode[c.cpt].amount += c.paid;
      
      // Note: Encounters is approximation here (lines), usually needs unique DOS check per code
      byCode[c.cpt].encounters += 1;

      // Global totals
      totals.total += c.units;
      if (c.isPaid) totals.paid += c.units;
      else totals.unpaid += c.units;
      totals.amount += c.paid;
      totals.encounters += 1;
    });

    return { byCode, totals };
  }, [claims]);

  const sortedCodes = Object.keys(stats.byCode).sort();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h3 className="font-bold text-lg text-gray-900">Detailed CPT Code Overview</h3>
          <p className="text-sm text-gray-500">Breakdown of all procedure codes submitted</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">CPT Code</th>
                <th className="px-6 py-3 text-right">Total Units</th>
                <th className="px-6 py-3 text-right">Paid Units</th>
                <th className="px-6 py-3 text-right">Unpaid Units</th>
                <th className="px-6 py-3 text-right">Total Paid ($)</th>
                <th className="px-6 py-3 text-right">Lines/Encounters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedCodes.map(code => {
                const row = stats.byCode[code];
                return (
                  <tr key={code} className="hover:bg-gray-50 text-gray-900">
                    <td className="px-6 py-3 font-mono font-bold text-blue-600">{code}</td>
                    <td className="px-6 py-3 text-right font-medium">{row.total}</td>
                    <td className="px-6 py-3 text-right text-green-600">{row.paid}</td>
                    <td className="px-6 py-3 text-right text-red-600 bg-red-50/50">{row.unpaid}</td>
                    <td className="px-6 py-3 text-right font-medium">{formatMoney(row.amount)}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{row.encounters}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
               <tr>
                 <td className="px-6 py-4">TOTALS</td>
                 <td className="px-6 py-4 text-right">{stats.totals.total}</td>
                 <td className="px-6 py-4 text-right text-green-700">{stats.totals.paid}</td>
                 <td className="px-6 py-4 text-right text-red-700">{stats.totals.unpaid}</td>
                 <td className="px-6 py-4 text-right">{formatMoney(stats.totals.amount)}</td>
                 <td className="px-6 py-4 text-right">{stats.totals.encounters}</td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Component: Comprehensive CPT Report (Grouped by Payer) ---

interface ComprehensiveReportProps {
  claims: Claim[];
}

export const ComprehensiveReport: React.FC<ComprehensiveReportProps> = ({ claims }) => {
  // Structure: Code -> Payer -> Stats
  const reportData = useMemo(() => {
    const map: Record<string, Record<string, { units: number, paidUnits: number, unpaidUnits: number, amount: number }>> = {};
    claims.forEach(c => {
      if (!map[c.cpt]) map[c.cpt] = {};
      if (!map[c.cpt][c.payer]) map[c.cpt][c.payer] = { units: 0, paidUnits: 0, unpaidUnits: 0, amount: 0 };
      
      const record = map[c.cpt][c.payer];
      record.units += c.units;
      if (c.isPaid) {
        record.paidUnits += c.units;
        record.amount += c.paid;
      } else {
        record.unpaidUnits += c.units;
      }
    });
    return map;
  }, [claims]);

  const codes = Object.keys(reportData).sort();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-5 border-b border-gray-200 bg-gray-50">
        <h3 className="font-bold text-lg text-gray-900">Comprehensive CPT Report</h3>
        <p className="text-sm text-gray-500">Detailed breakdown by Payer including unit disposition</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-6 py-3 w-32">CPT Code</th>
              <th className="px-6 py-3">Payer Breakdown</th>
              <th className="px-6 py-3 text-right w-32">Total Units</th>
              <th className="px-6 py-3 text-right w-32">Total Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {codes.map(code => {
              const payers = reportData[code];
              const payerNames = Object.keys(payers).sort();
              const totalUnits = payerNames.reduce((s, p) => s + payers[p].units, 0);
              const totalAmount = payerNames.reduce((s, p) => s + payers[p].amount, 0);

              return (
                <tr key={code} className="align-top hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-bold text-blue-600 bg-gray-50/30 border-r border-gray-100">{code}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-3">
                      {payerNames.map(payer => {
                        const pData = payers[payer];
                        return (
                          <div key={payer} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-medium text-gray-800 flex items-center gap-2 w-1/3">
                              <CreditCard className="w-3 h-3 text-gray-400" /> {payer}
                            </span>
                            
                            <div className="flex gap-4 text-xs w-2/3 justify-end">
                              <div className="flex flex-col items-end min-w-[60px]">
                                <span className="text-gray-500 uppercase text-[10px]">Total</span>
                                <span className="font-medium">{pData.units}</span>
                              </div>
                              <div className="flex flex-col items-end min-w-[60px]">
                                <span className="text-green-600 uppercase text-[10px]">Paid Units</span>
                                <span className="text-green-700 font-medium">{pData.paidUnits}</span>
                              </div>
                              <div className="flex flex-col items-end min-w-[60px]">
                                <span className="text-red-500 uppercase text-[10px]">Unpaid</span>
                                <span className="text-red-600 font-bold">{pData.unpaidUnits}</span>
                              </div>
                              <div className="flex flex-col items-end min-w-[80px]">
                                <span className="text-gray-500 uppercase text-[10px]">Amount</span>
                                <span className="font-medium text-gray-900">{formatMoney(pData.amount)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">{totalUnits}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">{formatMoney(totalAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Component: Denial Analytics & Reimbursement Matrix ---

interface DenialAnalyticsProps {
  claims: Claim[];
  providerName: string;
}

interface DenialStat {
  units: number;
  charges: number;
  projected: number;
  codes: Record<string, number>;
}

export const DenialAnalyticsTable: React.FC<DenialAnalyticsProps> = ({ claims, providerName }) => {
  const rates = useMemo(() => calculateReimbursementRates(claims), [claims]);
  
  const analytics = useMemo(() => {
    const map: Record<string, DenialStat> = {};
    
    claims.filter(c => !c.isPaid).forEach(c => {
      if (!map[c.payer]) map[c.payer] = { units: 0, charges: 0, projected: 0, codes: {} };
      map[c.payer].units += c.units;
      map[c.payer].charges += c.charge;
      map[c.payer].codes[c.cpt] = (map[c.payer].codes[c.cpt] || 0) + c.units;
      
      // Reimbursement logic
      const expected = rates.get(c.payer)?.get(c.cpt)?.expectedRate || 0;
      map[c.payer].projected += (c.units * expected);
    });
    return map;
  }, [claims, rates]);

  const sortedPayers = Object.keys(analytics).sort((a, b) => analytics[b].projected - analytics[a].projected);

  return (
    <div className="space-y-8">
      {/* Denial Opportunity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200 bg-red-50">
          <h3 className="font-bold text-lg text-red-900">Estimated Revenue Denied</h3>
          <p className="text-sm text-red-700 mt-1">
            Calculated revenue lost based on actual historical payments (Mode/Max) from each payer.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-red-100/50 text-red-900">
              <tr>
                <th className="px-6 py-3">Payer</th>
                <th className="px-6 py-3 text-right">Denied Units</th>
                <th className="px-6 py-3 text-right">Est. Revenue Denied ($)</th>
                <th className="px-6 py-3">Top Denied Codes (Units)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedPayers.map(payer => {
                const row = analytics[payer];
                const topCodes = Object.entries(row.codes)
                  .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([code, count]) => `${code} (${count})`)
                  .join(', ');

                return (
                  <tr key={payer} className="hover:bg-red-50/30 text-gray-900">
                    <td className="px-6 py-4 font-medium">{payer}</td>
                    <td className="px-6 py-4 text-right">{row.units}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-700 bg-green-50/50 rounded">
                      {formatMoney(row.projected)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">{topCodes}</td>
                  </tr>
                );
              })}
              {sortedPayers.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No denials found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payer Reimbursement Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
         <div className="p-5 border-b border-gray-200 bg-blue-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-blue-900">Payer Reimbursement Matrix</h3>
              <p className="text-sm text-blue-700 mt-1">Actual fee schedule derived from paid claims (Mode/Max Logic).</p>
            </div>
            <Info className="text-blue-400 w-5 h-5" />
         </div>
         <div className="overflow-x-auto max-h-[500px]">
           <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3">Payer</th>
                  <th className="px-6 py-3">CPT Code</th>
                  <th className="px-6 py-3 text-right">Expected Rate / Unit</th>
                  <th className="px-6 py-3 text-center">Method</th>
                  <th className="px-6 py-3 text-center">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {Array.from(rates.keys()).sort().map(payer => {
                  const cptMap = rates.get(payer)!;
                  return Array.from(cptMap.keys()).sort().map((cpt, idx) => {
                    const data = cptMap.get(cpt)!;
                    return (
                      <tr key={`${payer}-${cpt}`} className="hover:bg-gray-50 text-gray-900">
                        {idx === 0 && (
                          <td rowSpan={cptMap.size} className="px-6 py-4 font-medium align-top bg-gray-50/30 border-r border-gray-100">
                            {payer}
                          </td>
                        )}
                        <td className="px-6 py-3 font-mono text-blue-600 font-semibold">{cpt}</td>
                        <td className="px-6 py-3 text-right font-bold text-gray-800">{formatMoney(data.expectedRate)}</td>
                        <td className="px-6 py-3 text-center text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded ${data.method === 'Mode' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {data.method}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center text-gray-500">{data.frequency}x</td>
                      </tr>
                    );
                  });
                })}
              </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};
