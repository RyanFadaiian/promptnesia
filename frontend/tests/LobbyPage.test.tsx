import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';
import LobbyPage from '../src/pages/LobbyPage';

function setupLobby() {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/state') ? {
      phase: 'LOBBY', seconds_left: 0, submitted_players: [],
      rounds: 1, current_round: 0,
      current_image_index: 0, current_image: null, guessed_players: [],
      eligible_guessers: 1, guesses: {}, winner: null, scores: {},
    } : { players: ['Host', 'Guest'], host: 'Host' },
  )));
  vi.stubGlobal('fetch', fetchMock);
  const router = createMemoryRouter([
    { path: '/lobby/:lobbyId', element: <LobbyPage /> },
  ], { initialEntries: [{ pathname: '/lobby/123', state: { username: 'Host' } }] });
  return { router, fetchMock };
}

test('polls each second and stops after unmounting', async () => {
  const { router, fetchMock } = setupLobby();
  const view = render(<RouterProvider router={router} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByRole('heading', { name: 'Lobby' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(fetchMock).toHaveBeenCalledTimes(6);
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

test('changing lobbies stops polling the old lobby', async () => {
  const { router, fetchMock } = setupLobby();
  render(<RouterProvider router={router} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await router.navigate('/lobby/456', { state: { username: 'Host' } }); });
  fetchMock.mockClear();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock.mock.calls.every(([url]) => url.includes('/lobbies/456'))).toBe(true);
});
