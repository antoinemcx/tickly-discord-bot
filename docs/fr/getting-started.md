# Démarrer avec Tickly
## Installation
Tickly peut être installé de deux façons :
- [**Installation sur un serveur :**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) utiliser Tickly dans un serveur spécifique.
- [**Installation sur le compte utilisateur (recommandé) :**](https://discord.com/oauth2/authorize?client_id=1483931102514249830) utiliser Tickly depuis n'importe où sur Discord, y compris les DMs et les serveurs.

Nous recommandons d'installer Tickly **sur votre compte utilisateur** pour la meilleure expérience.  
Cela vous permet d'utiliser le bot depuis n'importe où sur Discord : en DM ou dans n'importe quel serveur, même s'ils ne l'ont pas ajouté.  
Certaines commandes peuvent être disponibles uniquement avec une installation sur le compte utilisateur.

![Bouton d'installation utilisateur](../../src/bot/assets/user_install.png)

> Notez cependant que certains serveurs peuvent interdire les applications installées par les utilisateurs (appelées « applications externes » dans les permissions Discord).  
> Le bot ne fonctionnerait alors pas dans ces serveurs et il pourrait être nécessaire que le serveur l'installe en tant qu'application de serveur.

## Premiers pas
Si vous êtes nouveau sur le bot, suivez ces étapes simples :
1. Installez Tickly sur votre compte utilisateur ou sur votre serveur.
2. Ouvrez n'importe quelle conversation où Tickly est disponible, tapez `/` et exécutez `/todoist login`.
3. Vous serez redirigé vers la connexion OAuth2 de Todoist.  
Après avoir approuvé l'accès, Tickly stocke votre jeton d'accès Todoist dans une session pour les interactions futures.  
Par défaut, votre session expire après 30 jours d'inactivité — vous pouvez modifier cela dans `/settings`.
4. De retour sur Discord, exécutez `/help` pour voir la liste des commandes et un guide de démarrage.

## Interagir avec le bot
Une fois installé, vous pouvez interagir avec le bot en utilisant :
- [**Les commandes slash**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps) : tapez `/` dans n'importe quel canal ou DM et sélectionnez une commande.
- [**Le menu contextuel des messages**](https://discord.com/blog/welcome-to-the-new-era-of-discord-apps) : faites un clic droit sur un message et sélectionnez une commande dans la section « Applications ».

## Ajouter votre première tâche
Pour ajouter une tâche à Todoist, vous avez trois options :
1. Utilisez la commande slash `/todoist add` et remplissez le formulaire.
2. Utilisez la commande « Ajouter à Todoist » du menu contextuel sur n'importe quel message.  
   Le formulaire sera pré-rempli avec le contenu du message.

   ![Ajouter depuis un message](../add_from_message.png)
3. Utilisez le paramètre `content` de la commande `/todoist add` pour saisir du texte en langage naturel.  
   Par exemple, vous pouvez taper `/todoist add content:Acheter du lait demain à 17h !!2 #MonProjet`. En savoir plus [ici](https://www.todoist.com/fr/help/articles/use-task-quick-add-in-todoist-va4Lhpzz#h_01J1DEY59AGACAT8JW998EPH74).

   ![Ajouter en langage naturel](../add_natural_language.png)
