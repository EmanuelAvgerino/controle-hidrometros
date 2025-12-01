const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Array de registros extraído do seu CSV (a partir do lote 78)
const registros = [
  { periodo: "Janeiro / Fevereiro", lote: "78", anterior: "472", atual: "482", consumo: "10" },
  { periodo: "Janeiro / Fevereiro", lote: "83", anterior: "527", atual: "537", consumo: "10" },
  { periodo: "Janeiro / Fevereiro", lote: "84", anterior: "99", atual: "116", consumo: "17" },
  { periodo: "Janeiro / Fevereiro", lote: "86", anterior: "89", atual: "98", consumo: "9" },
  { periodo: "Janeiro / Fevereiro", lote: "87", anterior: "71", atual: "71", consumo: "0" },
  { periodo: "Janeiro / Fevereiro", lote: "88", anterior: "52", atual: "61", consumo: "9" },
  { periodo: "Janeiro / Fevereiro", lote: "89", anterior: "1033", atual: "1041", consumo: "8" },
  { periodo: "Janeiro / Fevereiro", lote: "90", anterior: "1462", atual: "1484", consumo: "22" },
  { periodo: "Janeiro / Fevereiro", lote: "91", anterior: "177", atual: "182", consumo: "5" },
  { periodo: "Janeiro / Fevereiro", lote: "92", anterior: "201", atual: "204", consumo: "3" },
  // ...adicione todos os registros do seu CSV aqui...
];

// Função para converter o período para mesAno (ex: "2025-01")
function periodoParaMesAno(periodo) {
  const mapa = {
    "Janeiro / Fevereiro": "2025-01",
    "Fevereiro / Março": "2025-02",
    "Março / Abril": "2025-03",
    "Abril / Maio": "2025-04",
    "Maio / Junho": "2025-05",
    "Julho / Agosto": "2025-07"
  };
  return mapa[periodo] || "2025-01";
}

async function importarLotes() {
  // Agrupa registros por lote
  const lotes = {};
  for (const reg of registros) {
    if (!reg.lote || isNaN(Number(reg.lote))) continue;
    if (!lotes[reg.lote]) lotes[reg.lote] = [];
    lotes[reg.lote].push({
      id: Date.now() + Math.floor(Math.random() * 100000), // Gera um id único
      mesAno: periodoParaMesAno(reg.periodo),
      leituraAnterior: Number(reg.anterior) || 0,
      leituraAtual: Number(reg.atual) || 0,
      consumo: Number(reg.consumo) || 0,
      tarifa: 0, // Defina a tarifa padrão se necessário
      custo: 0   // Pode ser calculado depois
    });
  }

  // Salva cada lote no Firestore, igual ao processo do site
  for (const [loteId, registros] of Object.entries(lotes)) {
    await db.collection('lotes').doc(loteId).set({ registros });
    console.log(`Lote ${loteId} importado com ${registros.length} registros.`);
  }
  console.log('Importação concluída!');
}

importarLotes();