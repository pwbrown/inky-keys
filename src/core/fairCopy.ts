/**
 * Fair Copy: a typing-speed test. The player copies out a passage (or as
 * much text as they can in a timed test); the clock starts on the first key.
 *
 * Mistakes don't block: each key lands on the next letter, right or wrong,
 * and Backspace can take keys back. Mistakes still on the page when the test
 * ends cost net speed (`errorPenaltyChars` each); every wrong key counts
 * against accuracy, fixed or not.
 *
 * A timed test strings passages together; Enter moves on to the next one.
 */
import { GAME_CONFIG } from './config';
import type { Language } from './languages';
import { applyEdit } from './editing';
import { accuracy, wpm } from './stats';
import { plainLetter } from './accents';

export interface Passage {
  id: string;
  /** The words language it's in: passages are dealt from the player's (REQUIREMENTS §13d). */
  lang: Language;
  title: string;
  author: string;
  text: string;
}

/** Public-domain openings (Project Gutenberg), with plain ASCII punctuation so every character can be typed. */
export const PASSAGES: readonly Passage[] = [
  {
    id: 'austen-pride',
    lang: 'en',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    text:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. ' +
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed ' +
      'in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
  },
  {
    id: 'dickens-two-cities',
    lang: 'en',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    text:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, ' +
      'it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, ' +
      'it was the spring of hope, it was the winter of despair.',
  },
  {
    id: 'twain-huck',
    lang: 'en',
    title: 'Adventures of Huckleberry Finn',
    author: 'Mark Twain',
    text:
      "You don't know about me without you have read a book by the name of The Adventures of Tom Sawyer; but that ain't no matter. " +
      'That book was made by Mr. Mark Twain, and he told the truth, mainly. There was things which he stretched, but mainly he told the truth.',
  },
  {
    id: 'melville-moby',
    lang: 'en',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    text:
      'Call me Ishmael. Some years ago - never mind how long precisely - having little or no money in my purse, and nothing particular ' +
      'to interest me on shore, I thought I would sail about a little and see the watery part of the world. ' +
      'It is a way I have of driving off the spleen and regulating the circulation.',
  },
  {
    id: 'tolstoy-anna',
    lang: 'en',
    title: 'Anna Karenina',
    author: 'Leo Tolstoy',
    text:
      "Happy families are all alike; every unhappy family is unhappy in its own way. Everything was in confusion in the Oblonskys' house. " +
      'The wife had discovered that the husband was carrying on an intrigue with a French girl, who had been a governess in their family, ' +
      'and she had announced to her husband that she could not go on living in the same house with him.',
  },
  {
    id: 'carroll-alice',
    lang: 'en',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    text:
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had ' +
      "peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' " +
      "thought Alice 'without pictures or conversations?'",
  },
  {
    id: 'bronte-jane',
    lang: 'en',
    title: 'Jane Eyre',
    author: 'Charlotte Bronte',
    text:
      'There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; ' +
      'but since dinner (Mrs. Reed, when there was no company, dined early) the cold winter wind had brought with it clouds so sombre, ' +
      'and a rain so penetrating, that further out-door exercise was now out of the question.',
  },
  {
    id: 'fitzgerald-gatsby',
    lang: 'en',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    text:
      "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since. " +
      '"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world ' +
      "haven't had the advantages that you've had.\"",
  },
  {
    id: 'barrie-peter',
    lang: 'en',
    title: 'Peter Pan',
    author: 'J. M. Barrie',
    text:
      'All children, except one, grow up. They soon know that they will grow up, and the way Wendy knew was this. ' +
      'One day when she was two years old she was playing in a garden, and she plucked another flower and ran with it to her mother.',
  },
  {
    id: 'baum-oz',
    lang: 'en',
    title: 'The Wonderful Wizard of Oz',
    author: 'L. Frank Baum',
    text:
      'Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer, and Aunt Em, who was the farmer\'s wife. ' +
      'Their house was small, for the lumber to build it had to be carried by wagon many miles.',
  },
  {
    id: 'dickens-carol',
    lang: 'en',
    title: 'A Christmas Carol',
    author: 'Charles Dickens',
    text:
      'Marley was dead: to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, ' +
      'the clerk, the undertaker, and the chief mourner. Scrooge signed it.',
  },
  {
    id: 'shelley-frankenstein',
    lang: 'en',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    text:
      'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such ' +
      'evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence ' +
      'in the success of my undertaking.',
  },
  {
    id: 'doyle-bohemia',
    lang: 'en',
    title: 'A Scandal in Bohemia',
    author: 'Arthur Conan Doyle',
    text:
      'To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. ' +
      'In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler.',
  },
  {
    id: 'alcott-little-women',
    lang: 'en',
    title: 'Little Women',
    author: 'Louisa May Alcott',
    text:
      '"Christmas won\'t be Christmas without any presents," grumbled Jo, lying on the rug. ' +
      '"It\'s so dreadful to be poor!" sighed Meg, looking down at her old dress. ' +
      '"I don\'t think it\'s fair for some girls to have plenty of pretty things, and other girls nothing at all," added little Amy, with an injured sniff.',
  },
  {
    id: 'burnett-secret-garden',
    lang: 'en',
    title: 'The Secret Garden',
    author: 'Frances Hodgson Burnett',
    text:
      'When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen. ' +
      'It was true, too. She had a little thin face and a little thin body, thin light hair and a sour expression.',
  },
  {
    id: 'grahame-willows',
    lang: 'en',
    title: 'The Wind in the Willows',
    author: 'Kenneth Grahame',
    text:
      'The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; ' +
      'then on ladders and steps and chairs, with a brush and a pail of whitewash; till he had dust in his throat and eyes, ' +
      'and splashes of whitewash all over his black fur, and an aching back and weary arms.',
  },
  {
    id: 'london-call',
    lang: 'en',
    title: 'The Call of the Wild',
    author: 'Jack London',
    text:
      'Buck did not read the newspapers, or he would have known that trouble was brewing, not alone for himself, ' +
      'but for every tide-water dog, strong of muscle and with warm, long hair, from Puget Sound to San Diego.',
  },
  {
    id: 'wilde-dorian',
    lang: 'en',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    text:
      'The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, ' +
      'there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.',
  },
  {
    id: 'dickens-expectations',
    lang: 'en',
    title: 'Great Expectations',
    author: 'Charles Dickens',
    text:
      "My father's family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer " +
      'or more explicit than Pip. So, I called myself Pip, and came to be called Pip.',
  },
  {
    id: 'austen-emma',
    lang: 'en',
    title: 'Emma',
    author: 'Jane Austen',
    text:
      'Emma Woodhouse, handsome, clever, and rich, with a comfortable home and happy disposition, seemed to unite some of the best blessings ' +
      'of existence; and had lived nearly twenty-one years in the world with very little to distress or vex her.',
  },
  {
    id: 'sewell-black-beauty',
    lang: 'en',
    title: 'Black Beauty',
    author: 'Anna Sewell',
    text:
      'The first place that I can well remember was a large pleasant meadow with a pond of clear water in it. ' +
      'Some shady trees leaned over the pond, and rushes and water-lilies grew at the deep end.',
  },
  {
    id: 'kipling-jungle',
    lang: 'en',
    title: 'The Jungle Book',
    author: 'Rudyard Kipling',
    text:
      "It was seven o'clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day's rest, scratched himself, " +
      'yawned, and spread out his paws one after the other to get rid of the sleepy feeling in their tips.',
  },
  {
    id: 'wells-time-machine',
    lang: 'en',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    text:
      'The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. ' +
      'His grey eyes shone and twinkled, and his usually pale face was flushed and animated.',
  },
  {
    id: 'conrad-heart',
    lang: 'en',
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    text:
      'The Nellie, a cruising yawl, swung to her anchor without a flutter of the sails, and was at rest. ' +
      'The flood had made, the wind was nearly calm, and being bound down the river, the only thing for it was to come to and wait for the turn of the tide.',
  },
  {
    id: 'nesbit-railway',
    lang: 'en',
    title: 'The Railway Children',
    author: 'E. Nesbit',
    text:
      "They were not railway children to begin with. I don't suppose they had ever thought about railways except as a means of getting " +
      "to Maskelyne and Cook's, the Pantomime, Zoological Gardens, and Madame Tussaud's.",
  },
  {
    id: 'burnett-little-princess',
    lang: 'en',
    title: 'A Little Princess',
    author: 'Frances Hodgson Burnett',
    text:
      "Once on a dark winter's day, when the yellow fog hung so thick and heavy in the streets of London that the lamps were lighted " +
      'and the shop windows blazed with gas as they do at night, an odd-looking little girl sat in a cab with her father ' +
      'and drove rather slowly through the big thoroughfares.',
  },
  {
    id: 'woolf-dalloway',
    lang: 'en',
    title: 'Mrs Dalloway',
    author: 'Virginia Woolf',
    text:
      'Mrs. Dalloway said she would buy the flowers herself. For Lucy had her work cut out for her. ' +
      "The doors would be taken off their hinges; Rumpelmayer's men were coming. " +
      'And then, thought Clarissa Dalloway, what a morning, fresh as if issued to children on a beach.',
  },

  // French: public-domain texts in the original, with their accents and plain
  // punctuation (straight quotes, no guillemets, an ordinary space before ; : ! ?).
  // Checked word for word against their editions on fr.wikisource.org (modern-spelling
  // editions where there are several; Perrault's 1697 tales in modern spelling).
  {
    id: 'verne-tour-du-monde',
    lang: 'fr',
    title: 'Le Tour du monde en quatre-vingts jours',
    author: 'Jules Verne',
    text:
      "En l'année 1872, la maison portant le numéro 7 de Saville-row, Burlington Gardens, maison dans laquelle Shéridan mourut en 1814, était habitée par Phileas Fogg, esq., " +
      "l'un des membres les plus singuliers et les plus remarqués du Reform-Club de Londres, " +
      "bien qu'il semblât prendre à tâche de ne rien faire qui pût attirer l'attention.",
  },
  {
    id: 'verne-vingt-mille-lieues',
    lang: 'fr',
    title: 'Vingt mille lieues sous les mers',
    author: 'Jules Verne',
    text:
      "L'année 1866 fut marquée par un événement bizarre, un phénomène inexpliqué et inexplicable que personne n'a sans doute oublié. " +
      "Sans parler des rumeurs qui agitaient les populations des ports et surexcitaient l'esprit public à l'intérieur des continents, " +
      'les gens de mer furent particulièrement émus.',
  },
  {
    id: 'hugo-miserables',
    lang: 'fr',
    title: 'Les Misérables',
    author: 'Victor Hugo',
    text:
      "En 1815, M. Charles-François-Bienvenu Myriel était évêque de Digne. C'était un vieillard d'environ soixante-quinze ans ; " +
      "il occupait le siège de Digne depuis 1806. Quoique ce détail ne touche en aucune manière au fond même de ce que nous avons à raconter, " +
      "il n'est peut-être pas inutile, ne fût-ce que pour être exact en tout, d'indiquer ici les bruits et les propos qui avaient couru sur son compte au moment où il était arrivé dans le diocèse.",
  },
  {
    id: 'dumas-mousquetaires',
    lang: 'fr',
    title: 'Les Trois Mousquetaires',
    author: 'Alexandre Dumas',
    text:
      "Le premier lundi du mois d'avril 1626, le bourg de Meung, où naquit l'auteur du Roman de la Rose, " +
      'semblait être dans une révolution aussi entière que si les huguenots en fussent venus faire une seconde Rochelle.',
  },
  {
    id: 'perrault-chaperon',
    lang: 'fr',
    title: 'Le Petit Chaperon rouge',
    author: 'Charles Perrault',
    text:
      "Il était une fois une petite fille de village, la plus éveillée qu'on eût su voir : sa mère en était folle, et sa mère-grand plus folle encore. " +
      "Cette bonne femme lui fit faire un petit chaperon rouge, qui lui seyait si bien, que partout on l'appelait le petit Chaperon rouge.",
  },
  {
    id: 'perrault-cendrillon',
    lang: 'fr',
    title: 'Cendrillon',
    author: 'Charles Perrault',
    text:
      "Il était une fois un gentilhomme qui épousa en secondes noces une femme, la plus hautaine et la plus fière qu'on eût jamais vue. " +
      'Elle avait deux filles de son humeur, et qui lui ressemblaient en toutes choses.',
  },
  {
    id: 'lafontaine-cigale',
    lang: 'fr',
    title: 'La Cigale et la Fourmi',
    author: 'Jean de La Fontaine',
    text:
      'La Cigale, ayant chanté tout l\'été, se trouva fort dépourvue quand la bise fut venue : pas un seul petit morceau de mouche ou de vermisseau. ' +
      'Elle alla crier famine chez la fourmi, sa voisine, la priant de lui prêter quelque grain pour subsister jusqu\'à la saison nouvelle.',
  },
  {
    id: 'lafontaine-corbeau',
    lang: 'fr',
    title: 'Le Corbeau et le Renard',
    author: 'Jean de La Fontaine',
    text:
      'Maître corbeau, sur un arbre perché, tenait en son bec un fromage. Maître renard, par l\'odeur alléché, lui tint à peu près ce langage : ' +
      "Hé ! bonjour, monsieur du corbeau. Que vous êtes joli ! que vous me semblez beau !",
  },
  {
    id: 'malot-sans-famille',
    lang: 'fr',
    title: 'Sans famille',
    author: 'Hector Malot',
    text:
      "Je suis un enfant trouvé. Mais jusqu'à huit ans, j'ai cru que, comme tous les autres enfants, j'avais une mère, " +
      "car lorsque je pleurais, il y avait une femme qui me serrait si doucement dans ses bras, en me berçant, que mes larmes s'arrêtaient de couler.",
  },
  {
    id: 'verne-ile-mysterieuse',
    lang: 'fr',
    title: "L'Île mystérieuse",
    author: 'Jules Verne',
    text:
      'Remontons-nous ? Non ! Au contraire ! Nous descendons ! Pis que cela, monsieur Cyrus ! Nous tombons ! ' +
      "Pour Dieu ! Jetez du lest ! Voilà le dernier sac vidé ! Le ballon se relève-t-il ? Non ! J'entends comme un clapotement de vagues ! " +
      'La mer est sous la nacelle !',
  },
  {
    id: 'lafontaine-lievre',
    lang: 'fr',
    title: 'Le Lièvre et la Tortue',
    author: 'Jean de La Fontaine',
    text:
      "Rien ne sert de courir ; il faut partir à point : le lièvre et la tortue en sont un témoignage. " +
      "Gageons, dit celle-ci, que vous n'atteindrez point sitôt que moi ce but.",
  },
  {
    id: 'lafontaine-rats',
    lang: 'fr',
    title: 'Le Rat de ville et le Rat des champs',
    author: 'Jean de La Fontaine',
    text:
      "Autrefois le rat de ville invita le rat des champs, d'une façon fort civile, à des reliefs d'ortolans. " +
      'Sur un tapis de Turquie le couvert se trouva mis. Je laisse à penser la vie que firent ces deux amis.',
  },
  {
    id: 'lafontaine-loup-agneau',
    lang: 'fr',
    title: "Le Loup et l'Agneau",
    author: 'Jean de La Fontaine',
    text:
      "La raison du plus fort est toujours la meilleure : nous l'allons montrer tout à l'heure. " +
      "Un agneau se désaltérait dans le courant d'une onde pure. Un loup survint à jeun, qui cherchait aventure, " +
      'et que la faim en ces lieux attirait.',
  },
  {
    id: 'perrault-chat-botte',
    lang: 'fr',
    title: 'Le Maître Chat ou le Chat botté',
    author: 'Charles Perrault',
    text:
      "Un meunier ne laissa pour tous biens à trois enfants qu'il avait, que son moulin, son âne et son chat. " +
      'Les partages furent bientôt faits, ni le notaire, ni le procureur n\'y furent point appelés. ' +
      'Ils auraient eu bientôt mangé tout le pauvre patrimoine.',
  },
  {
    id: 'perrault-fees',
    lang: 'fr',
    title: 'Les Fées',
    author: 'Charles Perrault',
    text:
      "Il était une fois une veuve qui avait deux filles : l'aînée lui ressemblait si fort d'humeur et de visage, " +
      'que qui la voyait, voyait la mère. Elles étaient toutes deux si désagréables et si orgueilleuses, ' +
      "qu'on ne pouvait vivre avec elles.",
  },
  {
    id: 'perrault-poucet',
    lang: 'fr',
    title: 'Le Petit Poucet',
    author: 'Charles Perrault',
    text:
      "Il était une fois un bûcheron et une bûcheronne qui avaient sept enfants, tous garçons ; " +
      "l'aîné n'avait que dix ans, et le plus jeune n'en avait que sept.",
  },
  {
    id: 'daudet-chevre',
    lang: 'fr',
    title: 'La Chèvre de monsieur Seguin',
    author: 'Alphonse Daudet',
    text:
      "M. Seguin n'avait jamais eu de bonheur avec ses chèvres. Il les perdait toutes de la même façon : " +
      'un beau matin, elles cassaient leur corde, s\'en allaient dans la montagne, et là-haut le loup les mangeait.',
  },
  {
    id: 'daudet-moulin',
    lang: 'fr',
    title: 'Lettres de mon moulin',
    author: 'Alphonse Daudet',
    text:
      "Ce sont les lapins qui ont été étonnés ! Depuis si longtemps qu'ils voyaient la porte du moulin fermée, " +
      'les murs et la plate-forme envahis par les herbes, ils avaient fini par croire que la race des meuniers était éteinte, ' +
      "et, trouvant la place bonne, ils en avaient fait quelque chose comme un quartier général, un centre d'opérations stratégiques : le moulin de Jemmapes des lapins...",
  },
  {
    id: 'hugo-notre-dame',
    lang: 'fr',
    title: 'Notre-Dame de Paris',
    author: 'Victor Hugo',
    text:
      "Il y a aujourd'hui trois cent quarante-huit ans six mois et dix-neuf jours que les parisiens s'éveillèrent " +
      "au bruit de toutes les cloches sonnant à grande volée dans la triple enceinte de la Cité, de l'Université et de la Ville.",
  },
  {
    id: 'alain-fournier-meaulnes',
    lang: 'fr',
    title: 'Le Grand Meaulnes',
    author: 'Alain-Fournier',
    text:
      'Il arriva chez nous un dimanche de novembre 189... Je continue à dire "chez nous", ' +
      'bien que la maison ne nous appartienne plus. Nous avons quitté le pays depuis bientôt quinze ans ' +
      "et nous n'y reviendrons certainement jamais.",
  },
  // Spanish: public-domain texts in the original, keeping ¿ ¡ and accents, with plain
  // punctuation (straight quotes, no dashes). Copied from es.wikisource.org and checked
  // word for word against those pages; only modern-spelling stretches are used.
  {
    id: 'cervantes-quijote',
    lang: 'es',
    title: 'Don Quijote de la Mancha',
    author: 'Miguel de Cervantes',
    text:
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los ' +
      'de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, ' +
      'salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura ' +
      'los domingos, consumían las tres partes de su hacienda.',
  },
  {
    id: 'cervantes-molinos',
    lang: 'es',
    title: 'Don Quijote de la Mancha',
    author: 'Miguel de Cervantes',
    text:
      '¿Qué gigantes? dijo Sancho Panza. Aquellos que allí ves, respondió su amo, de los brazos largos, que los ' +
      'suelen tener algunos de casi dos leguas. Mire vuestra merced, respondió Sancho, que aquellos que allí se ' +
      'parecen no son gigantes, sino molinos de viento, y lo que en ellos parecen brazos son las aspas, que, ' +
      'volteadas del viento, hacen andar la piedra del molino.',
  },
  {
    id: 'calderon-vida-sueno',
    lang: 'es',
    title: 'La vida es sueño',
    author: 'Pedro Calderón de la Barca',
    text:
      'Yo sueño que estoy aquí Destas prisiones cargado, Y soñé que en otro estado Mas lisonjero me vi. ¿Qué es la ' +
      'vida? Un frenesí. ¿Qué es la vida? Una ilusión, Una sombra, una ficción, Y el mayor bien es pequeño: Que toda ' +
      'la vida es sueño, Y los sueños sueño son.',
  },
  {
    id: 'galdos-trafalgar',
    lang: 'es',
    title: 'Trafalgar',
    author: 'Benito Pérez Galdós',
    text:
      'Se me permitirá que antes de referir el gran suceso de que fui testigo, diga algunas palabras sobre mi ' +
      'infancia, explicando por qué extraña manera me llevaron los azares de la vida a presenciar la terrible ' +
      'catástrofe de nuestra marina.',
  },
  {
    id: 'becquer-rayo-de-luna',
    lang: 'es',
    title: 'El rayo de luna',
    author: 'Gustavo Adolfo Bécquer',
    text:
      'Yo no sé si esto es una historia que parece cuento o un cuento que parece historia; lo que puedo decir es que ' +
      'en su fondo hay una verdad, una verdad muy triste, de la que acaso yo seré uno de los últimos en aprovecharme, ' +
      'dadas mis condiciones de imaginación. Otro, con esta idea, tal vez hubiera hecho un tomo de filosofía ' +
      'lacrimosa; yo he escrito esta leyenda, que, a los que nada vean en su fondo, al menos podrá entretenerlos un ' +
      'rato.',
  },
  {
    id: 'dario-sonatina',
    lang: 'es',
    title: 'Sonatina',
    author: 'Rubén Darío',
    text:
      'La princesa está triste... ¿qué tendrá la princesa? Los suspiros se escapan de su boca de fresa, Que ha ' +
      'perdido la risa, que ha perdido el color. La princesa está pálida en su silla de oro, Está mudo el teclado de ' +
      'su clave sonoro; Y en un vaso olvidada se desmaya una flor.',
  },
  {
    id: 'dario-margarita',
    lang: 'es',
    title: 'A Margarita Debayle',
    author: 'Rubén Darío',
    text:
      'Margarita, está linda la mar, y el viento lleva esencia sutil de azahar; yo siento en el alma una alondra ' +
      'cantar; tu acento. Margarita, te voy a contar un cuento. Este era un rey que tenía un palacio de diamantes, ' +
      'una tienda hecha del día y un rebaño de elefantes, un kiosko de malaquita, un gran manto de tisú, y una gentil ' +
      'princesita, tan bonita, Margarita, tan bonita como tú.',
  },
  {
    id: 'marti-rosa-blanca',
    lang: 'es',
    title: 'Versos sencillos',
    author: 'José Martí',
    text:
      'Cultivo una rosa blanca En julio como enero, Para el amigo sincero Que me da su mano franca. Y para el cruel ' +
      'que me arranca El corazón con que vivo, Cardo ni ortiga cultivo; Cultivo la rosa blanca.',
  },
  {
    id: 'marti-zapaticos',
    lang: 'es',
    title: 'Los zapaticos de rosa',
    author: 'José Martí',
    text:
      'Hay sol bueno y mar de espuma, Y arena fina, y Pilar Quiere salir a estrenar Su sombrerito de pluma. "¡Vaya la ' +
      'niña divina!" Dice el padre, y le da un beso: "Vaya mi pájaro preso A buscarme arena fina." "Yo voy con mi ' +
      'niña hermosa", Le dijo la madre buena: "¡No te manches en la arena Los zapaticos de rosa!" Fueron las dos al ' +
      'jardín Por la calle del laurel: La madre cogió un clavel Y Pilar cogió un jazmín.',
  },
  {
    id: 'clarin-cordera',
    lang: 'es',
    title: '¡Adiós, Cordera!',
    author: 'Leopoldo Alas "Clarín"',
    text:
      '¡Eran tres: siempre los tres! Rosa, Pinín y la Cordera. El prao Somonte era un recorte triangular de ' +
      'terciopelo verde tendido, como una colgadura, cuesta abajo por la loma. Uno de sus ángulos, el inferior, lo ' +
      'despuntaba el camino de hierro de Oviedo a Gijón.',
  },
  {
    id: 'quiroga-tortuga',
    lang: 'es',
    title: 'La tortuga gigante',
    author: 'Horacio Quiroga',
    text:
      'Había una vez un hombre que vivía en Buenos Aires, y estaba muy contento porque era un hombre sano y ' +
      'trabajador. Pero un día se enfermó, y los médicos le dijeron que solamente yéndose al campo podría curarse. El ' +
      'no quería ir, porque tenía hermanos chicos a quienes daba de comer; y se enfermaba cada día más.',
  },
  {
    id: 'machado-caminante',
    lang: 'es',
    title: 'Campos de Castilla',
    author: 'Antonio Machado',
    text:
      'Caminante, son tus huellas el camino, y nada más; caminante, no hay camino: se hace camino al andar. Al andar ' +
      'se hace camino, y al volver la vista atrás se ve la senda que nunca se ha de volver a pisar. Caminante, no hay ' +
      'camino, sino estelas en la mar.',
  },
  {
    id: 'pombo-renacuajo',
    lang: 'es',
    title: 'El renacuajo paseador',
    author: 'Rafael Pombo',
    text:
      'El hijo de rana, Rinrín renacuajo Salió esta mañana muy tieso y muy majo Con pantalón corto, corbata a la moda ' +
      'Sombrero encintado y chupa de boda. ¡Muchacho, no salgas! le grita mamá pero él hace un gesto y orondo se va. ' +
      'Halló en el camino, a un ratón vecino Y le dijo: ¡amigo! venga usted conmigo, Visitemos juntos a doña ratona Y ' +
      'habrá francachela y habrá comilona.',
  },
  {
    id: 'pombo-mirringa',
    lang: 'es',
    title: 'Mirringa Mirronga',
    author: 'Rafael Pombo',
    text:
      'Llegaron en coche ya entrada la noche señores y damas, con muchas zalemas, en grande uniforme, de cola y de ' +
      'guante, con cuellos muy tiesos y frac elegante. Al cerrar la puerta Mirriña la tuerta en una cabriola se ' +
      'mordió la cola, mas olió el tocino y dijo "¡Miaao! ¡Este es un banquete de pipiripao!"',
  },
  {
    id: 'pombo-simon',
    lang: 'es',
    title: 'Simón el bobito',
    author: 'Rafael Pombo',
    text:
      'Simón el bobito llamó al pastelero: ¡a ver los pasteles, los quiero probar! Sí, repuso el otro, pero antes yo ' +
      'quiero ver ese cuartillo con que has de pagar. Buscó en los bolsillos el buen Simoncito y dijo: ¡de veras! no ' +
      'tengo ni unito. A Simón el bobito le gusta el pescado Y quiere volverse también pescador, Y pasa las horas ' +
      'sentado, sentado, Pescando en el balde de mamá Leonor.',
  },
  {
    id: 'quiroga-flamencos',
    lang: 'es',
    title: 'Las medias de los flamencos',
    author: 'Horacio Quiroga',
    text:
      'Cierta vez las víboras dieron un gran baile. Invitaron a las ranas y los sapos, a los flamencos, y a los ' +
      'yacarés y los pescados. Los pescados, como no caminan, no pudieron bailar; pero siendo el baile a la orilla ' +
      'del río, los pescados estaban asomados a la arena, y aplaudían con la cola.',
  },
  {
    id: 'quiroga-loro',
    lang: 'es',
    title: 'El loro pelado',
    author: 'Horacio Quiroga',
    text:
      'Había una vez una bandada de loros que vivían en el monte. De mañana, temprano iban a comer choclos a la ' +
      'chacra, y de tarde comían naranjas. Hacían gran barullo con sus gritos, y tenían siempre un loro de centinela ' +
      'en los árboles más altos, para ver si venía alguien.',
  },
  {
    id: 'dario-lobo',
    lang: 'es',
    title: 'Los motivos del lobo',
    author: 'Rubén Darío',
    text:
      'El varón que tiene corazón de lis, alma de querube, lengua celestial, el mínimo y dulce Francisco de Asís, ' +
      'está con un rudo y torvo animal, bestia temerosa, de sangre y de robo, las fauces de furia, los ojos de mal: ' +
      '¡el lobo de Gubbia, el terrible lobo!',
  },
  {
    id: 'samaniego-cuervo',
    lang: 'es',
    title: 'El cuervo y el zorro',
    author: 'Félix María de Samaniego',
    text:
      'Al oír un discurso tan dulce y halagüeño, de vanidad llevado, quiso cantar el Cuervo. Abrió su negro pico, ' +
      'dejó caer el queso. El muy astuto Zorro, después de haberle preso, le dijo: "Señor bobo, pues sin otro ' +
      'alimento, quedáis con alabanzas tan hinchado y repleto, digerid las lisonjas mientras yo digiero el queso" ' +
      'Quien oye aduladores, nunca espere otro premio.',
  },
  {
    id: 'galdos-misericordia',
    lang: 'es',
    title: 'Misericordia',
    author: 'Benito Pérez Galdós',
    text:
      'Antes de que concluyera la frase, el D. Carlos voló; y lo digo así, porque el terrible huracán hizo presa en ' +
      'su desmedida capa, y allá veríais al hombre, con todo el paño arremolinado en la cabeza, dando tumbos y giros, ' +
      'como un rollo de tela o un pedazo de alfombra arrebatados por el viento, hasta que fue a dar de golpe contra ' +
      'la puerta, y entró ruidosa y atropelladamente, desembarazando su cabeza del trapo que la envolvía.',
  },
  {
    id: 'becquer-corza',
    lang: 'es',
    title: 'La corza blanca',
    author: 'Gustavo Adolfo Bécquer',
    text:
      'En efecto, era así, pues a poco de haberse oído la esquililla empezaron a saltar por entre las apiñadas matas ' +
      'de cantueso y tomillo y a descender a la orilla opuesta del riachuelo, hasta unos cien corderos blancos como ' +
      'la nieve, detrás de los cuales, con su caperuza calada para libertarse la cabeza de los perpendiculares rayos ' +
      'del sol, y su hatillo al hombro en la punta de un palo, apareció el zagal que los conducía.',
  },
];

export function isPassageId(value: unknown): value is string {
  return typeof value === 'string' && PASSAGES.some((p) => p.id === value);
}

/** What separates passages in a timed test: the player presses Enter, as for a new paragraph. */
export const PASSAGE_BREAK = '\n';

/**
 * Deals passages in a shuffled order, every one before any comes round again,
 * and never the same one twice in a row across a reshuffle.
 */
export class PassageDeck {
  private queue: Passage[] = [];
  private last: Passage | null = null;

  constructor(
    private readonly rand: () => number,
    private readonly passages: readonly Passage[] = PASSAGES,
  ) {}

  next(): Passage {
    if (this.queue.length === 0) {
      const deck = [...this.passages];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      if (deck.length > 1 && deck[0] === this.last) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
      this.queue = deck;
    }
    this.last = this.queue.shift()!;
    return this.last;
  }
}

/** Passages from `deck` for a timed test, `first` and then as many as it takes for at least `minChars` (more than anyone types in time). */
export function drawPassages(deck: { next(): Passage }, minChars: number, first: Passage = deck.next()): Passage[] {
  const passages = [first];
  let chars = first.text.length;
  // Skip one already in this test (a chosen `first` can come round in the deck), unless they've all been used.
  for (let skips = 0; chars < minChars; ) {
    const next = deck.next();
    if (passages.includes(next) && skips++ < PASSAGES.length) continue;
    passages.push(next);
    chars += 1 + next.text.length;
  }
  return passages;
}

/** A passage's place in a test's text (a timed test strings several together). */
export interface PassageSpan {
  passage: Passage;
  start: number;
}

/** Text for a test: the passages one after another, with a PASSAGE_BREAK (Enter) between each. */
export function chainPassages(passages: readonly Passage[]): { text: string; spans: PassageSpan[] } {
  const spans: PassageSpan[] = [];
  let text = '';
  for (const passage of passages) {
    if (text !== '') text += PASSAGE_BREAK;
    spans.push({ passage, start: [...text].length });
    text += passage.text;
  }
  return { text, spans };
}

export interface FairCopy {
  text: string;
  /** For a timed test, how long it lasts; null to copy the whole text. */
  limitMs: number | null;
  /** What the player has typed, mistakes and all. One character per character of `text`. */
  buffer: string;
  /** When the first key was pressed, or null before then. */
  startedAt: number | null;
  /** When the test ended (last character typed, or time up), or null while going. */
  finishedAt: number | null;
  /** Right and wrong keystrokes (Backspace isn't either). */
  correct: number;
  errors: number;
  missedKeys: Record<string, number>;
  /** Correct keys in a row, and the best run. */
  streak: number;
  bestStreak: number;
  /** Time spent on each key: the gap since the previous key, when both were right. */
  keyTimes: Record<string, { totalMs: number; presses: number }>;
  /** The time of the last keystroke, and whether it was right. */
  lastKeyAt: number | null;
  lastWasCorrect: boolean;
  /**
   * Ink Race (M36): mistakes must be fixed. Once one is on the page only
   * `GAME_CONFIG.race.maxWrong` keys land; the rest are `blocked` until
   * Backspace, and the test only finishes when every character is right.
   */
  mustFix: boolean;
  /** A plain letter counts for its accented one (é typed as e), like the game's Forgiving accents, and `? !` for `¿ ¡`. */
  forgiving: boolean;
}

/** `blocked`: with `mustFix`, a key that didn't land because mistakes are waiting to be fixed. */
export type FairCopyEvent = 'started' | 'correct' | 'error' | 'ignored' | 'blocked' | 'fixed' | 'finished';

export interface FairCopyRules {
  mustFix?: boolean;
  forgiving?: boolean;
}

export function createFairCopy(text: string, limitMs: number | null = null, rules: FairCopyRules = {}): FairCopy {
  return {
    text,
    limitMs,
    mustFix: rules.mustFix ?? false,
    forgiving: rules.forgiving ?? false,
    buffer: '',
    startedAt: null,
    finishedAt: null,
    correct: 0,
    errors: 0,
    missedKeys: {},
    streak: 0,
    bestStreak: 0,
    keyTimes: {},
    lastKeyAt: null,
    lastWasCorrect: false,
  };
}

/** Whether each typed character matches the text. */
export function marks(test: Pick<FairCopy, 'buffer' | 'text'>): boolean[] {
  const text = [...test.text];
  return [...test.buffer].map((c, i) => c === text[i]);
}

/** With `forgiving`, what may be typed for `expected`: the plain letter, or `? !` for `¿ ¡`. */
function standIn(expected: string): string {
  if (expected === '¿') return '?';
  if (expected === '¡') return '!';
  return plainLetter(expected);
}

/** Characters typed right from the start, before the first mistake: a racer's progress. */
export function correctPrefix(test: Pick<FairCopy, 'buffer' | 'text'>): number {
  const ok = marks(test);
  const first = ok.indexOf(false);
  return first === -1 ? ok.length : first;
}

/** Mistakes still on the page. */
export function mistakesLeft(test: Pick<FairCopy, 'buffer' | 'text'>): number {
  return marks(test).filter((ok) => !ok).length;
}

export function isFinished(test: FairCopy): boolean {
  return test.finishedAt !== null;
}

/** Ends a timed test once its time is up. Call it before reading the clock. */
export function tick(test: FairCopy, now: number): FairCopyEvent[] {
  if (isFinished(test) || test.startedAt === null || test.limitMs === null) return [];
  if (now - test.startedAt < test.limitMs) return [];
  test.finishedAt = test.startedAt + test.limitMs;
  return ['finished'];
}

/** Type one character at `now` (ms). It lands on the next letter, right or wrong. The first key starts the clock. */
export function typeKey(test: FairCopy, char: string, now: number): FairCopyEvent[] {
  const ended = tick(test, now);
  if (isFinished(test)) return ended.length > 0 ? ended : ['ignored'];
  const events: FairCopyEvent[] = [];
  if (test.startedAt === null) {
    test.startedAt = now;
    events.push('started');
  }
  const text = [...test.text];
  const at = [...test.buffer].length;
  const expected = text[at];
  if (test.forgiving && expected !== undefined && char !== expected && standIn(expected) === char) char = expected;
  if (test.mustFix && (at >= text.length || at - correctPrefix(test) >= GAME_CONFIG.race.maxWrong)) {
    // Too many mistakes waiting (or the page is full of them): this key doesn't land.
    return [...events, 'blocked'];
  }
  test.buffer = applyEdit({ buffer: test.buffer, cursor: at }, { type: 'insert', char }).buffer;
  if (char === expected) {
    test.correct++;
    test.streak++;
    test.bestStreak = Math.max(test.bestStreak, test.streak);
    if (test.lastKeyAt !== null && test.lastWasCorrect) {
      const slot = (test.keyTimes[char] ??= { totalMs: 0, presses: 0 });
      slot.totalMs += now - test.lastKeyAt;
      slot.presses++;
    }
    test.lastWasCorrect = true;
    events.push('correct');
  } else {
    test.errors++;
    test.streak = 0;
    if (expected !== undefined) test.missedKeys[expected] = (test.missedKeys[expected] ?? 0) + 1;
    test.lastWasCorrect = false;
    events.push('error');
  }
  test.lastKeyAt = now;
  // The last character ends it, right or wrong (with mustFix, only once everything is right).
  if (at + 1 >= text.length && (!test.mustFix || test.buffer === test.text)) {
    test.finishedAt = now;
    events.push('finished');
  }
  return events;
}

/** Backspace: take back the last character (optional: mistakes left in just cost speed). */
export function backspace(test: FairCopy, now: number): FairCopyEvent[] {
  const ended = tick(test, now);
  if (isFinished(test)) return ended.length > 0 ? ended : ['ignored'];
  if (test.buffer === '') return ['ignored'];
  const wasWrong = marks(test).at(-1) === false;
  test.buffer = applyEdit({ buffer: test.buffer, cursor: [...test.buffer].length }, { type: 'backspace' }).buffer;
  test.lastKeyAt = now;
  test.lastWasCorrect = false;
  return wasWrong ? ['fixed'] : [];
}

/** Time on the clock: zero before the first key, frozen once finished. */
export function elapsedMs(test: FairCopy, now: number): number {
  if (test.startedAt === null) return 0;
  const ms = (test.finishedAt ?? now) - test.startedAt;
  return test.limitMs === null ? ms : Math.min(ms, test.limitMs);
}

/** Time left in a timed test (its full length before the first key), or null for a passage. */
export function remainingMs(test: FairCopy, now: number): number | null {
  return test.limitMs === null ? null : Math.max(0, test.limitMs - elapsedMs(test, now));
}

export interface FairCopyResult {
  /** Net speed: characters on the page, less `errorPenaltyChars` for each mistake left in. */
  netWpm: number;
  /** Raw speed: every keystroke, right or wrong. */
  rawWpm: number;
  /** Speed lost to mistakes left in (gross minus net). */
  penaltyWpm: number;
  /** Right keystrokes over all keystrokes, 0..1. */
  accuracy: number;
  ms: number;
  correct: number;
  errors: number;
  mistakesLeft: number;
  /** Characters on the page. */
  typed: number;
  bestStreak: number;
  /** Slowest keys first, by average time per press. */
  slowestKeys: { key: string; averageMs: number }[];
}

/** Live numbers while typing (`now`), or the final ones once finished. */
export function fairCopyResult(test: FairCopy, now: number): FairCopyResult {
  const ms = elapsedMs(test, now);
  const c = GAME_CONFIG.fairCopy;
  const typed = [...test.buffer].length;
  const left = mistakesLeft(test);
  const gross = wpm({ correct: typed, playMs: ms });
  const netWpm = wpm({ correct: Math.max(0, typed - left * c.errorPenaltyChars), playMs: ms });
  const slowestKeys = Object.entries(test.keyTimes)
    .filter(([, slot]) => slot.presses >= c.slowKeyMinPresses)
    .map(([key, slot]) => ({ key, averageMs: slot.totalMs / slot.presses }))
    .sort((a, b) => b.averageMs - a.averageMs || a.key.localeCompare(b.key))
    .slice(0, c.slowKeysShown);
  return {
    netWpm,
    rawWpm: wpm({ correct: test.correct + test.errors, playMs: ms }),
    penaltyWpm: gross - netWpm,
    accuracy: accuracy(test),
    ms,
    correct: test.correct,
    errors: test.errors,
    mistakesLeft: left,
    typed,
    bestStreak: test.bestStreak,
    slowestKeys,
  };
}
