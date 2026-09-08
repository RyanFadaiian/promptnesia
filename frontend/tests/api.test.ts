import { expect, test, vi } from 'vitest';
import { api } from '../src/api';

test('sends JSON and returns the parsed response', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 123 })));
  vi.stubGlobal('fetch', fetchMock);
  expect(await api('/lobbies', 'POST', { username: 'Host' })).toEqual({ id: 123 });
  expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/lobbies', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Host' }),
  });
});

test('preserves a server error message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: 'Lobby not found' }), { status: 404 }),
  ));
  await expect(api('/lobbies/123')).rejects.toThrow('Lobby not found');
});

test('handles a non-JSON error response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
  await expect(api('/lobbies')).rejects.toThrow('Request failed');
});

test('rejects malformed successful responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not JSON')));
  await expect(api('/lobbies')).rejects.toThrow('Unexpected server response');
});
