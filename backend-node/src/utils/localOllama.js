function localOllamaChatUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      url.port === '11434' && url.pathname.replace(/\/+$/, '') === '/v1') {
      return new URL('/api/chat', url).href;
    }
  } catch (_) { /* Not a configured local Ollama endpoint. */ }
  return null;
}

module.exports = { localOllamaChatUrl };
