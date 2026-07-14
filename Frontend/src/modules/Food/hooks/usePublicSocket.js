import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (() => {
    const base = import.meta.env?.VITE_API_BASE_URL || '';
    if (base) {
        // Remove /api/v1 or /api to get the root server URL
        return base.replace(/\/api(\/v\d+)?$/i, '');
    }
    // Fallback: same origin (works with Vite proxy or localhost)
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
})();

/**
 * Hook that connects to the /public socket namespace (no auth required)
 * and listens for real-time admin updates.
 * 
 * @param {Object} listeners - Map of event names to callback functions
 * Example:
 *   usePublicSocket({
 *     'grocery:category:update': () => refetchCategories(),
 *     'grocery:product:update': () => refetchProducts(),
 *     'banner:update': (data) => { if (data.section === 'grocery') refetchBanners(); }
 *   });
 */
export function usePublicSocket(listeners = {}) {
    const socketRef = useRef(null);
    const listenersRef = useRef(listeners);

    // Keep listeners ref up to date without reconnecting
    useEffect(() => {
        listenersRef.current = listeners;
    }, [listeners]);

    useEffect(() => {
        // Connect to public namespace (no auth token needed)
        const socket = io(`${SOCKET_URL}/public`, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[PublicSocket] Connected:', socket.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[PublicSocket] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.warn('[PublicSocket] Connection error:', err.message);
        });

        // Register all event listeners
        const eventNames = Object.keys(listenersRef.current);
        const handler = (eventName) => (data) => {
            if (listenersRef.current[eventName]) {
                listenersRef.current[eventName](data);
            }
        };

        const handlers = {};
        eventNames.forEach((eventName) => {
            handlers[eventName] = handler(eventName);
            socket.on(eventName, handlers[eventName]);
        });

        return () => {
            // Cleanup
            eventNames.forEach((eventName) => {
                socket.off(eventName, handlers[eventName]);
            });
            socket.disconnect();
            socketRef.current = null;
        };
    }, []); // Only connect once on mount

    return socketRef;
}
