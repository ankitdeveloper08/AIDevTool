const output = "id\tval\n1\tA\n2\tB\nid\tval\n1\tA\n2\tB\n";

const lines = output.trim().split('\n');
const tables = [];
let currentTable = null;

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

console.log(JSON.stringify(tables, null, 2));
