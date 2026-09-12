import ipaddr from 'ipaddr.js';

/** Browser-safe link validation. Activities are links, never server fetch targets. */
export function isActivityHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (ipaddr.isValid(host)) {
      return ipaddr.process(host).range() === 'unicast';
    }
    return host.includes('.') && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  } catch {
    return false;
  }
}
