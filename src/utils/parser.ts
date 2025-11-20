
import { Claim, CodeType } from '../types';

declare const XLSX: any;

// --- Helpers ---

const normalizeMoney = (str: string | number | undefined): number => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  let s = String(str).replace(/[$,\s]/g, '').trim();
  if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const parseDOS = (str: string | undefined): Date | null => {
  if (!str) return null;
  const s = String(str).trim();
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  // US MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let y = +mdy[3];
    if (y < 100) y += 2000;
    return new Date(y, +mdy[1] - 1, +mdy[2]);
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
};

const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length) || '';
  return firstLine.includes('\t') ? '\t' : ',';
};

const normalizePayerName = (raw: string): string => {
  if (!raw) return 'Unknown Payer';
  const upper = raw.toUpperCase().trim();
  
  // UnitedHealthcare Normalization
  if (
    upper.includes('UNITED HEALTH') || 
    upper.includes('UNITEDHEALTH') || 
    upper.includes('UHC') || 
    upper === 'UNITED'
  ) {
    return 'UnitedHealthcare';
  }

  return raw.trim();
};

const determineCodeType = (cpt: string): CodeType => {
  const upperCpt = cpt.toUpperCase();
  if (/^[AQL]/.test(upperCpt)) return CodeType.AQL;
  if (/^\d/.test(upperCpt)) return CodeType.NUMERIC;
  return CodeType.OTHER;
};

const parseCSVLine = (text: string, delim: string): string[][] => {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delim) {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c !== '\r') {
        field += c;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

// --- CSV Parser ---

export const parseClaimsData = (text: string, fallbackProvider: string): Claim[] => {
  const delim = detectDelimiter(text);
  const rawRows = parseCSVLine(text, delim);
  
  if (rawRows.length < 2) return [];

  const header = rawRows[0].map(h => h.toLowerCase().trim());
  const dataRows = rawRows.slice(1);

  const findIdx = (candidates: string[]) => {
    for (const cand of candidates) {
      const i = header.indexOf(cand);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iCPT = findIdx(['cpt', 'procedure code', 'proc code']);
  const iUnits = findIdx(['days_or_units', 'units', 'days', 'qty']);
  const iCharges = findIdx(['charges', 'charge', 'billed']);
  const iPaid = findIdx(['insurance_payment', 'paid', 'payment', 'ins paid']);
  const iPatientID = findIdx(['patient_id', 'id', 'mrn', 'account number']);
  const iPatientName = findIdx(['patient_name', 'patient', 'name', 'patient name']);
  const iPayer = findIdx(['insurance provider', 'payer', 'insurance', 'plan', 'insurance_name']);
  const iDOS = findIdx(['date_of_service', 'dos', 'date', 'service date']);
  const iProvider = findIdx(['provider', 'rendering provider', 'rendering_provider', 'attending']);

  if (iCPT === -1) throw new Error("Could not find a 'CPT' column header in CSV.");

  const claims: Claim[] = [];
  let idCounter = 1;

  for (const row of dataRows) {
    if (!row[iCPT]) continue;
    const cpt = row[iCPT].trim();
    if (!cpt) continue;

    const units = parseFloat(row[iUnits]) || 0;
    const charge = normalizeMoney(row[iCharges]);
    const paid = Math.abs(normalizeMoney(row[iPaid]));
    const provider = (iProvider !== -1 ? row[iProvider] : '') || fallbackProvider || 'Unknown Provider';
    const rawPayer = (iPayer !== -1 ? row[iPayer] : '') || 'Unknown Payer';
    const payer = normalizePayerName(rawPayer);
    const patientId = (iPatientID !== -1 ? row[iPatientID] : '') || 'Unknown ID';
    const patientName = (iPatientName !== -1 ? row[iPatientName] : '') || 'Unknown Patient';
    const dos = parseDOS(iDOS !== -1 ? row[iDOS] : undefined);
    const codeType = determineCodeType(cpt);

    claims.push({
      id: idCounter++,
      provider,
      cpt: cpt.toUpperCase(),
      codeType,
      units,
      charge,
      paid,
      isPaid: paid > 0.01,
      patientId,
      patientName,
      payer,
      dos,
      dateSort: dos ? dos.getTime() : 0
    });
  }

  return claims;
};

// --- Excel Parser (Unstructured Report) ---

export const parseExcelReport = (buffer: ArrayBuffer, fallbackProvider: string): Claim[] => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  // header:1 returns array of arrays
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

  const claims: Claim[] = [];
  let idCounter = 1;
  let currentPatientInfo: any = {};
  
  // 1. Determine Report Type by finding header row
  const headerRowIndex = rows.findIndex(row => 
    row.some(cell => {
      if (typeof cell !== 'string') return false;
      const c = cell.toLowerCase().trim();
      return c === 'date of service' || c === 'dos';
    })
  );

  if (headerRowIndex === -1) {
    throw new Error("Could not find 'Date of Service' or 'DOS' header in Excel file.");
  }

  const headerRow = rows[headerRowIndex];
  const headerMap: Record<string, number> = {};
  headerRow.forEach((cell: any, index: number) => {
    if (typeof cell === 'string' && cell.trim() !== '') {
      headerMap[cell.trim().toLowerCase()] = index;
    }
  });

  // Detect Type
  // Type 1: Patient Visit Report (Has 'charges', 'insurance payment', 'patient:' info in rows)
  // Type 2: Applied Payment Report (Has 'applied payments', 'dos')
  const isPaymentReport = headerMap['applied payments'] !== undefined;

  if (isPaymentReport) {
    // --- PARSE TYPE 2: Applied Payments Report ---
    
    let currentProvider = fallbackProvider;
    
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => cell === "")) continue;
      const rowStr = row.join(' ').toLowerCase();

      // Detect Provider Context (e.g. "Provider Name: XINGBO SUN, DPM")
      if (rowStr.includes('provider name:')) {
        const cell = row.find(c => typeof c === 'string' && c.toLowerCase().includes('provider name:'));
        if (cell) {
           currentProvider = String(cell).replace(/provider name:/i, '').trim() || currentProvider;
        }
        continue;
      }

      // Data Row Check
      const dosVal = headerMap['dos'] !== undefined ? row[headerMap['dos']] : null;
      const cptVal = headerMap['cpt'] !== undefined ? row[headerMap['cpt']] : null;

      if (dosVal && cptVal) {
         // Skip Adjustments if column exists
         const descIdx = headerMap['desc.'];
         if (descIdx !== undefined) {
             const desc = String(row[descIdx]).toLowerCase();
             if (desc.includes('adj')) continue;
         }

         const appliedPayment = normalizeMoney(row[headerMap['applied payments']]);
         const paid = Math.abs(appliedPayment);
         
         const patName = headerMap['patient name'] !== undefined ? String(row[headerMap['patient name']]) : 'Unknown';
         const patId = headerMap['patient id'] !== undefined ? String(row[headerMap['patient id']]) : 'Unknown';
         const payer = headerMap['payer'] !== undefined ? normalizePayerName(String(row[headerMap['payer']])) : 'Unknown Payer';
         
         const dos = parseDOS(dosVal);
         const cpt = String(cptVal).trim().toUpperCase();
         
         claims.push({
            id: idCounter++,
            provider: currentProvider || 'Unknown Provider',
            cpt: cpt,
            codeType: determineCodeType(cpt),
            units: 1, // Default to 1 unit for payment reports
            charge: 0, // Charges usually not shown in this specific report view
            paid: paid,
            isPaid: paid > 0.01,
            patientId: patId,
            patientName: patName,
            payer: payer,
            dos: dos,
            dateSort: dos ? dos.getTime() : 0
         });
      }
    }

  } else {
    // --- PARSE TYPE 1: Patient Visit Report ---

    // Helper to find key-value pairs in rows
    const findValueByKeyword = (row: any[], keyword: string): string => {
      const keywordLower = keyword.toLowerCase().replace(':', '');
      const cellIndex = row.findIndex(c => typeof c === 'string' && c.toLowerCase().includes(keywordLower));
      
      if (cellIndex === -1) return '';

      const cellText = String(row[cellIndex]);
      const potentialValue = cellText.replace(new RegExp(keyword, 'i'), '').replace(':', '').trim();
      if (potentialValue) return potentialValue;

      let valueIndex = cellIndex + 1;
      while (valueIndex < row.length) {
        const nextCell = row[valueIndex];
        if (nextCell !== "" && nextCell !== null && nextCell !== undefined) {
          return String(nextCell).trim();
        }
        valueIndex++;
      }
      return '';
    };

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => cell === "" || cell === null)) continue;
      
      const rowAsString = row.join(' ').toLowerCase();
      if (rowAsString.includes('sub total') || rowAsString.includes('page:')) continue;

      if (row.some(c => typeof c === 'string' && c.toLowerCase().startsWith('patient:'))) {
        currentPatientInfo = {};
        currentPatientInfo.Patient_Name = findValueByKeyword(row, 'Patient:');
        currentPatientInfo.Patient_ID = findValueByKeyword(row, 'Patient ID:');
        continue;
      }
      
      if (row.some(c => typeof c === 'string' && c.toLowerCase().startsWith('insurance:'))) {
        currentPatientInfo.Insurance = findValueByKeyword(row, 'Insurance:');
        currentPatientInfo.Provider = findValueByKeyword(row, 'Provider:');
        continue;
      }

      const dosIndex = headerMap['date of service'];
      const cptIndex = headerMap['cpt'];
      
      const dateOfService = (dosIndex !== undefined && row[dosIndex]) ? String(row[dosIndex]).trim() : '';
      const cptCode = (cptIndex !== undefined && row[cptIndex]) ? String(row[cptIndex]).trim() : '';

      if ((/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateOfService) || /^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) && cptCode) {
        
        const units = parseFloat(row[headerMap['days or units']]) || 0;
        const charges = normalizeMoney(row[headerMap['charges']]);
        const insPayment = normalizeMoney(row[headerMap['insurance payment']]);
        const paid = Math.abs(insPayment);

        const provider = currentPatientInfo.Provider || fallbackProvider || 'Unknown Provider';
        const payer = normalizePayerName(currentPatientInfo.Insurance || 'Unknown Payer');
        const dos = parseDOS(dateOfService);
        const codeType = determineCodeType(cptCode);

        claims.push({
          id: idCounter++,
          provider,
          cpt: cptCode.toUpperCase(),
          codeType,
          units,
          charge: charges,
          paid: paid,
          isPaid: paid > 0.01,
          patientId: currentPatientInfo.Patient_ID || 'Unknown ID',
          patientName: currentPatientInfo.Patient_Name || 'Unknown Patient',
          payer,
          dos,
          dateSort: dos ? dos.getTime() : 0
        });
      }
    }
  }

  return claims;
};

// --- Exporter ---

export const downloadCSV = (claims: Claim[]) => {
  const headers = [
    "Claim ID", "Provider", "Payer", "Patient Name", "Patient ID", "CPT", "Units", "DOS", "Charge", "Paid", "Status"
  ];

  const escape = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = claims.map(c => [
    c.id,
    c.provider,
    c.payer,
    c.patientName,
    c.patientId,
    c.cpt,
    c.units,
    c.dos ? c.dos.toISOString().split('T')[0] : '',
    c.charge.toFixed(2),
    c.paid.toFixed(2),
    c.isPaid ? 'Paid' : 'Unpaid'
  ]);

  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `claims_report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatMoney = (n: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
