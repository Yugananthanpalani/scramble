export const scrambleWord = (word: string): string => {
  const letters = word.toLowerCase().split('');
  
  // Fisher-Yates shuffle algorithm
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  
  // Ensure the scrambled word is different from original
  const scrambled = letters.join('');
  if (scrambled === word.toLowerCase() && word.length > 1) {
    // Swap first two letters if scrambled word is same as original
    [letters[0], letters[1]] = [letters[1], letters[0]];
    return letters.join('');
  }
  
  return scrambled;
};

export const calculatePoints = (
  isCorrect: boolean,
  timeElapsed: number,
  maxTime: number,
  basePoints: number = 100
): number => {
  if (!isCorrect) return 0;
  
  // Speed bonus: more points for faster guesses
  const speedMultiplier = Math.max(0.3, 1 - (timeElapsed / maxTime));
  return Math.round(basePoints * speedMultiplier);
};

export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const getRandomWord = (category: string = 'general'): string => {
  const wordLists = {
    general: [
      'javascript', 'computer', 'keyboard', 'monitor', 'internet', 'website',
      'programming', 'developer', 'software', 'hardware', 'database', 'algorithm',
      'function', 'variable', 'array', 'object', 'string', 'number', 'boolean',
      'framework', 'library', 'component', 'interface', 'application', 'system'
    ],
    animals: [
      'elephant', 'giraffe', 'penguin', 'dolphin', 'butterfly', 'kangaroo',
      'rhinoceros', 'chimpanzee', 'flamingo', 'octopus', 'seahorse', 'platypus',
      'chameleon', 'hedgehog', 'armadillo', 'mongoose', 'meerkat', 'wallaby'
    ],
    food: [
      'pizza', 'hamburger', 'spaghetti', 'chocolate', 'strawberry', 'pineapple',
      'avocado', 'broccoli', 'sandwich', 'pancake', 'croissant', 'lasagna',
      'quesadilla', 'burrito', 'enchilada', 'cappuccino', 'macchiato', 'tiramisu'
    ],
    technology: [
      'smartphone', 'laptop', 'tablet', 'headphones', 'bluetooth', 'wireless',
      'artificial', 'intelligence', 'machine', 'learning', 'blockchain', 'cryptocurrency',
      'virtual', 'reality', 'augmented', 'quantum', 'computing', 'cybersecurity'
    ]
  };
  
  const words = wordLists[category as keyof typeof wordLists] || wordLists.general;
  return words[Math.floor(Math.random() * words.length)];
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};