import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import GuessingScreen from '../src/components/lobby/GuessingScreen';

function props() {
  return {
    phase: 'GUESSING' as const,
    currentImage: { number: 1, username: 'Host', image_url: '/1.png', prompt: 'A secret cat' },
    currentImageIndex: 0,
    players: ['Host', 'Guest'],
    username: 'Guest',
    guesses: { Guest: 'A flying cat' },
    winner: null,
    submittingRound: false,
    roundError: '',
    guessedPlayers: [],
    eligibleGuessers: 1,
    guessed: false,
    submitRound: vi.fn().mockResolvedValue(undefined),
  };
}

test('the author cannot guess and the original prompt stays hidden', () => {
  render(<GuessingScreen {...props()} username="Host" />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText(/Your image/)).toBeInTheDocument();
  expect(screen.queryByText(/A secret cat/)).not.toBeInTheDocument();
});

test('submits a guest guess, disables resubmission, and clears it for the next image', async () => {
  const user = userEvent.setup();
  const data = props();
  const { rerender } = render(<GuessingScreen {...data} />);
  await user.type(screen.getByRole('textbox'), 'A flying cat');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(data.submitRound).toHaveBeenCalledWith('guess', 'A flying cat');
  rerender(<GuessingScreen {...data} guessed />);
  expect(screen.getByRole('button', { name: 'Submitted' })).toBeDisabled();
  rerender(<GuessingScreen {...data} currentImageIndex={1} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('only the author can choose a winner and selection closes after a winner is chosen', async () => {
  const user = userEvent.setup();
  const data = props();
  const { rerender } = render(<GuessingScreen {...data} phase="REVEAL" />);
  expect(screen.queryByRole('button', { name: 'Pick winner' })).not.toBeInTheDocument();
  rerender(<GuessingScreen {...data} phase="REVEAL" username="Host" />);
  await user.click(screen.getByRole('button', { name: 'Pick winner' }));
  expect(data.submitRound).toHaveBeenCalledWith('winner', 'Guest');
  rerender(<GuessingScreen {...data} phase="REVEAL" username="Host" winner="Guest" />);
  expect(screen.getByRole('status')).toHaveTextContent('Guest wins 1 point!');
  expect(screen.queryByRole('button', { name: 'Pick winner' })).not.toBeInTheDocument();
});
