import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';
import JoinPage from '../src/pages/JoinPage';

function renderJoin() {
  render(
    <MemoryRouter initialEntries={['/join/123']}>
      <Routes>
        <Route path="/join/:lobbyId" element={<JoinPage />} />
        <Route path="/lobby/:lobbyId" element={<h1>Joined lobby</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

test('shows a taken username warning and lets the player retry', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Username already taken' }), { status: 409 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'joined' })));
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  renderJoin();
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'Host');
  await user.click(screen.getByRole('button', { name: 'Play!' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Username already taken');
  await user.clear(screen.getByRole('textbox'));
  await user.type(screen.getByRole('textbox'), 'Guest');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Play!' }));
  expect(await screen.findByRole('heading', { name: 'Joined lobby' })).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ username: 'Guest' });
});

test('shows a connection error and re-enables the join button', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
  const user = userEvent.setup();
  renderJoin();
  await user.type(screen.getByRole('textbox'), 'Guest');
  await user.click(screen.getByRole('button', { name: 'Play!' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect');
  expect(screen.getByRole('button', { name: 'Play!' })).toBeEnabled();
});
