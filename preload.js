const { contextBridge, ipcRenderer } = require('electron');

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
    resetActivation: () => ipcRenderer.invoke('reset-activation')
});
