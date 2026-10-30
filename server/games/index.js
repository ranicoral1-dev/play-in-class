import wyr from './wyr.js';
import wordle from './wordle.js';
import party from './party.js';
import story from './story.js';
import sameword from './sameword.js';
import quote from './quote.js';
import complete from './complete.js';

export const GAMES = {
  [wyr.id]: wyr,
  [wordle.id]: wordle,
  [party.id]: party,
  [story.id]: story,
  [sameword.id]: sameword,
  [quote.id]: quote,
  [complete.id]: complete,
};
