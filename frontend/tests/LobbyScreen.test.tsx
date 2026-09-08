import { act, fireEvent, render, screen } from '@testing-library/react';
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
    rounds: 1,
    changeRounds: vi.fn().mockResolvedValue(undefined),
    savingRounds: false,
    roundsError: '',
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

  const slider = screen.getByRole('slider', { name: 'Number of rounds' });
  expect(slider).toHaveAttribute('min', '1');
  expect(slider).toHaveAttribute('max', '3');
  fireEvent.pointerDown(slider);
  fireEvent.change(slider, { target: { value: '2' } });
  expect(props.changeRounds).not.toHaveBeenCalled();
  expect(slider).toBeEnabled();
  fireEvent.change(slider, { target: { value: '3' } });
  expect(screen.getByText('Rounds: 3')).toBeInTheDocument();
  expect(props.changeRounds).not.toHaveBeenCalled();
  await act(async () => { fireEvent.pointerUp(slider); });
  expect(props.changeRounds).toHaveBeenCalledWith(3);
  props.changeRounds.mockClear();
  rerender(<LobbyScreen {...props} rounds={3} />);
  fireEvent.pointerDown(slider);
  fireEvent.change(slider, { target: { value: '2' } });
  fireEvent.change(slider, { target: { value: '1' } });
  expect(props.changeRounds).not.toHaveBeenCalled();
  await act(async () => { fireEvent.pointerUp(slider); });
  expect(props.changeRounds).toHaveBeenCalledWith(1);
  props.changeRounds.mockClear();
  rerender(<LobbyScreen {...props} rounds={1} />);
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  fireEvent.change(slider, { target: { value: '2' } });
  await act(async () => { fireEvent.keyUp(slider, { key: 'ArrowRight' }); });
  expect(props.changeRounds).toHaveBeenCalledWith(2);
  rerender(<LobbyScreen {...props} rounds={3} username="Guest" />);
  expect(screen.getByText('Rounds: 3')).toBeInTheDocument();
  expect(slider).toBeDisabled();
});
