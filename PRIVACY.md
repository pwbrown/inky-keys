# Privacy

Inky Keys collects **nothing** about you.

- **No analytics, tracking, ads, crash reporting or third-party scripts.** The game's code only talks to the site it was loaded from, plus the optional word download described below.
- **Your data stays in your browser.** Your chosen keys, presets, progress, best scores and per-key typing stats are stored on your device (IndexedDB) and never sent anywhere. Display and sound settings are kept in the browser's local storage.
- **Players.** Several people can play on one browser, each with their own save. A player is just a name and an ink-drop color you choose, stored with the saves on your device. There are no accounts, and nothing moves between devices unless you send it yourself (see **Moving to another device** below).
- **You control it.** In the game, open **Manage saves** (press **B** on the main menu) to export a backup of the current player's save, import one, or erase it. **Switch player** (U) lets you rename or delete players. Clearing your browser's site data for Inky Keys erases everything.
- **Offline.** After the first visit, the game runs from your browser's cache and doesn't need a connection.

## The website host

When the game is served from a website (for example GitHub Pages), that host receives the normal information any web request includes, such as your IP address and browser type, and may keep server logs under its own privacy policy. Inky Keys has no access to those logs and adds nothing to them. For GitHub Pages, see [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Word lists (optional download)

Pressing **W** opens **Word lists**, where you can download words related to a topic. Only when you click **Download words**, Inky Keys sends the topic you typed, and nothing else, to [Wikipedia's public API](https://www.mediawiki.org/wiki/API:Main_page) in your words language (`en.wikipedia.org` for English words, `fr.wikipedia.org` for French, `es.wikipedia.org` for Spanish), which returns the best-matching article. The request carries no cookies, no referrer and no identifiers (just a header naming the game, as Wikimedia asks of apps). Wikipedia receives the request like any web server would (including your IP address) under the [Wikimedia privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy). Inky Keys picks the article's words on your device, keeps only those, and saves them on your device to work offline.

This is the only network request the game makes beyond loading itself, and it never happens unless you ask.

## Moving to another device

In **Manage saves**, **Copy transfer link** puts the current player's name, badge and progress (everything in their save except downloaded word lists) into a link, after a `#`. Browsers never send that part to the website. You send the link to yourself however you like, and open it on the other device, where the game reads it, removes it from the address bar, and asks whether to add the player or replace the current one.

Anyone who has the link can load a copy of that progress, so send it only to yourself. The game checks a transfer link exactly as it checks an imported backup file.

## Sharing your Daily Page result

On the **Daily Page** screen you can copy your result. It's made on your device; the game sends nothing.

- **Copy result** puts a short text on your clipboard: your score, words per minute, accuracy, each page's grade, your streak and a **challenge link**.
- The challenge link holds the day's page number, your keyboard layout, your words language (when it isn't English), your score and page grades after a `#` in the address. Browsers never send that part to the website, so the host doesn't see it when a friend opens the link. Your player name is only added if you tick **Sign my challenge link**.
- When you open someone else's challenge link, the game reads it in your browser and removes it from the address bar. A name in a link is shortened to letters, numbers and spaces, and left out if the word filter wouldn't allow it.

## Links to GitHub

The **About** screen links to Inky Keys' source code and to a form for suggesting ideas or reporting bugs, both on GitHub. These are ordinary links: the game sends nothing, and GitHub only hears from you if you click one, in a new tab, under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
