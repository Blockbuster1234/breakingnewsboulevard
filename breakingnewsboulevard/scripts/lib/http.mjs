const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url, { timeout = 30000, retries = 2, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          ...headers,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function fetchBuffer(url, { timeout = 120000, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const type = res.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new Error(`Unexpected content-type ${type} for ${url}`);
      return { buffer: Buffer.from(await res.arrayBuffer()), type };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(5000 * (attempt + 1));
    }
  }
  throw lastError;
}
