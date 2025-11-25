const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
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

// 初始化应用配置存储
const appConfigStore = new Store({
    name: 'app-config',
    defaults: {
        appTitle: '特教安全教育资源仪',
        logoPath: 'logo.png',  // 相对于 userData 目录
        titleStyle: {
            fontSize: '36px',
            color: 'white'
        },
        headerBackground: 'linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5ed 100%)'
    }
});

let mainWindow;
let h5Server;  // 本地HTTP服务器
let h5ServerPort = 0;  // 服务器端口

// MIME类型映射
const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.hdat': 'text/html',  // .hdat识别为HTML
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

// 启动本地HTTP服务器（用于H5资源）
function startH5Server() {
    // 打包后从安装目录的 assets 文件夹读取
    // 开发时从 src/assets 读取
    const assetsPath = app.isPackaged
        ? path.join(path.dirname(app.getPath('exe')), 'assets')
        : path.join(__dirname, 'src', 'assets');

    h5Server = http.createServer((req, res) => {
        try {
            // 解析URL并移除查询参数
            const parsedUrl = url.parse(req.url);
            let filePath = decodeURIComponent(parsedUrl.pathname);

            // 移除开头的斜杠
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }

            // 构建完整文件路径
            const fullPath = path.join(assetsPath, filePath);

            // 检查文件是否存在
            if (!fs.existsSync(fullPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('文件未找到');
                return;
            }

            // 读取文件
            const fileContent = fs.readFileSync(fullPath);
            const mimeType = getMimeType(fullPath);

            // 设置响应头
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': fileContent.length,
                'Cache-Control': 'no-cache'
            });

            res.end(fileContent);
        } catch (error) {
            console.error('HTTP服务器错误:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('服务器内部错误');
        }
    });

    // 使用随机端口启动服务器
    h5Server.listen(0, 'localhost', () => {
        h5ServerPort = h5Server.address().port;
        console.log(`✅ H5资源服务器已启动: http://localhost:${h5ServerPort}`);
    });

    // 错误处理
    h5Server.on('error', (error) => {
        console.error('❌ H5服务器错误:', error);
    });
}

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
    // 启动H5资源服务器
    startH5Server();

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
    // 关闭HTTP服务器
    if (h5Server) {
        h5Server.close(() => {
            console.log('✅ H5资源服务器已关闭');
        });
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC处理：加载资源列表
ipcMain.handle('load-resources', async () => {
    try {
        const resourcesPath = app.isPackaged
            ? path.join(path.dirname(app.getPath('exe')), 'assets', 'resources.json')
            : path.join(__dirname, 'src/resources.json');
        const data = fs.readFileSync(resourcesPath, 'utf-8');
        console.log('📄 资源列表加载成功，共', JSON.parse(data).length, '个资源');
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
        // 生产模式从安装目录的 assets 读取
        return path.join(path.dirname(app.getPath('exe')), cleanPath);
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
            ? path.join(path.dirname(app.getPath('exe')), cleanPath)
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
        // 移除开头的斜杠
        let cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

        // 移除 'assets/' 前缀（因为HTTP服务器根目录就是 assets）
        if (cleanPath.startsWith('assets/')) {
            cleanPath = cleanPath.substring(7);  // 移除 'assets/'
        }

        // 返回HTTP服务器URL（支持 .html 和 .hdat）
        return `http://localhost:${h5ServerPort}/${cleanPath}`;
    } catch (error) {
        console.error('获取H5路径失败:', error);
        return null;
    }
});

// IPC处理：获取HTTP服务器端口（用于访问图片等资源）
ipcMain.handle('get-http-server-port', async () => {
    return h5ServerPort;
});

// IPC处理：获取封面图片路径
ipcMain.handle('get-cover-path', async (event, coverUrl) => {
    try {
        // 移除开头的斜杠
        let cleanPath = coverUrl.startsWith('/') ? coverUrl.substring(1) : coverUrl;
        // 移除 'assets/' 前缀（因为HTTP服务器根目录就是 assets）
        if (cleanPath.startsWith('assets/')) {
            cleanPath = cleanPath.substring(7);  // 移除 'assets/'
        }
        // 返回HTTP服务器URL
        return `http://localhost:${h5ServerPort}/${cleanPath}`;
    } catch (error) {
        console.error('获取封面路径失败:', error);
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

// ===== 应用配置相关IPC处理 =====

// 获取应用配置
ipcMain.handle('get-app-config', async () => {
    try {
        const config = {
            appTitle: appConfigStore.get('appTitle'),
            logoPath: appConfigStore.get('logoPath'),
            titleStyle: appConfigStore.get('titleStyle'),
            headerBackground: appConfigStore.get('headerBackground')
        };

        // 返回 logo 的完整路径
        if (config.logoPath === 'logo.png') {
            // 默认 logo：从 assets/icons 目录读取
            const defaultLogoPath = app.isPackaged
                ? path.join(path.dirname(app.getPath('exe')), 'assets', 'icons', 'logo.png')
                : path.join(__dirname, 'icons', 'logo.png');

            if (fs.existsSync(defaultLogoPath)) {
                config.logoFullPath = defaultLogoPath;
            }
        } else {
            // 自定义 logo：从 userData 目录读取
            const logoFullPath = path.join(app.getPath('userData'), config.logoPath);
            if (fs.existsSync(logoFullPath)) {
                config.logoFullPath = logoFullPath;
            }
        }

        return { success: true, config };
    } catch (error) {
        console.error('获取应用配置失败:', error);
        return { success: false, message: error.message };
    }
});

// 更新应用配置
ipcMain.handle('update-app-config', async (event, config) => {
    try {
        if (config.appTitle) {
            appConfigStore.set('appTitle', config.appTitle);
        }
        if (config.titleStyle) {
            appConfigStore.set('titleStyle', config.titleStyle);
        }
        if (config.headerBackground) {
            appConfigStore.set('headerBackground', config.headerBackground);
        }

        console.log('✅ 应用配置已更新');
        return { success: true };
    } catch (error) {
        console.error('更新应用配置失败:', error);
        return { success: false, message: error.message };
    }
});

// 上传Logo图片
ipcMain.handle('upload-logo', async (event, imageData) => {
    try {
        const userDataPath = app.getPath('userData');
        const logoPath = path.join(userDataPath, 'custom-logo.png');

        // 将base64图片数据保存为文件
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 检查文件大小（1MB = 1048576 bytes）
        if (buffer.length > 1048576) {
            return { success: false, message: '图片大小超过1MB，请选择更小的图片' };
        }

        fs.writeFileSync(logoPath, buffer);
        appConfigStore.set('logoPath', 'custom-logo.png');

        console.log('✅ Logo图片已上传:', logoPath);
        return { success: true, logoPath: logoPath };
    } catch (error) {
        console.error('上传Logo失败:', error);
        return { success: false, message: error.message };
    }
});

// 重置为默认Logo
ipcMain.handle('reset-logo', async () => {
    try {
        appConfigStore.set('logoPath', 'logo.png');
        console.log('✅ Logo已重置为默认');
        return { success: true };
    } catch (error) {
        console.error('重置Logo失败:', error);
        return { success: false, message: error.message };
    }
});

// 验证管理员密码
ipcMain.handle('verify-admin-password', async (event, password) => {
    const correctPassword = '299451';
    return { success: password === correctPassword };
});
