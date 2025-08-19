import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Configuração global do Chart.js para o tema claro
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
ChartJS.defaults.color = '#334155'; // slate-700
ChartJS.defaults.borderColor = 'rgba(0, 0, 0, 0.05)';

// ===================================================================================
//  1. DADOS E LÓGICA DE NEGÓCIO (Simulação de Backend)
// ===================================================================================

// Removido backend simulado. Usuários e dados agora são gerenciados pelo Firebase.

// ===================================================================================
//  2. HOOKS PERSONALIZADOS (Para organizar a lógica)
// ===================================================================================

// --- hooks/useAuth.js ---
const useAuth = () => {
    const [currentUser, setCurrentUser] = useState(null);
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(user => {
            if (user) {
                // Recupera role do Firestore
                getDocs(collection(db, 'users')).then(snapshot => {
                    const userData = snapshot.docs.find(doc => doc.data().email === user.email);
                    if (userData) {
                        setCurrentUser({ username: user.email, role: userData.data().role });
                    } else {
                        setCurrentUser({ username: user.email, role: 'plantonista' });
                    }
                });
            } else {
                setCurrentUser(null);
            }
        });
        return () => unsub();
    }, []);
    const login = async (username, password) => {
        try {
            await signInWithEmailAndPassword(auth, username, password);
            return null;
        } catch (error) {
            return 'Usuário ou senha inválidos.';
        }
    };
    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
    };
    return { currentUser, login, logout };
};

// --- hooks/useCondoData.js ---
const useCondoData = () => {
    const [allData, setAllData] = useState({});
    useEffect(() => {
        // Escuta dados em tempo real do Firestore
        const unsub = onSnapshot(collection(db, 'lotes'), (snapshot) => {
            const data = {};
            snapshot.forEach(doc => {
                data[doc.id] = doc.data().registros || [];
            });
            setAllData(data);
        });
        return () => unsub();
    }, []);
    const updateAllData = async (newData) => {
        // Atualiza todos os lotes no Firestore
        for (const loteId in newData) {
            await setDoc(doc(db, 'lotes', loteId), { registros: newData[loteId] });
        }
        setAllData(newData);
    };
    return { allData, updateAllData };
};


// ===================================================================================
//  3. CONTEXTO DA APLICAÇÃO (Para compartilhar o estado globalmente)
// ===================================================================================

// --- context/AppContext.js ---
const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const auth = useAuth();
    const condoData = useCondoData();
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    useEffect(() => {
        const loadScript = (src, id) => new Promise((resolve, reject) => {
            if (document.getElementById(id)) { resolve(); return; }
            const script = document.createElement('script'); script.src = src; script.id = id;
            script.onload = resolve; script.onerror = () => reject(new Error(`Erro ao carregar ${src}`));
            document.body.appendChild(script);
        });
        Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas-script'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script')
        ]).then(() => setScriptsLoaded(true)).catch(error => console.error("Falha ao carregar scripts:", error));
    }, []);
    const value = { ...auth, ...condoData, scriptsLoaded };
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);


// ===================================================================================
//  4. COMPONENTES DE INTERFACE (UI)
// ===================================================================================

// --- components/LoginView.js ---
const LoginView = () => {
    const { login } = useAppContext();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = () => setError(login(username, password) || '');
    const handleKeyPress = (e) => e.key === 'Enter' && handleSubmit();
    return (
        <div className="w-full max-w-sm"><main className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20"><div className="text-center mb-8"><h1 className="text-3xl font-bold text-gray-900">Acesso ao Sistema</h1><p className="text-gray-600 mt-2">Controle de Hidrômetros</p></div><div className="space-y-6"><div><label htmlFor="username-login" className="block text-sm font-medium text-gray-700">Usuário</label><input type="text" id="username-login" value={username} onChange={(e) => setUsername(e.target.value)} onKeyPress={handleKeyPress} className="mt-1 w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800" /></div><div><label htmlFor="password-login" className="block text-sm font-medium text-gray-700">Senha</label><input type="password" id="password-login" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={handleKeyPress} className="mt-1 w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800" /></div>{error && <p className="text-sm text-red-600 text-center">{error}</p>}<button onClick={handleSubmit} className="w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl">Entrar</button></div></main></div>
    );
};

// --- components/LoteListModal.js ---
const LoteListModal = ({ title, lotes, onClose, onSelectLote }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300"><div className="bg-white/90 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl w-full max-w-2xl mx-auto transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">{title}</h3><button onClick={onClose} className="text-3xl font-light text-gray-500 hover:text-gray-900">&times;</button></div><div className="max-h-80 overflow-y-auto pr-2 border-t pt-4"><ul className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3">{lotes.map(lote => (<li key={lote} onClick={() => onSelectLote(lote)} className="text-center font-semibold bg-gray-100 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-200 hover:border-gray-400 transition-all">{lote}</li>))}</ul></div><div className="mt-6 text-right border-t pt-4"><button onClick={onClose} className="px-5 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">Fechar</button></div></div></div>
);

// --- components/DashboardView.js ---
const DashboardView = ({ onSelectLote }) => {
    const { allData } = useAppContext();
    const [modalInfo, setModalInfo] = useState({ show: false, title: '', lotes: [] });
    const dashboardData = useMemo(() => {
        const data = { totalLotes: 0, verificados: 0, consumoTotal: 0, consumoMedio: 0, ranking: [], anomalias: { altas: [], baixas: [] }, allLotesList: [], verificadosList: [], ultimoMesAno: '' };
        const lotes = Object.keys(allData); data.totalLotes = lotes.length; data.allLotesList = lotes.sort((a,b) => a - b); if (data.totalLotes === 0) return data;
        let ultimoMesAno = '';
        lotes.forEach(loteId => { const regs = allData[loteId] || []; regs.forEach(r => { if (r.mesAno > ultimoMesAno) ultimoMesAno = r.mesAno; }); });
        if (!ultimoMesAno) return data;
        data.ultimoMesAno = ultimoMesAno.split('-').reverse().join('/');
        const dadosUltimoMes = lotes.map(loteId => { const r = allData[loteId]?.find(reg => reg.mesAno === ultimoMesAno); return r ? { loteId, ...r } : null; }).filter(Boolean);
        if (dadosUltimoMes.length === 0) return data;
        data.verificados = dadosUltimoMes.length; data.verificadosList = dadosUltimoMes.map(d => d.loteId).sort((a,b) => a - b);
        data.consumoTotal = dadosUltimoMes.reduce((acc, curr) => acc + curr.consumo, 0);
        data.consumoMedio = data.verificados > 0 ? data.consumoTotal / data.verificados : 0; data.ranking = [...dadosUltimoMes].sort((a, b) => b.consumo - a.consumo);
        const thresholdAlto = data.consumoMedio * 1.5; const thresholdBaixo = data.consumoMedio * 0.5;
        data.anomalias.altas = data.ranking.filter(r => r.consumo > thresholdAlto); data.anomalias.baixas = data.ranking.filter(r => r.consumo > 0 && r.consumo < thresholdBaixo);
        return data;
    }, [allData]);
    const handleCardClick = (title, lotes) => setModalInfo({ show: true, title, lotes });
    const handleSelectAndClose = (lote) => { onSelectLote(lote); setModalInfo({ show: false, title: '', lotes: [] }); };
    const renderRankingList = (rankingData) => (<ul className="space-y-2">{rankingData.map(item => (<li key={item.loteId} onClick={() => onSelectLote(item.loteId)} className="flex justify-between items-center text-sm p-3 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"><span>Lote <strong className="font-semibold text-gray-800">{item.loteId}</strong></span><span className="font-bold text-gray-700">{item.consumo.toFixed(2)} m³</span></li>))}</ul>);
    const Card = ({ title, value, label, onClick, icon, colorClass }) => (
        <div onClick={onClick} className={`p-6 rounded-2xl text-center cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 ${colorClass}`}>
            <div className="flex items-center justify-center mx-auto w-12 h-12 mb-4 bg-black/5 rounded-full">{icon}</div>
            <h3 className="text-lg font-semibold opacity-80">{title}</h3><p className="text-4xl font-bold mt-2">{value}</p>
            {label && <p className="text-xs opacity-70 mt-1">{label}</p>}
        </div>
    );
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Lotes Totais" value={dashboardData.totalLotes} onClick={() => handleCardClick('Todos os Lotes Cadastrados', dashboardData.allLotesList)} colorClass="bg-gray-200 text-gray-800" icon={<svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>} />
                <Card title="Lotes Verificados" value={dashboardData.verificados} label={dashboardData.ultimoMesAno ? `Em ${dashboardData.ultimoMesAno}` : '(Nenhum registro recente)'} onClick={() => handleCardClick(`Lotes Verificados em ${dashboardData.ultimoMesAno}`, dashboardData.verificadosList)} colorClass="bg-green-100 text-green-900" icon={<svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <Card title="Consumo Médio" value={dashboardData.consumoMedio.toFixed(2) + ' m³'} label={dashboardData.ultimoMesAno ? `Em ${dashboardData.ultimoMesAno}` : ''} colorClass="bg-yellow-100 text-yellow-900" icon={<svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><div className="bg-white p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-semibold mb-4 text-gray-800">Top 5 Consumidores</h3>{dashboardData.ranking.length > 0 ? renderRankingList(dashboardData.ranking.slice(0, 5)) : <p className="text-sm text-gray-500">Sem dados.</p>}</div><div className="bg-white p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-semibold mb-4 text-gray-800">Top 5 Econômicos</h3>{dashboardData.ranking.length > 0 ? renderRankingList([...dashboardData.ranking].reverse().slice(0, 5)) : <p className="text-sm text-gray-500">Sem dados.</p>}</div></div>
            <div className="bg-white p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-semibold mb-4 text-red-700 flex items-center"><svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>Alertas de Anormalidade</h3>{dashboardData.anomalias.altas.length === 0 && dashboardData.anomalias.baixas.length === 0 ? <p className="text-sm text-gray-500 mt-4">Nenhuma anormalidade detectada.</p> : (<div className="space-y-4 mt-4">{dashboardData.anomalias.altas.length > 0 && <div><h4 className="font-semibold text-red-600">Consumo Alto</h4>{renderRankingList(dashboardData.anomalias.altas)}</div>}{dashboardData.anomalias.baixas.length > 0 && <div><h4 className="font-semibold text-yellow-600">Consumo Baixo</h4>{renderRankingList(dashboardData.anomalias.baixas)}</div>}</div>)}</div>
            {modalInfo.show && <LoteListModal title={modalInfo.title} lotes={modalInfo.lotes} onClose={() => setModalInfo({ show: false, title: '', lotes: [] })} onSelectLote={handleSelectAndClose} />}
        </div>
    );
};

// --- components/RegistroForm.js ---
const RegistroForm = ({ onSave, editingRecord, onCancelEdit, formData, setFormData, isAdmin }) => {
    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    const handleSubmit = () => onSave(formData, editingRecord ? editingRecord.id : null);
    return (
        <div>
            <h2 id="form-title" className="text-xl font-semibold text-gray-800 mb-4">{editingRecord ? `Editando Registro (${editingRecord.mesAno.split('-').reverse().join('/')})` : 'Adicionar Novo Registro'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-gray-50/50 p-4 rounded-xl border">
                <div className="lg:col-span-1">
                    <label htmlFor="mes" className="block text-sm font-medium text-gray-700">Mês</label>
                    <select id="mes" value={formData.mes} onChange={handleChange} className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800">
                        {Array.from({length: 12}).map((_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-1"><label htmlFor="ano" className="block text-sm font-medium text-gray-700">Ano</label><input type="number" id="ano" value={formData.ano} onChange={handleChange} placeholder="2025" className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-lg" /></div>
                <div className="lg:col-span-1"><label htmlFor="leituraAnterior" className="block text-sm font-medium text-gray-700">Leitura Ant.</label><input type="number" id="leituraAnterior" value={formData.leituraAnterior} onChange={handleChange} placeholder="m³" className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-lg" /></div>
                <div className="lg:col-span-1"><label htmlFor="leituraAtual" className="block text-sm font-medium text-gray-700">Leitura Atual</label><input type="number" id="leituraAtual" value={formData.leituraAtual} onChange={handleChange} placeholder="m³" className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-lg" /></div>
                <div className="lg:col-span-1"><label htmlFor="tarifa" className="block text-sm font-medium text-gray-700">Tarifa (R$)</label><input type="number" id="tarifa" value={formData.tarifa} onChange={handleChange} placeholder="R$/m³" step="0.01" className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-lg" /></div>
            </div>
            <div className="mt-4 flex items-center space-x-3">
                <button onClick={handleSubmit} className="w-full md:w-auto bg-gray-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 shadow-md hover:shadow-lg transition-all">{editingRecord ? 'Atualizar Registro' : 'Salvar Registro'}</button>
                {editingRecord && isAdmin && (<button onClick={onCancelEdit} className="w-full md:w-auto bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-500">Cancelar</button>)}
            </div>
        </div>
    );
};

// --- components/HistoricoTable.js ---
const HistoricoTable = ({ registros, onEdit, onDelete, isAdmin }) => (
    <div className="overflow-x-auto"><table className="min-w-full bg-transparent"><thead className="bg-transparent"><tr><th className="py-3 px-4 border-b border-gray-200 text-left text-sm font-semibold text-gray-500">Mês/Ano</th><th className="py-3 px-4 border-b border-gray-200 text-left text-sm font-medium text-gray-500">Consumo</th><th className="py-3 px-4 border-b border-gray-200 text-left text-sm font-medium text-gray-500">Custo (R$)</th>{isAdmin && <th className="py-3 px-4 border-b border-gray-200 text-left text-sm font-medium text-gray-500">Ações</th>}</tr></thead><tbody>{registros.map(r => (<tr key={r.id} className="hover:bg-gray-50/50"><td className="py-4 px-4 border-b border-gray-200 text-gray-700">{r.mesAno.split('-').reverse().join('/')}</td><td className="py-4 px-4 border-b border-gray-200"><span className="font-semibold text-gray-800">{r.consumo.toFixed(2)} m³</span><span className="block text-sm text-gray-500">{(r.consumo * 1000).toLocaleString('pt-BR')} litros</span></td><td className="py-4 px-4 border-b border-gray-200 text-gray-700">{r.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>{isAdmin && (<td className="py-4 px-4 border-b border-gray-200 text-sm space-x-4"><button onClick={() => onEdit(r.id)} className="font-semibold text-gray-700 hover:text-black">Editar</button><button onClick={() => onDelete(r.id)} className="font-semibold text-red-600 hover:text-red-500">Remover</button></td>)}</tr>))}</tbody></table></div>
);

// --- components/AnaliseView.js ---
const AnaliseView = ({ registros, onExportPDF, onExportCSV, selectedLote }) => {
    const exportContentRef = useRef();
    if (registros.length < 1) return <div className="text-center py-12 px-4 border-dashed border-2 border-gray-300 rounded-lg"><p className="text-gray-500">Adicione pelo menos um registro para gerar um comparativo.</p></div>;
    const chartData = { 
        labels: registros.map(r => {
            const [ano, mes] = r.mesAno.split('-');
            const consumoLitros = (r.consumo * 1000).toLocaleString('pt-BR');
            return [`${mes}/${ano.slice(2)}`, `${consumoLitros} litros`];
        }),
        datasets: [{ 
            label: 'Consumo (litros)', 
            data: registros.map(r => r.consumo * 1000), 
            backgroundColor: 'rgba(0, 0, 255, 1)', 
            borderColor: 'rgba(55, 65, 81, 1)', 
            borderWidth: 1, 
            borderRadius: 4 
        }] 
    };
    const chartOptions = { responsive: true, maintainAspectRatio: false, layout: { padding: { bottom: 30 } }, plugins: { legend: { display: false }, title: { display: false }, tooltip: { enabled: true, callbacks: { title: (context) => context[0].label.split(',')[0], label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += context.parsed.y.toLocaleString('pt-BR') + ' litros'; } return label; } } }}, scales: { y: { beginAtZero: true, title: { display: true, text: 'Consumo (litros)', color: '#4b5563' }, grid: { color: 'rgba(0, 0, 0, 0.05)' } }, x: { ticks: { font: { size: 11 }, color: '#374151' }, grid: { color: 'rgba(0, 0, 0, 0.05)' } } }};
    const getMensagemGrafico = () => {
        const ultimo = registros[registros.length - 1]; let msg = ''; let className = 'mt-4 text-center p-4 rounded-lg ';
        if (registros.length === 1) { msg = `Primeiro registro: <strong>${ultimo.consumo.toFixed(2)} m³</strong> (${(ultimo.consumo * 1000).toLocaleString('pt-BR')} litros).`; className += 'bg-gray-100 text-gray-800'; } 
        else { const penultimo = registros[registros.length - 2]; const diferenca = ultimo.consumo - penultimo.consumo; const diferencaLitros = Math.abs(diferenca * 1000).toLocaleString('pt-BR');
            if (diferenca > 0.001) { msg = `Aumento de <strong>${diferenca.toFixed(2)} m³</strong> (${diferencaLitros} litros) desde o mês anterior.`; className += 'bg-red-100 text-red-800'; } 
            else if (diferenca < -0.001) { msg = `Economia de <strong>${Math.abs(diferenca).toFixed(2)} m³</strong> (${diferencaLitros} litros) desde o mês anterior.`; className += 'bg-green-100 text-green-800'; } 
            else { msg = `Consumo estável em <strong>${ultimo.consumo.toFixed(2)} m³</strong>.`; className += 'bg-gray-100 text-gray-800'; }
        }
        return <div className={className} dangerouslySetInnerHTML={{ __html: msg }} />;
    };
    return (
        <div>
            <div id="export-content" ref={exportContentRef} className="bg-white rounded-2xl p-4">
                <h2 className="text-2xl font-bold text-center text-gray-800 pt-4 pb-2">DEMONSTRATIVO DE CONSUMO D'ÁGUA - 2025 - LOTE  {selectedLote}</h2>
                <h3 className="text-lg font-semibold text-center text-gray-600 mb-8">Comparativo de Consumo</h3>
                <div className="p-4 h-96"><Bar options={chartOptions} data={chartData} /></div>
                {getMensagemGrafico()}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => onExportPDF(exportContentRef)} className="w-full sm:w-auto bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700">Exportar para PDF</button>
                <button onClick={onExportCSV} className="w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700">Exportar para Excel (CSV)</button>
            </div>
        </div>
    );
};

// --- components/LoteManager.js ---
const LoteManager = ({ initialLote, onSwitchToDashboard }) => {
    const { currentUser, allData, updateAllData } = useAppContext();
    const [view, setView] = useState(initialLote ? 'lancamento' : 'selecao');
    const [loteInput, setLoteInput] = useState(initialLote || '');
    const [selectedLote, setSelectedLote] = useState(initialLote || null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [formData, setFormData] = useState({ mes: '', ano: '', leituraAnterior: '', leituraAtual: '', tarifa: '' });
    
    const isAdmin = currentUser.role === 'admin';
    const registros = selectedLote ? (allData[selectedLote] || []) : [];

    const handleCarregarLote = (lote) => {
        const loteId = lote || loteInput;
        if (!loteId || isNaN(parseInt(loteId))) { alert("Por favor, insira um número de lote válido."); return; }
        setSelectedLote(loteId); setLoteInput(loteId); setView('lancamento');
    };
    
    useEffect(() => { if(selectedLote) prepararProximoFormulario(allData[selectedLote] || []); }, [selectedLote, allData]);

    const prepararProximoFormulario = (currentRegistros) => {
        const sorted = [...currentRegistros].sort((a, b) => new Date(`${a.mesAno}-01`) - new Date(`${b.mesAno}-01`));
        if (sorted.length > 0) {
            const ultimo = sorted[sorted.length - 1]; let [ultimoAno, ultimoMes] = ultimo.mesAno.split('-');
            let proximoMes = parseInt(ultimoMes) + 1; let proximoAno = parseInt(ultimoAno);
            if (proximoMes > 12) { proximoMes = 1; proximoAno++; }
            setFormData({ mes: String(proximoMes).padStart(2, '0'), ano: String(proximoAno), leituraAnterior: ultimo.leituraAtual, leituraAtual: '', tarifa: ultimo.tarifa });
        } else {
            const hoje = new Date();
            setFormData({ mes: String(hoje.getMonth() + 1).padStart(2, '0'), ano: String(hoje.getFullYear()), leituraAnterior: '', leituraAtual: '', tarifa: '' });
        }
    };

    const handleSave = (data, id) => {
        const parsedData = { mes: data.mes, ano: data.ano, leituraAnterior: parseFloat(data.leituraAnterior), leituraAtual: parseFloat(data.leituraAtual), tarifa: parseFloat(data.tarifa) };
        if (Object.values(parsedData).some(v => v === '' || isNaN(v))) { alert("Por favor, preencha todos os campos corretamente."); return; }
        if (parsedData.leituraAtual < parsedData.leituraAnterior) { alert("A leitura atual não pode ser menor que a anterior."); return; }
        const mesAno = `${parsedData.ano}-${parsedData.mes}`; const consumo = parsedData.leituraAtual - parsedData.leituraAnterior;
        const custo = consumo * parsedData.tarifa; let updatedRegistros;
        const currentRegistros = allData[selectedLote] || [];
        if (id) {
            if (currentRegistros.some(r => r.mesAno === mesAno && r.id !== id)) { alert("Já existe um registro para este mês/ano."); return; }
            updatedRegistros = currentRegistros.map(r => r.id === id ? { ...r, mesAno, consumo, custo, ...parsedData } : r);
            setEditingRecord(null);
        } else {
            if (currentRegistros.some(r => r.mesAno === mesAno)) { alert("Já existe um registro para este mês/ano."); return; }
            const newRecord = { id: Date.now(), mesAno, consumo, custo, ...parsedData };
            updatedRegistros = [...currentRegistros, newRecord];
        }
        updateAllData({ ...allData, [selectedLote]: updatedRegistros });
    };

    const handleEdit = (id) => {
        const record = registros.find(r => r.id === id); setEditingRecord(record);
        const [ano, mes] = record.mesAno.split('-'); setFormData({ mes, ano, leituraAnterior: record.leituraAnterior, leituraAtual: record.leituraAtual, tarifa: record.tarifa });
        document.getElementById('form-title')?.scrollIntoView({ behavior: 'smooth' });
    };
    const handleCancelEdit = () => { setEditingRecord(null); prepararProximoFormulario(registros); };
    const handleDelete = () => {
        const newRegistros = registros.filter(r => r.id !== recordToDelete);
        updateAllData({ ...allData, [selectedLote]: newRegistros });
        setRecordToDelete(null);
    };

    const handleExportPDF = (ref) => {
        const { html2canvas, jspdf } = window; if (!ref.current || !html2canvas || !jspdf) return;
        ref.current.style.backgroundColor = '#FFFFFF';
        html2canvas(ref.current, { scale: 2, backgroundColor: '#FFFFFF' }).then(canvas => {
            const imgData = canvas.toDataURL('image/png'); const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasRatio = canvas.width / canvas.height; let targetWidth = pdfWidth * 0.9;
            let targetHeight = targetWidth / canvasRatio;
            if (targetHeight > pdfHeight * 0.95) { targetHeight = pdfHeight * 0.95; targetWidth = targetHeight * canvasRatio; }
            const x = (pdfWidth - targetWidth) / 2; const y = 15;
            pdf.addImage(imgData, 'PNG', x, y, targetWidth, targetHeight); 
            pdf.save(`relatorio_lote_${selectedLote}.pdf`);
            ref.current.style.backgroundColor = '';
        });
    };
    const handleExportCSV = () => {
        if(registros.length === 0) { alert("Nenhum registro para exportar."); return; }
        const titleRow = `"Relatório para o Lote: ${selectedLote}"\n\n`;
        const headers = ["Mes/Ano", "Leitura Anterior (m³)", "Leitura Atual (m³)", "Consumo (m³)", "Consumo (litros)", "Tarifa (R$/m³)", "Custo Total (R$)"];
        const rows = registros.map(r => [ `"${r.mesAno.split('-').reverse().join('/')}"`, r.leituraAnterior, r.leituraAtual, r.consumo.toFixed(2), (r.consumo * 1000).toFixed(0), r.tarifa.toFixed(2), r.custo.toFixed(2) ]);
        let csvContent = "data:text/csv;charset=utf-8," + titleRow + headers.join(";") + "\n" + rows.map(e => e.join(";")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `historico_lote_${selectedLote}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };
    
    const handleReturnToSelection = () => {
        setSelectedLote(null);
        setLoteInput('');
        setView('selecao');
        if (isAdmin && onSwitchToDashboard) onSwitchToDashboard(false);
    };

    return (
        <div>
            {view === 'selecao' ? (
                <div className="p-6 bg-gray-100/80 rounded-xl mb-6">
                    <label htmlFor="lote-input" className="block text-xl font-bold text-gray-800 mb-2">Selecione o Lote</label>
                    <div className="flex items-center gap-3">
                        <input type="number" id="lote-input" value={loteInput} onChange={e => setLoteInput(e.target.value)} placeholder="Digite o número do lote" className="text-lg flex-grow p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800" />
                        <button onClick={() => handleCarregarLote()} className="text-lg bg-gray-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-700 transition-all shadow-md hover:shadow-lg">Carregar</button>
                    </div>
                </div>
            ) : view === 'analise' ? (
                <div>
                     <button onClick={() => setView('lancamento')} className="mb-6 bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300">← Voltar para Lançamentos</button>
                     <AnaliseView registros={registros} onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} selectedLote={selectedLote} />
                </div>
            ) : (
                 <div>
                    <div className="flex justify-between items-center mb-6 bg-gray-50/80 p-4 rounded-xl border">
                        <h1 className="text-2xl font-bold text-gray-800">Lote: <span className="text-gray-900">{selectedLote}</span></h1>
                        <button onClick={handleReturnToSelection} className="text-sm bg-white border border-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors">← Selecionar Outro Lote</button>
                    </div>
                    {registros.length === 0 && (<p className="mb-4 p-3 bg-yellow-100 text-yellow-800 text-sm rounded-md border border-yellow-200">Este lote ainda não possui registros.</p>)}
                    {isAdmin && (<div className="my-6 text-center"><button onClick={() => setView('analise')} className="bg-teal-500 text-white font-bold py-3 px-8 text-lg rounded-xl hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-lg">Ver Análise Detalhada</button></div>)}
                    <RegistroForm onSave={handleSave} editingRecord={editingRecord} onCancelEdit={handleCancelEdit} formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
                    <hr className="my-8 border-gray-200" /><h2 className="text-2xl font-semibold text-gray-800 mb-4">Histórico de Registros</h2>
                    {registros.length > 0 ? (<HistoricoTable registros={registros} onEdit={handleEdit} onDelete={setRecordToDelete} isAdmin={isAdmin} />) : (!editingRecord && <div className="text-center py-8"><p className="text-gray-500">Aguardando primeiro registro...</p></div>)}
                 </div>
             )}
             {recordToDelete && (
                 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/90 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl w-full max-w-sm mx-auto text-gray-800"><h3 className="text-lg font-medium">Confirmar Remoção</h3><p className="mt-2 text-sm text-gray-600">Tem certeza?</p><div className="mt-5 flex justify-end space-x-3"><button onClick={() => setRecordToDelete(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Remover</button></div></div>
                 </div>
            )}
        </div>
    );
};

// --- components/AppView.js ---
function AppView() {
    const { currentUser, logout } = useAppContext();
    const [activeTab, setActiveTab] = useState(currentUser.role === 'admin' ? 'dashboard' : 'lancamentos');
    const [loteToLoad, setLoteToLoad] = useState(null);
    
    const handleSelectLoteFromDashboard = (loteId) => {
        setLoteToLoad(loteId);
        setActiveTab('lancamentos');
    };

    useEffect(() => {
        if (activeTab !== 'lancamentos') setLoteToLoad(null);
    }, [activeTab]);

    return (
        <div className="w-full max-w-5xl mx-auto">
            <header className="mb-8 flex justify-between items-center px-4 md:px-0">
                <p className="text-lg text-gray-700">Bem-vindo, <span className="font-bold text-gray-900">{currentUser.username}</span> <span className="text-gray-500">({currentUser.role})</span></p>
                <button onClick={logout} className="text-base font-semibold text-red-600 flex items-center gap-2 bg-white/80 hover:bg-red-100 transition-all px-4 py-2 rounded-xl shadow-md border border-white/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    Sair
                </button>
            </header>
            <main className="bg-white/70 backdrop-blur-xl border border-white/20 p-6 md:p-8 rounded-3xl shadow-2xl">
                <div className="mb-8 border-b border-gray-200">
                    <nav className="flex justify-center -mb-px">
                        {currentUser.role === 'admin' && <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap py-4 px-6 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'dashboard' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>Dashboard</button>}
                        <button onClick={() => setActiveTab('lancamentos')} className={`whitespace-nowrap py-4 px-6 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'lancamentos' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>Lançamentos</button>
                    </nav>
                </div>
                {activeTab === 'dashboard' && currentUser.role === 'admin' && <DashboardView onSelectLote={handleSelectLoteFromDashboard} />}
                {activeTab === 'lancamentos' && <LoteManager key={loteToLoad} initialLote={loteToLoad} onSwitchToDashboard={() => setActiveTab('dashboard')} />}
            </main>
        </div>
    );
};

// --- Componente Raiz da Aplicação ---
export default function App() {
    return (
        <AppProvider>
            <Root />
        </AppProvider>
    );
}

const Root = () => {
    const { currentUser } = useAppContext();
    return (
         <div className="text-gray-800 min-h-screen p-4 sm:p-8 flex items-center justify-center bg-cover bg-center" style={{backgroundColor: '#D3D3D3'}}>
            {currentUser ? <AppView /> : <LoginView />}
            <style>{`
              @keyframes fade-in-scale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
              .animate-fade-in-scale { animation: fade-in-scale 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};
