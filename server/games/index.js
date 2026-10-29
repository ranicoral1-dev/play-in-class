import wyr from './wyr.js';
import wordle from './wordle.js';
import party from './party.js';
import story from './story.js';
import sameword from './sameword.js';

export const GAMES = {
  [wyr.id]: wyr,
  [wordle.id]: wordle,
  [party.id]: party,
  [story.id]: story,
  [sameword.id]: sameword,
};
