const { contextBridge, ipcRenderer } = require('electron');

const childSafetyListeners = new WeakMap();
const CHILD_SAFETY_EVENT_CHANNEL = 'child-safety:event';

function stringValue(value) {
    return typeof value === 'string' ? value : '';
}

// 通过contextBridge暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 加载资源列表
    loadResources: () => ipcRenderer.invoke('load-resources'),

    // 获取视频路径
    getVideoPath: (filePath) => ipcRenderer.invoke('get-video-path', filePath),

    // 读取视频文件
    readVideoFile: (filePath) => ipcRenderer.invoke('read-video-file', filePath),

    // 获取H5资源路径
    getH5Path: (filePath) => ipcRenderer.invoke('get-h5-path', filePath),

    // 获取HTTP服务器端口
    getHttpServerPort: () => ipcRenderer.invoke('get-http-server-port'),

    // 获取封面图片路径
    getCoverPath: (coverUrl) => ipcRenderer.invoke('get-cover-path', coverUrl),

    // 学习记录相关API
    getLearningRecord: (resourceId) => ipcRenderer.invoke('get-learning-record', resourceId),
    getAllLearningRecords: () => ipcRenderer.invoke('get-all-learning-records'),
    saveLearningRecord: (record) => ipcRenderer.invoke('save-learning-record', record),
    getLearningStatistics: () => ipcRenderer.invoke('get-learning-statistics'),
    clearLearningRecords: () => ipcRenderer.invoke('clear-learning-records'),

    // 激活系统API
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    verifyLicense: (licenseKey) => ipcRenderer.invoke('verify-license', licenseKey),
    getActivationStatus: () => ipcRenderer.invoke('get-activation-status'),
    resetActivation: () => ipcRenderer.invoke('reset-activation'),

    // 应用配置API
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (config) => ipcRenderer.invoke('update-app-config', config),
    uploadLogo: (imageData) => ipcRenderer.invoke('upload-logo', imageData),
    resetLogo: () => ipcRenderer.invoke('reset-logo'),
    verifyAdminPassword: (password) => ipcRenderer.invoke('verify-admin-password', password),

    // 激活文件导入（.lic）
    importLicenseFile: () => ipcRenderer.invoke('import-license-file'),

    childSafetyAssistant: {
        getStatus: () => ipcRenderer.invoke('child-safety:get-status'),
        saveConfig: (input = {}) => ipcRenderer.invoke('child-safety:save-config', {
            apiKey: stringValue(input.apiKey),
            modelId: stringValue(input.modelId)
        }),
        clearApiKey: () => ipcRenderer.invoke('child-safety:clear-api-key'),
        listSessions: () => ipcRenderer.invoke('child-safety:list-sessions'),
        createSession: () => ipcRenderer.invoke('child-safety:create-session', {}),
        getSession: (sessionId) => ipcRenderer.invoke('child-safety:get-session', {
            sessionId: stringValue(sessionId)
        }),
        deleteSession: (sessionId) => ipcRenderer.invoke('child-safety:delete-session', {
            sessionId: stringValue(sessionId)
        }),
        clearHistory: () => ipcRenderer.invoke('child-safety:clear-history'),
        sendMessage: (input = {}) => ipcRenderer.invoke('child-safety:send-message', {
            sessionId: stringValue(input.sessionId),
            content: stringValue(input.content),
            requestId: stringValue(input.requestId)
        }),
        stopGeneration: (requestId) => ipcRenderer.invoke('child-safety:stop-generation', {
            requestId: stringValue(requestId)
        }),
        editAndResend: (input = {}) => ipcRenderer.invoke('child-safety:edit-and-resend', {
            sessionId: stringValue(input.sessionId),
            messageId: stringValue(input.messageId),
            content: stringValue(input.content),
            requestId: stringValue(input.requestId)
        }),
        regenerate: (input = {}) => ipcRenderer.invoke('child-safety:regenerate', {
            sessionId: stringValue(input.sessionId),
            messageId: stringValue(input.messageId),
            requestId: stringValue(input.requestId)
        }),
        onEvent: (callback) => {
            if (typeof callback !== 'function') {
                return;
            }
            const previous = childSafetyListeners.get(callback);
            if (previous) {
                ipcRenderer.removeListener(CHILD_SAFETY_EVENT_CHANNEL, previous);
            }
            const listener = (_event, payload) => callback(payload);
            childSafetyListeners.set(callback, listener);
            ipcRenderer.on(CHILD_SAFETY_EVENT_CHANNEL, listener);
        },
        offEvent: (callback) => {
            const listener = childSafetyListeners.get(callback);
            if (listener) {
                ipcRenderer.removeListener(CHILD_SAFETY_EVENT_CHANNEL, listener);
                childSafetyListeners.delete(callback);
            }
        }
    }
});
