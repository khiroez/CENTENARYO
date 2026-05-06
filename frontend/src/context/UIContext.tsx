"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, ShieldAlert } from 'lucide-react';

type ModalType = 'success' | 'error' | 'warning' | 'info' | 'security' | 'confirm';

interface UIModal {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

interface UIContextType {
    showModal: (type: ModalType, title: string, message: string) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
    hideModal: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<UIModal>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showModal = (type: ModalType, title: string, message: string) => {
        setModal({ isOpen: true, type, title, message });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm Action', cancelText = 'Cancel') => {
        setModal({ isOpen: true, type: 'confirm', title, message, onConfirm, confirmText, cancelText });
    };

    const hideModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleConfirm = () => {
        if (modal.onConfirm) modal.onConfirm();
        hideModal();
    };

    return (
        <UIContext.Provider value={{ showModal, showConfirm, hideModal }}>
            {children}
            
            {/* Global Modal Overlay */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={hideModal}></div>
                    <div className="bg-white rounded-[40px] shadow-2xl border border-white/20 w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`h-2 w-full ${
                            modal.type === 'success' ? 'bg-emerald-500' :
                            modal.type === 'error' ? 'bg-rose-500' :
                            modal.type === 'warning' ? 'bg-amber-500' :
                            modal.type === 'security' ? 'bg-indigo-600' : 
                            modal.type === 'confirm' ? 'bg-indigo-600' : 'bg-blue-500'
                        }`}></div>
                        
                        <div className="p-10 text-center">
                            <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-6 ${
                                modal.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                modal.type === 'error' ? 'bg-rose-50 text-rose-600' :
                                modal.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                modal.type === 'security' || modal.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                                {modal.type === 'success' && <CheckCircle size={40} strokeWidth={2.5} />}
                                {modal.type === 'error' && <AlertCircle size={40} strokeWidth={2.5} />}
                                {modal.type === 'warning' && <AlertCircle size={40} strokeWidth={2.5} />}
                                {modal.type === 'security' && <ShieldAlert size={40} strokeWidth={2.5} />}
                                {modal.type === 'confirm' && <ShieldAlert size={40} strokeWidth={2.5} />}
                                {modal.type === 'info' && <Info size={40} strokeWidth={2.5} />}
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">{modal.title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed px-2">{modal.message}</p>
                            
                            <div className="mt-10 space-y-3">
                                <button 
                                    onClick={modal.type === 'confirm' ? handleConfirm : hideModal}
                                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg transition-all hover:-translate-y-1 active:translate-y-0 ${
                                        modal.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-200' :
                                        modal.type === 'error' ? 'bg-rose-600 text-white shadow-rose-200' :
                                        modal.type === 'warning' ? 'bg-amber-600 text-white shadow-amber-200' :
                                        modal.type === 'security' || modal.type === 'confirm' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-900 text-white shadow-slate-200'
                                    }`}
                                >
                                    {modal.type === 'confirm' ? modal.confirmText : 'Understood'}
                                </button>
                                
                                {modal.type === 'confirm' && (
                                    <button 
                                        onClick={hideModal}
                                        className="w-full py-3 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-600 transition-colors"
                                    >
                                        {modal.cancelText}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
