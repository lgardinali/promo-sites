/**
 * Resolvedor de cubic-bezier para animações feitas em JS.
 * Usado para que o scroll suave siga exatamente a mesma curva das transições
 * CSS (a curva "Slow" do Figma), em vez de um easing genérico.
 */

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 1e-7;
const SUBDIVISION_MAX_ITERATIONS = 10;

const A = (a1, a2) => 1 - 3 * a2 + 3 * a1;
const B = (a1, a2) => 3 * a2 - 6 * a1;
const C = (a1) => 3 * a1;

/** Valor da curva de Bézier em t, para um dos eixos. */
const calcBezier = (t, a1, a2) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;

/** Derivada da curva, usada pelo Newton-Raphson. */
const getSlope = (t, a1, a2) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);

function binarySubdivide(x, a, b, mX1, mX2) {
  let currentX, currentT, i = 0;
  do {
    currentT = a + (b - a) / 2;
    currentX = calcBezier(currentT, mX1, mX2) - x;
    if (currentX > 0) b = currentT;
    else a = currentT;
  } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
  return currentT;
}

function newtonRaphsonIterate(x, guessT, mX1, mX2) {
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const currentSlope = getSlope(guessT, mX1, mX2);
    if (currentSlope === 0) return guessT;
    guessT -= (calcBezier(guessT, mX1, mX2) - x) / currentSlope;
  }
  return guessT;
}

/**
 * Devolve uma função de easing f(t) equivalente a cubic-bezier(x1, y1, x2, y2).
 * @returns {(t: number) => number}
 */
export function cubicBezier(x1, y1, x2, y2) {
  if (x1 === y1 && x2 === y2) return (t) => t;

  return function easing(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Resolve t a partir de x, depois avalia y.
    let guess = t;
    const slope = getSlope(guess, x1, x2);
    if (slope >= NEWTON_MIN_SLOPE) guess = newtonRaphsonIterate(t, guess, x1, x2);
    else if (slope !== 0) guess = binarySubdivide(t, 0, 1, x1, x2);

    return calcBezier(guess, y1, y2);
  };
}

/** Curvas equivalentes aos presets de mola do Figma usados no projeto. */
export const EASE_SLOW = cubicBezier(0.33, 0, 0.15, 1);
export const EASE_BOUNCY = cubicBezier(0.34, 1.56, 0.64, 1);
