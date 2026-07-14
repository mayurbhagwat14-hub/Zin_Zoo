import React, { useState, useEffect } from 'react'
import AppRoutes from './routes'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  if (showSplash) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <img 
          src={`/Zin_ZOO_X_Design.png?v=${Date.now()}`} 
          alt="Zin Zoo X" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
    )
  }

  return <AppRoutes />
}

export default App
