import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { formatMoney } from '../utils/parser';
import { MonthlyStat, PayerDenialStats } from '../types';

interface MonthlyTrendProps {
  data: MonthlyStat[];
}

export const MonthlyTrendChart: React.FC<MonthlyTrendProps> = ({ data }) => {
  // Sort chronologically
  const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{fontSize: 12}} />
          <YAxis tickFormatter={(val) => `$${val}`} tick={{fontSize: 12}} />
          <Tooltip 
            formatter={(val: number) => formatMoney(val)}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
          <Bar dataKey="paid" name="Amount Paid ($)" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface DenialChartProps {
  data: PayerDenialStats[];
}

export const DenialChart: React.FC<DenialChartProps> = ({ data }) => {
  // Top 10 payers by denied units
  const topData = [...data].sort((a, b) => b.deniedUnits - a.deniedUnits).slice(0, 10);

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          layout="vertical" 
          data={topData} 
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
          <XAxis type="number" />
          <YAxis dataKey="payer" type="category" width={120} tick={{fontSize: 11}} interval={0} />
          <Tooltip 
            cursor={{fill: '#fee2e2', opacity: 0.4}}
            contentStyle={{ borderRadius: '8px' }}
          />
          <Legend />
          <Bar dataKey="deniedUnits" name="Denied Units" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
