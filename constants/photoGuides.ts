// constants/photoGuides.ts
// Consignes de photos par prestation (clé = slug de sous-catégorie du
// catalogue). Le client cadre ce qu'on lui demande ; le prestataire arrive
// avec les bonnes pièces. `required` bloque l'envoi de la demande tant que la
// prise manque. Libellés et aides : i18n `shots.<key>.label` / `.hint`.
// Une sous-catégorie absente d'ici reçoit GENERIC_SHOTS (rien de requis).
// Décision d'Enès (13/09/2026) : les consignes vivent dans le code, pas en base.
export type ShotSpec = { key: string; required: boolean };

export const GENERIC_SHOTS: ShotSpec[] = [
  { key: 'problem', required: false },
  { key: 'overview', required: false },
];

export const PHOTO_GUIDES: Record<string, ShotSpec[]> = {
  // ── Plomberie ──
  'fuite-eau':                    [{ key: 'leak', required: true }, { key: 'under_sink', required: false }, { key: 'meter', required: false }],
  'recherche-fuite':              [{ key: 'trace', required: true }, { key: 'overview', required: false }, { key: 'meter', required: false }],
  'fuite-colonne-principale':     [{ key: 'leak', required: true }, { key: 'column', required: false }],
  'fuite-electromenager':         [{ key: 'appliance_hose', required: true }, { key: 'leak', required: false }],
  'debouchage-canalisation':      [{ key: 'drain', required: true }, { key: 'under_sink', required: false }],
  'debouchage-wc':                [{ key: 'wc_bowl', required: true }],
  'debouchage-hydrocurage':       [{ key: 'drain', required: false }, { key: 'overview', required: false }],
  'inspection-camera':            [{ key: 'drain', required: false }, { key: 'overview', required: false }],
  'chasse-eau-mecanisme-wc':      [{ key: 'wc_tank', required: true }, { key: 'wc_bowl', required: false }],
  'reparation-wc':                [{ key: 'wc_bowl', required: true }, { key: 'wc_tank', required: false }],
  'installation-wc':              [{ key: 'wc_bowl', required: false }, { key: 'overview', required: false }],
  'remplacement-robinet':         [{ key: 'tap', required: true }, { key: 'under_sink', required: false }],
  'installation-sanitaire':       [{ key: 'overview', required: true }, { key: 'under_sink', required: false }],
  'installation-douche-baignoire':[{ key: 'bathroom', required: true }],
  'renovation-plomberie':         [{ key: 'bathroom', required: false }, { key: 'overview', required: false }],
  'panne-chauffe-eau':            [{ key: 'water_heater', required: true }, { key: 'label_plate', required: false }],
  'installation-chauffe-eau':     [{ key: 'water_heater', required: false }, { key: 'overview', required: false }],
  'entretien-pompe-chaleur':      [{ key: 'heat_pump', required: false }, { key: 'label_plate', required: false }],
  'regonflage-pression':          [{ key: 'boiler_gauge', required: true }],
  'detartrage-circuit':           [{ key: 'boiler_gauge', required: false }, { key: 'radiator', required: false }],
  // ── Serrurerie ──
  'ouverture-porte-claquee':      [{ key: 'lock_close', required: true }, { key: 'door_full', required: false }],
  'ouverture-porte-blindee':      [{ key: 'door_full', required: true }, { key: 'lock_close', required: true }],
  'cle-cassee-coincee':           [{ key: 'lock_close', required: true }, { key: 'key_broken', required: false }],
  'remplacement-cylindre':        [{ key: 'lock_close', required: true }, { key: 'door_edge', required: false }],
  'remplacement-serrure':         [{ key: 'lock_close', required: true }, { key: 'door_edge', required: true }],
  'reparation-serrure':           [{ key: 'lock_close', required: true }, { key: 'door_edge', required: false }],
  'reparation-porte':             [{ key: 'door_full', required: true }, { key: 'door_edge', required: false }],
  'installation-verrou':          [{ key: 'door_full', required: false }, { key: 'door_edge', required: false }],
  'blindage-porte':               [{ key: 'door_full', required: true }, { key: 'door_frame', required: false }],
  'installation-porte':           [{ key: 'door_full', required: true }, { key: 'door_frame', required: false }],
  'mise-en-securite-effraction':  [{ key: 'door_full', required: true }, { key: 'lock_close', required: false }],
  'securite-porte-accessoires':   [{ key: 'door_full', required: false }],
  'double-cle-badge':             [{ key: 'key_badge', required: true }],
  'boite-aux-lettres':            [{ key: 'mailbox', required: true }],
  'controle-acces':               [{ key: 'access_device', required: false }, { key: 'door_full', required: false }],
  'installation-coffre-fort':     [{ key: 'overview', required: false }],
  'ouverture-coffre-fort':        [{ key: 'safe', required: true }],
  'portail-motorisation':         [{ key: 'gate', required: true }, { key: 'gate_motor', required: false }],
  'volets-rideaux-metalliques':   [{ key: 'shutter', required: true }],
};

/** Icône Feather de chaque prise (tuile vide). */
export const SHOT_ICONS: Record<string, string> = {
  problem: 'alert-circle', overview: 'maximize', leak: 'droplet', under_sink: 'box', meter: 'activity', trace: 'search',
  column: 'align-center', appliance_hose: 'link', drain: 'disc', wc_bowl: 'circle', wc_tank: 'square', tap: 'droplet',
  bathroom: 'layout', water_heater: 'thermometer', label_plate: 'tag', heat_pump: 'wind', boiler_gauge: 'compass',
  radiator: 'sliders', door_full: 'log-in', lock_close: 'lock', key_broken: 'key', door_edge: 'sidebar', door_frame: 'layout',
  key_badge: 'key', mailbox: 'inbox', access_device: 'cpu', safe: 'archive', gate: 'grid', gate_motor: 'settings', shutter: 'menu',
};

/** Toutes les clés de prise connues (pour l'i18n et les tests). */
export const SHOT_KEYS: string[] = Array.from(new Set([...GENERIC_SHOTS, ...Object.values(PHOTO_GUIDES).flat()].map((s) => s.key)));
