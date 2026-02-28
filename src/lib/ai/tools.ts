// ── Définitions des outils pour le chat agentique ───────────────────────────
// Format Anthropic Tool pour Claude tool use.
// Chaque outil décrit ce que le second peut faire pour le capitaine.

import type Anthropic from '@anthropic-ai/sdk'

export type ToolName =
  | 'create_log_entry'
  | 'manage_checklist'
  | 'update_boat_status'
  | 'manage_route'
  | 'create_reminder'
  | 'get_weather'

export const CHAT_TOOLS: Anthropic.Tool[] = [
  // ── 1. Créer une entrée journal ─────────────────────────────────────────
  {
    name: 'create_log_entry',
    description:
      'Créer une entrée dans le journal de bord. Utilise cet outil quand le capitaine signale une arrivée, un départ, un ravitaillement, un incident, ou veut noter quelque chose. Met aussi à jour le boat_status (carburant, eau, position) si ces infos sont fournies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        position: {
          type: 'string',
          description: 'Nom du port ou position (ex: "Lorient", "47.75N 3.37W")',
        },
        latitude: {
          type: 'number',
          description: 'Latitude en degrés décimaux (optionnel)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude en degrés décimaux (optionnel)',
        },
        entry_type: {
          type: 'string',
          enum: ['navigation', 'arrival', 'departure', 'maintenance', 'incident'],
          description: 'Type d\'entrée journal',
        },
        fuel_tank: {
          type: 'string',
          enum: ['full', '3/4', 'half', '1/4', 'reserve', 'empty'],
          description: 'Niveau du réservoir carburant (optionnel)',
        },
        jerricans: {
          type: 'number',
          description: 'Nombre de jerricans restants (optionnel)',
        },
        water: {
          type: 'string',
          enum: ['full', '3/4', 'half', '1/4', 'reserve', 'empty'],
          description: 'Niveau d\'eau (optionnel)',
        },
        problems: {
          type: 'string',
          description: 'Description des problèmes rencontrés (optionnel)',
        },
        notes: {
          type: 'string',
          description: 'Notes libres (optionnel)',
        },
      },
      required: ['position', 'entry_type'],
    },
  },

  // ── 2. Gérer la checklist ───────────────────────────────────────────────
  {
    name: 'manage_checklist',
    description:
      'Gérer la checklist du voyage. Actions: "add" (créer), "check" (marquer fait), "uncheck" (remettre à faire), "delete" (supprimer), "edit" (modifier), "list" (lister les éléments en attente).',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'check', 'uncheck', 'delete', 'edit', 'list'],
          description: 'Action à effectuer',
        },
        task: {
          type: 'string',
          description: 'Nom de la tâche (requis pour add, utilisé comme recherche fuzzy pour check/uncheck/delete/edit)',
        },
        category: {
          type: 'string',
          enum: ['Safety', 'Propulsion', 'Navigation', 'Rigging', 'Comfort', 'Admin'],
          description: 'Catégorie de la tâche (pour add/edit)',
        },
        priority: {
          type: 'string',
          enum: ['Critical', 'High', 'Normal', 'Low'],
          description: 'Priorité de la tâche (pour add/edit)',
        },
        notes: {
          type: 'string',
          description: 'Notes optionnelles (pour add/edit)',
        },
        new_task: {
          type: 'string',
          description: 'Nouveau nom de la tâche (pour edit uniquement)',
        },
      },
      required: ['action'],
    },
  },

  // ── 3. Mettre à jour l'état du bateau ──────────────────────────────────
  {
    name: 'update_boat_status',
    description:
      'Mettre à jour l\'état courant du bateau : position, niveaux de carburant/eau, statut de navigation, problèmes actifs. Utilise quand le capitaine signale un changement d\'état sans faire une entrée journal complète.',
    input_schema: {
      type: 'object' as const,
      properties: {
        current_position: {
          type: 'string',
          description: 'Position actuelle (nom de port ou description)',
        },
        current_lat: {
          type: 'number',
          description: 'Latitude en degrés décimaux',
        },
        current_lon: {
          type: 'number',
          description: 'Longitude en degrés décimaux',
        },
        fuel_tank: {
          type: 'string',
          enum: ['full', '3/4', 'half', '1/4', 'reserve', 'empty'],
          description: 'Niveau du réservoir',
        },
        jerricans: {
          type: 'number',
          description: 'Nombre de jerricans',
        },
        water: {
          type: 'string',
          enum: ['full', '3/4', 'half', '1/4', 'reserve', 'empty'],
          description: 'Niveau d\'eau',
        },
        nav_status: {
          type: 'string',
          enum: ['in_port', 'sailing', 'at_anchor', 'in_canal'],
          description: 'Statut de navigation',
        },
        active_problems: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des problèmes actifs (remplace la liste existante)',
        },
      },
      required: [],
    },
  },

  // ── 4. Gérer la route ───────────────────────────────────────────────────
  {
    name: 'manage_route',
    description:
      'Gérer les étapes de la route du voyage. Actions: "update_status" (marquer une étape done/in_progress), "add_step" (ajouter une étape), "edit_step" (modifier une étape), "delete_step" (supprimer une étape), "list" (lister toutes les étapes).',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['update_status', 'add_step', 'edit_step', 'delete_step', 'list'],
          description: 'Action à effectuer sur la route',
        },
        step_name: {
          type: 'string',
          description: 'Nom ou recherche partielle de l\'étape (requis pour update_status, edit_step, delete_step. Pour add_step, utilisé comme nom de la nouvelle étape)',
        },
        new_status: {
          type: 'string',
          enum: ['done', 'in_progress'],
          description: 'Nouveau statut (pour update_status)',
        },
        from_port: {
          type: 'string',
          description: 'Port de départ (pour add_step/edit_step)',
        },
        to_port: {
          type: 'string',
          description: 'Port d\'arrivée (pour add_step/edit_step)',
        },
        after_step_name: {
          type: 'string',
          description: 'Insérer après cette étape (recherche partielle, pour add_step)',
        },
        phase: {
          type: 'string',
          description: 'Phase de l\'étape: Maritime, Canal, Fluvial (pour add_step/edit_step)',
        },
        distance_nm: {
          type: 'number',
          description: 'Distance en milles nautiques (pour add_step/edit_step)',
        },
        distance_km: {
          type: 'number',
          description: 'Distance en kilomètres (pour add_step/edit_step, canaux/fluvial)',
        },
        notes: {
          type: 'string',
          description: 'Notes sur l\'étape (pour add_step/edit_step)',
        },
      },
      required: ['action'],
    },
  },

  // ── 5. Créer un rappel ───────────────────────────────────────────────
  {
    name: 'create_reminder',
    description:
      'Programmer un rappel pour le capitaine. Le rappel sera déclenché par le système de triggers au moment voulu. Utilise quand le capitaine demande "rappelle-moi de..." ou quand tu juges qu\'un rappel est pertinent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Message du rappel (ce que le capitaine doit faire/vérifier)',
        },
        remind_at: {
          type: 'string',
          description: 'Date et heure du rappel en ISO 8601 (ex: "2026-03-15T06:00:00Z")',
        },
        category: {
          type: 'string',
          enum: ['navigation', 'safety', 'maintenance', 'provisions', 'general'],
          description: 'Catégorie du rappel',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priorité du rappel',
        },
      },
      required: ['message', 'remind_at'],
    },
  },

  // ── 6. Récupérer la météo ───────────────────────────────────────────
  {
    name: 'get_weather',
    description:
      'Récupérer les prévisions météo marines pour des coordonnées spécifiques. Utilise quand le capitaine demande la météo pour un endroit précis qui n\'est pas sa position actuelle.',
    input_schema: {
      type: 'object' as const,
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude en degrés décimaux',
        },
        longitude: {
          type: 'number',
          description: 'Longitude en degrés décimaux',
        },
        location_name: {
          type: 'string',
          description: 'Nom du lieu (pour le résumé)',
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
]
