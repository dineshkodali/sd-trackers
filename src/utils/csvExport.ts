export interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export function exportTableToCsv(options: CsvExportOptions): void {
  const { filename, headers, rows } = options;

  const escapeCsvValue = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const stringVal = String(val);
    // If the string contains quotes, commas, newlines, wrap in quotes and escape internal quotes
    if (stringVal.includes('"') || stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r')) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return `"${stringVal}"`;
  };

  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCsvValue).join(','));

  // Data rows
  rows.forEach(row => {
    csvRows.push(row.map(escapeCsvValue).join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\r\n'); // Add UTF-8 BOM for Microsoft Excel compatibility
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
