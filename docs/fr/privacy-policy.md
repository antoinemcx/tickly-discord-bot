# Politique de Confidentialité

**Dernière mise à jour : 28 septembre 2026**

Tickly (« le bot », « nous ») est un bot Discord qui connecte votre compte Discord à Todoist.
Cette politique explique les données que nous collectons, pourquoi, et pendant combien de temps
nous les conservons.

## 1. Données Collectées

Lorsque vous utilisez Tickly, nous stockons les données suivantes dans notre base de données :

| Donnée | Finalité |
|---|---|
| Identifiant Discord (User ID) | Vous identifier et associer vos préférences et session à votre compte |
| Préférence de langue | Répondre dans votre langue préférée |
| Durée de rétention de session | Respecter votre paramètre d'expiration de session |
| Jeton d'accès Todoist | Exécuter des opérations Todoist en votre nom (récupération ou création de tâches, etc.) |
| Horodatages de session (création, dernière utilisation) | Gérer le cycle de vie et l'expiration des sessions |

Nous ne stockons **pas** le contenu des messages Discord ni le contenu des tâches. Les données
des tâches sont transmises directement à l'API de Todoist et sont soumises à la
[politique de confidentialité de Todoist](https://todoist.com/fr/privacy).

## 2. Utilisation de Vos Données

Vos données sont utilisées exclusivement pour fournir les fonctionnalités de Tickly :
- Votre identifiant Discord associe votre session Todoist à votre compte Discord.
- Votre jeton d'accès est utilisé uniquement pour interagir avec l'API de Todoist en votre nom.
- Aucune donnée n'est vendue, partagée avec des tiers à des fins commerciales, ni utilisée
  à des fins publicitaires.

## 3. Conservation des Données

- Les **sessions actives** expirent après une période d'inactivité configurable (défaut : 30 jours).
  Vous pouvez modifier ce paramètre avec `/settings`.
- Les **sessions OAuth en attente** (démarrées mais non terminées) expirent automatiquement
  après 15 minutes.
- Vous pouvez supprimer votre session et votre jeton d'accès à tout moment en exécutant
  `/todoist logout`.
- Pour supprimer toutes vos données (y compris votre profil utilisateur et votre session Todoist),
  utilisez la commande `/settings` et cliquez sur « Supprimer mes données », ou contactez-nous sur
  [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues) ou notre
  [serveur de support](https://antoinemcx.fr/discord).

## 4. Services Tiers

Tickly interagit avec les services tiers suivants :
- **Todoist** — les données des tâches sont transmises à l'API de Todoist.
  Voir la [politique de confidentialité de Todoist](https://todoist.com/fr/privacy).
- **Discord** — le bot fonctionne sur la plateforme Discord.
  Voir la [politique de confidentialité de Discord](https://discord.com/privacy).

Nous ne sommes pas responsables des pratiques en matière de données de ces services.

## 5. Sécurité

Votre jeton d'accès Todoist est chiffré avant d'être stocké dans notre base de données. Cela signifie que nous ne pouvons pas lire votre jeton en clair, même avec un accès direct à la base de données. Ce chiffrement est conforme aux exigences du RGPD en matière de protection des données.

Nous prenons des mesures raisonnables pour protéger vos données, mais aucun système n'est parfaitement sécurisé.

## 6. Limitation de Responsabilité

Le bot est fourni « tel quel », sans garantie d'aucune sorte. Les développeurs de Tickly ne
sont pas responsables :
- de tout dommage direct ou indirect causé par l'utilisation ou l'impossibilité d'utiliser
  le bot
- du contenu des tâches transmis via les commandes, celles-ci appartenant à Todoist et étant
  créées par l'utilisateur
- des interruptions de service ou bugs dans l'utilisation du bot

Pour la clause de non-responsabilité complète, voir la
[licence GPL-3.0](../../LICENSE) (sections 15–16).

## 7. Contact

Pour signaler un problème ou poser une question concernant cette politique :
- Ouvrez une issue sur [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues)
- Rejoignez notre [serveur Discord de support](https://antoinemcx.fr/discord)
