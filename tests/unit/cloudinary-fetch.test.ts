import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('fetchVideoResource()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: 'key123',
      CLOUDINARY_API_SECRET: 'secret456',
    };
    mockFetch.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('returns video resource on success', async () => {
    const mockResource = {
      public_id: 'viralengine/uploads/u1/video1',
      duration: 45.2,
      format: 'mp4',
      bytes: 1024000,
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/viralengine/uploads/u1/video1.mp4',
    };
    mockFetch.mockResolvedValueOnce(makeResponse(mockResource));
    const { fetchVideoResource } = await import('@/lib/cloudinary');
    const result = await fetchVideoResource('viralengine/uploads/u1/video1');
    expect(result.public_id).toBe('viralengine/uploads/u1/video1');
    expect(result.duration).toBe(45.2);
    expect(result.format).toBe('mp4');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Not found' }, 404));
    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await expect(fetchVideoResource('nonexistent/video')).rejects.toThrow('404');
  });

  it('uses Basic auth with api_key:api_secret', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ public_id: 'p', duration: 10, format: 'mp4', bytes: 100, secure_url: 'u' }));
    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await fetchVideoResource('some/public/id');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const expectedAuth = `Basic ${Buffer.from('key123:secret456').toString('base64')}`;
    expect((init.headers as Record<string, string>)['Authorization']).toBe(expectedAuth);
  });

  it('throws when CLOUDINARY env vars missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await expect(fetchVideoResource('some/id')).rejects.toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('URL encodes the public_id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ public_id: 'p', duration: 10, format: 'mp4', bytes: 100, secure_url: 'u' }));
    const { fetchVideoResource } = await import('@/lib/cloudinary');
    await fetchVideoResource('path/with spaces/video');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('path%2Fwith%20spaces%2Fvideo');
  });
});
