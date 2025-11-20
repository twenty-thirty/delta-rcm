
import React, { useMemo, useState } from 'react';
import { Claim } from '../types';
import { formatMoney } from '../utils/parser';
import { Calendar, ChevronDown, ChevronRight, Filter, SortAsc, SortDesc } from 'lucide-react';

interface DetailedGridProps {
  claims: Claim[];
  providerName: string;
}

type SortOrder = 'asc' | 'desc';
type SortKey = 'date' | 'status';

export const DetailedClaimsGrid: React.FC<DetailedGridProps> = ({ claims, providerName }) => {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set()); // All collapsed by default, or change to all open
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc'); // Default chronological ascending (Oct -> Nov)
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Toggle logic
  const toggleMonth = (month: string) => {
    const newSet = new Set(expandedMonths);
    if (newSet.has(month)) newSet.delete(month);
    else newSet.add(month);
    setExpandedMonths(newSet);
  };

  // 1. Filter
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      if (statusFilter === 'paid') return c.isPaid;
      if (statusFilter === 'unpaid') return !c.isPaid;
      return true;
    });
  }, [claims, statusFilter]);

  // 2. Group
  const grouped = useMemo(() => {
    const groups: Record<string, Claim[]> = {};
    filteredClaims.forEach(c => {
      const date = c.dos;
      const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'Unknown Date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return groups;
  }, [filteredClaims]);

  // 3. Sort Months
  const sortedMonths = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      if (a === 'Unknown Date') return 1;
      if (b === 'Unknown Date') return -1;
      return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });
  }, [grouped, sortOrder]);

  // Initial expand effect (optional: expand all on load? or expand first?)
  // Let's expand all by default for visibility
  useMemo(() => {
    if (sortedMonths.length > 0 && expandedMonths.size === 0) {
       setExpandedMonths(new Set(sortedMonths));
    }
  }, [sortedMonths.length]); // Run once when data loads

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col animate-fade-in">
      {/* Header Controls */}
      <div className="p-5 border-b border-gray-200 bg-white rounded-t-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900">Detailed Claims List for <span className="text-blue-600">{providerName}</span></h3>
          <p className="text-sm text-gray-500 mt-1">
            {filteredClaims.length} claims found
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Sort Toggle */}
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-gray-500" /> : <SortDesc className="w-4 h-4 text-gray-500" />}
            {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
          </button>

          {/* Status Filter */}
          <div className="relative">
             <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                  className="bg-transparent outline-none text-gray-700 appearance-none pr-6 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid Only</option>
                  <option value="unpaid">Unpaid Only</option>
                </select>
             </div>
          </div>
        </div>
      </div>
      
      {/* List */}
      <div className="flex-grow bg-gray-50">
        {sortedMonths.map(month => {
           const monthClaims = grouped[month];
           // Sort inside month? Usually sort by date asc inside month
           monthClaims.sort((a,b) => (a.dateSort || 0) - (b.dateSort || 0));

           const isOpen = expandedMonths.has(month);
           const totalMonth = monthClaims.reduce((s,c) => s + c.paid, 0);

           return (
            <div key={month} className="border-b border-gray-200 bg-white mb-2 last:mb-0 shadow-sm">
              <div 
                onClick={() => toggleMonth(month)}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-5 h-5 text-blue-500" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  <div className="flex flex-col">
                     <span className="font-bold text-gray-800 text-base">
                        {month === 'Unknown Date' ? month : new Date(month + '-02').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                     </span>
                     <span className="text-xs text-gray-500">{monthClaims.length} claims</span>
                  </div>
                </div>
                <div className="font-mono font-semibold text-gray-700 text-sm bg-gray-100 px-3 py-1 rounded-full">
                   {formatMoney(totalMonth)}
                </div>
              </div>
              
              {isOpen && (
                <div className="overflow-x-auto border-t border-gray-100 animate-fade-in">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50/50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-5 py-2 w-24">Date</th>
                        <th className="px-5 py-2">Patient</th>
                        <th className="px-5 py-2">ID</th>
                        <th className="px-5 py-2">Payer</th>
                        <th className="px-5 py-2 w-20">CPT</th>
                        <th className="px-5 py-2 text-right w-20">Units</th>
                        <th className="px-5 py-2 text-right w-32">Charges</th>
                        <th className="px-5 py-2 text-right w-32">Paid</th>
                        <th className="px-5 py-2 text-center w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthClaims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                          <td className="px-5 py-3 text-gray-900">{claim.dos?.toLocaleDateString() || '-'}</td>
                          <td className="px-5 py-3 font-medium text-gray-900">{claim.patientName}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{claim.patientId}</td>
                          <td className="px-5 py-3 text-gray-700 max-w-[150px] truncate" title={claim.payer}>{claim.payer}</td>
                          <td className="px-5 py-3 font-mono text-blue-600 font-medium">{claim.cpt}</td>
                          <td className="px-5 py-3 text-right text-gray-900">{claim.units}</td>
                          <td className="px-5 py-3 text-right text-gray-400">{formatMoney(claim.charge)}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-900">{formatMoney(claim.paid)}</td>
                          <td className="px-5 py-3 text-center">
                            {claim.isPaid ? (
                              <span className="inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-800 bg-green-100 rounded-full">Paid</span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-800 bg-red-100 rounded-full">Unpaid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
           );
        })}
      </div>
    </div>
  );
};
