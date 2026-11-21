/**
 * French holiday words (core/seasons.ts): December only. Thanksgiving isn't
 * a French holiday, so it has no French words (REQUIREMENTS §13d). A test
 * checks each is in the bundled French pack, so the word filter allows it.
 */
import type { SeasonId } from '../../core/seasons';

export const HOLIDAY_WORDS: Readonly<Partial<Record<SeasonId, readonly string[]>>> = {
  christmas: [
    'neige', 'cadeau', 'cadeaux', 'traîneau', 'lutin', 'lutins', 'sapin', 'étoile', 'étoiles', 'guirlande',
    'bougie', 'bougies', 'biscuit', 'chocolat', 'moufle', 'moufles', 'écharpe', 'ruban', 'renne', 'rennes',
    'hiver', 'givre', 'glaçon', 'cheminée', 'chaussette', 'ange', 'anges', 'jouet', 'jouets', 'joie',
    'joyeux', 'fête', 'boule', 'boules', 'houx', 'flocon', 'flocons', 'bûche', 'crèche', 'noël',
    'cloche', 'clochette', 'réveillon', 'luge', 'bonnet', 'marrons', 'épices', 'chant', 'lumières', 'paquet',
  ],
};
