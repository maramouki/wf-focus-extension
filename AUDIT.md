# Audit complet — WF Focus (extension Chrome)

**Date :** 28 août 2026
**Version auditée :** `manifest.json` v1.0.0 (commit `91cf9c6`)
**Périmètre :** produit & pertinence, architecture, sécurité, UX, UI, qualité du dépôt
**Taille du code :** 972 lignes (519 `content.js`, 95 `popup.js`, 296 `popup.css`, 62 `popup.html`)

---

## 1. Résumé exécutif

WF Focus résout un vrai problème (styliser une classe parente sous des combo classes) avec une
technique fondamentalement risquée : **l'extension supprime réellement les classes de l'élément**
en pilotant l'UI de Webflow (clics simulés + `Backspace`), puis les **retape** pour les restaurer.
Comme Webflow enregistre en continu, toute interruption (crash, fermeture d'onglet, navigation,
échec de l'autocomplétion) laisse le projet dans un état dégradé, et **il n'existe aucun mécanisme
de récupération** malgré une persistance de l'état déjà en place.

En parallèle, **Webflow a rattrapé le besoin nativement** : le *sélecteur d'héritage*
(« inheritance selectors indicator », au-dessus du champ Selector) permet aujourd'hui de styliser
la classe de base sans toucher aux combo classes, avec un code couleur inherited / overridden /
overridden-by-more-specific. C'est exactement le problème décrit au §2 du `PRODUCT_DESIGN_DOC.md`.

**Verdict :** le concept reste marginalement utile (le natif ne donne pas l'aperçu visuel
« classe de base seule », ni le geste en un clic), mais **l'implémentation actuelle ne justifie
plus son niveau de risque**. Deux issues raisonnables : soit un pivot vers une version
**non destructive** qui pilote le menu natif (~1 semaine, supprime 100 % du risque de perte de
données), soit une **réécriture en Designer Extension officielle** (App Webflow) si l'objectif est
d'en faire un produit distribuable.

**Note globale**

| Axe | Note | Commentaire |
|---|---|---|
| Pertinence produit | 4/10 | Largement couvert par le natif depuis |
| Architecture / robustesse | 3/10 | Couplage au DOM privé, timings magiques, pas de vérification |
| Sécurité (surface d'attaque) | 8/10 | Aucun réseau, aucun `eval`, aucune injection HTML |
| Hygiène des permissions | 4/10 | 2 permissions inutilisées, `host_permissions` superflues |
| UX | 4/10 | Blocage total du canvas, aucune porte de sortie en cas d'échec |
| UI | 6/10 | Soigné visuellement, mais 0 accessibilité, 0 dark mode |
| Qualité du dépôt | 3/10 | 0 test, 0 lint, 0 CI, docs contradictoires |

---

## 2. Audit produit — Webflow a-t-il rendu le projet obsolète ?

### 2.1 Ce que Webflow fait maintenant nativement

Le Designer expose un **indicateur de sélecteurs héritants** juste au-dessus du champ Selector.
En cliquant dessus, on ouvre le menu d'héritage et on peut **sélectionner et styliser la classe de
base** (ou un niveau intermédiaire de la pile) sans retirer les combo classes. Le panneau Style
indique alors :

- **orange** = propriété héritée,
- **bleu** = propriété surchargée / nouvelle,
- **barré rouge** = valeur écrasée par un sélecteur plus spécifique.

Un bouton « Back » ramène à la combo class. C'est le workflow exact que WF Focus automatise —
**sans supprimer quoi que ce soit**.

**Impact :** environ **80 % de la proposition de valeur** de WF Focus est désormais dans le produit,
avec zéro risque. Le `PRODUCT_DESIGN_DOC.md` §2 (« l'utilisateur doit normalement supprimer
manuellement les classes supérieures… ») décrit un problème qui n'est plus tout à fait exact.

### 2.2 Ce qui reste non couvert par le natif

1. **L'aperçu visuel.** Le menu d'héritage change *ce que vous éditez*, pas *ce que vous voyez* :
   le canvas continue d'afficher l'élément avec toutes ses combo classes. WF Focus, lui, montre
   réellement le rendu « classe de base seule ». C'est le seul avantage fonctionnel restant, et
   il est réel quand on debug une cascade.
2. **L'ergonomie du geste.** Shift+Clic sur la pilule est plus rapide que : cliquer l'indicateur →
   ouvrir le menu → choisir le niveau. Gain marginal mais réel sur un usage intensif.

### 2.3 L'API Webflow a-t-elle changé ? Oui, et c'est une opportunité

Ce projet n'utilise **aucune API Webflow** — il fait du scraping de DOM privé. Or Webflow dispose
depuis février 2024 d'une plateforme officielle, la **Designer API v2**, qui couvre précisément ce
cas d'usage :

| Méthode | Utilité pour WF Focus |
|---|---|
| `webflow.getSelectedElement()` | Élément sélectionné sur le canvas |
| `element.getStyles()` | Lire la pile complète de classes (ordre inclus) |
| `element.setStyles([...])` | Appliquer une pile de classes **atomiquement** |
| `style.isComboClass()` | Savoir si un style est une combo class |
| `style.getParent()` | Remonter la chaîne d'héritage (ajouté au changelog du **28 janvier 2026**) |
| `style.getProperties()` | Comparer hérité vs surchargé |
| `webflow.subscribe(...)` | Réagir au changement de sélection |

Chaque `Style` expose `id`, `name`, `type` (`global` / `combo` / `tag` / `element` / `descendant`)
et `source`. Autrement dit : **isoler puis restaurer devient deux appels `setStyles()`**, atomiques,
annulables, sans clic simulé, sans autocomplétion à deviner, sans bouclier.

**Le point bloquant à connaître :** les *Marketplace Guidelines* de Webflow interdisent
explicitement aux Designer Extensions d'utiliser des raccourcis clavier pour invoquer l'app ou
l'une de ses fonctions (« Do not use keyboard shortcuts to invoke your app or any functionality
within it »). **Le geste Shift+Clic ne survit donc pas à une App officielle** — il faudrait un
panneau avec un bouton, synchronisé sur la sélection courante.

### 2.4 Les trois scénarios

| | A — Arrêter | B — Pivot non destructif (Chrome) | C — Designer Extension (App) |
|---|---|---|---|
| **Principe** | Utiliser le menu d'héritage natif | Shift+Clic → piloter le menu natif | Réécriture sur la Designer API v2 |
| **Risque de perte de données** | nul | **nul** | nul |
| **Garde le Shift+Clic** | — | **oui** | non (interdit par le Marketplace) |
| **Aperçu « base seule »** | non | non | **oui** (`setStyles([base])` + restore) |
| **Résiste aux refontes UI Webflow** | — | non (toujours couplé au DOM) | **oui** (API supportée) |
| **Distribuable** | — | Chrome Web Store | **Marketplace Webflow** |
| **Effort** | 0 | ~1 semaine | ~3–4 semaines |
| **Code supprimé** | tout | ~60 % (plus de bouclier, plus de restore) | réécriture |

**Recommandation.** Si l'outil est pour vous seul et que vous tenez au geste : **B**. Le pivot est
simple — au lieu de supprimer les classes, on ouvre le menu d'héritage natif et on clique l'entrée
correspondante. Le pire échec devient « il ne se passe rien » au lieu de « vos classes ont
disparu ». On supprime le bouclier, le module de restauration, les retries, les timings magiques :
il ne reste qu'un raccourci clavier au-dessus d'une fonctionnalité supportée.

Si l'objectif est d'en faire un produit : **C**, mais en assumant un positionnement différent —
non plus « isoler une classe » (le natif le fait) mais **inspecteur de cascade** : aperçu visuel
base-seule, diff hérité/surchargé via `getParent()` + `getProperties()`, audit des combo classes
d'un site. C'est là qu'il y a un produit ; le simple « isolate » n'en est plus un.

**A** reste défendable si vous ne l'avez pas ouvert depuis des mois : le natif suffit.

---

## 3. Audit technique

### 3.1 Architecture

Il n'y a **pas de back-end** — c'est une extension MV3 purement cliente, sans service worker,
sans appel réseau, sans stockage distant. Deux contextes seulement :

```
popup/popup.js  ──(chrome.storage.local)──  scripts/content.js
   réglages                état partagé          logique DOM
                          (enabled, opacity,
                           focusActive,
                           removedClasses)
```

C'est adapté au périmètre. Le vrai problème n'est pas l'architecture, c'est **la stratégie
d'intégration** : tout repose sur des attributs `data-automation-id` internes à Webflow
(`content.js:9-11`), non documentés, destinés aux tests automatisés de Webflow, qui peuvent être
renommés dans n'importe quel déploiement sans préavis ni versionnement.

### 3.2 Critique (P0) — risque de perte de données

**P0-1 — Le mode focus est destructif et Webflow enregistre en continu.**
`content.js:472-484` supprime réellement les combo classes de l'élément. Webflow persiste
immédiatement. Un crash navigateur, une fermeture d'onglet, un changement de page ou un simple
échec de la boucle laisse l'élément **définitivement amputé** de ses classes. C'est le défaut
structurel de l'approche, pas un bug isolé.

**P0-2 — L'état est persisté mais jamais relu : aucune récupération possible.**
`content.js:466-470` écrit `focusActive`, `removedClasses` et `focusedClass` dans le storage. Au
chargement, `content.js:46-51` ne relit que `enabled` et `opacity`. Conséquences :
- après un rechargement en plein focus, **rien ne propose de restaurer** les classes perdues,
  alors que leur liste est là, dans le storage ;
- le popup, lui, relit ces clés (`popup.js:46-54`) et affichera indéfiniment un
  « Focus actif sur .xxx » fantôme ;
- le bouton *Reset* (`popup.js:84-94`) ne réécrit que `DEFAULTS` — il **ne nettoie pas** l'état
  fantôme, qui devient impossible à effacer depuis l'UI.

*Correctif minimal, quelques lignes :* au chargement du content script, si `focusActive` est vrai,
afficher une bannière « N classes n'ont pas été restaurées : `a`, `b`, `c` » avec un bouton
« Restaurer » / « Ignorer ».

**P0-3 — Chemin d'erreur qui piège l'utilisateur.**
`content.js:370-373` : si le champ de saisie des classes est introuvable, la fonction fait un
`console.error` puis `return` — **sans** `exitFocusMode()`, **sans** bannière d'échec. Le bouclier
reste affiché, `isFocusMode` reste à `true`, et le bouton « Restore » rejouera le même échec en
boucle. À comparer avec `content.js:338-342`, qui pour la même cause appelle bien `exitFocusMode()`.
Deux chemins d'erreur, deux comportements opposés.

**P0-4 — La restauration dépend de l'autocomplétion de Webflow.**
`restoreSingleClass` (`content.js:286-325`) retape le nom puis envoie `Enter` : la liste de
suggestions peut sélectionner **une autre classe**. Le code détecte le cas et appelle
`removeWrongClass` (`content.js:276-284`) — qui à son tour fait un `Backspace` à l'aveugle via
`removeClass`. Si *cette* suppression rate sa cible, on supprime une classe légitime.
Un échec en amorce un autre.

**P0-5 — Restauration partielle = ordre de la pile silencieusement faux.**
Si la classe n°1 sur 3 échoue mais que les n°2 et n°3 passent, la pile est reconstruite dans un
ordre différent — donc une **spécificité CSS différente**, sans avertissement explicite. La
bannière « Manual Restore Needed » liste bien les classes numérotées, mais ne dit pas que l'ordre
compte.

**P0-6 — Le bouclier laisse le bouton Publish accessible.**
`content.js:237` découpe l'overlay en `polygon(0 0, 0 100%, {boundary} 100%, {boundary} 0)` : tout
ce qui est à droite de la frontière reste cliquable **sur toute la hauteur**, y compris la partie
droite de la barre supérieure de Webflow. Un utilisateur peut donc **publier le site** pendant que
ses classes sont retirées.

### 3.3 Élevé (P1)

**P1-1 — Couplage à un DOM privé, sans détection de compatibilité.**
Si `style-rule-token-wrapper` est renommé, `enterFocusMode` sort silencieusement
(`content.js:448` et `content.js:453`) et l'extension paraît simplement morte. Il faut une
vérification au chargement et un message explicite « incompatible avec cette version du Designer ».

**P1-2 — `execCommand` déprécié, et son fallback est un no-op silencieux.**
`content.js:85` et `content.js:103`. Le fallback `input.value = text` (`content.js:106`) est
**ignoré par React** : sans passer par le setter natif
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`), l'état React n'est
jamais mis à jour. Ironie : le `PRODUCT_DESIGN_DOC.md` §5 annonce une fonction `setReactValue` —
**elle n'existe nulle part dans le code**.

**P1-3 — Aucune vérification après suppression.**
`content.js:474-477` enchaîne les `removeClass()` sans vérifier que la pilule a disparu. Et
`removeClass` (`content.js:265-274`) ne fait rien si l'input est absent — échec totalement
silencieux. L'état est marqué « focus actif » avant même que les suppressions aient réussi
(`content.js:455-470`), donc l'UI peut mentir.

**P1-4 — Pas de recalcul de la frontière du masque.**
`computeMaskBoundary()` n'est appelé qu'une fois (`content.js:236`). Un redimensionnement de
fenêtre, un repli du panneau Style ou un changement de breakpoint laisse le trou au mauvais
endroit : soit le panneau devient inaccessible (blocage total), soit une large zone de canvas
redevient cliquable (bouclier inutile). Il manque un `ResizeObserver` / listener `resize`.

**P1-5 — Verrou `isBusy` sans soupape de sécurité.**
`content.js:328` fait sortir `restoreClasses` si `isBusy` est vrai : pendant ce temps, ni `ESC` ni
le bouton « Restore » ne répondent, et le bouclier reste. Il n'existe aucun watchdog ni geste de
sortie forcée (double-`ESC`, timeout) pour reprendre la main.

**P1-6 — Timings magiques.**
`CONFIG.timing` (`content.js:20-27`) empile des `setTimeout` de 100 à 600 ms. Sur une machine
lente ou un gros projet, les courses se produisent. Il faudrait attendre une condition observable
(`MutationObserver` + polling borné) plutôt qu'une durée fixe.

**P1-7 — `chrome.runtime.lastError` jamais vérifié dans `content.js`.**
9 appels `chrome.storage.local` sans garde, alors que `popup.js` le fait systématiquement. Après un
rechargement de l'extension (onglet Webflow resté ouvert), le contexte est invalidé et chaque appel
lève une erreur non capturée.

### 3.4 Moyen (P2)

- **P2-1 — Permissions inutilisées.** Le code n'utilise que `chrome.storage`. `activeTab` et
  `scripting` (`manifest.json:6-10`) ne sont **jamais** appelés. À supprimer : avertissement
  d'installation plus léger et motif classique de rejet au Chrome Web Store.
- **P2-2 — `host_permissions` superflues.** Un content script déclaré via `matches` n'a pas besoin
  de `host_permissions` tant qu'il ne fait pas de `fetch` cross-origin ni de `chrome.scripting`.
  À retirer (`manifest.json:11-14`).
- **P2-3 — Aucune icône.** Ni `icons`, ni `action.default_icon`. Chrome affiche la pièce de puzzle
  par défaut, et le Web Store exige une 128×128.
- **P2-4 — Pas de Shadow DOM.** L'overlay et le toast sont injectés directement dans la page
  (`content.js:253`) : fuite de styles dans les deux sens. Le `<style id="wf-focus-styles">`
  (`content.js:241-251`) reste dans le `<head>` après la sortie du mode focus.
- **P2-5 — Popup : relecture du storage à chaque changement.** `popup.js:58-66` relit à chaque
  événement, y compris ses propres écritures — et le slider d'opacité écrit sur `input`, donc à
  chaque pixel. Filtrer par clé modifiée et débouncer.
- **P2-6 — Popup non synchronisé.** Seul le tracker de focus réagit aux changements externes ; le
  toggle et le slider ne se mettent pas à jour si un autre onglet modifie les réglages.
- **P2-7 — Pas de `minimum_chrome_version`** (le CSS utilise `:has()`, `popup.css:89`).
- **P2-8 — Aucun test, aucun lint, aucune CI, aucun script de packaging.** Sur un outil qui pilote
  une UI tierce par simulation d'événements, l'absence totale de tests de non-régression est le
  principal facteur de fragilité dans la durée.

---

## 4. Sécurité & vie privée

**La bonne nouvelle : la surface d'attaque est très faible.**

| Vérification | Résultat |
|---|---|
| Appels réseau / télémétrie | **Aucun** |
| `eval`, `new Function`, code distant | **Aucun** |
| Injection HTML (`innerHTML` avec données) | **Aucune** — tout passe par `createElement` + `textContent` ; le seul `innerHTML` est `= ''` (`popup.js:17`) |
| Secrets / clés en dur | Aucun |
| Dépendances tierces | **Zéro** (pas de `node_modules`, pas de CDN) — donc pas de risque de chaîne d'approvisionnement |
| Données stockées | Uniquement des noms de classes, en `chrome.storage.local` |

**Points à corriger (par ordre d'importance) :**

1. **Moindre privilège violé** — `activeTab` + `scripting` + `host_permissions` non utilisés
   (cf. P2-1/P2-2). C'est le principal reproche « sécurité » exploitable en revue Web Store.
2. **Wildcard de sous-domaine** — `https://*.design.webflow.com/*` injecte le script sur tout
   sous-domaine correspondant. Risque faible (domaine contrôlé par Webflow), mais c'est une
   surface plus large que nécessaire.
3. **Écoute globale en phase de capture** — `content.js:490` et `content.js:499` interceptent
   *tous* les `keydown` et `mousedown` du Designer. Le filtrage sur `e.shiftKey` limite les dégâts,
   mais le `preventDefault()` en capture (`content.js:503-511`) confisque un modificateur que
   Webflow peut lui-même vouloir utiliser demain.
4. **Confidentialité client** — les noms de classes d'un projet client sont écrits dans le storage
   local, en clair, et n'y sont jamais nettoyés (cf. P0-2). Faible sensibilité, mais à purger.

**À valoriser :** « zéro réseau, zéro dépendance, zéro télémétrie » est un excellent argument à
écrire noir sur blanc dans le README et dans la fiche Web Store — la plupart des extensions
Webflow ne peuvent pas le dire.

---

## 5. Audit UX

**UX-1 — Le bouclier est une réponse disproportionnée.** Recouvrir tout le canvas d'un voile
`cursor: not-allowed` (`content.js:228-234`) pour empêcher un changement de sélection accidentel,
c'est punir l'utilisateur pour un problème créé par l'approche destructive elle-même. Dans le
scénario B (non destructif), **le bouclier disparaît entièrement** : il n'y a plus rien à protéger.

**UX-2 — Pas de porte de sortie.** Quand la restauration échoue, l'utilisateur n'a que
« Got it » — qui appelle `exitFocusMode()` et **abandonne** les classes manquantes. Aucun
« Réessayer », aucun « Copier la liste », aucun rappel que l'ordre compte.

**UX-3 — Échecs silencieux.** Shift+Clic sur la dernière pilule de la pile ne fait rien
(`content.js:453`) : aucun retour, l'utilisateur croit à un bug. Idem si les sélecteurs Webflow ont
changé.

**UX-4 — Découvrabilité.** Rien dans l'UI de Webflow n'indique que Shift+Clic fait quelque chose.
Le popup ne rappelle pas le raccourci. Un premier utilisateur ne peut pas deviner.

**UX-5 — Le réglage d'opacité est un faux réglage.** Le curseur 0–40 % ne change rien au vrai
problème (le canvas est bloqué ou non). À 0 %, le blocage est invisible mais toujours actif — c'est
un piège.

**UX-6 — État fantôme dans le popup.** Cf. P0-2 : « Focus actif » peut rester affiché
indéfiniment, sans moyen de l'effacer.

**UX-7 — Langues mélangées.** README/INSTALL/PDD en français, UI de l'extension en anglais, tracker
du popup en français (`popup.html:24-26`). À unifier — en anglais si vous visez le Web Store.

---

## 6. Audit UI

**Le positif :** la direction visuelle est cohérente et soignée. Tokens CSS bien posés
(`popup.css:1-10`), rayons et ombres harmonieux, accent ambre lisible, animations discrètes
(`wf-slide-down`, `wf-pulse`) bien calibrées. Le toast est joli.

**Les problèmes :**

**UI-1 — Le toast est coupé par le `clip-path`.** L'overlay fait `100vw` avec
`align-items: center` (`content.js:232`) : le toast est donc centré sur la **fenêtre**, alors que
l'overlay est découpé à `maskBoundary`. Avec plusieurs classes en attente, le toast s'élargit et se
fait **trancher visuellement** par la découpe. Il manque un `max-width` et un centrage calculé sur
la zone utile.

**UI-2 — Accessibilité quasi nulle.**
- L'overlay n'a ni `role="dialog"`, ni `aria-live`, ni piège de focus — un lecteur d'écran ne sait
  pas qu'un mode bloquant vient de s'activer.
- Le bouton « Restore » n'est pas atteignable dans un ordre de tabulation prévisible.
- `<input type="range">` sans `aria-label` (`popup.html:49`).
- L'icône 🎯 est un emoji nu sans nom accessible (`popup.html:15`).
- Contraste : `#888` sur `#fffafa` pour les instructions du toast (`content.js:169`) ≈ 3.5:1,
  **sous le seuil AA de 4.5:1** pour du texte de 12 px.

**UI-3 — Pas de mode sombre.** Le popup est en blanc dur (`popup.css:12-19`) alors que le Designer
Webflow est sombre : l'ouverture du popup est visuellement agressive. Un bloc
`@media (prefers-color-scheme: dark)` suffirait.

**UI-4 — Styles en dur, non thémables.** Toute l'UI injectée est en `cssText` inline
(`content.js:134-215`), avec l'ambre `#ff9100` répété 12 fois. Sans Shadow DOM ni variables, la
moindre évolution visuelle demande de toucher partout.

**UI-5 — Pas de troncature.** Les pilules de classes (`content.js:184-188`) sont en
`white-space: nowrap` sans `max-width` ni ellipse : un nom de classe long casse la mise en page.

---

## 7. Dépôt, documentation, process

**D-1 — Chaos de versions.** `manifest.json` dit **1.0.0**, `PRODUCT_DESIGN_DOC.md` dit **v0.1.1**,
`INSTALL.md` dit **v2.6**, le `README.md` ne dit rien. Trois sources de vérité contradictoires.

**D-2 — `INSTALL.md` est un extrait de conversation.** « Version Finale ? », « Dites-moi si cette
version est enfin la bonne ! » — à supprimer ou à convertir en véritable plan de test.

**D-3 — Le PDD documente des fonctions inexistantes.** Le badge « ON » sur l'icône (§4.4) n'existe
pas : aucun `chrome.action`, aucun service worker dans le code. `setReactValue` (§5) non plus.

**D-4 — `image.png` (372 Ko) à la racine**, référencé nulle part. À intégrer au README ou à
déplacer dans `docs/`.

**D-5 — Pas de LICENSE** alors que le README annonce « Usage interne/privé ». À trancher
explicitement si une publication est envisagée.

**D-6 — Aucun outillage** : pas de `package.json`, pas d'ESLint, pas de CI, pas de script de build
produisant le `.zip` du Web Store, pas de `CHANGELOG.md`.

---

## 8. Plan d'action priorisé

### Étape 0 — Colmater aujourd'hui (~2 h), quelle que soit la suite

1. **Récupération au chargement** — relire `focusActive` / `removedClasses` dans `content.js` et
   proposer une restauration (P0-2). *C'est le correctif le plus rentable du lot.*
2. **Corriger le chemin d'erreur** `content.js:370-373` : appeler `showShield(failedClasses)` puis
   `exitFocusMode()` au lieu d'un `return` nu (P0-3).
3. **Étendre le bouclier à la barre supérieure** pour bloquer Publish (P0-6).
4. **Nettoyer le manifest** : retirer `activeTab`, `scripting`, `host_permissions` ; ajouter les
   icônes (P2-1/2/3).
5. **Nettoyer l'état fantôme** dans le bouton *Reset* du popup (P0-2).

### Étape 1 — Décider de la trajectoire

Relancez Webflow et testez le menu d'héritage natif sur un cas réel de combo class.
Si le natif vous suffit → **scénario A**, archivez le dépôt.
Sinon → **scénario B**.

### Étape 2 — Scénario B, le pivot non destructif (~1 semaine)

1. Cartographier le DOM du menu d'héritage natif (indicateur + entrées de la liste).
2. Réécrire `enterFocusMode` : au lieu de supprimer les classes, ouvrir le menu et cliquer l'entrée
   correspondant à la pilule Shift+cliquée.
3. **Supprimer** : `showShield`, `restoreClasses`, `restoreSingleClass`, `removeWrongClass`,
   `simulatePaste`, `simulateBackspace`, tous les retries et `CONFIG.timing`. ≈ 300 lignes en moins.
4. Remplacer le bouclier par un simple indicateur non bloquant (badge sur la pilule active).
5. Ajouter une détection de compatibilité au chargement + un message explicite si le DOM a changé.
6. Ajouter un `package.json`, ESLint, et une CI minimale qui lint et produit le `.zip`.

### Étape 3 — Scénario C, la Designer Extension (~3–4 semaines)

À n'entreprendre que si l'ambition est un produit. Repositionner en **inspecteur de cascade** :
aperçu base-seule via `setStyles`, diff hérité/surchargé via `getParent()` + `getProperties()`,
audit des combo classes du site. Prévoir la contrainte Marketplace : **pas de raccourci clavier**,
donc une UI de panneau synchronisée sur la sélection via `webflow.subscribe`.

---

## 9. Sources

- [Style panel overview – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview)
- [Style selectors panel – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961365722899-Style-selectors-panel)
- [Classes – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961311094419-Classes)
- [Webflow Designer APIs — Introduction](https://developers.webflow.com/designer/reference/introduction)
- [Designer API — Styles overview](https://developers.webflow.com/designer/reference/styles-overview)
- [Designer API — Element styles: setStyles](https://developers.webflow.com/designer/reference/element-styles/setStyles)
- [Designer API — style.getParent()](https://developers.webflow.com/designer/get-parent-style)
- [Designer API — style.isComboClass()](https://developers.webflow.com/designer/reference/style/is-combo-class)
- [Designer API v2 changelog — 20 février 2024](https://developers.webflow.com/home/changelog/2024/2/20)
- [Changelog — 28 janvier 2026 (`style.getParent`)](https://developers.webflow.com/home/changelog/2026/1/28)
- [Designer Extensions](https://developers.webflow.com/data/docs/designer-extensions)
- [App Marketplace Guidelines](https://developers.webflow.com/data-beta/apps/docs/marketplace-guidelines)
- [Forum Webflow — changement de format d'URL du Designer](https://discourse.webflow.com/t/new-webflow-designer-url-format/262739)
