import { useState, useEffect } from 'react';
import { Activity, Plus, RefreshCw, Trash2, ExternalLink, AlertCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Domain {
  id: string;
  url: string;
  name: string;
  status: 'up' | 'down' | 'warning' | 'checking' | 'unknown';
  responseTime?: number;
  lastChecked?: number;
  statusCode?: number;
}

export default function App() {
  const [domains, setDomains] = useState<Domain[]>(() => {
    const saved = localStorage.getItem('domain-monitor-list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      { id: '1', url: 'https://google.com', name: 'Google', status: 'unknown' },
      { id: '2', url: 'https://github.com', name: 'GitHub', status: 'unknown' },
    ];
  });

  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  useEffect(() => {
    localStorage.setItem('domain-monitor-list', JSON.stringify(domains));
  }, [domains]);

  const checkDomain = async (domain: Domain): Promise<Domain> => {
    const startTime = Date.now();
    try {
      const urlToFetch = domain.url.startsWith('http') ? domain.url : `https://${domain.url}`;
      // Using a CORS proxy to allow client-side fetching
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlToFetch)}`;
      
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      const responseTime = Date.now() - startTime;
      const actualResponseTime = data.status?.response_time || responseTime;
      
      if (data.status && data.status.http_code >= 200 && data.status.http_code < 400) {
        // Warning state if response time is over 1000ms
        const isWarning = actualResponseTime > 1000;
        
        return { 
          ...domain, 
          status: isWarning ? 'warning' : 'up', 
          responseTime: actualResponseTime, 
          statusCode: data.status.http_code,
          lastChecked: Date.now()
        };
      } else {
        return { 
          ...domain, 
          status: 'down', 
          responseTime: 0, 
          statusCode: data.status?.http_code || 0,
          lastChecked: Date.now()
        };
      }
    } catch (error) {
      return { 
        ...domain, 
        status: 'down', 
        responseTime: 0, 
        statusCode: 0,
        lastChecked: Date.now()
      };
    }
  };

  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    
    // Set all to checking
    setDomains(prev => prev.map(d => ({ ...d, status: 'checking' })));
    
    // Check all concurrently
    const promises = domains.map(async (domain) => {
      const updatedDomain = await checkDomain(domain);
      setDomains(prev => prev.map(d => d.id === updatedDomain.id ? updatedDomain : d));
    });
    
    await Promise.allSettled(promises);
    setIsCheckingAll(false);
  };

  const handleCheckSingle = async (id: string) => {
    const domainToCheck = domains.find(d => d.id === id);
    if (!domainToCheck) return;
    
    setDomains(prev => prev.map(d => d.id === id ? { ...d, status: 'checking' } : d));
    const updatedDomain = await checkDomain(domainToCheck);
    setDomains(prev => prev.map(d => d.id === id ? updatedDomain : d));
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    
    let formattedUrl = newUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    const newDomain: Domain = {
      id: Date.now().toString(),
      url: formattedUrl,
      name: newName.trim() || formattedUrl.replace(/^https?:\/\//, ''),
      status: 'unknown'
    };
    
    setDomains(prev => [...prev, newDomain]);
    setNewUrl('');
    setNewName('');
    
    // Check the new domain immediately
    handleCheckSingle(newDomain.id);
  };

  const handleDeleteDomain = (id: string) => {
    setDomains(prev => prev.filter(d => d.id !== id));
  };

  // Initial check on load
  useEffect(() => {
    const hasUnknown = domains.some(d => d.status === 'unknown');
    if (hasUnknown && !isCheckingAll) {
      handleCheckAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upCount = domains.filter(d => d.status === 'up').length;
  const warningCount = domains.filter(d => d.status === 'warning').length;
  const downCount = domains.filter(d => d.status === 'down').length;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-200">
      <div className="max-w-5xl mx-auto px-4 py-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                <Activity size={24} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Domain Status Monitor</h1>
            </div>
            <p className="text-neutral-500 max-w-md">
              Monitor your domains and services. Green for normal, yellow for warnings (slow response), and red for errors.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-neutral-100">
            <div className="text-center px-4 border-r border-neutral-100">
              <div className="text-2xl font-semibold text-neutral-900">{domains.length}</div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center px-4 border-r border-neutral-100">
              <div className="text-2xl font-semibold text-emerald-600">{upCount}</div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Normal</div>
            </div>
            <div className="text-center px-4 border-r border-neutral-100">
              <div className="text-2xl font-semibold text-amber-500">{warningCount}</div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Warning</div>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-semibold text-rose-600">{downCount}</div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Error</div>
            </div>
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <form onSubmit={handleAddDomain} className="flex-1 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Domain Name (e.g. My Website)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-4 py-3 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <input
              type="text"
              placeholder="URL (e.g. example.com)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} />
              <span>Add Domain</span>
            </button>
          </form>
          
          <button
            onClick={handleCheckAll}
            disabled={isCheckingAll || domains.length === 0}
            className="px-6 py-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw size={18} className={isCheckingAll ? "animate-spin" : ""} />
            <span>{isCheckingAll ? 'Checking All...' : 'Check All Domains'}</span>
          </button>
        </div>

        {/* Domain List */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          {domains.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">
              <Activity size={48} className="mx-auto mb-4 opacity-20" />
              <p>No domains added yet. Add one above to start monitoring.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              <AnimatePresence mode="popLayout">
                {domains.map((domain) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={domain.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {domain.status === 'up' && (
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" title="Normal">
                            <CheckCircle2 size={20} />
                          </div>
                        )}
                        {domain.status === 'warning' && (
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center" title="Warning (Slow Response)">
                            <AlertTriangle size={20} />
                          </div>
                        )}
                        {domain.status === 'down' && (
                          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center" title="Error">
                            <AlertCircle size={20} />
                          </div>
                        )}
                        {domain.status === 'checking' && (
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center" title="Checking...">
                            <RefreshCw size={20} className="animate-spin" />
                          </div>
                        )}
                        {domain.status === 'unknown' && (
                          <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center" title="Unknown">
                            <Clock size={20} />
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900">{domain.name}</h3>
                          {domain.statusCode ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              domain.statusCode >= 200 && domain.statusCode < 400 
                                ? domain.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700' 
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {domain.statusCode}
                            </span>
                          ) : null}
                        </div>
                        <a 
                          href={domain.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-neutral-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                        >
                          {domain.url}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                      <div className="flex flex-col items-start sm:items-end text-sm">
                        {domain.status === 'checking' ? (
                          <span className="text-neutral-400">Checking...</span>
                        ) : domain.status !== 'unknown' ? (
                          <>
                            <span className={`font-medium ${domain.status === 'warning' ? 'text-amber-600' : 'text-neutral-900'}`}>
                              {domain.responseTime ? `${domain.responseTime}ms` : '-'}
                            </span>
                            <span className="text-neutral-400 text-xs flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {domain.lastChecked ? new Date(domain.lastChecked).toLocaleString() : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-neutral-400">Not checked yet</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCheckSingle(domain.id)}
                          disabled={domain.status === 'checking'}
                          className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Check status manually"
                        >
                          <RefreshCw size={18} className={domain.status === 'checking' ? "animate-spin" : ""} />
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete domain"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
