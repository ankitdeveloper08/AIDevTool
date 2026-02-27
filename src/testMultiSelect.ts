import { executeCode } from './utils/execute';

async function test() {
  const code = `
CREATE TABLE test1 (id INT, val VARCHAR(10));
INSERT INTO test1 VALUES (1, 'A'), (2, 'B');
SELECT * FROM test1;
SELECT '--- separator ---' as msg;
SELECT * FROM test1 WHERE id = 1;
  `;
  const res = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'mysql', code })
  });
  const data = await res.json();
  console.log(JSON.stringify(data.output));
}
test();
