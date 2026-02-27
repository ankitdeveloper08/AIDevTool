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

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Execution failed' };
    }

    return data;
  } catch (error: any) {
    return { error: error.message || 'Network error' };
  }
};
