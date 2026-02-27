const sql = `CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  department VARCHAR(50),
  salary DECIMAL(10, 2)
);`;

const parseSQLTables = (sql) => {
  const tables = {};
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\`?(\w+)\`?\s*\(([\s\S]*?)\);/gi;
  
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    
    const columnLines = [];
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
      
      const match = trimmed.match(/^(\`?\w+\`?)\s+([a-zA-Z0-9_]+(?:\s*\([^)]+\))?)/);
      if (match) {
        return {
          name: match[1].replace(/\`/g, ''),
          type: match[2].toUpperCase()
        };
      }
      return null;
    }).filter(Boolean);
    
    tables[tableName] = columns;
  }
  return tables;
};

console.log(parseSQLTables(sql));
