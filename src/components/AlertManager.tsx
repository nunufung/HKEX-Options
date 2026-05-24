import React, { useState } from 'react';
import { Bell, BellOff, Settings2, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertSettings, DEFAULT_ALERT_SETTINGS } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AlertManagerProps {
  alerts: Alert[];
  settings: AlertSettings;
  onUpdateSettings: (settings: AlertSettings) => void;
  onClearAlerts: () => void;
  onMarkAsRead: (id: string) => void;
}

export default function AlertManager({ alerts, settings, onUpdateSettings, onClearAlerts, onMarkAsRead }: AlertManagerProps) {
  const [showSettings, setShowSettings] = useState(false);

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-emerald-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] flex items-center justify-center rounded-full font-bold animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <h3 className="text-xs font-bold uppercase text-slate-500">即時警報與通知</h3>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={cn("p-1.5 rounded transition-colors", showSettings ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:text-emerald-500")}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={onClearAlerts}
            className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-950/50 border-b border-slate-800"
          >
            <div className="p-4 space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Settings2 className="w-3 h-3" />
                警報通知閾值篩選器
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">停利目標偏好 (%)</label>
                  <input 
                    type="number" 
                    value={settings.profitTarget * 100}
                    onChange={(e) => onUpdateSettings({ ...settings, profitTarget: parseFloat(e.target.value) / 100 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">最大止損比率 (%)</label>
                  <input 
                    type="number" 
                    value={Math.abs(settings.lossLimit * 100)}
                    onChange={(e) => onUpdateSettings({ ...settings, lossLimit: -Math.abs(parseFloat(e.target.value) / 100) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">到期天數警示 (DTE)</label>
                  <input 
                    type="number" 
                    value={settings.dteThreshold}
                    onChange={(e) => onUpdateSettings({ ...settings, dteThreshold: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">最低評分警報臨界值</label>
                  <input 
                    type="number" 
                    value={settings.minScore}
                    onChange={(e) => onUpdateSettings({ ...settings, minScore: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">最低隱含波動率 IV (%)</label>
                  <input 
                    type="number" 
                    value={settings.minIV * 100}
                    onChange={(e) => onUpdateSettings({ ...settings, minIV: parseFloat(e.target.value) / 100 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">最低波動率百分位 IVR</label>
                  <input 
                    type="number" 
                    value={settings.minIVRank}
                    onChange={(e) => onUpdateSettings({ ...settings, minIVRank: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">Delta 警戒上限</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={settings.maxDelta}
                    onChange={(e) => onUpdateSettings({ ...settings, maxDelta: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">正股價格變動幅度 (%)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.priceChangeThreshold * 100}
                    onChange={(e) => onUpdateSettings({ ...settings, priceChangeThreshold: parseFloat(e.target.value) / 100 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500">正股目標警報價 (HKD)</label>
                  <input 
                    type="number" 
                    value={settings.priceTargetAlert}
                    onChange={(e) => onUpdateSettings({ ...settings, priceTargetAlert: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <BellOff className="w-8 h-8 text-slate-800" />
            <p className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter">無作用中警報或系統通知</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {alerts.slice().reverse().map((alert) => (
              <div 
                key={alert.id} 
                onClick={() => onMarkAsRead(alert.id)}
                className={cn(
                  "p-4 transition-colors cursor-pointer group hover:bg-slate-800/30",
                  !alert.read ? "bg-emerald-500/5 border-l-2 border-emerald-500" : "opacity-60"
                )}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                    {alert.type === 'danger' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {alert.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 leading-tight">
                      {alert.message}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-1 font-mono uppercase">
                      {alert.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
