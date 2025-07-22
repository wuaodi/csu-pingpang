const simpleSync = require('../../utils/simpleSync');

Page({
  data: {
    lastSyncTime: '从未同步',
    userCount: 0,
    gameCount: 0
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  // 加载数据
  loadData() {
    const users = wx.getStorageSync('allUsers') || [];
    const games = wx.getStorageSync('allGames') || [];
    const lastSync = wx.getStorageSync('lastSyncTime');

    this.setData({
      userCount: users.length,
      gameCount: games.length,
      lastSyncTime: this.formatSyncTime(lastSync)
    });
  },

  // 格式化同步时间
  formatSyncTime(timestamp) {
    if (!timestamp) return '从未同步';
    
    const syncDate = new Date(timestamp);
    const now = new Date();
    const diff = now - syncDate;
    
    if (diff < 60000) return '刚刚同步';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    
    return syncDate.toLocaleDateString();
  },

  // 执行同步
  async performSync() {
    wx.showLoading({ title: '正在同步...' });
    
    try {
      const success = await simpleSync.fullSync();
      
      wx.hideLoading();
      
      if (success) {
        this.loadData(); // 刷新数据显示
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '同步失败',
        icon: 'none'
      });
    }
  },

  // 导出所有数据
  exportAllData() {
    try {
      const users = wx.getStorageSync('allUsers') || [];
      const games = wx.getStorageSync('allGames') || [];
      
      const exportData = {
        users: users,
        games: games,
        exportTime: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      
      wx.setClipboardData({
        data: dataStr,
        success: () => {
          wx.showModal({
            title: '导出成功',
            content: '数据已复制到剪贴板，可以分享到其他设备导入',
            showCancel: false
          });
        }
      });
    } catch (error) {
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '此操作将删除所有本地数据，包括用户信息和比赛记录，是否继续？',
      confirmText: '确认清空',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('allUsers');
            wx.removeStorageSync('allGames');
            wx.removeStorageSync('lastSyncTime');
            
            this.loadData();
            
            wx.showToast({
              title: '已清空数据',
              icon: 'success'
            });
          } catch (error) {
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
}); 