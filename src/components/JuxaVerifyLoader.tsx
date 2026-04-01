import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface JuxaVerifyLoaderProps {
  text?: string;
  progress?: number;
}

export function JuxaVerifyLoader({ text = 'Procesando...', progress }: JuxaVerifyLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20"
        />
        <div className="relative flex items-center justify-center w-24 h-24 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-100">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-blue-600 border-r-blue-400 opacity-50"
          />
          <ShieldCheck className="w-12 h-12 text-blue-600" />
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          JUXA <span className="text-blue-600">VERIFY</span>
        </h3>
        <motion.p 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          {text}
        </motion.p>
      </div>

      {typeof progress === 'number' && (
        <div className="w-full max-w-xs space-y-2">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <motion.div 
              className="bg-blue-600 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-right">{progress}%</p>
        </div>
      )}
    </div>
  );
}
