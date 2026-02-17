# Document de Conception Produit : WF Focus (Webflow App Version)

## 1. Introduction
Ce document détaille la transition de l'extension Chrome "WF Focus" vers une application native "Webflow Designer App". Cette nouvelle architecture permet une distribution sur le Webflow Marketplace et une intégration officielle via le SDK Webflow V2.

## 2. Le Concept : "Super Selector Panel"
Puisque les Webflow Apps ne peuvent pas modifier l'interface native de Webflow (les pilules bleues), **WF Focus V2** devient un panneau de contrôle avancé des sélecteurs situé dans la barre latérale de Webflow.

## 3. Workflow Utilisateur
1.  L'utilisateur ouvre l'App **WF Focus** dans le panneau latéral de Webflow.
2.  L'App affiche automatiquement la pile de classes de l'élément sélectionné sur le canevas.
3.  L'utilisateur clique sur une classe dans l'interface de l'App pour l'isoler (Mode Focus).
4.  L'App utilise l'API `setStyles()` pour retirer temporairement les classes combo suivantes dans le Designer.
5.  Un bouton "Restore" global ou un clic inverse permet de remettre toutes les classes via l'API.

## 4. Valeur Ajoutée (Au-delà du Focus)
Pour justifier une Webflow App payante, nous allons étendre les fonctions :
*   **Focus / Isolate** : La fonction cœur.
*   **Bulk Rename** : Renommer une classe sur tout le projet.
*   **Style Clean** : Identifier et supprimer les classes combo inutilisées sur l'élément.
*   **Quick Swap** : Remplacer une classe par une autre dans la pile par simple glisser-déposer.

## 5. Architecture Technique
*   **Frontend** : React + Vite (recommandé par Webflow).
*   **Webflow SDK** : Utilisation intensive de `@webflow/api` V2.
*   **Hébergement** : L'app est un site web statique hébergé (ex: Vercel/Netlify) qui est chargé dans l'iframe de Webflow.

## 6. Monétisation
*   **Webflow App Payments** : Intégration directe ou via un portail tiers dans l'App.
*   **Modèle** : Gratuit pour l'isolation simple / Payant pour les fonctions de gestion avancée (Bulk Rename, etc.).
