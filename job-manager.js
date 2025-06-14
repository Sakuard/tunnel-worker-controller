import express from 'express';
import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

// 載入環境變數
dotenv.config();
const BOT_TOKEN = process.env.TG_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = process.env.TG_CHAT_ID || 'YOUR_CHAT_ID_HERE';
const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || 'monitoring';

const app = express();
app.use(express.json());

// Job 快取系統
const jobCache = {
  url: null,
  timestamp: null
};
const CACHE_TTL = 60000; // 60 秒
let isCreatingJob = false;

// 嘗試多個可能的 Kubernetes API hostname
const K8S_HOSTS = [
  'kubernetes.default.svc.cluster.local',
  'kubernetes.default.svc', 
  'kubernetes.default',
  'kubernetes'
];

async function getKubernetesApiHost() {
  // 嘗試從環境變數取得
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return process.env.KUBERNETES_SERVICE_HOST;
  }
  
  // 如果沒有環境變數，使用預設值
  return 'kubernetes.default.svc.cluster.local';
}

// 修正模板字串問題並補上缺少的函數
async function getPodNameByJob(jobName) {
  return new Promise(async (resolve, reject) => {
    const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
    const caCert = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    
    const hostname = await getKubernetesApiHost();
    console.log(`嘗試連接 Kubernetes API: ${hostname}`);

    const options = {
      hostname: hostname,
      port: 443,
      path: `/api/v1/namespaces/${KUBE_NAMESPACE}/pods?labelSelector=job-name=${jobName}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ca: caCert,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.items && response.items.length > 0) {
            // 找到第一個 pod
            resolve(response.items[0].metadata.name);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('解析 Pod 資訊失敗:', error);
          reject(error);
        }
      });
    });

    req.on('error', (e) => {
      console.error('取得 Pod 名稱失敗:', e);
      reject(e);
    });

    req.end();
  });
}

async function getPodLogs(podName) {
  return new Promise(async (resolve, reject) => {
    const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
    const caCert = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    
    const hostname = await getKubernetesApiHost();
    console.log(`嘗試從 ${hostname} 取得 Pod logs`);

    const options = {
      hostname: hostname,
      port: 443,
      path: `/api/v1/namespaces/${KUBE_NAMESPACE}/pods/${podName}/log`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      ca: caCert,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('取得 Pod logs 失敗:', e);
      reject(e);
    });

    req.end();
  });
}

async function createJob() {
  return new Promise(async (resolve, reject) => {
    const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
    const caCert = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    
    const hostname = await getKubernetesApiHost();
    console.log(`嘗試在 ${hostname} 建立 Job`);

    const postData = JSON.stringify({
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: { name: "cf-job" },
      spec: {
        ttlSecondsAfterFinished: 10,
        template: {
          spec: {
            restartPolicy: "Never",
            imagePullSecrets: [
              { name: "regcred" }
            ],
            containers: [
              {
                name: "tunnel",
                image: "ghcr.io/sakuard/tunnel-worker-controller/tunnel:latest",
                command: ["/bin/sh", "-c"],
                args: ["cloudflared tunnel --url http://kube-prometheus-stack-grafana.monitoring.svc.cluster.local:80 & sleep 180;"],
                imagePullPolicy: "Always"
              }
            ]
          }
        }
      }
    });

    const options = {
      hostname: hostname,
      port: 443,
      path: `/apis/batch/v1/namespaces/${KUBE_NAMESPACE}/jobs`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      ca: caCert,
    };

    const req = https.request(options, (res) => {
      let data = '';

      console.log(`狀態碼: ${res.statusCode}`);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('回應資料:', data);
        if (res.statusCode === 201) {
          resolve(data);
        } else {
          reject(new Error(`Job 建立失敗，狀態碼: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`錯誤: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// 新增一個等待 Pod 準備好的函數
async function checkJobExists(jobName) {
  return new Promise(async (resolve, reject) => {
    const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
    const caCert = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    
    const hostname = await getKubernetesApiHost();
    console.log(`檢查 Job 是否存在: ${jobName}`);

    const options = {
      hostname: hostname,
      port: 443,
      path: `/apis/batch/v1/namespaces/${KUBE_NAMESPACE}/jobs/${jobName}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ca: caCert,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true); // Job 存在
        } else if (res.statusCode === 404) {
          resolve(false); // Job 不存在
        } else {
          reject(new Error(`檢查 Job 失敗，狀態碼: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error('檢查 Job 失敗:', e);
      reject(e);
    });

    req.end();
  });
}

async function waitForPodReady(jobName, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const podName = await getPodNameByJob(jobName);
      if (podName) {
        console.log(`找到 Pod: ${podName}`);
        return podName;
      }
    } catch (error) {
      console.log(`第 ${i + 1} 次嘗試找 Pod 失敗:`, error.message);
    }
    
    // 等待 2 秒後再試
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return null;
}

// app.post('/runjob', (req, res) => {
//   console.log(`Cloudflared tunnel 將在 3 秒後啟動`);
  
//   setTimeout(async() => {
//     try {
//       // 建立 Job
//       await createJob();
//       console.log('Job 建立成功，等待 Pod 啟動...');
      
//       // 等待 Pod 準備好
//       const podName = await waitForPodReady('cf-job');
//       if (!podName) {
//         res.status(500).json({ error: 'Cloudflared tunnel 啟動失敗：找不到 Pod' });
//         return;
//       }
      
//       // 等待 tunnel 完全啟動
//       console.log('Pod 已啟動，等待 tunnel 建立...');
//       await new Promise(r => setTimeout(r, 8000));
      
//       // 取得 logs
//       const logs = await getPodLogs(podName);
//       console.log('Pod logs:', logs);
      
//       // 從 logs 中提取 tunnel URL
//       const match = logs.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
//       if (!match) {
//         throw new Error('找不到 tunnel URL');
//       }

//       console.log(`找到 tunnel URL: ${match[0]}`);
//       res.status(200).json({ tunnelUrl: match[0] });
      
//     } catch (err) {
//       console.error('錯誤:', err);
//       res.status(500).json({ error: `Cloudflared tunnel 啟動失敗: ${err.message}` });
//     }
//   }, 3000);
// });

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, {polling: true});
console.log('Telegram Bot started...');
// Listen for any kind of message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const userName = msg.from.first_name || msg.from.username || 'Unknown';
  
  // Only process messages from the specified CHAT_ID
  if (chatId.toString() === CHAT_ID) {
    try {
      // 檢查快取是否有效
      if (jobCache.url && jobCache.timestamp && (Date.now() - jobCache.timestamp < CACHE_TTL)) {
        console.log('使用快取的 tunnel URL:', jobCache.url);
        bot.sendMessage(chatId, `Tunnel 已準備好: ${jobCache.url}`);
        return;
      }
      
      // 防止併發建立
      if (isCreatingJob) {
        bot.sendMessage(chatId, '正在建立 tunnel，請稍候...');
        return;
      }
      
      // 檢查 Job 是否已存在
      const jobExists = await checkJobExists('cf-job');
      if (jobExists) {
        console.log('Job 已存在，等待取得 URL...');
        bot.sendMessage(chatId, 'Tunnel 正在啟動中，請稍候...');
        
        // 等待現有 Job 的 Pod 準備好
        const podName = await waitForPodReady('cf-job');
        if (podName) {
          await new Promise(r => setTimeout(r, 8000));
          const logs = await getPodLogs(podName);
          const match = logs.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
          if (match) {
            jobCache.url = match[0];
            jobCache.timestamp = Date.now();
            bot.sendMessage(chatId, `Tunnel 已準備好: ${match[0]}`);
            return;
          }
        }
      }
      
      // 建立新 Job
      isCreatingJob = true;
      bot.sendMessage(chatId, '正在建立新的 tunnel...');
      
      setTimeout(async() => {
        try {
          // 建立 Job
          await createJob();
          console.log('Job 建立成功，等待 Pod 啟動...');
          
          // 等待 Pod 準備好
          const podName = await waitForPodReady('cf-job');
          if (!podName) {
            bot.sendMessage(chatId, 'Cloudflared tunnel 啟動失敗：找不到 Pod');
            return;
          }
          
          // 等待 tunnel 完全啟動
          console.log('Pod 已啟動，等待 tunnel 建立...');
          await new Promise(r => setTimeout(r, 8000));
          
          // 取得 logs
          const logs = await getPodLogs(podName);
          console.log('Pod logs:', logs);
          
          // 從 logs 中提取 tunnel URL
          const match = logs.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
          if (!match) {
            throw new Error('找不到 tunnel URL');
          }
    
          console.log(`找到 tunnel URL: ${match[0]}`);
          
          // 更新快取
          jobCache.url = match[0];
          jobCache.timestamp = Date.now();
          
          bot.sendMessage(chatId, `Tunnel 已準備好: ${match[0]}`);
          
        } catch (err) {
          console.error('錯誤:', err);
          bot.sendMessage(chatId, `Cloudflared tunnel 啟動失敗: ${err.message}`);
        } finally {
          isCreatingJob = false;
        }
      }, 1500);
      
    } catch (err) {
      console.error('處理訊息錯誤:', err);
      bot.sendMessage(chatId, '處理請求時發生錯誤');
      isCreatingJob = false;
    }
  }

});

// Handle bot errors
bot.on('error', (error) => {
  console.error('Bot error:', error);
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});