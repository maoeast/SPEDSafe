const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const Store = require('electron-store');
const licenseManager = require('./license-manager');

// 初始化学习记录存储
const learningStore = new Store({
    name: 'learning-history',
    defaults: {
        records: {},
        statistics: {
            totalViews: 0,
            totalLearningTime: 0,
            lastActiveDate: null
        }
    }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        },
        frame: true,
        icon: path.join(__dirname, 'icons/icon.ico'),
        show: false
    });

    // 开发模式加载Vite服务器，生产模式加载打包文件
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools(); // 开发时打开调试工具
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    // 禁用菜单栏
    mainWindow.setMenu(null);

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 禁用右键菜单（生产环境）
    mainWindow.webContents.on('context-menu', (e, params) => {
        if (app.isPackaged) {
            e.preventDefault();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // 注册 local 协议用于加载本地文件
    protocol.registerFileProtocol('local', (request, callback) => {
        let filePath = decodeURIComponent(request.url.replace('local://', ''));

        // 为.mdat文件设置正确的MIME类型，使其能被识别为视频
        let mimeType;
        if (filePath.endsWith('.mdat')) {
            mimeType = 'video/mp4';  // 强制识别为MP4视频
            console.log('🎬 加载.mdat视频文件:', path.basename(filePath));
        }

        callback({
            path: filePath,
            mimeType: mimeType
        });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC处理：加载资源列表
ipcMain.handle('load-resources', async () => {
    try {
        const resourcesPath = path.join(__dirname, 'src/resources.json');
        const data = fs.readFileSync(resourcesPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('加载资源列表失败:', error);
        return [];
    }
});

// IPC处理：获取视频文件路径
ipcMain.handle('get-video-path', async (event, filePath) => {
    try {
        // 处理路径，移除开头的斜杠
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

        // 开发模式直接返回相对路径
        if (!app.isPackaged) {
            const fullPath = path.join(__dirname, 'src', cleanPath);
            console.log('视频完整路径:', fullPath);
            return fullPath;
        }
        // 生产模式返回打包后的路径
        return path.join(process.resourcesPath, cleanPath);
    } catch (error) {
        console.error('获取视频路径失败:', error);
        return null;
    }
});

// IPC处理：读取视频文件为Buffer（用于后期扩展名伪装）
ipcMain.handle('read-video-file', async (event, filePath) => {
    try {
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        const fullPath = app.isPackaged
            ? path.join(process.resourcesPath, cleanPath)
            : path.join(__dirname, 'src', cleanPath);

        const buffer = fs.readFileSync(fullPath);
        return buffer;
    } catch (error) {
        console.error('读取视频文件失败:', error);
        return null;
    }
});

// IPC处理：获取H5资源路径
ipcMain.handle('get-h5-path', async (event, filePath) => {
    try {
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        const fullPath = app.isPackaged
            ? path.join(process.resourcesPath, cleanPath)
            : path.join(__dirname, 'src', cleanPath);

        return `file://${fullPath}`;
    } catch (error) {
        console.error('获取H5路径失败:', error);
        return null;
    }
});

// ===== 学习记录相关IPC处理 =====

// 获取学习记录
ipcMain.handle('get-learning-record', async (event, resourceId) => {
    const records = learningStore.get('records', {});
    return records[resourceId] || null;
});

// 获取所有学习记录
ipcMain.handle('get-all-learning-records', async () => {
    return learningStore.get('records', {});
});

// 保存学习记录
ipcMain.handle('save-learning-record', async (event, record) => {
    const records = learningStore.get('records', {});
    const { resourceId, isUpdate } = record;

    if (records[resourceId]) {
        // 更新现有记录
        if (!isUpdate) {
            // 不是更新操作，增加观看次数
            records[resourceId].viewCount++;
        }
        records[resourceId].totalDuration += record.duration || 0;
        records[resourceId].lastViewedAt = new Date().toISOString();
        records[resourceId].lastProgress = record.progress || 0;
    } else {
        // 创建新记录
        records[resourceId] = {
            resourceId,
            title: record.title,
            type: record.type,
            category: record.category,
            viewCount: 1,
            totalDuration: record.duration || 0,
            firstViewedAt: new Date().toISOString(),
            lastViewedAt: new Date().toISOString(),
            lastProgress: record.progress || 0
        };
    }

    learningStore.set('records', records);

    // 更新统计数据
    const stats = learningStore.get('statistics', {});
    if (!isUpdate) {
        // 不是更新操作，增加总观看次数
        stats.totalViews = (stats.totalViews || 0) + 1;
    }
    stats.totalLearningTime = (stats.totalLearningTime || 0) + (record.duration || 0);
    stats.lastActiveDate = new Date().toISOString().split('T')[0];
    learningStore.set('statistics', stats);

    console.log(`💾 保存学习记录: ${record.title}, 观看次数: ${records[resourceId].viewCount}, 时长: ${records[resourceId].totalDuration}秒`);

    return records[resourceId];
});

// 获取学习统计
ipcMain.handle('get-learning-statistics', async () => {
    return learningStore.get('statistics', {
        totalViews: 0,
        totalLearningTime: 0,
        lastActiveDate: null
    });
});

// 清空学习记录（用于测试）
ipcMain.handle('clear-learning-records', async () => {
    learningStore.set('records', {});
    learningStore.set('statistics', {
        totalViews: 0,
        totalLearningTime: 0,
        lastActiveDate: null
    });
    return true;
});

// ===== 激活系统相关IPC处理 =====

// 获取机器码
ipcMain.handle('get-machine-id', async () => {
    try {
        const machineId = licenseManager.getMachineFingerprint();
        console.log('📱 机器码:', machineId);
        return { success: true, machineId };
    } catch (error) {
        console.error('获取机器码失败:', error);
        return { success: false, message: error.message };
    }
});

// 验证激活码
ipcMain.handle('verify-license', async (event, licenseKey) => {
    try {
        console.log('🔐 验证激活码...');
        const result = licenseManager.verifyLicenseKey(licenseKey);
        console.log('验证结果:', result);
        return result;
    } catch (error) {
        console.error('验证激活码失败:', error);
        return { success: false, message: '验证失败: ' + error.message };
    }
});

// 获取激活状态
ipcMain.handle('get-activation-status', async () => {
    try {
        const status = licenseManager.getActivationStatus();
        console.log('📊 激活状态:', status.type, status.activated ? '已激活' : '未激活');
        return status;
    } catch (error) {
        console.error('获取激活状态失败:', error);
        return {
            activated: false,
            type: 'error',
            message: error.message,
            machineId: licenseManager.getMachineFingerprint()
        };
    }
});

// 重置激活状态（仅用于开发测试）
ipcMain.handle('reset-activation', async () => {
    try {
        if (!app.isPackaged) {
            const result = licenseManager.resetActivation();
            console.log('🔄 激活状态已重置（仅开发模式）');
            return result;
        } else {
            return { success: false, message: '生产环境不允许重置激活状态' };
        }
    } catch (error) {
        console.error('重置激活失败:', error);
        return { success: false, message: error.message };
    }
});
