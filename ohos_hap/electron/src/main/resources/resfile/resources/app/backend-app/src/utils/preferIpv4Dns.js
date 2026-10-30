/**
 * Windows 上常见 IPv6 黑洞：DNS 返回 Cloudflare IPv6（如 2606:4700::…）后
 * 连接 ETIMEDOUT，而同主机 IPv4 实际可用。打包 Electron 出站尤其容易踩中。
 *
 * 在进程最早阶段调用，使 getaddrinfo / fetch / http(s) 优先使用 IPv4。
 */
const dns = require('dns');
const net = require('net');

function preferIpv4Dns() {
  try {
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch (_) {}
  try {
    // Node 18.13+ / Electron 内置 Node：缩短 Happy Eyeballs 等待，更快回退 IPv4
    if (typeof net.setDefaultAutoSelectFamily === 'function') {
      net.setDefaultAutoSelectFamily(true);
    }
    if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === 'function') {
      net.setDefaultAutoSelectFamilyAttemptTimeout(300);
    }
  } catch (_) {}
}

preferIpv4Dns();

module.exports = { preferIpv4Dns };
