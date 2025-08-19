// Script para cadastrar ou atualizar o usuário admin no Firestore
// Execute este script em um ambiente Node.js com acesso ao seu projeto Firebase

const { initializeApp } = require('firebase/app');
const { getFirestore, setDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB3VvZGjMtp-_b_ltvQRBz_f2G0hRUan7o",
  authDomain: "controle-hidrometros.firebaseapp.com",
  projectId: "controle-hidrometros",
  storageBucket: "controle-hidrometros.firebasestorage.app",
  messagingSenderId: "654677897841",
  appId: "1:654677897841:web:cfd150df7f3dd03aada1d0",
  measurementId: "G-JC8Z2PW70M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setAdminUser() {
  const email = 'admin@seudominio.com'; // Altere para o email do admin
  const userId = 'admin'; // Pode ser o UID do usuário ou um identificador único
  await setDoc(doc(db, 'users', userId), {
    email: email,
    role: 'admin'
  });
  console.log('Usuário admin cadastrado/atualizado com sucesso!');
}

setAdminUser();
