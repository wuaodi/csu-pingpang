const autoSync = require('../../utils/autoSync');

Page({
  data: {
    players: [],
    showModal: false,
    newPlayerName: '',
    loading: false
  },

  onLoad() {
    this.loadPlayersFromLocal();
  },

  onShow() {
    this.loadPlayersFromLocal();
  },

  // 从本地加载选手列表
  loadPlayersFromLocal() {
    const players = wx.getStorageSync('players') || [];
    this.setData({ players: players });
  },

  // 从远程加载选手列表（仅在手动刷新时调用）
  async loadPlayersFromRemote() {
    try {
      this.setData({ loading: true });
      const players = await autoSync.loadPlayersFromRemote();
      
      this.setData({ 
        players: players,
        loading: false 
      });
    } catch (error) {
      console.error('加载选手数据失败:', error);
      this.setData({ loading: false });
      
      // 如果远程加载失败，尝试使用本地数据
      this.loadPlayersFromLocal();
    }
  },

  // 显示添加选手弹窗
  showAddModal() {
    this.setData({ 
      showModal: true,
      newPlayerName: ''
    });
  },

  // 隐藏添加选手弹窗
  hideAddModal() {
    this.setData({ 
      showModal: false,
      newPlayerName: ''
    });
  },

  // 输入选手姓名
  onPlayerNameInput(e) {
    const value = e.detail.value || '';
    this.setData({
      newPlayerName: value
    });
  },

  // 添加选手（直接操作远程）
  async addPlayer() {
    const newPlayerName = (this.data.newPlayerName || '').trim();
    
    if (!newPlayerName) {
      wx.showToast({
        title: '请输入选手姓名',
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ loading: true });
      
      // 直接在远程添加选手
      await autoSync.addPlayer(newPlayerName);

      this.setData({
        showModal: false,
        newPlayerName: '',
        loading: false
      });

      // 重新从远程加载数据
      await this.loadPlayersFromRemote();

      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ loading: false });
      
      if (error.message === '选手已存在') {
        wx.showToast({
          title: '选手已存在',
          icon: 'none'
        });
      } else {
        console.error('添加选手失败:', error);
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        });
      }
    }
  },

  // 删除选手（直接操作远程）
  async deletePlayer(e) {
    const playerId = e.currentTarget.dataset.id;
    const player = this.data.players.find(p => p.id === playerId);
    
    if (!player) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选手"${player.name}"吗？`,
      confirmText: '删除',
      confirmColor: '#ff4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ loading: true });
            
            // 直接在远程删除选手
            await autoSync.deletePlayer(playerId);
            
            this.setData({ loading: false });
            
            // 重新从远程加载数据
            await this.loadPlayersFromRemote();

            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
          } catch (error) {
            this.setData({ loading: false });
            console.error('删除选手失败:', error);
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 手动刷新数据
  async onRefresh() {
    try {
      wx.showLoading({ title: '刷新中...' });
      
      // 重新计算选手统计
      await autoSync.recalculatePlayerStats();
      
      // 重新加载数据
      await this.loadPlayersFromRemote();
      
      wx.hideLoading();
      wx.showToast({
        title: '刷新完成',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败，请重试',
        icon: 'none'
      });
    }
  }
}); 