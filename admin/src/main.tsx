import { StyleProvider } from '@ant-design/cssinjs';
import { App as AntApp, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App';
import { AuthProvider } from './auth';
import { oofooTheme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider hashPriority="high">
      <ConfigProvider theme={oofooTheme} locale={thTH}>
        <AntApp>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
