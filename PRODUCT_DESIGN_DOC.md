> **Document historique — projet archivé en août 2026.**
> Conservé tel quel pour mémoire. Deux réserves à connaître avant de le lire :
> le §2 (« Définition du Problème ») décrit un flux que Webflow a depuis résolu nativement
> via le sélecteur d'héritage ; et le §4.4 (badge d'icône) comme le §5 (`setReactValue`)
> décrivent des éléments qui n'ont jamais été implémentés. Voir [AUDIT.md](./AUDIT.md).

---

# Document de Conception Produit : WF Focus (v0.1.1)

## 1. Introduction
Ce document décrit l'extension "WF Focus", un outil conçu pour isoler les classes parentes dans Webflow. L'objectif est de permettre aux designers de modifier les styles de base sans être gênés par les classes combo supérieures, tout en garantissant une restauration rapide et sécurisée.

## 2. Définition du Problème
Webflow applique les styles de manière cumulative. Pour modifier une classe parente (ex: `.card`) située sous des classes combo (ex: `.is-red .is-featured`), l'utilisateur doit normalement supprimer manuellement les classes supérieures, faire sa modification, puis les retaper. C'est un processus répétitif et propice aux erreurs.

## 3. La Solution : Focus Isolé (Non-Destructif)
L'extension automatise ce flux en permettant d'isoler n'importe quelle étape de la pile de classes en un clic, tout en protégeant l'état du projet via un bouclier d'interface.

## 4. Fonctionnalités Implémentées (v0.1.1)

### 4.1. Interaction "Shift + Click"
*   **Entrée en Focus** : `Shift + Clic` sur une pilule de classe dans le panneau de style pour isoler ce niveau spécifique.
*   **Sortie de Focus** : `Shift + Clic` sur la même pilule (mise en évidence en orange) ou pression sur la touche `Echap`.

### 4.2. Bouclier de Protection (Interface Shield)
*   **Sécurité** : Un masque transparent bloque les interactions avec le canevas, la barre supérieure et la barre de gauche pendant le mode Focus. Cela empêche tout changement accidentel de sélection ou d'élément.
*   **Accessibilité** : Le panneau de style à droite reste 100% interactif grâce à une technique de découpe précise (`clip-path`).
*   **Robustesse** : Inclut une zone de sécurité de 300px par défaut si le panneau de style n'est pas détecté dynamiquement.

### 4.3. Interface Utilisateur Premium
*   **Bandeau Top-Center** : Un bandeau d'alerte élégant (style "Soft Toast") apparaît en haut au centre du canevas pour indiquer l'état actif.
*   **Instructions Intégrées** : Le bandeau affiche les raccourcis de restauration (`Shift + Click` ou `ESC`) et un bouton d'action directe.
*   **Design Ambre** : Utilise des accents orange vibrant pour une visibilité maximale et une esthétique premium.

### 4.4. Menu de Configuration (Popup)
*   **Activation** : Switch pour activer/désactiver l'extension globalement.
*   **Opacité du Masque** : Curseur pour régler la transparence du bouclier (de 0% à 40%).
*   **Badge d'Icône** : Indicateur visuel "ON" sur l'icône de l'extension dans la barre d'outils du navigateur.
*   **Reset** : Bouton pour revenir aux paramètres d'usine.

## 5. Spécifications Techniques

*   **Core** : JavaScript natif (Manifest V3).
*   **Synchronisation** : Interaction directe avec les composants React de Webflow via simulation d'input (`setReactValue`) pour éviter les conflits d'état.
*   **Persistance** : Utilisation de `chrome.storage.local` pour synchroniser les réglages entre la popup et les scripts de contenu.
*   **Nettoyage** : Gestion automatique des instances d'overlay pour éviter les doublons lors des rechargements.
