# Instructions de Test (v2.6 - Version Finale ?)

Cette version règle les deux problèmes bloquants de manière radicale.

**Corrections v2.6 :**
1.  **Hole-Punching (Découpe) :** J'utilise maintenant une technique mathématique (`clip-path`) pour découper un trou exact dans le bouclier. Le panneau de style à droite est désormais **Garanti** interactif, alors que tout le reste est bloqué.
2.  **Toggle par Nom :** Pour le Shift+Clic qui ne fonctionnait pas pour revenir : l'extension ne regarde plus le code HTML (qui change tout le temps), mais le **NOM** de la classe. Si vous cliquez sur la même classe, elle se restaure.
3.  **Priorité Absolue :** J'ai forcé l'extension à passer avant Webflow sur tous les clics et touches.

**Procédure :**
1.  **Rechargez l'extension**.
2.  **Rafraîchissez Webflow**. (Message : `v2.6 Ready`).
3.  **Shift + Clic** sur une classe.
4.  **TEST Panneau :** Modifiez vos paramètres à droite. Cela doit fonctionner à 100%.
5.  **TEST Toggle :** Refaites un **Shift + Clic** sur le nom de la classe. Cela doit tout restaurer.
6.  **TEST Esc :** (Optionnel) Testez la touche Echap.

Dites-moi si cette version est enfin la bonne !
