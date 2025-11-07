export function scrambleWord(word: string): string {
  const letters = word.toLowerCase().split('');

  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }

  const scrambled = letters.join('');

  if (scrambled === word.toLowerCase() && word.length > 1) {
    return scrambleWord(word);
  }

  return scrambled;
}

export function calculatePoints(timeElapsed: number, maxTime: number): number {
  const timeRatio = Math.max(0, 1 - (timeElapsed / maxTime));
  return Math.floor(50 + (timeRatio * 50));
}
