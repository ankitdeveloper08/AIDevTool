export interface SQLColumn {
  name: string;
  type: string;
}

export interface SQLOutputTable {
  headers: string[];
  rows: string[][];
}

export const parseSQLOutput = (output: string): SQLOutputTable[] => {
  if (!output || !output.trim()) return [];
  
  const lines = output.trim().split('\n');
  const tables: SQLOutputTable[] = [];
  let currentTable: SQLOutputTable | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split('\t');
    
    if (!currentTable) {
      currentTable = { headers: cells, rows: [] };
    } else {
      if (cells.length === currentTable.headers.length && JSON.stringify(cells) !== JSON.stringify(currentTable.headers)) {
        currentTable.rows.push(cells);
      } else {
        tables.push(currentTable);
        currentTable = { headers: cells, rows: [] };
      }
    }
  }
  if (currentTable) tables.push(currentTable);
  
  return tables;
};

export const parseSQLTables = (sql: string): Record<string, SQLColumn[]> => {
  const tables: Record<string, SQLColumn[]> = {};
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\`?(\w+)\`?\s*\(([\s\S]*?)\);/gi;
  
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    
    const columnLines: string[] = [];
    let currentLine = '';
    let parenDepth = 0;
    
    for (let i = 0; i < columnsStr.length; i++) {
      const char = columnsStr[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        columnLines.push(currentLine);
        currentLine = '';
        continue;
      }
      currentLine += char;
    }
    if (currentLine) columnLines.push(currentLine);
    
    const columns = columnLines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      if (/^(PRIMARY|FOREIGN|UNIQUE|KEY|CONSTRAINT)\b/i.test(trimmed)) return null;
      
      const colMatch = trimmed.match(/^(\`?\w+\`?)\s+([a-zA-Z0-9_]+(?:\s*\([^)]+\))?)/);
      if (colMatch) {
        return {
          name: colMatch[1].replace(/\`/g, ''),
          type: colMatch[2].toUpperCase()
        };
      }
      return null;
    }).filter(Boolean) as SQLColumn[];
    
    tables[tableName] = columns;
  }
  return tables;
};
