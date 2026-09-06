"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, Gift, FileWarning, CheckCircle, TrendingDown, ShieldAlert } from 'lucide-react';

export type NotificationType = 'ML_FLAG' | 'MILESTONE' | 'DOCUMENT' | 'PAYROLL' | 'SECURITY' | 'BUDGET';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    description: string;
    time: string;
    link: string;
    isRead: boolean;
    targetId?: string | number; // For highlighting
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notif: Omit<Notification, 'id' | 'time' | 'isRead'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Initialize from localStorage or fallback
    useEffect(() => {
        try {
            const saved = localStorage.getItem('centenaryo_notifications');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setNotifications(parsed);
                    return;
                }
            }
        } catch (e) {
            console.warn("Could not read notifications from storage:", e);
        }

        const initialNotifs: Notification[] = [
            {
                id: '1',
                type: 'ML_FLAG',
                title: 'AI Anomaly Detected',
                description: "AI detected a potential duplicate record in Brgy. San Jose.",
                time: 'Just now',
                link: '/anomalies',
                isRead: false,
                targetId: 'flag-101'
            }
        ];
        setNotifications(initialNotifs);
    }, []);

    // Sync across browser tabs in real time
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'centenaryo_notifications' && e.newValue) {
                try {
                    const updated = JSON.parse(e.newValue);
                    if (Array.isArray(updated)) {
                        setNotifications(updated);
                    }
                } catch (err) {
                    console.warn("Storage sync parse error:", err);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const saveNotifs = (newNotifs: Notification[]) => {
        setNotifications(newNotifs);
        try {
            localStorage.setItem('centenaryo_notifications', JSON.stringify(newNotifs));
        } catch (e) {
            console.warn("Could not persist notifications:", e);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const addNotification = (notif: Omit<Notification, 'id' | 'time' | 'isRead'>) => {
        const newNotif: Notification = {
            ...notif,
            id: Date.now().toString(),
            time: 'Just now',
            isRead: false
        };
        const updated = [newNotif, ...notifications];
        saveNotifs(updated);
    };

    const markAsRead = (id: string) => {
        const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
        saveNotifs(updated);
    };

    const markAllAsRead = () => {
        const updated = notifications.map(n => ({ ...n, isRead: true }));
        saveNotifs(updated);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
