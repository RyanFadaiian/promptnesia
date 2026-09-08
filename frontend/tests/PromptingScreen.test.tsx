import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import PromptingScreen from '../src/components/lobby/PromptingScreen';

test.each(['', '   '])('allows submitting a blank prompt (%j)', async (prompt) => {
  const user = userEvent.setup();
  const props = {
    secondsLeft: 20,
    submittedPlayers: [],
    players: ['Host', 'Guest'],
    prompt,
    submitted: false,
    setPrompt: vi.fn(),
    submitPrompt: vi.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<PromptingScreen {...props} />);
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(props.submitPrompt).toHaveBeenCalledOnce();
  rerender(<PromptingScreen {...props} submitted />);
  expect(screen.getByRole('button', { name: 'Submitted' })).toBeDisabled();
  rerender(<PromptingScreen {...props} secondsLeft={0} />);
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
});
