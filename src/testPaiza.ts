async function testLang(lang, code) {
  try {
    const res = await fetch('https://api.paiza.io/runners/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: code,
        language: lang,
        api_key: 'guest'
      })
    });
    const data = await res.json();

    await new Promise(r => setTimeout(r, 2000));

    const res2 = await fetch('https://api.paiza.io/runners/get_details?id=' + data.id + '&api_key=guest');
    const data2 = await res2.json();
    console.log(lang, data2.stdout, data2.stderr, data2.build_stderr);
  } catch (e) {
    console.error(e);
  }
}

testLang('csharp', 'using System; class Program { static void Main() { Console.WriteLine("Hello C#"); } }');
testLang('javascript', 'console.log("Hello JS");');
testLang('mysql', 'CREATE TABLE users (id INT, name VARCHAR(50)); INSERT INTO users VALUES (1, "Alice"); SELECT * FROM users;');
