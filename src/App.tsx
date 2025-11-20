
import React, { useState, useMemo } from 'react';
import { UploadScreen } from './components/UploadScreen';
import { downloadCSV, formatMoney } from './utils/parser';
import { calculateReimbursementRates, calculateDenialOpportunity } from './utils/analytics';
import { Claim, MonthlyStat, PayerDenialStats } from './types';
import { MonthlyTrendChart, DenialChart } from './components/DashboardCharts';
import { CPTPerformanceReport, ComprehensiveReport, DenialAnalyticsTable, AQLSummaryTable } from './components/SummaryTables';
import { DetailedClaimsGrid } from './components/DetailedGrid';
import { PatientAnalytics } from './components/PatientAnalytics';
import { Download, RefreshCw, AlertCircle, CheckCircle, DollarSign, BarChart2, Layout, FileText, Users } from 'lucide-react';

const App: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [hasData, setHasData] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'denials' | 'patients' | 'details'>('overview');

  const handleDataLoaded = (loadedClaims: Claim[], inputProvider: string) => {
    try {
      if (loadedClaims.length === 0) {
        alert("No valid claims found.");
        return;
      }
      
      // Deduce provider name if not manually supplied
      let finalProvider = inputProvider;
      if (!finalProvider && loadedClaims.length > 0) {
        const counts: Record<string, number> = {};
        loadedClaims.forEach(c => counts[c.provider] = (counts[c.provider] || 0) + 1);
        const topProv = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
        finalProvider = topProv || 'Unknown Provider';
      } else if (!finalProvider) {
        finalProvider = 'Unknown Provider';
      }

      setClaims(loadedClaims);
      setProviderName(finalProvider);
      setHasData(true);
    } catch (e) {
      alert("Error loading data: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleReset = () => {
    setClaims([]);
    setHasData(false);
    setProviderName('');
    setActiveTab('overview');
  };

  // --- Analytics ---
  const rates = useMemo(() => calculateReimbursementRates(claims), [claims]);
  
  const kpis = useMemo(() => {
    const totalCollected = claims.reduce((acc, c) => acc + c.paid, 0);
    // Approximation of unique encounters based on PatientID + Date
    const totalEncounters = new Set(claims.map(c => c.patientId + (c.dos?.toISOString() || ''))).size; 
    const totalUnits = claims.reduce((acc, c) => acc + c.units, 0);
    const paidUnits = claims.filter(c => c.isPaid).reduce((acc, c) => acc + c.units, 0);
    const denialRate = totalUnits ? ((totalUnits - paidUnits) / totalUnits) * 100 : 0;
    
    // Calculate Opportunity
    const deniedStats = calculateDenialOpportunity(claims, rates);
    const projectedOpportunity = deniedStats.reduce((s, i) => s + i.projectedValue, 0);
    
    return { totalCollected, totalEncounters, totalUnits, paidUnits, denialRate, projectedOpportunity };
  }, [claims, rates]);

  const monthlyData = useMemo<MonthlyStat[]>(() => {
    const map = new Map<string, MonthlyStat>();
    claims.forEach(c => {
      if (!c.dos) return;
      const key = `${c.dos.getFullYear()}-${String(c.dos.getMonth() + 1).padStart(2, '0')}`;
      const existing = map.get(key) || { month: key, paid: 0, units: 0 };
      existing.paid += c.paid;
      existing.units += c.units;
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [claims]);

  const payerDenials = useMemo<PayerDenialStats[]>(() => {
    // Re-using simple denial counts for chart, ignoring deep calculation for visual speed
    const map = new Map<string, PayerDenialStats>();
    claims.filter(c => !c.isPaid).forEach(c => {
      const existing = map.get(c.payer) || { payer: c.payer, deniedUnits: 0, deniedValue: 0, projectedValue: 0 };
      existing.deniedUnits += c.units;
      existing.deniedValue += c.charge;
      map.set(c.payer, existing);
    });
    return Array.from(map.values());
  }, [claims]);

  if (!hasData) {
    return <UploadScreen onDataLoaded={handleDataLoaded} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2 rounded-lg text-white">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xl text-gray-900 tracking-tight block leading-tight">ClaimsAlytics</span>
                <span className="text-xs text-gray-500 font-medium">Report for <span className="text-blue-600">{providerName}</span></span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => downloadCSV(claims)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-100"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" /> New Upload
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Dashboard & CPTs', icon: Layout },
              { id: 'financials', label: 'Detailed Financials', icon: DollarSign },
              { id: 'denials', label: 'Denials & Reimbursement', icon: AlertCircle },
              { id: 'patients', label: 'Patient Insights', icon: Users },
              { id: 'details', label: 'Claims Grid', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors outline-none
                  ${activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard 
            title="Total Collected" 
            value={formatMoney(kpis.totalCollected)} 
            icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} 
            trend="Total Paid Amount" 
            bg="bg-emerald-50" 
          />
          <KpiCard 
            title="Est. Revenue Denied" 
            value={formatMoney(kpis.projectedOpportunity)} 
            icon={<DollarSign className="w-6 h-6 text-amber-600" />} 
            trend="Based on Payor Matrix" 
            bg="bg-amber-50" 
            highlight 
          />
          <KpiCard 
            title="Denial Rate" 
            value={kpis.denialRate.toFixed(1) + '%'} 
            icon={<AlertCircle className="w-6 h-6 text-red-600" />} 
            trend="By Unit Volume" 
            negative={kpis.denialRate > 15} 
            bg="bg-red-50" 
          />
          <KpiCard 
            title="Unique Encounters" 
            value={kpis.totalEncounters.toLocaleString()} 
            icon={<Layout className="w-6 h-6 text-blue-600" />} 
            trend="Patient Visits" 
            bg="bg-blue-50" 
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Monthly Paid Trend</h3>
                <MonthlyTrendChart data={monthlyData} />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Volume by Payer (Denials)</h3>
                <DenialChart data={payerDenials} />
              </div>
            </div>
            <AQLSummaryTable claims={claims} />
            <CPTPerformanceReport claims={claims} />
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="space-y-6 animate-fade-in">
             <ComprehensiveReport claims={claims} />
          </div>
        )}

        {activeTab === 'denials' && (
           <div className="space-y-6 animate-fade-in">
             <DenialAnalyticsTable claims={claims} providerName={providerName} />
           </div>
        )}

        {activeTab === 'patients' && (
            <div className="animate-fade-in">
              <PatientAnalytics claims={claims} />
            </div>
        )}

        {activeTab === 'details' && (
          <DetailedClaimsGrid claims={claims} providerName={providerName} />
        )}

      </main>
    </div>
  );
};

const KpiCard = ({ title, value, icon, trend, negative = false, highlight = false, bg = 'bg-gray-50' }: any) => (
  <div className={`p-6 rounded-xl shadow-sm border flex flex-col hover:shadow-md transition-shadow ${highlight ? 'bg-white border-amber-200 ring-1 ring-amber-100' : 'bg-white border-gray-200'}`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        <h3 className={`text-2xl font-bold mt-2 ${negative ? 'text-red-600' : highlight ? 'text-amber-600' : 'text-gray-900'}`}>{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${bg}`}>
        {icon}
      </div>
    </div>
    <p className="text-xs text-gray-400 mt-auto font-medium">{trend}</p>
  </div>
);

export default App;
