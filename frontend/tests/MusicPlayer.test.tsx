import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import MusicPlayer from '../src/components/MusicPlayer';

test('starts on interaction, adjusts volume, and skips without repeating songs', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const { container, unmount } = render(<MusicPlayer />);
  const audio = container.querySelector('audio')!;
  expect(play).not.toHaveBeenCalled();
  fireEvent.pointerDown(document);
  expect(play).toHaveBeenCalledOnce();
  expect(audio.volume).toBe(0.2);

  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.65' } });
  expect(audio.volume).toBe(0.65);
  const played = [audio.src];
  fireEvent.click(screen.getByRole('button', { name: 'Skip song' }));
  played.push(audio.src);
  fireEvent.ended(audio);
  played.push(audio.src);
  expect(new Set(played).size).toBe(3);
  fireEvent.ended(audio);
  expect(audio.src).not.toBe(played[2]);
  unmount();
  expect(pause).toHaveBeenCalled();
});
