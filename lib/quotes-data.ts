// Curated quote collections by category. Live public APIs (ZenQuotes,
// DummyJSON, QuotesOnDesign) expand the "Any" pool and themed categories when
// they are reachable; these bundled sets keep the page working offline and
// cover "books", which no good free topic API provides. For book quotes the
// `author` field is "Author, Book Title".

export interface CategoryQuote {
  text: string;
  author: string;
}

export type QuoteCategory =
  | "any"
  | "life"
  | "time"
  | "love"
  | "success"
  | "wisdom"
  | "motivation"
  | "happiness"
  | "books";

export const QUOTE_CATEGORIES: { value: QuoteCategory; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "life", label: "Life" },
  { value: "time", label: "Time" },
  { value: "love", label: "Love" },
  { value: "success", label: "Success" },
  { value: "wisdom", label: "Wisdom" },
  { value: "motivation", label: "Motivation" },
  { value: "happiness", label: "Happiness" },
  { value: "books", label: "Book quotes" },
];

export const CATEGORY_QUOTES: Record<
  Exclude<QuoteCategory, "any">,
  CategoryQuote[]
> = {
  life: [
    { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
    { text: "In the end, it's not the years in your life that count. It's the life in your years.", author: "Abraham Lincoln" },
    { text: "Life is really simple, but we insist on making it complicated.", author: "Confucius" },
    { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
    { text: "Get busy living or get busy dying.", author: "Stephen King" },
    { text: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
    { text: "Life is either a daring adventure or nothing at all.", author: "Helen Keller" },
    { text: "The unexamined life is not worth living.", author: "Socrates" },
    { text: "Life shrinks or expands in proportion to one's courage.", author: "Anaïs Nin" },
    { text: "Everything you can imagine is real.", author: "Pablo Picasso" },
  ],
  time: [
    { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" },
    { text: "Lost time is never found again.", author: "Benjamin Franklin" },
    { text: "The two most powerful warriors are patience and time.", author: "Leo Tolstoy" },
    { text: "Time you enjoy wasting is not wasted time.", author: "Marthe Troly-Curtin" },
    { text: "Yesterday is gone. Tomorrow has not yet come. We have only today.", author: "Mother Teresa" },
    { text: "Time is what we want most, but what we use worst.", author: "William Penn" },
    { text: "The key is in not spending time, but in investing it.", author: "Stephen R. Covey" },
    { text: "Better three hours too soon than a minute too late.", author: "William Shakespeare" },
    { text: "Time flies over us, but leaves its shadow behind.", author: "Nathaniel Hawthorne" },
    { text: "The trouble is, you think you have time.", author: "Jack Kornfield" },
  ],
  love: [
    { text: "Where there is love there is life.", author: "Mahatma Gandhi" },
    { text: "We are most alive when we're in love.", author: "John Updike" },
    { text: "To love and be loved is to feel the sun from both sides.", author: "David Viscott" },
    { text: "The best thing to hold onto in life is each other.", author: "Audrey Hepburn" },
    { text: "Love is composed of a single soul inhabiting two bodies.", author: "Aristotle" },
    { text: "Being deeply loved by someone gives you strength; loving someone deeply gives you courage.", author: "Lao Tzu" },
    { text: "The greatest happiness of life is the conviction that we are loved.", author: "Victor Hugo" },
    { text: "You know you're in love when you can't fall asleep because reality is finally better than your dreams.", author: "Dr. Seuss" },
    { text: "Love all, trust a few, do wrong to none.", author: "William Shakespeare" },
  ],
  success: [
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The secret of success is to do the common thing uncommonly well.", author: "John D. Rockefeller" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
    { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
    { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  ],
  wisdom: [
    { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
    { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
    { text: "The fool doth think he is wise, but the wise man knows himself to be a fool.", author: "William Shakespeare" },
    { text: "Patience is the companion of wisdom.", author: "Saint Augustine" },
    { text: "By three methods we may learn wisdom: by reflection, by imitation, and by experience.", author: "Confucius" },
    { text: "It is the province of knowledge to speak, and it is the privilege of wisdom to listen.", author: "Oliver Wendell Holmes" },
    { text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
  ],
  motivation: [
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Anonymous" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Little by little, one travels far.", author: "J.R.R. Tolkien" },
  ],
  happiness: [
    { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
    { text: "For every minute you are angry you lose sixty seconds of happiness.", author: "Ralph Waldo Emerson" },
    { text: "Happiness depends upon ourselves.", author: "Aristotle" },
    { text: "The most important thing is to enjoy your life—to be happy—it's all that matters.", author: "Audrey Hepburn" },
    { text: "Count your age by friends, not years. Count your life by smiles, not tears.", author: "John Lennon" },
    { text: "Happiness is when what you think, what you say, and what you do are in harmony.", author: "Mahatma Gandhi" },
    { text: "The happiest people don't have the best of everything, they make the best of everything.", author: "Anonymous" },
  ],
  books: [
    { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen, Pride and Prejudice" },
    { text: "So we beat on, boats against the current, borne back ceaselessly into the past.", author: "F. Scott Fitzgerald, The Great Gatsby" },
    { text: "All animals are equal, but some animals are more equal than others.", author: "George Orwell, Animal Farm" },
    { text: "It was the best of times, it was the worst of times.", author: "Charles Dickens, A Tale of Two Cities" },
    { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien, The Fellowship of the Ring" },
    { text: "All we have to decide is what to do with the time that is given us.", author: "J.R.R. Tolkien, The Fellowship of the Ring" },
    { text: "We accept the love we think we deserve.", author: "Stephen Chbosky, The Perks of Being a Wallflower" },
    { text: "It does not do to dwell on dreams and forget to live.", author: "J.K. Rowling, Harry Potter and the Philosopher's Stone" },
    { text: "And, when you want something, all the universe conspires in helping you to achieve it.", author: "Paulo Coelho, The Alchemist" },
    { text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou, I Know Why the Caged Bird Sings" },
    { text: "The world breaks everyone, and afterward many are strong at the broken places.", author: "Ernest Hemingway, A Farewell to Arms" },
    { text: "Who controls the past controls the future. Who controls the present controls the past.", author: "George Orwell, 1984" },
    { text: "Whatever our souls are made of, his and mine are the same.", author: "Emily Brontë, Wuthering Heights" },
    { text: "Tomorrow is always fresh, with no mistakes in it yet.", author: "L.M. Montgomery, Anne of Green Gables" },
    { text: "Until I feared I would lose it, I never loved to read. One does not love breathing.", author: "Harper Lee, To Kill a Mockingbird" },
    { text: "I took a deep breath and listened to the old brag of my heart: I am, I am, I am.", author: "Sylvia Plath, The Bell Jar" },
    { text: "Memories warm you up from the inside. But they also tear you apart.", author: "Haruki Murakami, Kafka on the Shore" },
    { text: "The only way out of the labyrinth of suffering is to forgive.", author: "John Green, Looking for Alaska" },
    { text: "Time is the longest distance between two places.", author: "Tennessee Williams, The Glass Menagerie" },
    { text: "It matters not what someone is born, but what they grow to be.", author: "J.K. Rowling, Harry Potter and the Goblet of Fire" },
  ],
};
