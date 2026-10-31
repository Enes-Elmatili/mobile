// lib/request/access.ts
// Infos d'accès saisies à l'étape 3 : défaut profil (PATCH /me) et snapshot
// propre à la mission (payload de création). Pur : testé dans
// __tests__/stepperAccess.test.js.

export type AccessFields = {
  buildingType: string | null;
  floorNum: string;
  hasElevator: boolean | null;
  accessNotes: string;
  clientLanguage: string | null;
};

/** Champs d'accès du profil client (absents du type UserData d'AuthContext). */
export type AccessProfile = {
  buildingType?: string | null;
  floor?: number | string | null;
  hasElevator?: boolean | null;
  language?: string | null;
};

// ⚠️ accessNotes EXCLU volontairement : c'est une info per-mission (digicode,
// instructions ponctuelles) qui n'a pas vocation à devenir un défaut profil.
// Le snapshot per-mission est géré via accessSnapshot dans le payload de création.
export function buildProfileUpdate(fields: Omit<AccessFields, 'accessNotes'>): Record<string, unknown> {
  const { buildingType, floorNum, hasElevator, clientLanguage } = fields;
  const profileUpdate: Record<string, unknown> = {};
  if (buildingType)                         profileUpdate.buildingType = buildingType;
  if (floorNum.trim())                      profileUpdate.floor        = parseInt(floorNum, 10) || null;
  if (hasElevator !== null)                  profileUpdate.hasElevator  = hasElevator;
  if (clientLanguage)                        profileUpdate.language     = clientLanguage;
  return profileUpdate;
}

// Snapshot des infos d'accès pour cette mission spécifique (évite que les
// missions partagent toutes les mêmes valeurs via User.* qui sert de défaut).
export function buildAccessSnapshot(fields: AccessFields): Record<string, unknown> {
  const { buildingType, floorNum, hasElevator, accessNotes, clientLanguage } = fields;
  const snap: Record<string, unknown> = {};
  if (buildingType) snap.accessBuildingType = buildingType;
  const f = parseInt(floorNum, 10);
  if (Number.isFinite(f)) snap.accessFloor = f;
  if (hasElevator !== null) snap.accessHasElevator = hasElevator;
  if (accessNotes.trim()) snap.accessNotes = accessNotes.trim();
  if (clientLanguage) snap.clientLanguage = clientLanguage;
  return snap;
}
