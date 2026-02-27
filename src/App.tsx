import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Code2, Database, FileJson, Terminal, Loader2, Layout, ChevronLeft, ChevronRight, ChevronDown, FileCode2, Coffee, FileType2, Globe, Palette, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { cn } from './utils/cn';
import { LANGUAGES } from './constants/languages';
import { executeCode } from './utils/execute';
import { SQL_SETUP_SCRIPT, SQL_TABLES } from './constants/sqlDatabase';
import { parseSQLOutput } from './utils/sqlParser';

const ICONS: Record<string, React.ElementType> = {
  Terminal,
  Code2,
  Database,
  FileJson,
  FileCode2,
  Coffee,
  FileType2,
  Globe,
  Palette,
};

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeLangId, setActiveLangId] = useState(LANGUAGES[0].id);
  const [codeMap, setCodeMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    LANGUAGES.forEach(l => initial[l.id] = l.defaultCode);
    return initial;
  });
  const [outputMap, setOutputMap] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [dbTables, setDbTables] = useState(SQL_TABLES);

  const activeLang = LANGUAGES.find(l => l.id === activeLangId)!;
  const code = codeMap[activeLangId];
  const output = outputMap[activeLangId] || '';
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [isDbPanelOpen, setIsDbPanelOpen] = useState(true);
  
  const sqlOutputTables = activeLang.id === 'mysql' && output ? parseSQLOutput(output) : [];

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
    if (value !== undefined) {
      setCodeMap(prev => ({ ...prev, [activeLangId]: value }));
    }
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
          html = `
            <!DOCTYPE html>
            <html>
              <head>
                <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
                <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
                <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                <style>body { margin: 0; font-family: sans-serif; }</style>
              </head>
              <body>
                <div id="root"></div>
                <script type="text/babel" data-type="module">
                  ${code}
                </script>
              </body>
            </html>
          `;
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

  return (
    <div className="flex h-screen w-full bg-[#0f111a] text-gray-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={cn("flex-shrink-0 border-r border-gray-800 bg-[#151822] flex flex-col transition-all duration-300", isSidebarOpen ? "w-64" : "w-16")}>
        <div className={cn("p-4 border-b border-gray-800 flex items-center text-white font-semibold", isSidebarOpen ? "justify-between" : "justify-center")}>
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-blue-500" />
              <span>AnkitDevStudio</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className={cn("px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider", !isSidebarOpen && "text-center px-0")}>
            {isSidebarOpen ? "Environments" : "Env"}
          </div>
          <div className="space-y-1 px-2">
            {LANGUAGES.map(lang => {
              const Icon = ICONS[lang.icon];
              const isActive = activeLangId === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setActiveLangId(lang.id)}
                  className={cn(
                    "w-full flex items-center rounded-md text-sm transition-colors",
                    isSidebarOpen ? "gap-3 px-3 py-2" : "justify-center py-3",
                    isActive 
                      ? "bg-blue-500/10 text-blue-400" 
                      : "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200"
                  )}
                  title={!isSidebarOpen ? lang.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="truncate">{lang.name}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className={cn("p-4 border-t border-gray-800 text-xs text-gray-500", !isSidebarOpen && "text-center p-2")}>
          {isSidebarOpen ? "Developed by Ankit" : "Ankit"}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 border-b border-gray-800 bg-[#151822] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">
              main.{activeLang.editorLang === 'javascript' ? 'js' : activeLang.editorLang === 'python' ? 'py' : activeLang.editorLang === 'csharp' ? 'cs' : activeLang.editorLang === 'html' ? 'html' : activeLang.editorLang === 'css' ? 'css' : activeLang.editorLang === 'java' ? 'java' : activeLang.editorLang === 'cpp' ? 'cpp' : activeLang.editorLang === 'c' ? 'c' : activeLang.editorLang === 'typescript' ? 'ts' : 'sql'}
            </span>
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

        {/* Editor & Output Split */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0">
          {/* Left Pane: Editor (and Output if MySQL) */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 min-h-0 min-w-0">
            <div className="flex-1 relative min-h-0">
              <Editor
                height="100%"
                language={activeLang.editorLang}
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

            {/* MySQL Output at bottom of Editor */}
            {activeLang.id === 'mysql' && (
              <div className="h-64 border-t border-gray-800 flex flex-col bg-[#0f111a] min-h-0 min-w-0">
                <div className="h-10 border-b border-gray-800 flex items-center px-4 flex-shrink-0 bg-[#151822]">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Terminal Output
                  </span>
                </div>
                <div className="flex-1 p-4 overflow-auto bg-[#0f111a]">
                  {!output ? (
                    <span className="text-gray-600 italic font-mono text-sm">Run your code to see the output here...</span>
                  ) : sqlOutputTables.length > 0 ? (
                    <div className="space-y-6">
                      {sqlOutputTables.map((table, i) => (
                        <div key={i} className="border border-gray-800 rounded-md overflow-hidden bg-[#151822]">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                              <thead className="bg-gray-800/50 text-gray-200">
                                <tr>
                                  {table.headers.map((header, j) => (
                                    <th key={j} className="px-4 py-2 font-medium border-b border-gray-800 whitespace-nowrap">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row, rowIndex) => (
                                  <tr key={rowIndex} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                                    {row.map((cell, cellIndex) => (
                                      <td key={cellIndex} className="px-4 py-2 whitespace-nowrap">
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
                    <div className="font-mono text-sm text-gray-300 whitespace-pre-wrap">{output}</div>
                  )}
                </div>
              </div>
            )}
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
              <div className="flex-1 flex flex-col bg-[#0f111a] min-h-0">
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
  );
}
