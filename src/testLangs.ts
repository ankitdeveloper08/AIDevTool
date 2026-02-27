import { executeCode } from './utils/execute';

async function test() {
  const langs = ['c', 'cpp', 'java', 'typescript'];
  for (const lang of langs) {
    let code = '';
    if (lang === 'c') code = '#include <stdio.h>\\nint main() { printf("C works"); return 0; }';
    if (lang === 'cpp') code = '#include <iostream>\\nint main() { std::cout << "CPP works"; return 0; }';
    if (lang === 'java') code = 'public class Main { public static void main(String[] args) { System.out.println("Java works"); } }';
    if (lang === 'typescript') code = 'const x: string = "TS works"; console.log(x);';
    
    const res = await fetch('http://localhost:3000/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, code })
    });
    const data = await res.json();
    console.log(lang, data);
  }
}
test();
