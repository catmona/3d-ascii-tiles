import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('layer-ui')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
