import React, { useState, useEffect, useRef } from 'react';
import { Star, Diamond, Gift, Clock, Droplets, Ticket, ChevronDown, PackageOpen, History, Wallet } from 'lucide-react';
import { ethers } from 'ethers'; 

// === SETUP SMART CONTRACT ===
const CONTRACT_ADDRESS = "0x1FE90594a49c527e30fa0EB1186A8E48a9Cd3De4"; 

const CONTRACT_ABI = [
  "function getPlayerPityCounter(address player, uint256 bannerId) view returns (uint256)",
  "function getPullHistory(address player) view returns (tuple(uint256 bannerId, string rewardResult, uint256 timestamp)[])",
  "function recordGachaPull(address player, uint256 bannerId, string rewardName, bool isRareReward)",
  "function recordBatchGachaPull(address player, uint256 bannerId, string[] rewardNames, bool[] isRareRewards)", 
  "function registerPlayer(address player, string username)",
  "function createBanner(uint256 bannerId, string name, string gachaType, uint256 cost)"
];
// ==========================

const HEROES = [
  "Aliceth", "Alna", "Aster", "Athalia", "Aurora", "Baelran", "Berial", 
  "Contess", "Cryonaia", "Dionel", "Dunlingr", "Elijah & Lailah", "Gunnar", 
  "Harak", "Kulu", "Lamentis", "Mehira", "Phraesto", "Reinier", "Rolan", 
  "Saida", "Scarlita", "Sylphira", "Talene"
];

const REWARD_POOLS = [
  { id: 'hero', name: 'Selected Hero', rate: 3.25, type: 'hero' },
  { id: 'temp_ess_5', name: 'Temporal Essence x5', rate: 0.5, type: 'item' },
  { id: 'temp_ess_1', name: 'Temporal Essence x1', rate: 3.0, type: 'item' },
  { id: 'tidal_ess_5', name: 'Tidal Essence x5', rate: 10.0, type: 'item' },
  { id: 'tidal_ess_1', name: 'Tidal Essence x1', rate: 20.0, type: 'item' },
  { id: 'diamond_9999', name: 'Diamond x9,999', rate: 0.1, type: 'currency' },
  { id: 'diamond_6666', name: 'Diamond x6,666', rate: 0.25, type: 'currency' },
  { id: 'diamond_3000', name: 'Diamond x3,000', rate: 0.5, type: 'currency' },
  { id: 'acorn_4', name: 'Omni-Acorn x4', rate: 20.59, type: 'acorn' },
  { id: 'acorn_2', name: 'Omni-Acorn x2', rate: 41.81, type: 'acorn' }
];

const MAX_PITY = 40;
const BANNER_ID = 1; 

export default function App() {
  const [selectedHero, setSelectedHero] = useState('Talene');
  const [pityCounter, setPityCounter] = useState(0);
  const [dollyTickets, setDollyTickets] = useState(0);
  const [savedRewards, setSavedRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [latestPulls, setLatestPulls] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // === STATE WEB3 ===
  const [walletAddress, setWalletAddress] = useState("");
  const [contract, setContract] = useState(null);
  const [isPulling, setIsPulling] = useState(false);
  
  const [inventory, setInventory] = useState({
    heroes: {},
    items: {
      'Temporal Essence': 0,
      'Tidal Essence': 0,
      'Diamond': 0,
      'Omni-Acorn': 0
    }
  });

  const [searchAddress, setSearchAddress] = useState("");
  const [viewingAddress, setViewingAddress] = useState("");

  const historyEndRef = useRef(null);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  
  const getRewardType = (name) => {
    if (HEROES.includes(name)) return 'hero';
    if (name.includes('Diamond')) return 'currency';
    if (name.includes('Acorn')) return 'acorn';
    return 'item';
  };

  // === FUNGSI KONEKSI METAMASK ===
  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        setViewingAddress(address); 

        const veriDropContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(veriDropContract);

        // Tarik data Pity
        const initialPity = await veriDropContract.getPlayerPityCounter(address, BANNER_ID);
        setPityCounter(Number(initialPity));

        // Tarik data Pull History dari Blockchain
        const rawHistory = await veriDropContract.getPullHistory(address);
        const formattedHistory = rawHistory.map((pull, index) => ({
          id: Number(pull.timestamp) + index, // Bikin ID unik
          reward: {
            name: pull.rewardResult,
            type: getRewardType(pull.rewardResult)
          }
        }));
        setHistory(formattedHistory);

      } catch (error) {
        console.error("Gagal connect MetaMask:", error);
        alert("Gagal konek ke MetaMask.");
      }
    } else {
      alert("Tolong install MetaMask dulu!");
    }
  };

  const searchPlayer = async () => {
    if (!contract) {
      alert("Harap connect MetaMask terlebih dahulu untuk membaca blockchain!");
      return;
    }
    
    // Validasi format alamat
    if (!ethers.isAddress(searchAddress)) {
      alert("Format alamat dompet tidak valid!");
      return;
    }

    try {
      // Tarik data Pity orang lain (Read-only, gratis tanpa gas fee)
      const searchedPity = await contract.getPlayerPityCounter(searchAddress, BANNER_ID);
      setPityCounter(Number(searchedPity));

      // Tarik riwayat Gacha orang lain
      const rawHistory = await contract.getPullHistory(searchAddress);
      const formattedHistory = rawHistory.map((pull, index) => ({
        id: Number(pull.timestamp) + index,
        reward: {
          name: pull.rewardResult,
          type: getRewardType(pull.rewardResult)
        }
      }));
      
      setHistory(formattedHistory);
      setViewingAddress(searchAddress);
      alert(`Sukses menarik data milik: ${searchAddress.substring(0,8)}...`);
    } catch (error) {
      console.error("Gagal menarik data:", error);
      alert("Gagal. Pastikan alamat terdaftar di jaringan.");
    }
  };

  const setupContract = async () => {
    if (!contract || !walletAddress) {
      alert("Harap connect MetaMask terlebih dahulu!");
      return;
    }
    
    alert("Proses Setup dimulai. Cek popup MetaMask kamu ya!");

    
    try {
      console.log("Membuka Banner...");
      const tx1 = await contract.createBanner(BANNER_ID, "Stargaze Event", "Special", 150);
      await tx1.wait();
      console.log("Banner sukses dibuka!");
    } catch (error) {
      console.log("Info: Banner sepertinya sudah ada, melompat ke pendaftaran...");
    }
    
    
    try {
      console.log("Mendaftar Player...");
      const tx2 = await contract.registerPlayer(walletAddress, "Player_Web3");
      await tx2.wait();
      alert("Setup Selesai! Kamu sekarang sudah terdaftar. Silakan gas Pull Gacha!");
    } catch (error) {
      // Cek apakah error-nya karena memang sudah daftar
      if (error.reason && error.reason.includes("Pemain sudah terdaftar")) {
        alert("Aman! Kamu sudah terdaftar sebelumnya. Langsung gas pencet Pull Gacha aja!");
      } else {
        console.error("Gagal daftar:", error);
        alert("Gagal mendaftar player. Cek console untuk detailnya.");
      }
    }
  };

  const getBaseRoll = () => {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const reward of REWARD_POOLS) {
      cumulative += reward.rate;
      if (rand <= cumulative) return reward;
    }
    return REWARD_POOLS[REWARD_POOLS.length - 1];
  };

  const processPull = (currentPity, currentSavedRewards) => {
    const baseRoll = getBaseRoll();
    let finalReward = null;
    let isPityTriggered = false;
    let newSavedRewards = [...currentSavedRewards];
    let newPity = currentPity + 1;
    let replacedReward = false;

    if (newPity >= MAX_PITY) {
      isPityTriggered = true;
      finalReward = { ...REWARD_POOLS[0], name: selectedHero };
      newPity = 0;
      if (baseRoll.type !== 'acorn') {
        const rollName = baseRoll.id === 'hero' ? selectedHero : baseRoll.name;
        newSavedRewards.push({ ...baseRoll, name: rollName });
      }
    } else {
      if (baseRoll.id === 'hero') {
        finalReward = { ...baseRoll, name: selectedHero };
        newPity = 0;
      } else if (baseRoll.type === 'acorn' && currentSavedRewards.length > 0) {
        finalReward = newSavedRewards.shift();
        replacedReward = true;
      } else {
        finalReward = { ...baseRoll };
      }
    }

    return { reward: finalReward, newPity, newSavedRewards, isPityTriggered, replacedReward, baseRollType: baseRoll.type };
  };

  const updateInventory = (reward) => {
    setInventory(prev => {
      const newInv = { ...prev, heroes: { ...prev.heroes }, items: { ...prev.items } };
      if (reward.type === 'hero') {
        newInv.heroes[reward.name] = (newInv.heroes[reward.name] || 0) + 1;
      } else {
        if (reward.name.includes('Temporal Essence')) {
          newInv.items['Temporal Essence'] += parseInt(reward.name.split('x')[1]);
        } else if (reward.name.includes('Tidal Essence')) {
          newInv.items['Tidal Essence'] += parseInt(reward.name.split('x')[1]);
        } else if (reward.name.includes('Diamond')) {
          newInv.items['Diamond'] += parseInt(reward.name.split('x')[1].replace(',', ''));
        } else if (reward.name.includes('Omni-Acorn')) {
          newInv.items['Omni-Acorn'] += parseInt(reward.name.split('x')[1]);
        }
      }
      return newInv;
    });
  };

  const handlePull = async (times) => {
    if (!contract || !walletAddress) {
      alert("Harap connect MetaMask terlebih dahulu!");
      return;
    }

    setIsPulling(true);
    let currentPity = pityCounter;
    let currentSaved = [...savedRewards];
    const pullResults = [];
    
    
    const rewardNamesForBlockchain = [];
    const isRareForBlockchain = [];

    
    for (let i = 0; i < times; i++) {
      const result = processPull(currentPity, currentSaved);
      currentPity = result.newPity;
      currentSaved = result.newSavedRewards;
      
      const pullData = {
        id: Date.now() + i,
        reward: result.reward,
        pityHit: result.isPityTriggered,
        wasReplaced: result.replacedReward
      };

      pullResults.push(pullData);
      
      
      rewardNamesForBlockchain.push(result.reward.name);
      isRareForBlockchain.push(result.reward.type === 'hero');
    }

    try {
      let tx;
      
      
      if (times === 1) {
        
        tx = await contract.recordGachaPull(
          walletAddress, 
          BANNER_ID, 
          rewardNamesForBlockchain[0], 
          isRareForBlockchain[0]
        );
      } else {
        
        tx = await contract.recordBatchGachaPull(
          walletAddress, 
          BANNER_ID, 
          rewardNamesForBlockchain, 
          isRareForBlockchain
        );
      }
      
      
      await tx.wait();

      
      pullResults.forEach(p => updateInventory(p.reward));
      setSavedRewards(currentSaved);
      setDollyTickets(prev => prev + (15 * times));
      setLatestPulls(pullResults);
      setHistory(prev => [...prev, ...pullResults]);
      setShowResults(true);

      
      const updatedPity = await contract.getPlayerPityCounter(walletAddress, BANNER_ID);
      setPityCounter(Number(updatedPity));

    } catch (error) {
      console.error("Transaksi batal/error:", error);
      alert("Transaksi dibatalkan atau error.");
    } finally {
      setIsPulling(false);
    }
  };

  const renderIcon = (type, name) => {
    if (type === 'hero') return <Star className="text-yellow-400" size={20} />;
    if (name.includes('Diamond')) return <Diamond className="text-cyan-300" size={20} />;
    if (name.includes('Temporal')) return <Clock className="text-orange-300" size={20} />;
    if (name.includes('Tidal')) return <Droplets className="text-blue-300" size={20} />;
    if (name.includes('Acorn')) return <PackageOpen className="text-amber-600" size={20} />;
    return <Gift className="text-purple-400" size={20} />;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      
      <div className="max-w-6xl mx-auto flex justify-end mb-4 gap-4">
        {/* TOMBOL SETUP (Hanya muncul kalau sudah connect MetaMask) */}
        {walletAddress && (
          <button 
            onClick={setupContract}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg"
          >
            🛠️ Admin: Buka Banner & Daftar
          </button>
        )}

        <button 
          onClick={connectWallet}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${walletAddress ? 'bg-green-600/20 text-green-400 border border-green-500/50' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg'}`}
        >
          <Wallet size={18} />
          {walletAddress 
            ? `Connected: ${walletAddress.substring(0,6)}...${walletAddress.substring(walletAddress.length - 4)}` 
            : 'Connect MetaMask'}
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Star size={120} />
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
              Stargaze Station
            </h1>
            <p className="text-slate-400 text-sm mb-6">Web3 Gacha Simulation (VeriDrop Smart Contract)</p>
            {/* === FITUR AUDIT KOMUNITAS === */}
            <div className="bg-slate-900/60 rounded-xl p-4 mb-8 border border-slate-700/50">
              <label className="block text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">
                Public Audit: Cari Data Pemain Lain
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Masukkan alamat dompet (0x...)" 
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button 
                  onClick={searchPlayer}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all"
                >
                  Cari
                </button>
              </div>
              
              {/* Peringatan jika sedang melihat data orang lain */}
              {viewingAddress && viewingAddress !== walletAddress && (
                <div className="mt-3 text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded border border-yellow-700/50 flex justify-between items-center">
                  <span>⚠️ Menampilkan Pity & History milik: <span className="font-mono">{viewingAddress.substring(0,6)}...{viewingAddress.substring(viewingAddress.length - 4)}</span></span>
                  <button 
                    onClick={connectWallet} 
                    className="text-blue-400 hover:text-blue-300 underline font-semibold"
                  >
                    Kembali ke Akunku
                  </button>
                </div>
              )}
            </div>
            {/* ============================= */}

            <div className="flex flex-col md:flex-row gap-4 items-end mb-8 relative z-10">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-300 mb-2">Selected Hero</label>
                <div className="relative">
                  <select 
                    value={selectedHero}
                    onChange={(e) => setSelectedHero(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    {HEROES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg px-6 py-3 border border-slate-700 flex flex-col items-center justify-center min-w-[140px]">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Blockchain Pity</span>
                <div className="text-2xl font-bold text-yellow-400">
                  {pityCounter} <span className="text-slate-500 text-sm">/ 40</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 relative z-10">
              <button 
                onClick={() => handlePull(1)}
                disabled={isPulling || !walletAddress}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Star size={18} /> {isPulling ? "Tx Pending..." : "Pull 1x"}
              </button>
              <button 
                onClick={() => handlePull(10)}
                disabled={isPulling || !walletAddress}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] flex items-center justify-center gap-2"
              >
                <Star size={18} className="fill-current" /> {isPulling ? "Tx Pending..." : "Pull 10x"}
              </button>
            </div>
            
            {savedRewards.length > 0 && (
              <div className="mt-4 text-xs text-orange-300 bg-orange-900/20 p-2 rounded border border-orange-800/50">
                Guarantee Saved Queue: {savedRewards.map(r => r.name).join(', ')}
              </div>
            )}
          </div>

          {showResults && (
            <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Latest Pull Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {latestPulls.map(pull => (
                  <div key={pull.id} className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center aspect-square ${pull.reward.type === 'hero' ? 'bg-yellow-900/30 border-yellow-500/50' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="mb-2">{renderIcon(pull.reward.type, pull.reward.name)}</div>
                    <span className={`text-xs font-medium ${pull.reward.type === 'hero' ? 'text-yellow-400' : 'text-slate-300'}`}>{pull.reward.name}</span>
                    {pull.pityHit && <span className="text-[10px] text-orange-400 mt-1 bg-orange-900/50 px-1.5 rounded">Pity</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-4 text-yellow-400">
              <Ticket size={24} />
              <h2 className="text-xl font-bold text-white">Inventory</h2>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-between mb-4 border border-slate-700">
              <span className="text-slate-400 font-medium text-sm">Dolly Tickets</span>
              <span className="text-lg font-bold text-pink-400">{dollyTickets}</span>
            </div>

            <div className="space-y-3">
              {Object.entries(inventory.items).map(([item, count]) => (
                <div key={item} className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
                  <span className="text-slate-300 flex items-center gap-2">{renderIcon('item', item)} {item}</span>
                  <span className="font-mono text-slate-100">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {Object.keys(inventory.heroes).length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Heroes Pulled</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(inventory.heroes).map(([hero, count]) => (
                    <div key={hero} className="bg-slate-700 rounded px-2 py-1 text-xs text-yellow-300 border border-slate-600 flex items-center gap-1">
                      {hero} <span className="bg-slate-800 text-slate-300 px-1 rounded-full">x{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex-1 flex flex-col max-h-[400px]">
            <div className="flex items-center gap-2 mb-4 text-slate-400 border-b border-slate-700 pb-3">
              <History size={20} />
              <h2 className="text-lg font-bold text-white">Pull History</h2>
            </div>
            <div className="overflow-y-auto flex-1 pr-2 space-y-2">
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm text-center italic mt-10">No pulls yet.</p>
              ) : (
                history.map((h, i) => (
                  <div key={h.id} className="text-xs flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-700/50">
                    <span className="text-slate-500 w-8">#{i + 1}</span>
                    <span className={`flex-1 ${h.reward.type === 'hero' ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>{h.reward.name}</span>
                  </div>
                ))
              )}
              <div ref={historyEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}