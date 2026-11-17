import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Plus, X, Database, Loader2, Layout, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, ChevronsDownUp, Search, Files, FileCode2, FilePlus2 } from 'lucide-react';
import { cn } from './utils/cn';
import { LANGUAGES } from './constants/languages';
import { executeCode } from './utils/execute';
import { SQL_SETUP_SCRIPT, SQL_TABLES } from './constants/sqlDatabase';
import { parseSQLOutput } from './utils/sqlParser';

const LANGUAGE_MARKS: Record<string, { label: string; color: string; background: string }> = {
  html: { label: '5', color: '#e34f26', background: '#fff1ec' },
  python: { label: 'Py', color: '#3776ab', background: '#fff4cc' },
  javascript: { label: 'JS', color: '#171717', background: '#f0db4f' },
  java: { label: '☕', color: '#e76f00', background: '#fff4e8' },
  mysql: { label: 'My', color: '#087b9a', background: '#e7f7fa' },
  c: { label: 'C', color: '#1769aa', background: '#eaf3fc' },
  cpp: { label: 'C++', color: '#1769aa', background: '#eaf3fc' },
  csharp: { label: 'C#', color: '#823085', background: '#f7eafa' },
  node: { label: 'N', color: '#43853d', background: '#eaf5e8' },
  react: { label: '⚛', color: '#149eca', background: '#e8faff' },
  typescript: { label: 'TS', color: '#3178c6', background: '#eaf3ff' },
  css: { label: 'CSS', color: '#264de4', background: '#edf0ff' },
};

const LANGUAGE_CATEGORIES: Record<string, string[]> = {
  Popular: ['html', 'python', 'javascript', 'java', 'mysql', 'c', 'cpp', 'csharp', 'node', 'react'],
  Programming: ['python', 'javascript', 'java', 'c', 'cpp', 'csharp', 'node', 'typescript'],
  Web: ['html', 'javascript', 'css', 'react', 'typescript'],
  Databases: ['mysql'],
};

type SourceFile = { id: string; name: string; code: string };
type FilesByLanguage = Record<string, SourceFile[]>;

const FILE_EXTENSIONS: Record<string, string> = {
  javascript: 'js', python: 'py', csharp: 'cs', html: 'html', css: 'css',
  java: 'java', cpp: 'cpp', c: 'c', typescript: 'ts', sql: 'sql',
};

const FILES_STORAGE_KEY = 'compiler-world-files';
const LEGACY_MYSQL_DEFAULT_CODE = '-- The database is pre-populated with `employees`, `departments`, and `projects` tables.\n-- They are connected via `department_id`.\n\nSELECT * FROM employees;';
const REACT_DEFAULT_FILES: SourceFile[] = [
  {
    id: 'react-app',
    name: 'App.js',
    code: `function App() {
  const [count, setCount] = React.useState(0);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Hello, React!</h1>
      <p>You clicked {count} times.</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </main>
  );
}`,
  },
  {
    id: 'react-package',
    name: 'package.json',
    code: JSON.stringify({
      name: 'compiler-world-react-app',
      version: '1.0.0',
      dependencies: { react: '18.2.0', 'react-dom': '18.2.0' },
    }, null, 2),
  },
  {
    id: 'react-html',
    name: 'index.html',
    code: '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>React App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>',
  },
  {
    id: 'react-index',
    name: 'index.jsx',
    code: `const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
  },
];

const getDefaultFiles = (): FilesByLanguage => Object.fromEntries(
  LANGUAGES.map(lang => [lang.id, lang.id === 'react'
    ? REACT_DEFAULT_FILES
    : [{ id: `${lang.id}-main`, name: `main.${FILE_EXTENSIONS[lang.editorLang] ?? 'txt'}`, code: lang.defaultCode }]])
);

const loadFiles = (): FilesByLanguage => {
  const filesByLanguage = getDefaultFiles();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || 'null');
    if (typeof stored !== 'object' || stored === null) return filesByLanguage;
    const storedFiles = stored as Record<string, unknown>;
    LANGUAGES.forEach(lang => {
      const files = storedFiles[lang.id];
      if (!Array.isArray(files)) return;
      const validFiles = files.filter((file): file is SourceFile => {
        if (typeof file !== 'object' || file === null) return false;
        const candidate = file as Record<string, unknown>;
        return typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.code === 'string';
      });
      if (validFiles.length > 0) filesByLanguage[lang.id] = validFiles;
    });
    filesByLanguage.mysql = filesByLanguage.mysql.map(file =>
      file.id === 'mysql-main' && file.code.trim() === LEGACY_MYSQL_DEFAULT_CODE
        ? { ...file, code: LANGUAGES.find(lang => lang.id === 'mysql')!.defaultCode }
        : file
    );
    const storedReactFiles = filesByLanguage.react ?? [];
    filesByLanguage.react = [
      ...REACT_DEFAULT_FILES.map(defaultFile => storedReactFiles.find(file => file.name === defaultFile.name) ?? defaultFile),
      ...storedReactFiles.filter(file => !REACT_DEFAULT_FILES.some(defaultFile => defaultFile.name === file.name)),
    ];
  } catch {
    return filesByLanguage;
  }
  return filesByLanguage;
};

const getLanguageSlug = (languageId: string) => languageId === 'mysql' ? 'sql' : languageId;

const getLanguageFromPath = () => {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return LANGUAGES.find(lang => getLanguageSlug(lang.id) === slug);
};

export default function App() {
  const [isHome, setIsHome] = useState(() => !getLanguageFromPath());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Popular');
  const [activeLangId, setActiveLangId] = useState(() => getLanguageFromPath()?.id ?? LANGUAGES[0].id);
  const [isCompilerPickerOpen, setIsCompilerPickerOpen] = useState(false);
  const [compilerSearchQuery, setCompilerSearchQuery] = useState('');
  const [compilerCategory, setCompilerCategory] = useState('Popular');
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [filesByLang, setFilesByLang] = useState<FilesByLanguage>(loadFiles);
  const [activeFileByLang, setActiveFileByLang] = useState<Record<string, string>>({});
  const [outputMap, setOutputMap] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const compilerPickerRef = useRef<HTMLDivElement>(null);

  const [dbTables, setDbTables] = useState(SQL_TABLES);

  const activeLang = LANGUAGES.find(l => l.id === activeLangId)!;
  const activeLangFiles = filesByLang[activeLangId] ?? [];
  const activeFile = activeLangFiles.find(file => file.id === activeFileByLang[activeLangId]) ?? activeLangFiles[0];
  const code = activeFile?.code ?? '';
  const output = outputMap[activeLangId] || '';
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [isDbPanelOpen, setIsDbPanelOpen] = useState(true);
  
  const sqlOutputTables = activeLang.id === 'mysql' && output ? parseSQLOutput(output) : [];
  const visibleLanguages = LANGUAGES.filter(lang =>
    LANGUAGE_CATEGORIES[activeCategory].includes(lang.id) &&
    lang.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const pickerLanguages = LANGUAGES.filter(lang =>
    LANGUAGE_CATEGORIES[compilerCategory].includes(lang.id) &&
    lang.name.toLowerCase().includes(compilerSearchQuery.trim().toLowerCase())
  );

  const selectLanguage = (languageId: string) => {
    const path = `/${getLanguageSlug(languageId)}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setActiveLangId(languageId);
  };

  const addFile = () => {
    if (activeLang.id === 'mysql') return;
    const extension = FILE_EXTENSIONS[activeLang.editorLang] ?? 'txt';
    const fileNames = new Set(activeLangFiles.map(file => file.name));
    let number = 1;
    while (fileNames.has(`NewFile${number}.${extension}`)) number += 1;
    const file: SourceFile = {
      id: `${activeLangId}-${Date.now()}`,
      name: `NewFile${number}.${extension}`,
      code: '',
    };
    setFilesByLang(prev => ({ ...prev, [activeLangId]: [...(prev[activeLangId] ?? []), file] }));
    setActiveFileByLang(prev => ({ ...prev, [activeLangId]: file.id }));
  };

  const closeFile = (fileId: string) => {
    if (activeLangFiles.length <= 1) return;
    const closedIndex = activeLangFiles.findIndex(file => file.id === fileId);
    const remainingFiles = activeLangFiles.filter(file => file.id !== fileId);
    setFilesByLang(prev => ({ ...prev, [activeLangId]: remainingFiles }));
    if (activeFile?.id === fileId) {
      const nextFile = remainingFiles[Math.max(0, closedIndex - 1)];
      setActiveFileByLang(prev => ({ ...prev, [activeLangId]: nextFile.id }));
    }
  };

  useEffect(() => {
    const syncWithPath = () => {
      const language = getLanguageFromPath();
      setIsHome(!language);
      if (language) {
        setActiveLangId(language.id);
      } else if (window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
    };

    window.addEventListener('popstate', syncWithPath);
    return () => window.removeEventListener('popstate', syncWithPath);
  }, []);

  useEffect(() => {
    if (!isCompilerPickerOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !compilerPickerRef.current?.contains(event.target)) {
        setIsCompilerPickerOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCompilerPickerOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isCompilerPickerOpen]);

  useEffect(() => {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(filesByLang));
  }, [filesByLang]);

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const toggleAllTables = () => {
    if (expandedTables.length === dbTables.length) {
      setExpandedTables([]);
    } else {
      setExpandedTables(dbTables.map(t => t.name));
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    setFilesByLang(prev => ({
      ...prev,
      [activeLangId]: (prev[activeLangId] ?? []).map(file => file.id === activeFile.id ? { ...file, code: value } : file),
    }));
  };

  const generateSetupScript = (tables: typeof SQL_TABLES) => {
    let script = '';
    for (const table of tables) {
      script += `CREATE TABLE ${table.name} (\n`;
      script += table.columns.map(c => {
        let type = c.type;
        if (c.name === 'id') type += ' PRIMARY KEY';
        return `  ${c.name} ${type}`;
      }).join(',\n');
      script += `\n);\n\n`;
      
      if (table.data.length > 0) {
        script += `INSERT INTO ${table.name} (${table.columns.map(c => c.name).join(', ')}) VALUES \n`;
        script += table.data.map(row => {
          return `  (${row.map((val, i) => {
            if (val === null || val === undefined || val === 'NULL') return 'NULL';
            const type = table.columns[i].type.toUpperCase();
            const isNumeric = type.includes('INT') || type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUMERIC') || type.includes('REAL');
            if (isNumeric) return val;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ')})`;
        }).join(',\n') + ';\n\n';
      }
    }
    return script;
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutputMap(prev => ({ ...prev, [activeLangId]: '' }));

    if (activeLang.paizaLang) {
      // Backend execution
      let codeToRun = code;
      if (activeLang.id === 'mysql') {
        const dynamicSetupScript = generateSetupScript(dbTables);
        codeToRun = `${dynamicSetupScript}\n\n${code}\n\nSELECT '---SECRET_SEPARATOR---' AS separator_col;\nSELECT * FROM employees;\nSELECT * FROM departments;\nSELECT * FROM projects;`;
      }
      
      const result = await executeCode(activeLang.paizaLang, codeToRun);
      if (result.error) {
        setOutputMap(prev => ({ ...prev, [activeLangId]: `Error: ${result.error}` }));
      } else {
        let finalOutput = result.output || '';
        
        if (activeLang.id === 'mysql') {
          const parts = finalOutput.split('---SECRET_SEPARATOR---');
          if (parts.length > 1) {
            // The first part is the user's output, minus the "separator_col" header
            finalOutput = parts[0].replace(/separator_col\s*$/, '').trim();
            const dbStateOutput = parts[1].trim();
            const parsedTables = parseSQLOutput(dbStateOutput);
            
            if (parsedTables.length >= 3) {
              setDbTables([
                { ...SQL_TABLES[0], data: parsedTables[0].rows },
                { ...SQL_TABLES[1], data: parsedTables[1].rows },
                { ...SQL_TABLES[2], data: parsedTables[2].rows }
              ]);
            }
          }
        }
        
        if (!finalOutput) {
          if (activeLang.id === 'mysql' && /update|insert|delete|drop|create|alter/i.test(code)) {
            finalOutput = 'Query executed successfully.\n\nNote: UPDATE, INSERT, and DELETE statements do not return any rows. Check the Database Tables panel to see your changes.';
          } else {
            finalOutput = 'Executed successfully with no output.';
          }
        }
        
        setOutputMap(prev => ({ ...prev, [activeLangId]: finalOutput }));
      }
    } else {
      // Browser execution
      if (iframeRef.current) {
        let html = '';
        if (activeLang.id === 'react') {
          const reactFiles = filesByLang.react ?? [];
          const hasAppFile = reactFiles.some(file => file.name.toLowerCase() === 'app.js');
          const sourceFiles = reactFiles
            .filter(file => /\.(js|jsx|ts|tsx)$/i.test(file.name))
            .filter(file => !(hasAppFile && file.name.toLowerCase() === 'main.js'))
            .sort((a, b) => Number(a.name.toLowerCase() === 'index.jsx') - Number(b.name.toLowerCase() === 'index.jsx'));
          const reactSource = sourceFiles.map(file => file.code
            .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
            .replace(/\bexport\s+default\s+/g, '')
            .replace(/\bexport\s+(?=(?:function|class|const|let|var)\b)/g, '')
          ).join('\n\n');
          const htmlTemplate = reactFiles.find(file => file.name.toLowerCase() === 'index.html')?.code ?? '<!doctype html><html><head><title>React App</title></head><body><div id="root"></div></body></html>';
          const libraries = '<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body { margin: 0; font-family: sans-serif; }</style>';
          const htmlWithLibraries = htmlTemplate.includes('</head>')
            ? htmlTemplate.replace('</head>', `${libraries}</head>`)
            : `${libraries}${htmlTemplate}`;
          const projectScript = `<script type="text/babel">${reactSource}</script>`;
          html = htmlWithLibraries.includes('</body>')
            ? htmlWithLibraries.replace('</body>', `${projectScript}</body>`)
            : `${htmlWithLibraries}${projectScript}`;
        } else if (activeLang.id === 'javascript') {
          html = `
            <!DOCTYPE html>
            <html>
              <head>
                <style>body { margin: 0; font-family: sans-serif; }</style>
              </head>
              <body>
                <div id="root"></div>
                <script>
                  try {
                    ${code}
                  } catch (e) {
                    document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: monospace;">' + e.toString() + '</div>';
                  }
                </script>
              </body>
            </html>
          `;
        } else if (activeLang.id === 'html') {
          html = code;
        } else if (activeLang.id === 'css') {
          html = `
            <!DOCTYPE html>
            <html>
              <head>
                <style>${code}</style>
              </head>
              <body>
                <div class="box">CSS Preview Box</div>
              </body>
            </html>
          `;
        }
        iframeRef.current.srcdoc = html;
        setOutputMap(prev => ({ ...prev, [activeLangId]: 'Running in browser preview...' }));
      }
    }
    setIsRunning(false);
  };

  const sqlTerminalPanel = activeLang.id === 'mysql' && (
    <div className="flex h-64 shrink-0 flex-col border-t border-gray-800 bg-[#0f111a]">
      <div className="flex h-10 shrink-0 items-center border-b border-gray-800 bg-[#151822] px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Terminal Output</span>
      </div>
      <div className="flex-1 overflow-auto bg-[#0f111a] p-4">
        {!output ? (
          <span className="font-mono text-sm italic text-gray-600">Run your code to see the output here...</span>
        ) : sqlOutputTables.length > 0 ? (
          <div className="space-y-6">
            {sqlOutputTables.map((table, i) => (
              <div key={i} className="overflow-hidden rounded-md border border-gray-800 bg-[#151822]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-gray-800/50 text-gray-200">
                      <tr>
                        {table.headers.map((header, j) => (
                          <th key={j} className="whitespace-nowrap border-b border-gray-800 px-4 py-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="whitespace-nowrap px-4 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="whitespace-pre-wrap font-mono text-sm text-gray-300">{output}</div>
        )}
      </div>
    </div>
  );

  return isHome ? (
    <main className="min-h-screen bg-[#0f111a] text-gray-200">
      <section className="mx-auto max-w-[1720px] px-5 pb-12 pt-10 sm:px-8 lg:px-12">
        <label className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-4 rounded-2xl border border-gray-800 bg-[#151822] px-5 text-gray-400 shadow-sm focus-within:border-blue-500">
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <input
            aria-label="Search languages"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search by Language/ DB/ Template etc.,"
            className="h-full w-full bg-transparent text-base text-gray-100 outline-none placeholder:text-gray-500 sm:text-lg"
          />
        </label>

        <div className="mt-8 flex justify-center">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-[#151822] p-1" role="tablist" aria-label="Environment categories">
            {Object.keys(LANGUAGE_CATEGORIES).map(category => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-100 sm:px-4 sm:text-base',
                  activeCategory === category && 'bg-blue-600 font-semibold text-white shadow-sm'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-6">
          {visibleLanguages.map(lang => {
            const mark = LANGUAGE_MARKS[lang.id];
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  selectLanguage(lang.id);
                  setIsHome(false);
                }}
                className="flex h-[108px] items-center justify-between rounded-[20px] border border-gray-800 bg-[#151822] px-5 text-left transition-colors hover:border-blue-500/70 hover:bg-[#1a2030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <span className="text-base font-medium text-gray-100 sm:text-lg">{lang.name}</span>
                <span
                  aria-hidden="true"
                  className="flex h-[56px] min-w-[56px] items-center justify-center rounded-xl px-1 text-xl font-bold"
                  style={{ color: mark.color, backgroundColor: mark.background }}
                >
                  {mark.label}
                </span>
              </button>
            );
          })}
          {visibleLanguages.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-gray-500">No matching environments.</p>
          )}
        </div>
      </section>
    </main>
  ) : (
    <div className="flex h-screen w-full bg-[#0f111a] text-gray-300 font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-800 bg-[#151822] px-4">
          <div className="flex items-center gap-2 justify-self-start">
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, '', '/');
                setIsHome(true);
              }}
              className="mr-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-white transition-colors hover:bg-gray-800"
              title="Go to home"
            >
              <Layout className="h-5 w-5 text-blue-500" />
              <span className="font-semibold">Compiler World</span>
            </button>
          </div>
          <div className="flex items-center gap-2 justify-self-center">
            <div className="relative" ref={compilerPickerRef}>
              <button
                type="button"
                onClick={() => setIsCompilerPickerOpen(open => !open)}
                aria-expanded={isCompilerPickerOpen}
                aria-haspopup="dialog"
                className="flex items-center gap-2 rounded-md border border-gray-700 bg-[#0f111a] px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-gray-800"
              >
                <span>{activeLang.name}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isCompilerPickerOpen && 'rotate-180')} />
              </button>
              {isCompilerPickerOpen && (
                <div
                  role="dialog"
                  aria-label="Choose a compiler"
                  className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,40rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-700 bg-[#151822] p-4 shadow-2xl"
                >
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#0f111a] px-3 text-gray-400 focus-within:border-blue-500">
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <input
                      autoFocus
                      aria-label="Search compilers"
                      value={compilerSearchQuery}
                      onChange={event => setCompilerSearchQuery(event.target.value)}
                      placeholder="Search languages..."
                      className="h-full w-full bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
                    />
                  </label>
                  <div className="mt-3 flex gap-1 overflow-x-auto rounded-lg bg-[#0f111a] p-1" role="tablist" aria-label="Compiler categories">
                    {Object.keys(LANGUAGE_CATEGORIES).map(category => (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={compilerCategory === category}
                        onClick={() => setCompilerCategory(category)}
                        className={cn(
                          'shrink-0 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-100',
                          compilerCategory === category && 'bg-blue-600 font-semibold text-white'
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {pickerLanguages.map(lang => {
                      const mark = LANGUAGE_MARKS[lang.id];
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => {
                            selectLanguage(lang.id);
                            setIsHome(false);
                            setIsCompilerPickerOpen(false);
                          }}
                          className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0f111a] px-3 py-2 text-left transition-colors hover:border-blue-500/70 hover:bg-[#1a2030]"
                        >
                          <span className="text-sm font-medium text-gray-100">{lang.name}</span>
                          <span
                            aria-hidden="true"
                            className="flex h-9 min-w-9 items-center justify-center rounded-lg px-1 text-sm font-bold"
                            style={{ color: mark.color, backgroundColor: mark.background }}
                          >
                            {mark.label}
                          </span>
                        </button>
                      );
                    })}
                    {pickerLanguages.length === 0 && (
                      <p className="col-span-full py-6 text-center text-sm text-gray-500">No matching compilers.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Code
            </button>
          </div>
          <div aria-hidden="true" />
        </div>

        {/* Editor & Output Split */}
        <div className="flex flex-1 min-h-0 min-w-0">
          <aside className={cn('flex shrink-0 flex-col border-r border-gray-800 bg-[#151822] transition-[width] duration-200', isExplorerOpen ? 'w-56' : 'w-12')}>
            <div className={cn('flex h-11 shrink-0 items-center border-b border-gray-800 px-2', isExplorerOpen ? 'justify-between' : 'justify-center')}>
              <button
                type="button"
                onClick={() => setIsExplorerOpen(open => !open)}
                className={cn(
                  'flex items-center text-gray-400 hover:bg-gray-700 hover:text-white',
                  isExplorerOpen
                    ? 'min-w-0 gap-2 px-1 text-xs font-semibold tracking-wide'
                    : 'rounded p-1'
                )}
                title={isExplorerOpen ? 'Collapse Explorer' : 'Expand Explorer'}
                aria-label={isExplorerOpen ? 'Collapse Explorer' : 'Expand Explorer'}
              >
                <Files className={cn('shrink-0', isExplorerOpen ? 'h-4 w-4' : 'h-5 w-5')} />
                {isExplorerOpen && <span>EXPLORER</span>}
              </button>
              {isExplorerOpen && activeLang.id !== 'mysql' && (
                <button
                  type="button"
                  onClick={addFile}
                  className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
                  title="New file"
                  aria-label="New file"
                >
                  <FilePlus2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isExplorerOpen && (
              <div className="flex-1 overflow-y-auto py-2">
                {activeLangFiles.map(file => {
                  const isActive = activeFile?.id === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setActiveFileByLang(prev => ({ ...prev, [activeLangId]: file.id }))}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                        isActive ? 'bg-blue-500/15 text-blue-200' : 'text-gray-300 hover:bg-gray-800/70'
                      )}
                      title={file.name}
                    >
                      <FileCode2 className="h-4 w-4 shrink-0 text-blue-400" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
          <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
          {/* Left Pane: Editor (and Output if MySQL) */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-gray-800 lg:border-b-0 lg:border-r">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-stretch overflow-x-auto border-b border-gray-800 bg-[#151822]">
              {activeLangFiles.map(file => {
                const isActive = activeFile?.id === file.id;
                return (
                  <div key={file.id} className={cn('group flex min-w-0 items-center border-r border-gray-800', isActive && 'border-b-2 border-b-blue-500 bg-[#0f111a]')}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveFileByLang(prev => ({ ...prev, [activeLangId]: file.id }))}
                      className={cn('max-w-52 truncate px-4 text-sm', isActive ? 'text-gray-100' : 'text-gray-400 hover:text-gray-200')}
                    >
                      {file.name}
                    </button>
                    {activeLangFiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => closeFile(file.id)}
                        className="mr-2 rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-100"
                        title={`Close ${file.name}`}
                        aria-label={`Close ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addFile}
                className="ml-2 my-1 flex w-10 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white"
                title="Add file"
                aria-label="Add file"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <Editor
                height="100%"
                language={activeLang.id === 'react' && activeFile?.name.endsWith('.json')
                  ? 'json'
                  : activeLang.id === 'react' && activeFile?.name.endsWith('.html')
                    ? 'html'
                    : activeLang.editorLang}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  formatOnPaste: true,
                }}
              />
            </div>
            {sqlTerminalPanel}
            </div>
          </div>

          {/* Right Pane: DB Tables (if MySQL) or Output (if not MySQL) */}
          {activeLang.id === 'mysql' ? (
            <>
              {isDbPanelOpen ? (
                <div className="w-80 flex-shrink-0 bg-[#151822] flex flex-col">
                      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          Database Tables
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={toggleAllTables}
                            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                            title={expandedTables.length === dbTables.length ? "Collapse all tables" : "Expand all tables"}
                          >
                            {expandedTables.length === dbTables.length ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => setIsDbPanelOpen(false)}
                            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                            title="Collapse panel"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-3 space-y-4">
                        {dbTables.map((table) => (
                          <div key={table.name} className="border border-gray-800 rounded-md overflow-hidden">
                            <button 
                              onClick={() => toggleTable(table.name)}
                              className="w-full bg-gray-800/50 px-3 py-2 text-xs font-semibold text-gray-300 border-b border-gray-800 flex items-center justify-between hover:bg-gray-800 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-blue-400" />
                                {table.name}
                              </div>
                              {expandedTables.includes(table.name) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            
                            {expandedTables.includes(table.name) && (
                            <div className="bg-[#0f111a] p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-gray-400">
                                  <thead className="bg-gray-800/30 text-gray-300">
                                    <tr>
                                      {table.columns.map((col, i) => (
                                        <th key={i} className="px-3 py-2 font-medium border-b border-gray-800 whitespace-nowrap">
                                          {col.name}
                                          <span className="block text-[10px] text-gray-500 font-normal mt-0.5">{col.type}</span>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.data.map((row, rowIndex) => (
                                      <tr key={rowIndex} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20">
                                        {row.map((cell, cellIndex) => (
                                          <td key={cellIndex} className="px-3 py-2 whitespace-nowrap">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-12 flex-shrink-0 bg-[#151822] flex flex-col border-l border-gray-800">
                    <button 
                      onClick={() => setIsDbPanelOpen(true)}
                      className="flex-1 flex flex-col items-center py-4 gap-4 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                      title="Expand panel"
                    >
                      <Database className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        Database Tables
                      </span>
                      <ChevronLeft className="w-4 h-4 mt-2" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col bg-[#0f111a]">
                <div className="h-10 border-b border-gray-800 flex items-center px-4 flex-shrink-0 bg-[#151822]">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {activeLang.paizaLang ? 'Terminal Output' : 'Browser Preview'}
                  </span>
                </div>
                <div className="flex-1 relative overflow-hidden flex">
                  {activeLang.paizaLang ? (
                    <div className="absolute inset-0 p-4 overflow-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
                      {output || <span className="text-gray-600 italic">Run your code to see the output here...</span>}
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-white">
                      <iframe
                        ref={iframeRef}
                        className="w-full h-full border-none"
                        title="preview"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
  );
}
