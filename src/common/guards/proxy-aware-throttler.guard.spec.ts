import { ProxyAwareThrottlerGuard } from './proxy-aware-throttler.guard';

// getTracker es protected: se expone acá para poder ejercitarlo sin levantar el
// guard entero, que arrastra las dependencias del módulo.
class Probe extends ProxyAwareThrottlerGuard {
  track(req: { headers?: Record<string, string | undefined>; ip?: string }) {
    return this.getTracker(req);
  }
}

describe('ProxyAwareThrottlerGuard', () => {
  const guard = Object.create(Probe.prototype) as Probe;

  it('agrupa por la IP real del cliente que informa Cloudflare', async () => {
    await expect(
      guard.track({ headers: { 'cf-connecting-ip': '190.1.2.3' }, ip: '10.0.0.9' }),
    ).resolves.toBe('190.1.2.3');
  });

  it('ignora la IP del proxy: es la que rotaba y dejaba pasar el límite', async () => {
    const a = await guard.track({
      headers: { 'cf-connecting-ip': '190.1.2.3' },
      ip: '172.16.0.1',
    });
    const b = await guard.track({
      headers: { 'cf-connecting-ip': '190.1.2.3' },
      ip: '172.16.0.2',
    });

    // Mismo cliente por dos nodos distintos de Cloudflare = un solo contador.
    expect(a).toBe(b);
  });

  it('sin Cloudflare adelante usa req.ip (desarrollo local)', async () => {
    await expect(guard.track({ headers: {}, ip: '127.0.0.1' })).resolves.toBe(
      '127.0.0.1',
    );
  });

  it('no se cae si no hay ni headers ni ip', async () => {
    await expect(guard.track({})).resolves.toBe('unknown');
  });

  it('clientes distintos no comparten contador', async () => {
    const a = await guard.track({ headers: { 'cf-connecting-ip': '190.1.2.3' } });
    const b = await guard.track({ headers: { 'cf-connecting-ip': '190.1.2.4' } });

    expect(a).not.toBe(b);
  });
});
