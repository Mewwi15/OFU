import { StyleProvider } from '@ant-design/cssinjs';
import { App as AntApp, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App';
import { AuthProvider } from './auth';
import { purgeStaleCaches } from './lib/purgeStaleCaches';
import { oofooTheme } from './theme';

/* ล้าง service worker/แคชรุ่นเก่าที่ค้างอยู่ในเครื่อง — ยิงทันทีที่โค้ดชุดใหม่เริ่มทำงาน
   ก่อนวาดหน้าจอด้วยซ้ำ เครื่องที่ค้างรุ่นเก่าจะสะอาดในการเปิดรอบเดียว */
void purgeStaleCaches();

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
