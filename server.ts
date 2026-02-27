import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Proxy API for Paiza.io
  app.post('/api/execute', async (req, res) => {
    try {
      const { language, code } = req.body;
      
      const createRes = await fetch('https://api.paiza.io/runners/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: code,
          language: language,
          api_key: 'guest'
        }),
      });
      
      const createData = await createRes.json();
      if (createData.error) {
        return res.status(400).json({ error: createData.error });
      }

      const id = createData.id;
      let resultData = null;

      // Poll for completion
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`https://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
        resultData = await statusRes.json();
        
        if (resultData.status === 'completed') {
          break;
        }
      }

      if (resultData && resultData.status === 'completed') {
        if (resultData.build_result === 'failure') {
          return res.json({ error: resultData.build_stderr || 'Build failed' });
        }
        
        let output = resultData.stdout || '';
        if (resultData.stderr) {
          output += (output ? '\n' : '') + resultData.stderr;
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
