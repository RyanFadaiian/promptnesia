import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import LobbyScreen from '../src/components/lobby/LobbyScreen';

test('requires a second player before the host can start', async () => {
  const user = userEvent.setup();
  const props = {
    inviteLink: '/join/123456',
    copied: false,
    players: ['Host'],
    host: 'Host',
    username: 'Host',
    handleCopyInviteLink: vi.fn().mockResolvedValue(undefined),
    startGame: vi.fn().mockResolvedValue(undefined),
  };
  const message = 'You need at least 2 players to start the game!';
  const { rerender } = render(<LobbyScreen {...props} />);
  expect(screen.queryByText(message)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(props.startGame).not.toHaveBeenCalled();

  rerender(<LobbyScreen {...props} players={['Host', 'Guest']} />);
  expect(screen.queryByText(message)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Start' }));
  expect(props.startGame).toHaveBeenCalledOnce();
});
