# WF Focus — Extension Chrome 🎯

> ## ⚠️ Projet archivé — août 2026
>
> **Webflow gère désormais ce cas nativement.** Le Designer expose un **indicateur de
> sélecteurs héritants** au-dessus du champ Selector : on clique dessus, on choisit la classe
> de base (ou un niveau intermédiaire de la pile), et on la style **sans retirer les combo
> classes**. Le panneau Style code alors les propriétés en couleur — orange pour hérité, bleu
> pour surchargé, barré rouge pour écrasé par un sélecteur plus spécifique — et un bouton
> « Back » ramène à la combo class.
>
> C'est exactement le problème que cette extension automatisait, résolu par le produit
> lui-même, sans risque. **Le dépôt n'est plus maintenu.** Il reste en ligne comme trace de
> la démarche.
>
> 📄 Le raisonnement complet est dans **[AUDIT.md](./AUDIT.md)**.

---

## Pourquoi ce projet s'arrête

Deux raisons, dans cet ordre.

**1. Le besoin a été absorbé par le produit.** WF Focus existait parce que styliser une classe
parente sous des combo classes obligeait à supprimer les classes supérieures à la main, puis à
les retaper. Le sélecteur d'héritage natif rend cette gymnastique inutile.

**2. L'approche était structurellement risquée.** Pour isoler une classe, l'extension
**supprimait réellement** les combo classes de l'élément en pilotant l'UI de Webflow (clics
simulés, `Backspace`, retape du nom via l'autocomplétion). Comme Webflow enregistre en continu,
toute interruption — crash, fermeture d'onglet, échec de l'autocomplétion — laissait l'élément
amputé de ses classes, sans mécanisme de récupération. L'audit détaille six défauts de ce
niveau.

Même sans la fonctionnalité native, cette approche aurait dû être remplacée : soit par un pilotage
non destructif du menu d'héritage, soit par une réécriture sur la
[Designer API v2](https://developers.webflow.com/designer/reference/introduction), qui expose
`getStyles()`, `setStyles()`, `style.isComboClass()` et `style.getParent()` — de quoi isoler et
restaurer atomiquement, sans simulation d'événements.

## Ce que faisait l'extension

- **Shift + Clic** sur une pilule de classe dans le panneau de style : isolait ce niveau en
  retirant les combo classes situées au-dessus.
- **Bouclier `clip-path`** : un masque découpé mathématiquement bloquait le canvas, la barre
  supérieure et la barre de gauche pendant le mode focus, tout en laissant le panneau de style
  interactif.
- **Bandeau de restauration** : un toast en haut du canvas listait les classes en attente et
  proposait de tout remettre en place.
- **ESC** ou un second **Shift + Clic** sur la pilule active : restauration.
- **Popup** : activation globale, réglage de l'opacité du masque, suivi en direct des classes
  retirées.

L'apparence du bandeau s'inspirait de [cette référence](./docs/toast-reference.png).

## Structure technique

| Chemin | Rôle |
|---|---|
| `manifest.json` | Configuration Manifest V3 |
| `scripts/content.js` | Logique d'injection, isolation et restauration (519 lignes) |
| `popup/` | Réglages rapides et suivi de l'état de focus |
| `AUDIT.md` | Audit final : produit, code, sécurité, UX/UI |

Extension purement cliente : aucun back-end, aucun appel réseau, aucune télémétrie, aucune
dépendance tierce.

## Installation (historique)

L'extension n'a jamais été publiée sur le Chrome Web Store. Pour la charger malgré tout :

1. Ouvrir `chrome://extensions/`
2. Activer le **Mode développeur**
3. **Charger l'extension non empaquetée** et sélectionner ce dossier

⚠️ À vos risques : les défauts P0 décrits dans l'audit n'ont pas été corrigés, et les sélecteurs
DOM internes de Webflow sur lesquels l'extension s'appuie ont pu changer depuis.

## Licence

Usage interne / privé. Aucune licence n'a été attachée à ce projet.
