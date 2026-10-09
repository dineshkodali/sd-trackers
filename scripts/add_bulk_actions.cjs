const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('View.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (!content.includes('<table')) continue;
      if (content.includes('BulkActionToolbar')) continue; // already added

      // 1. Add import
      content = content.replace(/(import .* from .*;)/, `$1\nimport { BulkActionToolbar } from '../common/BulkActionToolbar';`);

      // 2. Add requestConfirmation if useApp is used
      content = content.replace(/useApp\(\);\s*$/, 'requestConfirmation } = useApp();');
      content = content.replace(/,\s*requestConfirmation\s*}\s*=\s*useApp\(\);/, ' } = useApp();'); // revert bad replace if it happened

      // Better way to add requestConfirmation:
      if (content.includes('useApp();') && !content.includes('requestConfirmation')) {
        content = content.replace(/(const \{[^}]+)} = useApp\(\);/, '$1, requestConfirmation } = useApp();');
      }

      // 3. Add state and handlers
      const handlerStr = `
  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedData?.map(p => p.id) || []); };
  const handleToggleSelect = (e: any, id: string) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected', message: 'Are you sure you want to delete selected items?', isDanger: true,
        onConfirm: async () => { /* Add logic */ setSelectedIds([]); }
      });
    }
  };
`;
      content = content.replace(/(const \[searchQuery, setSearchQuery\][^;]*;)/, `$1\n${handlerStr}`);

      // 4. Add toolbar before closing div (crude but might work if we find last </div>)
      if (content.includes('</Pagination>')) {
        content = content.replace(/(<\/Pagination>[\s\S]*?)(<\/div>)/, `$1\n      <BulkActionToolbar selectedCount={selectedIds.length} totalCount={100} onClearSelection={() => setSelectedIds([])} onSelectAll={handleToggleSelectAll} onDeleteSelected={handleDeleteSelected} />\n$2`);
      }

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(path.join(__dirname, 'src', 'components'));
console.log('Codemod complete');
