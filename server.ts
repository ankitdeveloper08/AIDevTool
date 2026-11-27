import express from 'express';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { LANGUAGES } from './src/constants/languages';

const getLanguageFolderName = (languageId: string) => {
  const language = LANGUAGES.find(candidate => candidate.id === languageId);
  if (!language) return null;
  return (language.id === 'csharp'
    ? 'C#'
    : language.id === 'mysql'
      ? 'SQL'
      : language.name).replace(/[<>:"/\\|?*]/g, '_');
};

const getSafeBaseName = (fileName: string) => fileName
  .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  .replace(/\.[^.]*$/, '')
  .replace(/[. ]+$/g, '')
  .trim()
  .slice(0, 100) || 'code';

const getSafeSavedFileName = (fileName: string) =>
  `${getSafeBaseName(fileName.replace(/\.txt$/i, ''))}.txt`;

const getSavedCodeRoot = () => resolve(process.env.SAVED_CODE_DIR || 'saved-code');

const isMissingPath = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/save-code', async (req, res) => {
    const body = req.body as { languageId?: unknown; fileName?: unknown; code?: unknown } | undefined;
    const { languageId, fileName, code } = body ?? {};
    const folderName = typeof languageId === 'string' ? getLanguageFolderName(languageId) : null;

    if (!folderName || typeof fileName !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'A valid language, filename, and code are required' });
    }

    const outputDirectory = join(getSavedCodeRoot(), 'Compiler World', folderName);
    const outputPath = join(outputDirectory, `${getSafeBaseName(fileName)}.txt`);

    try {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(outputPath, code, 'utf8');
      return res.json({ path: outputPath });
    } catch (error) {
      console.error('Code save error:', error);
      return res.status(500).json({ error: 'Could not save the code file' });
    }
  });

  app.get('/api/saved-code', async (_req, res) => {
    try {
      const compilerDirectory = join(getSavedCodeRoot(), 'Compiler World');
      const savedFiles: {
        languageId: string;
        languageName: string;
        fileName: string;
        updatedAt: string;
      }[] = [];

      for (const language of LANGUAGES) {
        const folderName = getLanguageFolderName(language.id);
        if (!folderName) continue;

        const languageDirectory = join(compilerDirectory, folderName);
        let entries;
        try {
          entries = await readdir(languageDirectory, { withFileTypes: true });
        } catch (error) {
          if (isMissingPath(error)) continue;
          throw error;
        }

        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue;
          const filePath = join(languageDirectory, entry.name);
          const fileStats = await stat(filePath);
          savedFiles.push({
            languageId: language.id,
            languageName: folderName,
            fileName: entry.name,
            updatedAt: fileStats.mtime.toISOString(),
          });
        }
      }

      savedFiles.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      return res.json({ files: savedFiles });
    } catch (error) {
      console.error('Saved code listing error:', error);
      return res.status(500).json({ error: 'Could not load saved code history' });
    }
  });

  app.get('/api/saved-code/file', async (req, res) => {
    const languageId = req.query.languageId;
    const fileName = req.query.fileName;
    const folderName = typeof languageId === 'string' ? getLanguageFolderName(languageId) : null;

    if (!folderName || typeof fileName !== 'string' || !fileName.toLowerCase().endsWith('.txt')) {
      return res.status(400).json({ error: 'A valid language and text filename are required' });
    }

    const baseName = fileName.slice(0, -4);
    const safeFileName = `${getSafeBaseName(baseName)}.txt`;
    if (safeFileName !== fileName) {
      return res.status(400).json({ error: 'Invalid saved filename' });
    }

    const filePath = join(getSavedCodeRoot(), 'Compiler World', folderName, safeFileName);
    try {
      const code = await readFile(filePath, 'utf8');
      return res.json({ code });
    } catch (error) {
      if (isMissingPath(error)) {
        return res.status(404).json({ error: 'Saved code file was not found' });
      }
      console.error('Saved code read error:', error);
      return res.status(500).json({ error: 'Could not read the saved code file' });
    }
  });

  app.post('/api/saved-code/rename', async (req, res) => {
    const body = req.body as {
      languageId?: unknown;
      fileName?: unknown;
      newFileName?: unknown;
    } | undefined;
    const { languageId, fileName, newFileName } = body ?? {};
    const folderName = typeof languageId === 'string' ? getLanguageFolderName(languageId) : null;

    if (
      !folderName ||
      typeof fileName !== 'string' ||
      typeof newFileName !== 'string' ||
      getSafeSavedFileName(fileName) !== fileName
    ) {
      return res.status(400).json({ error: 'A valid language and filenames are required' });
    }

    const safeNewFileName = getSafeSavedFileName(newFileName);
    if (safeNewFileName === fileName) {
      return res.json({ fileName });
    }

    const languageDirectory = join(getSavedCodeRoot(), 'Compiler World', folderName);
    const oldPath = join(languageDirectory, fileName);
    const newPath = join(languageDirectory, safeNewFileName);

    try {
      await access(oldPath);
      try {
        await copyFile(oldPath, newPath, constants.COPYFILE_EXCL);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
          return res.status(409).json({ error: 'A file with that name already exists' });
        }
        throw error;
      }
      await unlink(oldPath);
      return res.json({ fileName: safeNewFileName });
    } catch (error) {
      if (isMissingPath(error)) {
        return res.status(404).json({ error: 'Saved code file was not found' });
      }
      console.error('Saved code rename error:', error);
      return res.status(500).json({ error: 'Could not rename the saved code file' });
    }
  });

  // Proxy API for Paiza.io
  app.post('/api/execute', async (req, res) => {
    try {
      const { language, code } = req.body;
      
      if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
      }
      
      const params = new URLSearchParams();
      params.append('source_code', code);
      params.append('language', language);
      params.append('api_key', 'guest');

      const createRes = await fetch('https://api.paiza.io/runners/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        body: params.toString(),
      });
      
      const createData = await createRes.json();
      if (createData.error) {
        return res.status(400).json({ error: createData.error });
      }

      const id = createData.id;
      if (!id) {
        return res.status(500).json({ error: 'Failed to get execution ID from Paiza API' });
      }

      let resultData: any = null;

      // Poll for completion
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`https://api.paiza.io/runners/get_details?id=${id}&api_key=guest`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
        resultData = await statusRes.json();
        
        if (resultData.status === 'completed') {
          break;
        }
      }

      if (resultData && resultData.status === 'completed') {
        if (resultData.build_result === 'failure') {
          return res.json({ error: resultData.build_stderr || 'Build failed' });
        }
        
        if (resultData.result !== 'success') {
          return res.json({ error: `Execution ${resultData.result}. ${resultData.stderr || resultData.stdout || ''}` });
        }
        
        let output = resultData.stdout || '';
        if (resultData.stderr) {
          output += (output ? '\n' : '') + resultData.stderr;
        }
        
        if (!output) {
          output = `DEBUG: Paiza API returned empty output.\nResult Data: ${JSON.stringify(resultData, null, 2)}\nCode Length: ${code.length}`;
        }
        
        return res.json({ output });
      }

      return res.status(408).json({ error: 'Execution timed out.' });
    } catch (error: any) {
      console.error('Execution error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
