#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════
# Laurine Navigator — Script de développement
# ══════════════════════════════════════════════════════════════════════

# ── Couleurs ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"
DEFAULT_PORT=3000

# ── Helpers ──────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}⚓${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }
header()  { echo -e "\n${BOLD}${CYAN}── $1 ──${NC}"; }

# ── Aide ─────────────────────────────────────────────────────────────
usage() {
  cat <<EOF

${BOLD}${CYAN}⚓ Laurine Navigator — Dev Script${NC}

${BOLD}Usage:${NC}  ./dev.sh [options]

${BOLD}Options:${NC}
  ${GREEN}--kill${NC}              Tue tous les process Next.js en cours
  ${GREEN}--reset${NC}             Reset la DB (supprime les données, garde le user Supabase Auth)
  ${GREEN}--seed${NC}              Injecte les données de test (bateau Laurine, route Audierne→Nice)
  ${GREEN}--install${NC}           Force npm install (même si node_modules existe)
  ${GREEN}--build${NC}             Lance un build de production au lieu du dev server
  ${GREEN}--port <N>${NC}          Port personnalisé (défaut: $DEFAULT_PORT)
  ${GREEN}--open${NC}              Ouvre le navigateur après le démarrage
  ${GREEN}--check${NC}             Vérifie la config sans démarrer (env, deps, DB, types)
  ${GREEN}--logs${NC}              Affiche les derniers logs du serveur de dev
  ${GREEN}--lint${NC}              Lance ESLint + TypeScript check
  ${GREEN}--help${NC}              Affiche cette aide

${BOLD}Exemples:${NC}
  ${DIM}./dev.sh${NC}                        # Démarre le serveur de dev
  ${DIM}./dev.sh --kill${NC}                 # Tue les process et quitte
  ${DIM}./dev.sh --kill --reset --seed${NC}  # Reset complet + données de test + démarre
  ${DIM}./dev.sh --port 3001 --open${NC}     # Dev sur port 3001 + ouvre le navigateur
  ${DIM}./dev.sh --check${NC}                # Vérifie tout sans démarrer

EOF
  exit 0
}

# ── Parse des arguments ──────────────────────────────────────────────
DO_KILL=false
DO_RESET=false
DO_SEED=false
DO_INSTALL=false
DO_BUILD=false
DO_OPEN=false
DO_CHECK=false
DO_LOGS=false
DO_LINT=false
PORT=$DEFAULT_PORT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kill)    DO_KILL=true ;;
    --reset)   DO_RESET=true ;;
    --seed)    DO_SEED=true ;;
    --install) DO_INSTALL=true ;;
    --build)   DO_BUILD=true ;;
    --open)    DO_OPEN=true ;;
    --check)   DO_CHECK=true ;;
    --logs)    DO_LOGS=true ;;
    --lint)    DO_LINT=true ;;
    --port)    PORT="$2"; shift ;;
    --help|-h) usage ;;
    *) error "Option inconnue: $1"; usage ;;
  esac
  shift
done

cd "$PROJECT_DIR"

# ══════════════════════════════════════════════════════════════════════
# --kill : Tuer les process existants
# ══════════════════════════════════════════════════════════════════════
kill_existing() {
  header "Kill des process existants"

  local pids
  pids=$(pgrep -f "next dev|next start" 2>/dev/null || true)

  if [[ -z "$pids" ]]; then
    info "Aucun process Next.js trouvé"
    return
  fi

  echo "$pids" | while read -r pid; do
    local cmd
    cmd=$(ps -p "$pid" -o command= 2>/dev/null || echo "inconnu")
    warn "Kill PID $pid — $cmd"
    kill "$pid" 2>/dev/null || true
  done

  sleep 1

  # Force kill si toujours en vie
  pids=$(pgrep -f "next dev|next start" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Force kill des process restants..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi

  # Nettoyer le lock file Next.js
  if [[ -f "$PROJECT_DIR/.next/dev/lock" ]]; then
    rm -f "$PROJECT_DIR/.next/dev/lock"
    info "Lock file .next/dev/lock supprimé"
  fi

  success "Process nettoyés"
}

if $DO_KILL; then
  kill_existing
fi

# ══════════════════════════════════════════════════════════════════════
# --logs : Afficher les logs et quitter
# ══════════════════════════════════════════════════════════════════════
if $DO_LOGS; then
  header "Logs du serveur"
  pids=$(pgrep -f "next dev" 2>/dev/null || true)
  if [[ -z "$pids" ]]; then
    error "Aucun serveur de dev en cours"
    exit 1
  fi
  info "PID: $pids — Ctrl+C pour quitter"
  # Affiche les logs Next.js récents via le fichier de sortie si dispo
  if [[ -f "$PROJECT_DIR/.next/trace" ]]; then
    tail -f "$PROJECT_DIR/.next/trace"
  else
    info "Pas de fichier de trace. Le serveur tourne mais les logs vont dans le terminal où il a été lancé."
  fi
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════
# Vérification de l'environnement
# ══════════════════════════════════════════════════════════════════════
check_env() {
  header "Vérification de l'environnement"

  local has_error=false

  # Node.js
  if command -v node &>/dev/null; then
    success "Node.js $(node -v)"
  else
    error "Node.js non trouvé — installez Node.js 18+"
    has_error=true
  fi

  # npm
  if command -v npm &>/dev/null; then
    success "npm $(npm -v)"
  else
    error "npm non trouvé"
    has_error=true
  fi

  # .env.local
  if [[ -f "$ENV_FILE" ]]; then
    success ".env.local trouvé"

    # Vérifier les variables critiques
    local missing_vars=()
    for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY; do
      if ! grep -q "^${var}=.\+" "$ENV_FILE" 2>/dev/null; then
        missing_vars+=("$var")
      fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
      warn "Variables manquantes ou vides dans .env.local:"
      for v in "${missing_vars[@]}"; do
        echo -e "    ${DIM}$v${NC}"
      done
    else
      success "Variables d'environnement critiques présentes"
    fi

    # Variables optionnelles
    local optional_missing=()
    for var in WORLDTIDES_API_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY CRON_SECRET; do
      if ! grep -q "^${var}=.\+" "$ENV_FILE" 2>/dev/null; then
        optional_missing+=("$var")
      fi
    done

    if [[ ${#optional_missing[@]} -gt 0 ]]; then
      info "Variables optionnelles non configurées: ${optional_missing[*]}"
    fi
  else
    error ".env.local manquant — copiez .env.local.example et remplissez les valeurs"
    has_error=true
  fi

  # node_modules
  if [[ -d "$PROJECT_DIR/node_modules" ]]; then
    success "node_modules présent"
  else
    warn "node_modules absent — lancement de npm install nécessaire"
    DO_INSTALL=true
  fi

  # Port disponible
  if lsof -i ":$PORT" &>/dev/null; then
    local occupant
    occupant=$(lsof -i ":$PORT" -t 2>/dev/null | head -1)
    warn "Port $PORT occupé par PID $occupant"
    if ! $DO_KILL; then
      info "Utilisez --kill pour libérer le port, ou --port <N> pour un autre port"
    fi
  else
    success "Port $PORT disponible"
  fi

  # Supabase — test de connexion
  if [[ -f "$ENV_FILE" ]]; then
    local sb_url
    sb_url=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_FILE" | cut -d= -f2)
    if [[ -n "$sb_url" ]]; then
      if curl -sf "${sb_url}/rest/v1/" -H "apikey: $(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d= -f2)" -o /dev/null 2>/dev/null; then
        success "Connexion Supabase OK"
      else
        warn "Supabase injoignable — vérifiez l'URL et la clé"
      fi
    fi
  fi

  if $has_error; then
    error "Des erreurs bloquantes ont été trouvées"
    exit 1
  fi
}

check_env

# Si --check seul, on s'arrête là
if $DO_CHECK; then
  echo ""
  success "Vérification terminée"
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════
# --install : npm install
# ══════════════════════════════════════════════════════════════════════
if $DO_INSTALL; then
  header "Installation des dépendances"
  npm install
  success "Dépendances installées"
fi

# ══════════════════════════════════════════════════════════════════════
# --reset : Reset de la base de données
# ══════════════════════════════════════════════════════════════════════
if $DO_RESET; then
  header "Reset de la base de données"

  # Extraire les credentials Supabase
  SB_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_FILE" | cut -d= -f2)
  SB_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d= -f2)

  if [[ -z "$SB_URL" || -z "$SB_SERVICE_KEY" ]]; then
    error "Impossible de lire les credentials Supabase depuis .env.local"
    exit 1
  fi

  API="${SB_URL}/rest/v1"
  AUTH_HEADERS=(-H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}" -H "Content-Type: application/json" -H "Prefer: return=minimal")

  warn "Suppression des données (les users Supabase Auth sont conservés)..."

  # Ordre de suppression : respecter les foreign keys (enfants d'abord)
  TABLES=(chat_history checklist logs briefings route_steps boat_status voyages nav_profiles boats users)

  for table in "${TABLES[@]}"; do
    status=$(curl -sf -o /dev/null -w "%{http_code}" \
      -X DELETE "${API}/${table}?id=not.is.null" \
      "${AUTH_HEADERS[@]}")
    if [[ "$status" =~ ^2 ]]; then
      success "  $table vidée"
    else
      warn "  $table — HTTP $status (peut-être déjà vide)"
    fi
  done

  success "Base de données réinitialisée"
  info "Les comptes Supabase Auth sont conservés"
  info "Au prochain login, l'utilisateur sera redirigé vers l'onboarding"
fi

# ══════════════════════════════════════════════════════════════════════
# --seed : Injection des données de test
# ══════════════════════════════════════════════════════════════════════
if $DO_SEED; then
  header "Injection des données de test"

  SB_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_FILE" | cut -d= -f2)
  SB_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d= -f2)

  API="${SB_URL}/rest/v1"
  AUTH_HEADERS=(-H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}" -H "Content-Type: application/json" -H "Prefer: return=representation")

  # Trouver le premier user dans auth.users
  info "Recherche d'un utilisateur existant..."
  USER_JSON=$(curl -sf "${SB_URL}/auth/v1/admin/users?per_page=1" \
    -H "apikey: ${SB_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SB_SERVICE_KEY}")

  USER_ID=$(echo "$USER_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  USER_EMAIL=$(echo "$USER_JSON" | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ -z "$USER_ID" ]]; then
    error "Aucun utilisateur trouvé dans Supabase Auth"
    error "Connectez-vous d'abord via l'app (magic link) puis relancez --seed"
    exit 1
  fi

  info "User trouvé: $USER_EMAIL ($USER_ID)"

  # 1. Upsert user profile
  info "Création du profil utilisateur..."
  curl -sf -X POST "${API}/users" \
    "${AUTH_HEADERS[@]}" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "{\"id\": \"${USER_ID}\", \"email\": \"${USER_EMAIL}\", \"name\": \"Skipper\", \"onboarding_completed\": true}" \
    -o /dev/null
  success "  Profil utilisateur créé"

  # 2. Insert boat
  info "Création du bateau Laurine..."
  BOAT_JSON=$(curl -sf -X POST "${API}/boats" \
    "${AUTH_HEADERS[@]}" \
    -d "{
      \"user_id\": \"${USER_ID}\",
      \"name\": \"Laurine\",
      \"type\": \"Laurin Koster 28\",
      \"length_m\": 8.5,
      \"draft_m\": 1.45,
      \"air_draft_m\": 12,
      \"engine_type\": \"Diesel\",
      \"fuel_capacity_hours\": 40,
      \"avg_speed_kn\": 4.5,
      \"has_ais_tx\": false,
      \"has_autopilot\": false,
      \"has_radar\": false,
      \"has_watermaker\": false
    }")
  BOAT_ID=$(echo "$BOAT_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  success "  Bateau créé: $BOAT_ID"

  # 3. Insert nav_profile
  info "Création du profil navigateur..."
  PROFILE_JSON=$(curl -sf -X POST "${API}/nav_profiles" \
    "${AUTH_HEADERS[@]}" \
    -d "{
      \"user_id\": \"${USER_ID}\",
      \"boat_id\": \"${BOAT_ID}\",
      \"experience\": \"Experienced\",
      \"crew_mode\": \"Solo\",
      \"risk_tolerance\": \"Moderate\",
      \"night_sailing\": \"Only if necessary\",
      \"max_continuous_hours\": 16
    }")
  PROFILE_ID=$(echo "$PROFILE_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  success "  Profil créé: $PROFILE_ID"

  # 4. Insert voyage
  info "Création du voyage Audierne → Nice..."
  VOYAGE_JSON=$(curl -sf -X POST "${API}/voyages" \
    "${AUTH_HEADERS[@]}" \
    -d "{
      \"user_id\": \"${USER_ID}\",
      \"boat_id\": \"${BOAT_ID}\",
      \"nav_profile_id\": \"${PROFILE_ID}\",
      \"name\": \"Audierne → Nice\",
      \"status\": \"active\"
    }")
  VOYAGE_ID=$(echo "$VOYAGE_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  success "  Voyage créé: $VOYAGE_ID"

  # 5. Insert boat_status
  info "Initialisation du statut bateau..."
  curl -sf -X POST "${API}/boat_status" \
    "${AUTH_HEADERS[@]}" \
    -H "Prefer: return=minimal" \
    -d "{
      \"voyage_id\": \"${VOYAGE_ID}\",
      \"current_position\": \"Audierne\",
      \"current_lat\": 48.0069,
      \"current_lon\": -4.5397,
      \"fuel_tank\": \"full\",
      \"jerricans\": 4,
      \"water\": \"full\",
      \"active_problems\": [\"navigation_lights\"],
      \"current_phase\": \"Atlantic\",
      \"nav_status\": \"in_port\"
    }" -o /dev/null
  success "  Statut bateau initialisé"

  # 6. Insert route_steps (20 étapes)
  info "Création des 20 étapes de route..."
  curl -sf -X POST "${API}/route_steps" \
    "${AUTH_HEADERS[@]}" \
    -H "Prefer: return=minimal" \
    -d "[
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":1,\"name\":\"Traversée du Raz de Sein\",\"from_port\":\"Audierne\",\"to_port\":\"Bénodet\",\"distance_nm\":30,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":48.0069,\"from_lon\":-4.5397,\"to_lat\":47.8753,\"to_lon\":-4.1103,\"notes\":\"Passage du Raz au bon créneau de courant. Plan B: rester à Audierne.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":2,\"name\":\"Vers Lorient\",\"from_port\":\"Bénodet\",\"to_port\":\"Lorient\",\"distance_nm\":35,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":47.8753,\"from_lon\":-4.1103,\"to_lat\":47.7283,\"to_lon\":-3.3700},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":3,\"name\":\"Escale Belle-Île\",\"from_port\":\"Lorient\",\"to_port\":\"Belle-Île\",\"distance_nm\":25,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":47.7283,\"from_lon\":-3.3700,\"to_lat\":47.3486,\"to_lon\":-3.1536,\"notes\":\"Le Palais. Bon abri.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":4,\"name\":\"Vers Le Croisic\",\"from_port\":\"Belle-Île\",\"to_port\":\"Le Croisic\",\"distance_nm\":30,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":47.3486,\"from_lon\":-3.1536,\"to_lat\":47.2922,\"to_lon\":-2.5097},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":5,\"name\":\"Vers Pornic\",\"from_port\":\"Le Croisic\",\"to_port\":\"Pornic\",\"distance_nm\":25,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":47.2922,\"from_lon\":-2.5097,\"to_lat\":47.1139,\"to_lon\":-2.1022},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":6,\"name\":\"Vers Les Sables-d'Olonne\",\"from_port\":\"Pornic\",\"to_port\":\"Les Sables-d'Olonne\",\"distance_nm\":40,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":47.1139,\"from_lon\":-2.1022,\"to_lat\":46.4972,\"to_lon\":-1.7900},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":7,\"name\":\"Vers La Rochelle\",\"from_port\":\"Les Sables-d'Olonne\",\"to_port\":\"La Rochelle\",\"distance_nm\":45,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":46.4972,\"from_lon\":-1.7900,\"to_lat\":46.1575,\"to_lon\":-1.1528,\"notes\":\"Ravitaillement carburant + provisions.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":8,\"name\":\"Vers Royan\",\"from_port\":\"La Rochelle\",\"to_port\":\"Royan\",\"distance_nm\":35,\"phase\":\"Atlantic\",\"status\":\"to_do\",\"from_lat\":46.1575,\"from_lon\":-1.1528,\"to_lat\":45.6228,\"to_lon\":-1.0286,\"notes\":\"Dernière étape atlantique. Préparer la Gironde.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":9,\"name\":\"Estuaire de la Gironde\",\"from_port\":\"Royan\",\"to_port\":\"Bordeaux\",\"distance_nm\":55,\"phase\":\"Gironde\",\"status\":\"to_do\",\"from_lat\":45.6228,\"from_lon\":-1.0286,\"to_lat\":44.8378,\"to_lon\":-0.5792,\"notes\":\"Forts courants de marée. Monter avec le flot.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":10,\"name\":\"Canal latéral à la Garonne\",\"from_port\":\"Bordeaux\",\"to_port\":\"Agen\",\"distance_km\":100,\"phase\":\"Canal de la Garonne\",\"status\":\"to_do\",\"from_lat\":44.8378,\"from_lon\":-0.5792,\"to_lat\":44.2033,\"to_lon\":0.6167,\"notes\":\"Vitesse max 8 km/h. Écluses VNF.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":11,\"name\":\"Vers Toulouse\",\"from_port\":\"Agen\",\"to_port\":\"Toulouse\",\"distance_km\":100,\"phase\":\"Canal de la Garonne\",\"status\":\"to_do\",\"from_lat\":44.2033,\"from_lon\":0.6167,\"to_lat\":43.6047,\"to_lon\":1.4442},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":12,\"name\":\"Début Canal du Midi\",\"from_port\":\"Toulouse\",\"to_port\":\"Castelnaudary\",\"distance_km\":60,\"phase\":\"Canal du Midi\",\"status\":\"to_do\",\"from_lat\":43.6047,\"from_lon\":1.4442,\"to_lat\":43.3186,\"to_lon\":1.9544,\"notes\":\"Entrée Canal du Midi. Vérifier tirants d'air.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":13,\"name\":\"Vers Carcassonne\",\"from_port\":\"Castelnaudary\",\"to_port\":\"Carcassonne\",\"distance_km\":40,\"phase\":\"Canal du Midi\",\"status\":\"to_do\",\"from_lat\":43.3186,\"from_lon\":1.9544,\"to_lat\":43.2128,\"to_lon\":2.3514},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":14,\"name\":\"Vers Béziers\",\"from_port\":\"Carcassonne\",\"to_port\":\"Béziers\",\"distance_km\":80,\"phase\":\"Canal du Midi\",\"status\":\"to_do\",\"from_lat\":43.2128,\"from_lon\":2.3514,\"to_lat\":43.3447,\"to_lon\":3.2150,\"notes\":\"Écluses de Fonseranes. Vérifier état opérationnel.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":15,\"name\":\"Sortie canal via Thau\",\"from_port\":\"Béziers\",\"to_port\":\"Sète\",\"distance_km\":40,\"phase\":\"Canal du Midi\",\"status\":\"to_do\",\"from_lat\":43.3447,\"from_lon\":3.2150,\"to_lat\":43.4053,\"to_lon\":3.6958,\"notes\":\"Traversée étang de Thau. Attention au vent.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":16,\"name\":\"Retour en mer\",\"from_port\":\"Sète\",\"to_port\":\"Port-Camargue\",\"distance_nm\":30,\"phase\":\"Méditerranée\",\"status\":\"to_do\",\"from_lat\":43.4053,\"from_lon\":3.6958,\"to_lat\":43.5267,\"to_lon\":4.1350,\"notes\":\"Premier leg Méditerranée. Tramontane possible.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":17,\"name\":\"Vers Marseille\",\"from_port\":\"Port-Camargue\",\"to_port\":\"Marseille\",\"distance_nm\":55,\"phase\":\"Méditerranée\",\"status\":\"to_do\",\"from_lat\":43.5267,\"from_lon\":4.1350,\"to_lat\":43.2965,\"to_lon\":5.3698,\"notes\":\"Traversée golfe du Lion. Attention Mistral. Pas d'abri sur 55 NM.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":18,\"name\":\"Vers Toulon\",\"from_port\":\"Marseille\",\"to_port\":\"Toulon\",\"distance_nm\":35,\"phase\":\"Méditerranée\",\"status\":\"to_do\",\"from_lat\":43.2965,\"from_lon\":5.3698,\"to_lat\":43.1242,\"to_lon\":5.9280,\"notes\":\"Cabotage côtier. Nombreux abris.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":19,\"name\":\"Vers Hyères\",\"from_port\":\"Toulon\",\"to_port\":\"Hyères\",\"distance_nm\":20,\"phase\":\"Méditerranée\",\"status\":\"to_do\",\"from_lat\":43.1242,\"from_lon\":5.9280,\"to_lat\":43.0833,\"to_lon\":6.1500,\"notes\":\"Mouillage Porquerolles possible.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"order_num\":20,\"name\":\"Dernière étape vers Nice\",\"from_port\":\"Hyères\",\"to_port\":\"Nice\",\"distance_nm\":60,\"phase\":\"Méditerranée\",\"status\":\"to_do\",\"from_lat\":43.0833,\"from_lon\":6.1500,\"to_lat\":43.6961,\"to_lon\":7.2719,\"notes\":\"Escales possibles: Saint-Raphaël, Cannes.\"}
    ]" -o /dev/null
  success "  20 étapes de route créées"

  # 7. Insert checklist
  info "Création de la checklist pré-départ..."
  curl -sf -X POST "${API}/checklist" \
    "${AUTH_HEADERS[@]}" \
    -H "Prefer: return=minimal" \
    -d "[
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Réparer les feux de navigation\",\"category\":\"Sécurité\",\"priority\":\"Critical\",\"status\":\"to_do\",\"notes\":\"Tous les feux HS. Obligatoire avant départ.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier gilets et harnais\",\"category\":\"Sécurité\",\"priority\":\"Critical\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Tester la VHF\",\"category\":\"Sécurité\",\"priority\":\"Critical\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier extincteur\",\"category\":\"Sécurité\",\"priority\":\"Critical\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Inspecter les fusées\",\"category\":\"Sécurité\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Tester pompe de cale\",\"category\":\"Sécurité\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vidange moteur + filtre\",\"category\":\"Propulsion\",\"priority\":\"Critical\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier turbine pompe eau de mer\",\"category\":\"Propulsion\",\"priority\":\"Critical\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Contrôler circuit carburant\",\"category\":\"Propulsion\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Test démarrage moteur 30min\",\"category\":\"Propulsion\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier hélice\",\"category\":\"Propulsion\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Plein carburant + jerricans\",\"category\":\"Propulsion\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Mettre à jour les cartes Navionics\",\"category\":\"Navigation\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Tester GPS et traceur\",\"category\":\"Navigation\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier compas\",\"category\":\"Navigation\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Télécharger guides canaux VNF\",\"category\":\"Navigation\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Inspecter gréement dormant\",\"category\":\"Gréement\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Inspecter gréement courant\",\"category\":\"Gréement\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Inspecter voiles\",\"category\":\"Gréement\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Graisser winches\",\"category\":\"Gréement\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Plein eau douce\",\"category\":\"Confort\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Provisions première semaine\",\"category\":\"Confort\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier gaz cuisine\",\"category\":\"Confort\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Nettoyer et aérer le bateau\",\"category\":\"Confort\",\"priority\":\"Low\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier assurance bateau\",\"category\":\"Admin\",\"priority\":\"High\",\"status\":\"to_do\",\"notes\":\"Couverture Méditerranée.\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Préparer papiers du bord\",\"category\":\"Admin\",\"priority\":\"High\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Vérifier vignette VNF\",\"category\":\"Admin\",\"priority\":\"Normal\",\"status\":\"to_do\"},
      {\"voyage_id\":\"${VOYAGE_ID}\",\"task\":\"Télécharger cartes offline\",\"category\":\"Admin\",\"priority\":\"Normal\",\"status\":\"to_do\"}
    ]" -o /dev/null
  success "  28 tâches de checklist créées"

  echo ""
  success "Données de test injectées pour $USER_EMAIL"
  info "Voyage: Audierne → Nice (20 étapes, 28 checklist items)"
fi

# ══════════════════════════════════════════════════════════════════════
# --lint : Vérification de code
# ══════════════════════════════════════════════════════════════════════
if $DO_LINT; then
  header "Vérification du code"

  info "TypeScript..."
  if npx tsc --noEmit 2>&1; then
    success "TypeScript OK"
  else
    error "Erreurs TypeScript détectées"
  fi

  info "ESLint..."
  if npx eslint src/ 2>&1; then
    success "ESLint OK"
  else
    warn "Avertissements ESLint"
  fi

  # Si --lint seul (pas de --build ni dev), on s'arrête
  if ! $DO_BUILD; then
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════════════════
# Démarrage
# ══════════════════════════════════════════════════════════════════════
if $DO_BUILD; then
  header "Build de production"
  npm run build
  success "Build terminé"

  header "Démarrage en mode production (port $PORT)"
  info "URL: http://localhost:$PORT"
  PORT=$PORT npm run start
else
  header "Démarrage du serveur de dev (port $PORT)"

  # Kill les process existants sur ce port si nécessaire
  if lsof -i ":$PORT" &>/dev/null && ! $DO_KILL; then
    warn "Port $PORT occupé, tentative de libération..."
    kill_existing
  fi

  echo ""
  info "URL: ${BOLD}http://localhost:$PORT${NC}"
  info "Ctrl+C pour arrêter"
  echo ""

  if $DO_OPEN; then
    # Ouvrir le navigateur après un court délai
    (sleep 3 && open "http://localhost:$PORT") &
  fi

  PORT=$PORT npx next dev --port "$PORT"
fi
