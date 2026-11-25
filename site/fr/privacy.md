# Confidentialité

Inky Keys ne collecte **rien** sur toi.

- **Ni statistiques, ni pistage, ni publicité, ni rapports de plantage, ni scripts tiers.** Le code du jeu ne parle qu'au site d'où il a été chargé, plus le téléchargement de mots facultatif et, quand tu joues à plusieurs, les autres appareils de ton propre réseau (tous deux décrits plus bas).
- **Tes données restent dans ton navigateur.** Tes touches, tes préréglages, ta progression, tes records et tes statistiques par touche sont enregistrés sur ton appareil (IndexedDB) et ne sont jamais envoyés. Les réglages d'affichage et de son sont gardés dans le stockage local du navigateur.
- **Les joueurs.** Plusieurs personnes peuvent jouer sur un même navigateur, chacune avec sa sauvegarde. Un joueur, c'est juste un nom et une couleur de goutte d'encre que tu choisis, gardés avec les sauvegardes sur ton appareil. Il n'y a pas de compte, et rien ne passe d'un appareil à l'autre sauf si tu l'envoies toi-même (voir **Passer sur un autre appareil** plus bas).
- **Tu gardes la main.** Dans le jeu, ouvre **Gérer les sauvegardes** (touche **S** au menu principal) pour exporter une copie de la sauvegarde du joueur, en importer une ou l'effacer. **Changer de joueur** (U) permet de renommer ou de supprimer des joueurs. Effacer les données du site Inky Keys dans ton navigateur efface tout.
- **Hors ligne.** Après la première visite, le jeu tourne depuis le cache du navigateur et n'a pas besoin de connexion.

## L'hébergeur du site

Quand le jeu est servi par un site web (par exemple GitHub Pages), cet hébergeur reçoit les informations habituelles de toute requête web, comme ton adresse IP et ton type de navigateur, et peut garder des journaux sous sa propre politique de confidentialité. Inky Keys n'a pas accès à ces journaux et n'y ajoute rien. Pour GitHub Pages, voir la [déclaration de confidentialité de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Listes de mots (téléchargement facultatif)

La touche **M** ouvre les **Listes de mots**, où tu peux télécharger des mots sur un sujet. Seulement quand tu cliques sur **Télécharger des mots**, Inky Keys envoie le sujet que tu as tapé, et rien d'autre, à l'[API publique de Wikipédia](https://www.mediawiki.org/wiki/API:Main_page) dans ta langue de mots (`fr.wikipedia.org` pour les mots en français, `en.wikipedia.org` pour l'anglais), qui renvoie l'article le plus proche. La requête ne porte ni cookie, ni référent, ni identifiant (juste un en-tête qui nomme le jeu, comme Wikimedia le demande aux applications). Wikipédia reçoit la requête comme n'importe quel serveur web (y compris ton adresse IP), sous la [politique de confidentialité de Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy). Inky Keys choisit les mots de l'article sur ton appareil, ne garde qu'eux, et les enregistre sur ton appareil pour qu'ils marchent hors ligne.

C'est la seule requête vers Internet que fait le jeu en dehors de son propre chargement, et elle n'a jamais lieu sans que tu le demandes.

## Passer sur un autre appareil

Dans **Gérer les sauvegardes**, **Copier le lien de transfert** met le nom, la goutte et la progression du joueur (tout ce qu'il y a dans sa sauvegarde sauf les listes de mots téléchargées) dans un lien, après un `#`. Les navigateurs n'envoient jamais cette partie au site. Tu t'envoies le lien comme tu veux et tu l'ouvres sur l'autre appareil : le jeu le lit, l'enlève de la barre d'adresse et demande s'il faut ajouter le joueur ou remplacer le joueur actuel.

Toute personne qui a le lien peut charger une copie de cette progression : ne l'envoie qu'à toi. Le jeu vérifie un lien de transfert exactement comme un fichier de sauvegarde importé.

## Partager le résultat de la page du jour

Sur l'écran de la **page du jour**, tu peux copier ton résultat. Il est fabriqué sur ton appareil ; le jeu n'envoie rien.

- **Copier le résultat** met un petit texte dans ton presse-papiers : ton score, tes mots par minute, ta précision, la note de chaque page, ta série et un **lien de défi**.
- Le lien de défi contient le numéro de la page du jour, ta disposition de clavier, ta langue de mots, ton score et tes notes, après un `#` dans l'adresse. Les navigateurs n'envoient jamais cette partie au site, donc l'hébergeur ne la voit pas quand un ami ouvre le lien. Ton nom n'est ajouté que si tu coches **Signer mon lien de défi**.
- Quand tu ouvres le lien de défi de quelqu'un, le jeu le lit dans ton navigateur et l'enlève de la barre d'adresse. Un nom dans un lien est réduit à des lettres, des chiffres et des espaces, et laissé de côté si le filtre de mots ne l'accepterait pas.

## Jouer ensemble

**Jouer ensemble** relie directement ton appareil à ceux de tes amis sur le même réseau (WebRTC). Il n'y a pas de serveur de jeu : le jeu n'utilise aucun serveur STUN, TURN ou relais, donc la connexion reste sur ton réseau et rien ne part sur Internet.

- **Les codes.** Comme il n'y a pas de serveur, les joueurs s'échangent un court code dans chaque sens : l'invitation de l'hôte, puis la réponse du joueur. Un code contient ce dont deux navigateurs ont besoin pour se trouver sur ton réseau : une empreinte de clé à usage unique, un mot de passe à usage unique, et l'adresse et le port de cet appareil sur le réseau local. D'habitude, les navigateurs cachent l'adresse derrière un nom au hasard (`….local`) ; une fois le micro autorisé, ils peuvent montrer la vraie adresse locale (comme `192.168.1.23`). Un code ne sert que sur ton réseau, pour cette partie.
- **Envoyer les codes.** Tu choisis comment un code voyage : le copier, l'envoyer en lien (il se trouve après un `#`, que les navigateurs n'envoient jamais au site) ou **le jouer en son**. Si tu l'envoies par une messagerie ou un e-mail, ce service le transporte comme n'importe quel message.
- **Le son et le micro.** **Écouter** allume le micro pour entendre un code joué par l'autre appareil ; **Arrêter d'écouter**, la connexion ou la fermeture de Jouer ensemble l'éteignent. Le son est décodé sur ton appareil puis jeté aussitôt ; rien n'est enregistré ni envoyé.
- **Ce que les joueurs partagent.** Ton nom de joueur et la couleur de ta goutte d'encre vont à l'hôte, qui les montre à tous les joueurs de la partie. L'hôte vérifie les noms avec le même filtre que les liens de défi. Rien n'est enregistré sur les autres appareils.

## Liens vers GitHub

L'écran **À propos** a des liens vers le code source d'Inky Keys et vers un formulaire pour proposer des idées ou signaler des bogues, tous deux sur GitHub. Ce sont des liens ordinaires : le jeu n'envoie rien, et GitHub n'entend parler de toi que si tu cliques sur l'un d'eux, dans un nouvel onglet, sous la [déclaration de confidentialité de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
