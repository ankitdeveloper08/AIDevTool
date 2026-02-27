import { executeCode } from './utils/execute';

async function test() {
  const code = `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name VARCHAR(50));
INSERT INTO employees VALUES (1, 'Alice');
SELECT * FROM employees;
  `;
  const res = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'mysql', code })
  });
  const data = await res.json();
  console.log(data);
}
test();
