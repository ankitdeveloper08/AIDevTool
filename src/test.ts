import { executeCode } from './utils/execute.ts';

async function test() {
  const res = await executeCode('python', 'print("Hello from paiza")');
  console.log(res);
}
test();
