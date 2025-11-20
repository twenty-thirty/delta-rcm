
import React, { useMemo } from 'react';
import { Claim, PatientStat } from '../types';
import { analyzePatients } from '../utils/analytics';
import { formatMoney } from '../utils/parser';
import { User, TrendingUp, Calendar } from 'lucide-react';

interface PatientAnalyticsProps {
  claims: Claim[];
}

export const PatientAnalytics: React.FC<PatientAnalyticsProps> = ({ claims }) => {
  const patients = useMemo(() => analyzePatients(claims), [claims]);
  
  const topByRevenue = [...patients].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
  const topByVisits = [...patients].sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600"><User className="w-6 h-6" /></div>
            <div>
               <p className="text-sm text-gray-500">Total Unique Patients</p>
               <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600"><TrendingUp className="w-6 h-6" /></div>
            <div>
               <p className="text-sm text-gray-500">Avg Revenue per Patient</p>
               <p className="text-2xl font-bold text-gray-900">
                 {patients.length ? formatMoney(claims.reduce((s,c)=>s+c.paid,0) / patients.length) : '$0.00'}
               </p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
           <div className="p-5 border-b border-gray-200 bg-white">
              <h3 className="font-bold text-gray-900">Top 10 Patients by Revenue</h3>
           </div>
           <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500">
                 <tr>
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-5 py-3">Payer</th>
                    <th className="px-5 py-3 text-right">Total Paid</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {topByRevenue.map(p => (
                    <tr key={p.patientId} className="hover:bg-gray-50">
                       <td className="px-5 py-3 font-medium text-gray-900">{p.patientName} <span className="text-xs text-gray-400 block">{p.patientId}</span></td>
                       <td className="px-5 py-3 text-gray-500">{p.payer}</td>
                       <td className="px-5 py-3 text-right font-bold text-green-700">{formatMoney(p.totalRevenue)}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Top Frequency */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
           <div className="p-5 border-b border-gray-200 bg-white">
              <h3 className="font-bold text-gray-900">Top 10 Frequent Visitors</h3>
           </div>
           <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500">
                 <tr>
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-5 py-3">Last Visit</th>
                    <th className="px-5 py-3 text-right">Visits</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {topByVisits.map(p => (
                    <tr key={p.patientId} className="hover:bg-gray-50">
                       <td className="px-5 py-3 font-medium text-gray-900">{p.patientName}</td>
                       <td className="px-5 py-3 text-gray-500">{p.lastVisit?.toLocaleDateString()}</td>
                       <td className="px-5 py-3 text-right font-bold text-blue-700">{p.totalVisits}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};
