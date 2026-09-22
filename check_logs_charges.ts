import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfigFile from './firebase-applet-config.json';

const app = initializeApp(firebaseConfigFile);
const db = getFirestore(app, firebaseConfigFile.firestoreDatabaseId);

async function main() {
  const clientsSnap = await getDocs(collection(db, 'clients'));
  const clients: any[] = [];
  const clientMap = new Map<string, any>();
  const phoneMap = new Map<string, any>();
  const nameMap = new Map<string, any>();

  clientsSnap.forEach((doc) => {
    const c = { id: doc.id, ...doc.data() };
    clients.push(c);
    clientMap.set(c.id, c);
    const cleanPhone = (c.phone || '').replace(/\D/g, '').replace(/^55/, '');
    if (cleanPhone) phoneMap.set(cleanPhone, c);
    const cleanName = (c.name || '').trim().toLowerCase();
    if (cleanName) nameMap.set(cleanName, c);
  });

  const chargesSnap = await getDocs(collection(db, 'charges'));
  const charges: any[] = [];
  chargesSnap.forEach((doc) => {
    charges.push({ id: doc.id, ...doc.data() });
  });

  const logsSnap = await getDocs(collection(db, 'sentLogs'));
  const logs: any[] = [];
  logsSnap.forEach((doc) => {
    logs.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Checking logs where clientId is not in clients:`);
  for (const log of logs) {
    if (!clientMap.has(log.clientId)) {
      console.log(`Log without client: log.id=${log.id}, log.clientName="${log.clientName}", log.phone="${log.phone}", log.clientId="${log.clientId}"`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
