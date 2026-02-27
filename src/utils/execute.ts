export const executeCode = async (language: string, code: string) => {
  try {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        language,
      }),
    });

    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Failed to parse response as JSON. Response text:', text);
      return { error: `Server returned invalid response: ${text.substring(0, 100)}...` };
    }

    if (!res.ok) {
      return { error: data.error || `Execution failed with status ${res.status}` };
    }

    return data;
  } catch (error: any) {
    console.error('Execution error:', error);
    return { error: error.message || 'Network error' };
  }
};
