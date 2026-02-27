import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '10mb' }));

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
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
