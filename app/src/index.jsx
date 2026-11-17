import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { installWakeLock } from './lib/native';

installWakeLock();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
