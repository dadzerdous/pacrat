// direction.js
// Shared direction vectors. Kept as a tiny separate module because Entity,
// Pacman, Ghost, and ghostAI all import it — centralizing avoids four copies.

export const DIR = {
  LEFT:  [-1,  0],
  RIGHT: [ 1,  0],
  UP:    [ 0, -1],   // Y decreases upward on canvas
  DOWN:  [ 0,  1],
  NONE:  [ 0,  0],
};
