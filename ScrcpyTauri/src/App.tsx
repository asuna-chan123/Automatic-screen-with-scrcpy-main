import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  Monitor,
  Smartphone,
  Wifi,
  ShieldCheck,
  Network,
  X,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface SavedDevice {
  name: string;
  turnScreenOff: boolean;
}

interface DeviceData {
  id: string;
  status: string;
  name: string;
  type: "USB" | "WiFi" | "VPN" | "Unknown";
  isConnected: boolean;
  turnScreenOff: boolean;
}

export default function App() {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [savedDevices, setSavedDevices] = useState<Record<string, SavedDevice>>({});
  const [search, setSearch] = useState("");
  
  // Host Info
  const [hostName, setHostName] = useState("DESKTOP-PC");
  const [hostIp, setHostIp] = useState("Unknown");

  // New IP Connection
  const [newIp, setNewIp] = useState("");

  // Editing Device Modal
  const [editingDevice, setEditingDevice] = useState<DeviceData | null>(null);
  const [editName, setEditName] = useState("");
  const [editTurnScreenOff, setEditTurnScreenOff] = useState(false);
  const [backendError, setBackendError] = useState("");
  
  const [isConnectingIp, setIsConnectingIp] = useState(false);
  const [connectIpError, setConnectIpError] = useState("");
  const [operatingDeviceId, setOperatingDeviceId] = useState<string | null>(null);
  const [screenLaunched, setScreenLaunched] = useState<Record<string, boolean>>({});

  const pollInterval = useRef<number | null>(null);

  useEffect(() => {
    loadHostInfo();
    loadSavedData();
    pollDevices();
    pollInterval.current = window.setInterval(pollDevices, 3000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const loadHostInfo = async () => {
    try {
      const [name, ip] = await invoke<[string, string]>("get_host_info");
      setHostName(name);
      setHostIp(ip);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSavedData = () => {
    try {
      const localData = localStorage.getItem("savedDevices");
      if (localData) {
        setSavedDevices(JSON.parse(localData));
      }
    } catch (e) {
      console.error("Failed to load local storage:", e);
    }
  };

  const saveToLocalStorage = (data: Record<string, SavedDevice>) => {
    setSavedDevices(data);
    localStorage.setItem("savedDevices", JSON.stringify(data));
  };

  const pollDevices = async () => {
    try {
      const adbDevices: [string, string][] = await invoke("get_adb_devices");
      
      setSavedDevices((currentSaved) => {
        const list: DeviceData[] = adbDevices.map(([id, status]) => {
          const isRemote = id.includes(":");
          let type: "USB" | "WiFi" | "VPN" | "Unknown" = isRemote ? "WiFi" : "USB";
          if (isRemote && id.startsWith("100.")) type = "VPN";
  
          const saved = currentSaved[id] || { name: id, turnScreenOff: false };

          return {
            id,
            status: status === "device" ? "Ready" : status,
            name: saved.name,
            type,
            isConnected: status === "device",
            turnScreenOff: saved.turnScreenOff
          };
        });

        Object.keys(currentSaved).forEach((savedId) => {
          if (!adbDevices.find(([id]) => id === savedId)) {
            list.push({
              id: savedId,
              status: "Offline",
              name: currentSaved[savedId].name,
              type: savedId.includes(":") ? (savedId.startsWith("100.") ? "VPN" : "WiFi") : "Unknown",
              isConnected: false,
              turnScreenOff: currentSaved[savedId].turnScreenOff
            });
          }
        });

        setDevices(list);
        setBackendError("");
        return currentSaved;
      });
    } catch (e: any) {
      console.error(e);
      setBackendError(String(e));
    }
  };

  const handleConnect = async (device: DeviceData) => {
    setOperatingDeviceId(device.id);
    if (!device.isConnected) {
      const [ip, port] = device.id.split(":");
      try {
        await invoke("connect_device", { ip, port: port || "5555" });
      } catch (e) {
        alert("Connect failed: " + e);
      }
    } else {
      try {
        await invoke("launch_scrcpy", { id: device.id, turnScreenOff: device.turnScreenOff });
        setScreenLaunched(prev => ({ ...prev, [device.id]: true }));
      } catch (e) {
        alert(e);
      }
    }
    pollDevices();
    setOperatingDeviceId(null);
  };

  const handleDisconnect = async (device: DeviceData) => {
    setOperatingDeviceId(device.id);
    try {
      await invoke("disconnect_device", { id: device.id });
      setScreenLaunched(prev => {
        const next = { ...prev };
        delete next[device.id];
        return next;
      });
      pollDevices();
    } catch (e) {
      alert("Disconnect failed: " + e);
    } finally {
      setOperatingDeviceId(null);
    }
  };

  const handleConnectNewIp = async () => {
    if (!newIp.trim()) return;
    
    setIsConnectingIp(true);
    setConnectIpError("");
    
    const parts = newIp.trim().split(":");
    const ip = parts[0];
    const port = parts[1] || "5555";
    try {
      await invoke("connect_device", { ip, port });
      pollDevices();
    } catch (e) {
      setConnectIpError(String(e));
    } finally {
      setIsConnectingIp(false);
    }
  };

  // CRUD Actions
  const handleSaveEdit = () => {
    if (!editingDevice) return;
    const newData = { ...savedDevices };
    newData[editingDevice.id] = {
      name: editName.trim() || editingDevice.id,
      turnScreenOff: editTurnScreenOff
    };
    saveToLocalStorage(newData);
    setEditingDevice(null);
    pollDevices();
  };

  const handleDelete = async () => {
    if (!editingDevice) return;
    if (confirm(`Remove device ${editingDevice.name}?`)) {
      if (editingDevice.id.includes(":")) {
        await invoke("disconnect_device", { id: editingDevice.id });
      }
      const newData = { ...savedDevices };
      delete newData[editingDevice.id];
      saveToLocalStorage(newData);
      setEditingDevice(null);
      pollDevices();
    }
  };

  const handleAutoWifi = async () => {
    if (!editingDevice) return;
    try {
      const ip: string = await invoke("get_device_ip", { id: editingDevice.id });
      if (ip) {
        await invoke("enable_tcpip", { id: editingDevice.id, port: "5555" });
        await new Promise((r) => setTimeout(r, 2000));
        await invoke("connect_device", { ip, port: "5555" });
        
        const newSavedId = `${ip}:5555`;
        const newData = { ...savedDevices };
        // copy settings from USB to WiFi
        newData[newSavedId] = {
          name: savedDevices[editingDevice.id]?.name || editingDevice.name,
          turnScreenOff: savedDevices[editingDevice.id]?.turnScreenOff || false
        };
        saveToLocalStorage(newData);
        
        alert(`Connected to WiFi IP: ${ip}`);
        setEditingDevice(null);
        pollDevices();
      }
    } catch (e) {
      alert("Auto WiFi failed: " + e);
    }
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-gray-200 font-sans flex flex-col items-center">
      <div className="w-full max-w-7xl p-8 flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-wide text-white">Devices</h1>
          <p className="text-gray-400 text-sm">
            Connect to your mobile devices in low latency desktop mode.
          </p>
          
          <div className="flex items-center justify-between mt-4 border-b border-[#3f3f46] pb-4">
            <div className="flex items-center bg-[#141517] border border-[#2a2b2f] rounded px-3 py-2 w-80">
              <Search size={18} className="text-gray-500 mr-2" />
              <input
                type="text"
                placeholder="Search Hosts and Computers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-500"
              />
            </div>
            <button 
              onClick={pollDevices}
              className="text-xs font-bold tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              RELOAD
            </button>
          </div>
          {backendError && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded text-sm break-all">
              <strong>Error:</strong> {backendError}
            </div>
          )}
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {/* Card 1: Host PC */}
          <div className="bg-[#25262b] border border-[#3f3f46] flex flex-col min-h-[280px]">
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 text-blue-300">
                <Monitor size={56} strokeWidth={1} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1 truncate w-full px-4">{hostName}</h2>
              <p className="text-sm text-gray-400">This Computer</p>
            </div>
            <div className="p-4 border-t border-[#3f3f46]">
              <button 
                onClick={() => alert(`Your local IP Address is: ${hostIp}`)}
                className="w-full bg-[#93c5fd] hover:bg-[#60a5fa] text-[#1a1b1e] font-bold py-3 uppercase text-xs tracking-widest transition-colors"
              >
                SHARE IP
              </button>
            </div>
          </div>

          {/* Cards 2..N: Devices */}
          {filteredDevices.map((device) => (
            <div key={device.id} className="bg-[#25262b] border border-[#3f3f46] flex flex-col min-h-[280px]">
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
                <div className={`mb-4 ${
                  device.type === "USB" ? "text-purple-400" :
                  device.type === "VPN" ? "text-emerald-400" :
                  "text-blue-400"
                }`}>
                  {device.type === "USB" ? <Smartphone size={56} strokeWidth={1} /> :
                   device.type === "VPN" ? <ShieldCheck size={56} strokeWidth={1} /> :
                   <Wifi size={56} strokeWidth={1} />}
                </div>
                <h2 className="text-xl font-bold text-white mb-1 truncate w-full px-4" title={device.name}>
                  {device.name}
                </h2>
                <p className={`text-sm flex flex-col items-center justify-center gap-1 ${device.status === "Ready" ? "text-emerald-400" : "text-gray-400"}`}>
                  <span>{device.status === "Ready" ? "Ready to connect" : "Offline"}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded uppercase">
                    Via {device.type}
                  </span>
                </p>
              </div>
              <div className="p-4 border-t border-[#3f3f46] flex gap-2">
                {device.isConnected ? (
                  screenLaunched[device.id] && device.id.includes(":") ? (
                    <button 
                      onClick={() => handleDisconnect(device)}
                      disabled={operatingDeviceId === device.id}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 disabled:bg-red-900/10 disabled:text-red-900 disabled:cursor-not-allowed text-red-400 font-bold py-3 uppercase text-xs tracking-widest transition-colors border border-transparent hover:border-red-500/50 flex justify-center items-center gap-2"
                    >
                      {operatingDeviceId === device.id ? (
                        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      {operatingDeviceId === device.id ? "DISCONNECTING..." : "DISCONNECT"}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleConnect(device)}
                      disabled={operatingDeviceId === device.id}
                      className="flex-1 bg-[#2a2b2f] hover:bg-[#3f3f46] disabled:bg-[#3f3f46] disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 uppercase text-xs tracking-widest transition-colors border border-transparent hover:border-gray-500 flex justify-center items-center gap-2"
                    >
                      {operatingDeviceId === device.id ? (
                        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      {operatingDeviceId === device.id ? "OPENING..." : "SCREEN"}
                    </button>
                  )
                ) : (
                  <button 
                    onClick={() => handleConnect(device)}
                    disabled={operatingDeviceId === device.id}
                    className="flex-1 bg-[#2a2b2f] hover:bg-[#3f3f46] disabled:bg-[#3f3f46] disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 uppercase text-xs tracking-widest transition-colors border border-transparent hover:border-gray-500 flex justify-center items-center gap-2"
                  >
                    {operatingDeviceId === device.id ? (
                      <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : null}
                    {operatingDeviceId === device.id ? "CONNECTING..." : "CONNECT"}
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    setEditingDevice(device);
                    setEditName(device.name);
                    setEditTurnScreenOff(device.turnScreenOff);
                  }}
                  className="px-3 bg-[#2a2b2f] hover:bg-[#3f3f46] text-gray-300 font-bold uppercase text-xs tracking-widest transition-colors border border-transparent hover:border-gray-500 flex items-center justify-center"
                >
                  EDIT
                </button>
              </div>
            </div>
          ))}

          {/* Last Card: Add IP */}
          <div className="bg-[#25262b] border border-[#3f3f46] flex flex-col min-h-[280px]">
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <h2 className="text-xl font-bold text-white mb-3">Connect to IP</h2>
              <p className="text-sm text-gray-400 mb-6 px-4">
                Enter details for manual connection.
              </p>
              <div className="w-full flex items-center bg-[#1a1b1e] border border-[#3f3f46] px-3 py-2">
                <Network size={16} className="text-gray-500 mr-2" />
                <input
                  type="text"
                  placeholder="Enter IP Address"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  disabled={isConnectingIp}
                  className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-500 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConnectNewIp();
                    }
                  }}
                />
              </div>
              {connectIpError && (
                <div className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-sm w-full break-words text-left max-h-24 overflow-y-auto">
                  {connectIpError}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#3f3f46]">
              <button 
                onClick={handleConnectNewIp}
                disabled={isConnectingIp || !newIp.trim()}
                className="w-full bg-[#93c5fd] hover:bg-[#60a5fa] disabled:bg-[#3f3f46] disabled:text-gray-400 disabled:cursor-not-allowed text-[#1a1b1e] font-bold py-3 uppercase text-xs tracking-widest transition-colors flex justify-center items-center gap-2"
              >
                {isConnectingIp ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    CONNECTING...
                  </>
                ) : (
                  "CONNECT"
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#25262b] border border-[#3f3f46] w-full max-w-md shadow-2xl rounded-sm">
            <div className="flex items-center justify-between p-4 border-b border-[#3f3f46]">
              <h3 className="text-lg font-bold text-white">Edit Device Settings</h3>
              <button onClick={() => setEditingDevice(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              
              {/* Form Input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">Device Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#1a1b1e] border border-[#3f3f46] px-4 py-3 outline-none focus:border-[#93c5fd] text-white transition-colors rounded-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">Device ID / IP</label>
                <input
                  type="text"
                  value={editingDevice.id}
                  readOnly
                  className="w-full bg-[#141517] border border-[#3f3f46] px-4 py-3 outline-none text-gray-500 cursor-not-allowed rounded-sm"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 bg-[#1a1b1e] border border-[#3f3f46] p-4 rounded-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Turn Screen Off</h4>
                    <p className="text-xs text-gray-500">Automatically turn off phone screen when streaming</p>
                  </div>
                  <button 
                    onClick={() => setEditTurnScreenOff(!editTurnScreenOff)}
                    className={`transition-colors ${editTurnScreenOff ? "text-blue-400" : "text-gray-500"}`}
                  >
                    {editTurnScreenOff ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={handleSaveEdit}
                  className="w-full bg-[#93c5fd] hover:bg-[#60a5fa] text-[#1a1b1e] font-bold py-3 uppercase text-xs tracking-widest transition-colors rounded-sm shadow-md shadow-blue-500/10"
                >
                  SAVE CHANGES
                </button>
                {editingDevice.type === "USB" && (
                  <button 
                    onClick={handleAutoWifi}
                    className="w-full bg-[#2a2b2f] hover:bg-[#3f3f46] text-white font-bold py-3 uppercase text-xs tracking-widest transition-colors border border-[#3f3f46] rounded-sm"
                  >
                    ENABLE AUTO WIFI
                  </button>
                )}
                <button 
                  onClick={handleDelete}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-3 uppercase text-xs tracking-widest transition-colors border border-red-500/20 mt-2 rounded-sm"
                >
                  REMOVE DEVICE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
