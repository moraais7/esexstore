export function deploymentEnvironment(input = {}) {
  const value = input.STORE_PUBLIC_URL || input.RENDER_EXTERNAL_URL || (input.NODE_ENV === 'production' ? '' : `http://localhost:${input.PORT || 3000}`);
  let url;
  try { url = new URL(value); } catch { throw new Error('Configure STORE_PUBLIC_URL com a URL pública da loja.'); }
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (input.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new Error('STORE_PUBLIC_URL deve usar HTTPS em produção e não pode conter credenciais.');
  }
  return { ...input, STORE_PUBLIC_URL: url.origin };
}
