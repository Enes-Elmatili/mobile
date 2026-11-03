// lib/types — le contrat serveur, tel que l'app le lit.
// Le backend n'est pas dans ce dépôt : ces types sont déduits des appelants
// (écrans, hooks) et de lib/mission/brief.ts. Un champ optionnel est un champ
// que l'app traite comme possiblement absent.
export * from './common';
export * from './user';
export * from './request';
export * from './provider';
export * from './quote';
export * from './invoice';
export * from './wallet';
export * from './message';
export * from './notification';
export * from './ticket';
export * from './address';
