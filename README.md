# WF Focus - Extension Chrome 🎯

**WF Focus Extension** est le cœur de l'interaction pour l'outil WF Focus. Elle permet d'injecter le bouclier de protection et de capturer les raccourcis clavier au sein du Designer Webflow.

---

## 🚀 Installation

1.  Ouvrez Chrome et rendez-vous sur `chrome://extensions/`.
2.  Activez le **Mode développeur** (en haut à droite).
3.  Cliquez sur **Charger l'extension non empaquetée**.
4.  Sélectionnez ce dossier (`wf-focus-extension`).
5.  *Note : Épinglez l'extension pour accéder rapidement au réglage de l'opacité.*

---

## 🔥 Fonctionnalités

-   **Shift + Clic** : Isole la classe sélectionnée en injectant un style temporaire.
-   **Bouclier Clip-path** : Bloque le canevas via une technique mathématique de découpe pour laisser le panneau de style 100% interactif.
-   **ESC** : Quitte le mode focus et restaure l'interface.

---

## 🛠 Structure Technique

-   `manifest.json` : Configuration V3.
-   `scripts/content.js` : Logique d'injection DOM.
-   `popup/` : Interface de réglages rapides (opacité du shield).

---

## 📄 Licence
Usage interne/privé.
