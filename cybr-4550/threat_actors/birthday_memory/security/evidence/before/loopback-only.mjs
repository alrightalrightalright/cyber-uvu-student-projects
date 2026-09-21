import net from 'node:net';

// Lab harness only: keep the original source unchanged while enforcing the
// assignment's loopback-only rule for the baseline Express listener.
const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'number' || /^\d+$/.test(String(args[0]))) {
    if (typeof args[1] === 'string') args[1] = '127.0.0.1';
    else args.splice(1, 0, '127.0.0.1');
  } else if (args[0] && typeof args[0] === 'object' && 'port' in args[0]) {
    args[0] = { ...args[0], host: '127.0.0.1' };
  }
  return originalListen.apply(this, args);
};
