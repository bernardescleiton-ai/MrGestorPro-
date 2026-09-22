import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfigFile from './firebase-applet-config.json';

const app = initializeApp(firebaseConfigFile);
const db = getFirestore(app, firebaseConfigFile.firestoreDatabaseId);

async function main() {
  const clientsSnap = await getDocs(collection(db, 'clients'));
  console.log(`=== CLIENTS count: ${clientsSnap.size} ===`);
  const clientIds = new Set<string>();
  const clientNames: Record<string, string> = {};
  clientsSnap.forEach((doc) => {
    const data = doc.data();
    clientIds.add(doc.id);
    clientNames[doc.id] = data.name;
    console.log(`Client [${doc.id}]: name="${data.name}", phone="${data.phone}", dueDate="${data.dueDate}"`);
  });

  const chargesSnap = await getDocs(collection(db, 'charges'));
  console.log(`\n=== CHARGES count: ${chargesSnap.size} ===`);
  chargesSnap.forEach((doc) => {
    const data = doc.data();
    const hasClient = clientIds.has(data.clientId);
    console.log(`Charge [${doc.id}]: clientId="${data.clientId}" (hasClient: ${hasClient}, clientName: "${clientNames[data.clientId] || 'NONE'}"), paid=${data.paid}, paidAt="${data.paidAt}", dueDate="${data.dueDate}", note="${data.note}"`);
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
