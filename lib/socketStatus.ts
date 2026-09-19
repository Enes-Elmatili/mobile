// lib/socketStatus.ts — « le socket est-il là ? », lisible sans React.
// Posé par SocketContext, lu par le handler de push au premier plan : si le
// socket porte déjà l'événement (toast depuis l'île), la bannière système
// se tait ; sinon elle s'affiche — on ne perd jamais l'information.
let up = false;
export function setSocketUp(v: boolean) { up = v; }
export function isSocketUp(): boolean { return up; }
