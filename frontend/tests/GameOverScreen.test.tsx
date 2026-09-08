import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import GameOverScreen from '../src/components/lobby/GameOverScreen';

test('sorts scores and lets only the host return to the lobby', async () => {
  const user = userEvent.setup();
  const props = {
    scores: { Host: 1, Guest: 3 }, host: 'Host', username: 'Guest',
    submittingRound: false, roundError: '', returnToLobby: vi.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<GameOverScreen {...props} />);
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Guest: 3');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<GameOverScreen {...props} username="Host" />);
  await user.click(screen.getByRole('button', { name: 'Return to Lobby' }));
  expect(props.returnToLobby).toHaveBeenCalledOnce();
  rerender(<GameOverScreen {...props} username="Host" submittingRound />);
  expect(screen.getByRole('button')).toBeDisabled();
});
