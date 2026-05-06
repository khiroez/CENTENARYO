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

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Load initial mock data but structure it to be dynamic
    useEffect(() => {
        // In a real app, this would fetch from /api/notifications/
        const initialNotifs: Notification[] = [
            {
                id: '1',
                type: 'ML_FLAG',
                title: 'AI Anomaly Detected',
                description: "AI detected a potential fraud attempt in Brgy. San Jose.",
                time: 'Just now',
                link: '/anomalies',
                isRead: false,
                targetId: 'flag-101'
            }
        ];
        setNotifications(initialNotifs);
    }, []);

    const addNotification = (notif: Omit<Notification, 'id' | 'time' | 'isRead'>) => {
        const newNotif: Notification = {
            ...notif,
            id: Date.now().toString(),
            time: 'Just now',
            isRead: false
        };
        setNotifications(prev => [newNotif, ...prev]);
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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
