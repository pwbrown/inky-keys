/**
 * Spanish holiday words (core/seasons.ts): December (Navidad) only.
 * Thanksgiving isn't a Spanish-speaking holiday, so it has no Spanish words
 * (REQUIREMENTS §13d). A test checks each is in the bundled Spanish pack, so
 * the word filter allows it.
 */
import type { SeasonId } from '../../core/seasons';

export const HOLIDAY_WORDS: Readonly<Partial<Record<SeasonId, readonly string[]>>> = {
  christmas: [
    'nieve', 'regalo', 'regalos', 'trineo', 'duende', 'duendes', 'árbol', 'estrella', 'estrellas', 'guirnalda',
    'vela', 'velas', 'galleta', 'galletas', 'chocolate', 'bufanda', 'guantes', 'cinta', 'reno', 'renos',
    'invierno', 'escarcha', 'chimenea', 'calcetín', 'calcetines', 'ángel', 'ángeles', 'juguete', 'juguetes',
    'alegría', 'feliz', 'fiesta', 'bola', 'bolas', 'campana', 'campanas', 'villancico', 'villancicos', 'turrón',
    'belén', 'pastores', 'nochebuena', 'navidad', 'gorro', 'castañas', 'luces', 'paquete', 'muñeco', 'copos',
    'reyes', 'magos', 'camello', 'hielo', 'abrazo', 'cena', 'mazapán', 'corona',
  ],
};
